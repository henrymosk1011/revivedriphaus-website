import * as THREE from 'three';
import { Molecules } from './Molecules.js';
import { pointFrag } from './glsl.js';
import { rng } from './util.js';

export const FLUID_ORIGIN = new THREE.Vector3(0, -500, 0);
export const FLUID_DEPTH = 150;

// Inside the IV fluid: light shafts from above, rising bubbles, suspended
// glints and the vitamin and mineral molecules that make up each drip.
export class FluidWorld {
  constructor({ quality = 'high' } = {}) {
    const low = quality === 'low';
    this.group = new THREE.Group();
    this.group.position.copy(FLUID_ORIGIN);
    this.uniforms = { uTime: { value: 0 }, uPixelRatio: { value: 1 } };

    // Bubbles: clear spheres with a soap-film sheen.
    const rand = rng(909);
    const nB = low ? 70 : 150;
    this.bubbleData = Array.from({ length: nB }, () => ({
      x: (rand() - 0.5) * 30,
      z: 6 - rand() * FLUID_DEPTH,
      s: 0.09 + Math.pow(rand(), 3) * 0.4,
      speed: 0.4 + rand() * 1.2,
      ph: rand() * 100,
    }));
    this.bubbles = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 3),
      new THREE.MeshPhysicalMaterial({
        color: '#e9fff2',
        roughness: 0.03,
        transparent: true,
        opacity: 0.32,
        iridescence: 1,
        iridescenceIOR: 1.33,
        envMapIntensity: 2.4,
        clearcoat: 1,
        depthWrite: false,
      }),
      nB
    );
    this.bubbles.frustumCulled = false;
    this.group.add(this.bubbles);

    // Suspended glints.
    const nP = low ? 1500 : 3200;
    const pos = new Float32Array(nP * 3);
    const seed = new Float32Array(nP);
    for (let i = 0; i < nP; i++) {
      pos.set([(rand() - 0.5) * 40, (rand() - 0.5) * 24, 10 - rand() * (FLUID_DEPTH + 20)], i * 3);
      seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const pts = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform float uTime, uPixelRatio;
          attribute float aSeed;
          varying float vA;
          void main(){
            vec3 p = position;
            p.y += mod(uTime * (0.1 + aSeed * 0.3) + aSeed * 24.0, 24.0) - 12.0;
            p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.4;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            float d = max(-mv.z, 0.1);
            gl_PointSize = uPixelRatio * (6.0 + aSeed * 22.0) / d;
            vA = (0.35 + 0.65 * aSeed) * smoothstep(0.5, 3.0, d) * smoothstep(80.0, 20.0, d);
          }`,
        fragmentShader: /* glsl */ `
          varying float vA;
          ${pointFrag}
          void main(){
            gl_FragColor = vec4(vec3(0.75, 1.0, 0.85) * 1.2, softDot(gl_PointCoord) * vA);
          }`,
      })
    );
    pts.frustumCulled = false;
    this.group.add(pts);

    // The formula: pearl, mint and lime molecules.
    this.molecules = new Molecules({
      center: new THREE.Vector3(0, 0, -12),
      count: low ? 7 : 11,
      spread: [26, 12, 120],
      palette: { C: '#cfeedd', O: '#6fdca0', N: '#c2f25a', H: '#eefaf3', S: '#f2cf63' },
      glow: 0.06,
      bondColor: '#e6f5ec',
    });
    this.group.add(this.molecules.group);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  update(time, pixelRatio, { assemble = 1 } = {}) {
    this.uniforms.uTime.value = time;
    this.uniforms.uPixelRatio.value = pixelRatio;
    for (let i = 0; i < this.bubbleData.length; i++) {
      const b = this.bubbleData[i];
      const y = ((time * b.speed + b.ph) % 26) - 13;
      this._v.set(b.x + Math.sin(time * 1.3 + b.ph) * 0.3 * b.s * 4, y, b.z);
      this._s.set(b.s, b.s * (0.92 + 0.08 * Math.sin(time * 6 + b.ph)), b.s);
      this._m.compose(this._v, this._q, this._s);
      this.bubbles.setMatrixAt(i, this._m);
    }
    this.bubbles.instanceMatrix.needsUpdate = true;
    this.molecules.update(time, { assemble });
  }
}
