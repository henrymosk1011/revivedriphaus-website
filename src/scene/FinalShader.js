import * as THREE from 'three';

// Last pass: lens-style chromatic fringe, vignette, film grain and a white
// "flash" used to cover the cut from the city into the bloodstream.
export const FinalShader = {
  name: 'FinalShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.04 },
    uVignette: { value: 0.5 },
    uFlash: { value: 0 },
    uCA: { value: 0.012 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uFlash, uCA;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * uCA;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      float aspect = uRes.x / uRes.y;
      vec2 vc = c * vec2(aspect, 1.0) / max(aspect, 1.0);
      col *= 1.0 - uVignette * smoothstep(0.08, 0.62, dot(vc, vc) * 1.6);
      float g = hash(floor(vUv * uRes) + fract(uTime * 7.31) * 113.0) - 0.5;
      col += g * uGrain;
      col = mix(col, vec3(0.93, 1.0, 0.95), clamp(uFlash, 0.0, 1.0));
      gl_FragColor = vec4(col, 1.0);
    }`,
};
