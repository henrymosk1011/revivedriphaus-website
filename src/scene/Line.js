import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { plasticMaterial, TUBE_START } from './IVBag.js';
import { hash } from './glsl.js';
import { rng } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// The IV line: a clear tube that falls from the drip chamber and loops
// through space. Green fluid fills it as you scroll.
export class Line {
  constructor({ quality = 'high' } = {}) {
    const low = quality === 'low';
    this.group = new THREE.Group();
    this.curve = new THREE.CatmullRomCurve3(
      [
        TUBE_START.clone(),
        V(0, -4.4, 0),
        V(0.2, -5.6, 0.3),
        V(1.6, -7.0, -0.4),
        V(2.4, -8.4, -1.8),
        V(1.0, -9.6, -3.0),
        V(-1.2, -10.2, -2.4),
        V(-2.4, -11.4, -0.6),
        V(-1.6, -12.8, 1.2),
        V(0.6, -13.8, 1.4),
        V(2.4, -15.2, 0.2),
        V(2.0, -16.8, -1.8),
        V(0.0, -18.0, -2.6),
        V(-2.0, -19.2, -1.4),
        V(-2.2, -20.8, 0.8),
        V(-0.4, -22.0, 1.8),
        V(1.2, -23.4, 1.0),
        V(1.0, -25.0, -0.6),
        V(0.2, -26.6, -1.6),
        V(-1.0, -28.2, -1.0),
        V(-1.4, -30.0, 0.4),
        V(-0.6, -32.0, 1.4),
      ],
      false,
      'centripetal'
    );
    const segs = low ? 900 : 1600;

    this.uniforms = { uTime: { value: 0 }, uFill: { value: 0 }, uLight: { value: new THREE.Vector3(0.3, 1, 0.6).normalize() } };

    // Fluid inside the tube.
    const fluid = new THREE.Mesh(
      new THREE.TubeGeometry(this.curve, segs, 0.058, 16, false),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vN;
          varying vec3 vV;
          void main(){
            vUv = uv;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uFill;
          varying vec2 vUv;
          varying vec3 vN;
          varying vec3 vV;
          ${hash}
          void main(){
            float x = vUv.x;
            if (x > uFill) discard;
            float facing = abs(dot(normalize(vN), normalize(vV)));
            vec3 deep = vec3(0.004, 0.07, 0.03);
            vec3 bright = vec3(0.04, 0.36, 0.15);
            vec3 col = mix(deep, bright, pow(facing, 1.6));
            // flow streaks and bubbles carried along the line
            float s = x * 900.0 - uTime * 6.0;
            float cell = floor(s / 9.0);
            float local = fract(s / 9.0);
            float has = step(0.72, hash11(cell * 1.37));
            float bub = has * smoothstep(0.5, 0.42, abs(local - 0.5) * 2.0) * smoothstep(0.35, 0.95, facing);
            col = mix(col, vec3(0.75, 0.95, 0.82), bub * 0.6);
            col += vec3(0.2, 0.6, 0.35) * 0.04 * sin(s * 0.7);
            // a crisp specular stripe along the tube
            col += vec3(1.0) * pow(facing, 18.0) * 0.12;
            // soft meniscus at the leading edge
            col = mix(col, vec3(0.75, 1.0, 0.85), smoothstep(uFill - 0.002, uFill, x) * 0.6);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      })
    );
    fluid.frustumCulled = false;
    this.group.add(fluid);

    // The clear plastic tube around it.
    const tube = new THREE.Mesh(new THREE.TubeGeometry(this.curve, segs, 0.085, 20, false), plasticMaterial({ opacity: 0.9 }));
    tube.frustumCulled = false;
    tube.renderOrder = 3;
    this.group.add(tube);

    const white = new THREE.MeshPhysicalMaterial({ color: '#f3f6f4', roughness: 0.3, clearcoat: 0.5, envMapIntensity: 1.15 });
    const green = new THREE.MeshPhysicalMaterial({ color: '#116935', roughness: 0.28, clearcoat: 0.7, envMapIntensity: 1.15 });
    const frameAt = (t) => {
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), tan);
      return { p, q, tan };
    };

    // Roller clamp: the flow regulator every IV line has.
    {
      const { p, q } = frameAt(0.52);
      const clamp = new THREE.Group();
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.95, 0.3, 4, 0.06), white);
      body.position.x = 0.06;
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 40), green);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0.17, 0.08, 0);
      const ridges = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 60), green);
      ridges.rotation.y = Math.PI / 2;
      ridges.position.copy(wheel.position);
      clamp.add(body, wheel, ridges);
      clamp.position.copy(p);
      clamp.quaternion.copy(q);
      this.group.add(clamp);
      this.clamp = clamp;
    }

    // Y-site injection port.
    {
      const { p, q } = frameAt(0.3);
      const y = new THREE.Group();
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 24), white);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.42, 20), white);
      arm.rotation.z = -0.6;
      arm.position.set(0.14, 0.22, 0);
      const capY = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.12, 24), green);
      capY.rotation.z = -0.6;
      capY.position.set(0.27, 0.4, 0);
      y.add(sleeve, arm, capY);
      y.position.copy(p);
      y.quaternion.copy(q);
      this.group.add(y);
    }

    this.buildBokeh(low ? 60 : 120);
  }

  // Soft out-of-focus specks that give the bright void some depth.
  buildBokeh(count) {
    const rand = rng(3);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos.set([(rand() - 0.5) * 16, -2 - rand() * 26, (rand() - 0.5) * 14 - 2], i * 3);
      seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.bokehUniforms = { uTime: this.uniforms.uTime, uPixelRatio: { value: 1 } };
    const pts = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.bokehUniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          uniform float uTime, uPixelRatio;
          attribute float aSeed;
          varying float vSeed;
          varying float vD;
          void main(){
            vec3 p = position;
            p.y += sin(uTime * 0.2 + aSeed * 30.0) * 0.3;
            p.x += cos(uTime * 0.15 + aSeed * 20.0) * 0.3;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            vD = -mv.z;
            gl_PointSize = uPixelRatio * (30.0 + aSeed * 90.0) / max(vD, 0.5);
            vSeed = aSeed;
          }`,
        fragmentShader: /* glsl */ `
          varying float vSeed;
          varying float vD;
          void main(){
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float disc = smoothstep(1.0, 0.82, d) * (0.55 + 0.45 * smoothstep(0.6, 0.95, d));
            vec3 col = mix(vec3(1.0), vec3(0.62, 0.92, 0.74), step(0.6, vSeed));
            gl_FragColor = vec4(col, disc * 0.28 * smoothstep(0.6, 3.0, vD));
          }`,
      })
    );
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  update(time, pixelRatio, { fill }) {
    this.uniforms.uTime.value = time;
    this.uniforms.uFill.value = fill;
    this.bokehUniforms.uPixelRatio.value = pixelRatio;
  }
}
