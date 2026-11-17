import * as THREE from 'three';

// Last pass: gentle grain and vignette, plus the "liquid wipe" used when the
// camera plunges into the IV fluid (and surfaces again): a wavy, refracting
// waterline sweeps across the frame with the fluid's tint below it.
export const FinalShader = {
  name: 'FinalShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.022 },
    uVignette: { value: 0.28 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uWipeLevel: { value: -0.2 }, // waterline height in screen space (0 bottom, 1 top)
    uWipeTint: { value: 0 },
    uWipeColor: { value: new THREE.Color('#0d8a45') },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uWipeLevel, uWipeTint;
    uniform vec3 uWipeColor;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec2 uv = vUv;
      float edge = uWipeLevel + 0.018 * sin(uv.x * 14.0 + uTime * 2.6) + 0.008 * sin(uv.x * 37.0 - uTime * 3.1);
      float below = smoothstep(edge + 0.006, edge - 0.006, uv.y);
      // refraction under the waterline
      uv += vec2(0.006 * sin(uv.y * 40.0 + uTime * 3.0), 0.012 * sin(uv.x * 22.0 + uTime * 2.0)) * below * uWipeTint;
      vec3 col = texture2D(tDiffuse, uv).rgb;
      vec3 tinted = col * mix(vec3(1.0), uWipeColor * 1.6, 0.55) + uWipeColor * 0.12;
      col = mix(col, tinted, below * uWipeTint);
      // bright meniscus line
      col += vec3(0.85, 1.0, 0.9) * exp(-abs(uv.y - edge) * 260.0) * 0.55 * uWipeTint * step(0.0, uWipeLevel) * step(uWipeLevel, 1.0);
      vec2 c = vUv - 0.5;
      col *= 1.0 - uVignette * smoothstep(0.15, 0.75, dot(c, c) * 1.8);
      col += (hash(floor(vUv * uRes) + fract(uTime * 7.31) * 113.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};
