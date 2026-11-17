import * as THREE from 'three';
import { pointFrag } from './glsl.js';

// Luminous motes that wrap around the camera, so there is always depth and a
// sense of motion wherever the film travels.
export class Dust {
  constructor({ count = 1800, box = 46 } = {}) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * box;
      pos[i * 3 + 1] = (Math.random() - 0.5) * box;
      pos[i * 3 + 2] = (Math.random() - 0.5) * box;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.uniforms = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uBox: { value: box },
      uSize: { value: 26 },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 0.7 },
      uColorA: { value: new THREE.Color('#9af2c0') },
      uColorB: { value: new THREE.Color('#ceff65') },
    };

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uBox, uSize, uPixelRatio;
        uniform vec3 uCam;
        attribute float aSeed;
        varying float vAlpha;
        varying float vSeed;
        void main(){
          vec3 p = position;
          p.y += uTime * (0.08 + aSeed * 0.22);
          p.x += sin(uTime * 0.21 + aSeed * 31.0) * 0.8;
          p.z += cos(uTime * 0.17 + aSeed * 17.0) * 0.8;
          vec3 rel = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
          vec4 mv = viewMatrix * vec4(uCam + rel, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = max(-mv.z, 0.001);
          gl_PointSize = uSize * uPixelRatio * (0.25 + aSeed * aSeed) / dist;
          float edge = 1.0 - smoothstep(uBox * 0.3, uBox * 0.5, length(rel));
          vAlpha = edge * smoothstep(0.4, 2.5, dist) * (0.35 + 0.65 * fract(aSeed * 7.13));
          vSeed = aSeed;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        uniform vec3 uColorA, uColorB;
        varying float vAlpha;
        varying float vSeed;
        ${pointFrag}
        void main(){
          float a = softDot(gl_PointCoord);
          vec3 col = mix(uColorA, uColorB, step(0.82, vSeed));
          gl_FragColor = vec4(col * 1.6, a * vAlpha * uOpacity);
        }`,
    });

    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
  }

  update(camera, time, pixelRatio) {
    this.uniforms.uCam.value.copy(camera.position);
    this.uniforms.uTime.value = time;
    this.uniforms.uPixelRatio.value = pixelRatio;
  }
}
