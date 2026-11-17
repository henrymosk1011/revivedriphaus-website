import * as THREE from 'three';
import { snoise } from './glsl.js';

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
        uniform float uTime;
        uniform vec3 uTop, uBottom, uGlow, uGlowDir;
        uniform float uGlowAmt;
        varying vec3 vDir;
        ${snoise}
        void main(){
          vec3 d = normalize(vDir);
          float h = smoothstep(-0.65, 0.85, d.y);
          vec3 col = mix(uBottom, uTop, h);
          float g = max(dot(d, normalize(uGlowDir)), 0.0);
          col += uGlow * (pow(g, 5.0) * 0.55 + pow(g, 28.0) * 0.6) * uGlowAmt;
          float n = snoise(d * 2.2 + vec3(0.0, uTime * 0.015, uTime * 0.01));
          float n2 = snoise(d * 5.0 - vec3(uTime * 0.02));
          col += uGlow * (n * 0.5 + 0.5) * (n2 * 0.5 + 0.5) * 0.07 * uGlowAmt;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  update(camera, time) {
    this.mesh.position.copy(camera.position);
    this.uniforms.uTime.value = time;
  }
}
