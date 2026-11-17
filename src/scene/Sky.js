import * as THREE from 'three';
import { snoise, hash } from './glsl.js';

// Sky colour for a view direction. Shared by the sky dome and anything that
// reflects the sky (the ocean), so reflections always match the grade.
export const skyChunk = /* glsl */ `
  uniform vec3 uTop, uBottom, uGlow, uGlowDir, uHorizon;
  uniform float uGlowAmt, uHorizonAmt, uSunAmt;
  vec3 skyColor(vec3 d){
    float h = smoothstep(-0.65, 0.85, d.y);
    vec3 col = mix(uBottom, uTop, h);
    vec3 gd = normalize(uGlowDir);
    float g = max(dot(d, gd), 0.0);
    col += uGlow * (pow(g, 5.0) * 0.55 + pow(g, 28.0) * 0.6) * uGlowAmt;
    // dusk: a warm band along the horizon, strongest towards the sun
    float az = 0.45 + 0.55 * max(dot(normalize(d.xz + 1e-4), normalize(gd.xz + 1e-4)), 0.0);
    float band = exp(-abs(d.y - 0.015) * 7.5) * az;
    col = mix(col, uHorizon, clamp(band * uHorizonAmt, 0.0, 1.0));
    col += uHorizon * exp(-max(d.y, 0.0) * 22.0) * az * 0.18 * uHorizonAmt;
    // the sun itself
    col += vec3(1.0, 0.86, 0.62) * smoothstep(0.99955, 0.99985, g) * 7.0 * uSunAmt;
    col += vec3(1.0, 0.7, 0.42) * pow(g, 260.0) * 2.2 * uSunAmt;
    return col;
  }
`;

// An infinite gradient dome that follows the camera. Its colours are driven
// per chapter by the Film so the "grade" shifts as the story moves on.
export class Sky {
  constructor() {
    this.uniforms = {
      uTime: { value: 0 },
      uTop: { value: new THREE.Color('#0a3523') },
      uBottom: { value: new THREE.Color('#010805') },
      uGlow: { value: new THREE.Color('#1fb867') },
      uGlowDir: { value: new THREE.Vector3(0.45, 0.35, -1).normalize() },
      uGlowAmt: { value: 0.6 },
      uHorizon: { value: new THREE.Color('#ff8a50') },
      uHorizonAmt: { value: 0 },
      uSunAmt: { value: 0 },
      uStars: { value: 0 },
      uClouds: { value: 1 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uStars, uClouds;
        varying vec3 vDir;
        ${snoise}
        ${hash}
        ${skyChunk}
        void main(){
          vec3 d = normalize(vDir);
          vec3 col = skyColor(d);
          float n = snoise(d * 2.2 + vec3(0.0, uTime * 0.015, uTime * 0.01));
          float n2 = snoise(d * 5.0 - vec3(uTime * 0.02));
          col += uGlow * (n * 0.5 + 0.5) * (n2 * 0.5 + 0.5) * 0.07 * uGlowAmt * uClouds;
          // stars, only high in the sky
          vec3 sc = floor(d * 260.0);
          float s = hash21(sc.xy + sc.z * 17.31);
          float tw = 0.6 + 0.4 * sin(uTime * (1.5 + s * 3.0) + s * 40.0);
          col += vec3(0.9, 0.93, 1.0) * step(0.9975, s) * smoothstep(0.12, 0.45, d.y) * tw * uStars;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 32), material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  update(camera, time) {
    this.mesh.position.copy(camera.position);
    this.uniforms.uTime.value = time;
  }
}
