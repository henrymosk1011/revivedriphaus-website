import * as THREE from 'three';
import { snoise, pointFrag } from './glsl.js';
import { rng } from './util.js';

// "Revive": thousands of particles stream in and assemble into a luminous
// sphere around a re-formed drop. It breathes gently through the finale.
export class Orb {
  constructor({ center, radius = 6, count = 14000 } = {}) {
    this.group = new THREE.Group();
    this.group.position.copy(center);
    this.radius = radius;
    const rand = rng(31337);

    const start = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      // Fibonacci sphere, with a thin shell and a few outliers (aura).
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const shell = radius * (rand() < 0.88 ? 1 + (rand() - 0.5) * 0.06 : 1.15 + rand() * 0.6);
      target.set([Math.cos(th) * r * shell, y * shell, Math.sin(th) * r * shell], i * 3);
      // Start scattered along the approach, behind the camera's path.
      start.set(
        [(rand() - 0.5) * 70, (rand() - 0.5) * 36, 20 + rand() * 150],
        i * 3
      );
      seed[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(target, 3));
    geo.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.uniforms = {
      uTime: { value: 0 },
      uMorph: { value: 0 },
      uBreath: { value: 0 },
      uPixelRatio: { value: 1 },
      uAmt: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uMorph, uBreath, uPixelRatio;
        attribute vec3 aStart;
        attribute float aSeed;
        varying float vSeed;
        varying float vA;
        ${snoise}
        mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
        void main(){
          float delay = aSeed * 0.45;
          float m = clamp((uMorph - delay) / 0.55, 0.0, 1.0);
          m = m * m * (3.0 - 2.0 * m);
          vec3 tgt = rotY(uTime * 0.06 + aSeed * 0.02) * position;
          float wob = snoise(tgt * 0.22 + uTime * 0.25);
          tgt *= 1.0 + wob * 0.05 + uBreath * 0.04 * sin(uTime * 1.2 + aSeed * 6.0);
          vec3 swirl = vec3(
            snoise(aStart * 0.05 + uTime * 0.1),
            snoise(aStart * 0.05 + 11.0 + uTime * 0.1),
            snoise(aStart * 0.05 + 23.0 + uTime * 0.1)) * 6.0;
          vec3 p = mix(aStart + swirl, tgt, m);
          // arc in towards the sphere rather than flying straight
          p += normalize(tgt + 0.001) * sin(m * 3.14159) * 6.0 * (1.0 - aSeed * 0.5);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = max(-mv.z, 0.01);
          gl_PointSize = uPixelRatio * (9.0 + aSeed * 30.0) * (0.55 + 0.45 * m) / dist;
          vA = smoothstep(0.0, 0.2, uMorph) * (0.4 + 0.6 * m) * smoothstep(0.3, 3.0, dist);
          vSeed = aSeed;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAmt;
        varying float vSeed;
        varying float vA;
        ${pointFrag}
        void main(){
          float a = softDot(gl_PointCoord);
          vec3 col = mix(vec3(0.3, 1.0, 0.6), vec3(0.85, 1.0, 0.5), smoothstep(0.55, 1.0, vSeed));
          col = mix(col, vec3(1.0), step(0.93, vSeed));
          gl_FragColor = vec4(col * 1.7, a * vA * uAmt);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    // Atmosphere: a fresnel shell that glows at the silhouette.
    this.shell = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.04, 64, 32),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uMorph, uAmt; varying vec3 vN; varying vec3 vV;
          void main(){
            float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.6);
            vec3 c = vec3(0.25, 1.0, 0.55) * f * 1.3 * smoothstep(0.55, 1.0, uMorph);
            gl_FragColor = vec4(c * uAmt, 1.0);
          }`,
      })
    );
    this.group.add(this.shell);
  }

  update(time, pixelRatio, { morph, breath = 1, amount = 1 }) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uMorph.value = morph;
    u.uBreath.value = breath;
    u.uPixelRatio.value = pixelRatio;
    u.uAmt.value = amount;
    this.shell.visible = morph > 0.5;
  }
}
