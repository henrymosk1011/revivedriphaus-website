import * as THREE from 'three';
import { snoise } from './glsl.js';

// The backdrop: a soft studio sweep for most of the film, and an underwater
// world (caustics + light shafts) while the camera is inside the fluid.
export class Sky {
  constructor() {
    this.uniforms = {
      uTime: { value: 0 },
      uTop: { value: new THREE.Color('#eef4f0') },
      uBottom: { value: new THREE.Color('#8faa9b') },
      uGlow: { value: new THREE.Color('#ffffff') },
      uGlowDir: { value: new THREE.Vector3(0.2, 0.1, -1).normalize() },
      uGlowAmt: { value: 1.0 },
      uFluid: { value: 0 },
      uDeep: { value: new THREE.Color('#032d18') },
      uShallow: { value: new THREE.Color('#33c97a') },
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
        uniform float uTime, uGlowAmt, uFluid;
        uniform vec3 uTop, uBottom, uGlow, uGlowDir, uDeep, uShallow;
        varying vec3 vDir;
        ${snoise}
        // Light caustics, the dancing net of light at the bottom of a pool.
        float caustic(vec2 uv, float t){
          vec2 p = mod(uv * 6.2831, 6.2831) - 250.0;
          vec2 i = p;
          float c = 1.0;
          float inten = 0.005;
          for (int n = 0; n < 4; n++){
            float tt = t * (1.0 - (3.5 / float(n + 1)));
            i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
            c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
          }
          c /= 4.0;
          c = 1.17 - pow(c, 1.4);
          return pow(abs(c), 8.0);
        }
        void main(){
          vec3 d = normalize(vDir);
          // studio sweep
          float h = smoothstep(-0.55, 0.55, d.y);
          vec3 studio = mix(uBottom, uTop, h);
          float g = max(dot(d, normalize(uGlowDir)), 0.0);
          studio += uGlow * (pow(g, 3.0) * 0.35 + pow(g, 12.0) * 0.25) * uGlowAmt;
          studio *= 1.0 - 0.18 * smoothstep(0.3, 1.0, abs(d.x));
          // underwater
          vec3 water = mix(uDeep, uShallow, smoothstep(-0.6, 0.9, d.y));
          vec2 cuv = d.xz / (abs(d.y) + 0.6) * 0.6;
          float c = caustic(cuv + vec2(uTime * 0.02, 0.0), uTime * 0.35);
          water += vec3(0.75, 1.0, 0.85) * c * 0.35 * smoothstep(-0.2, 0.7, d.y);
          float ang = atan(d.z, d.x);
          float rays = pow(max(snoise(vec3(ang * 6.0, uTime * 0.12, 0.0)) * 0.5 + 0.5, 0.0), 3.0);
          water += vec3(0.6, 1.0, 0.75) * rays * smoothstep(0.0, 0.9, d.y) * 0.28;
          vec3 col = mix(studio, water, uFluid);
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
