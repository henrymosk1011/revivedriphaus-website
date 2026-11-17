import * as THREE from 'three';
import { snoise } from './glsl.js';

export const LIQUID_GREEN = new THREE.Color('#19b45c');

export function liquidUniforms(seed = 0) {
  return {
    uTime: { value: 0 },
    uAmp: { value: 0.05 },
    uFreq: { value: 1.1 },
    uDrop: { value: 0 },
    uStretch: { value: 0 },
    uSeed: { value: seed },
  };
}

// Liquid glass in the brand green. Vertex noise keeps a drop alive, uDrop
// pinches it into a teardrop hanging from the spike, uStretch elongates it as
// it falls. Normals are rebuilt in the shader so refraction follows the shape.
export function liquidMaterial(uniforms, opts = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 0.015,
    metalness: 0,
    transmission: 1,
    thickness: 0.6,
    ior: 1.34,
    attenuationColor: LIQUID_GREEN,
    attenuationDistance: 0.5,
    iridescence: 0.15,
    iridescenceIOR: 1.3,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    specularIntensity: 1,
    envMapIntensity: 1.3,
    dispersion: 0.25,
    ...opts,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uTime, uAmp, uFreq, uDrop, uStretch, uSeed;
        ${snoise}
        vec3 displace(vec3 p){
          float t = uTime * 0.8 + uSeed;
          float n = snoise(p * uFreq + vec3(t * 0.6, t * 0.45, -t * 0.5));
          n += 0.2 * snoise(p * uFreq * 2.1 + vec3(-t, t * 0.8, t * 0.3));
          vec3 q = p * (1.0 + n * uAmp);
          float h = p.y;
          float pinch = smoothstep(-0.2, 1.0, h);
          q.xz *= 1.0 - uDrop * 0.86 * pinch * pinch;
          q.y += uDrop * (1.25 * pinch * pinch * pinch + 0.1 * h);
          q.y *= 1.0 + uStretch;
          q.xz *= 1.0 - uStretch * 0.2;
          return q;
        }`
      )
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `
        vec3 sp = normalize(position);
        vec3 dpos = displace(sp);
        vec3 tng = normalize(cross(sp, abs(sp.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 btn = normalize(cross(sp, tng));
        vec3 pA = displace(normalize(sp + tng * 0.012));
        vec3 pB = displace(normalize(sp + btn * 0.012));
        vec3 objectNormal = normalize(cross(pA - dpos, pB - dpos));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = dpos;');
  };
  material.customProgramCacheKey = () => 'liquid-glass';
  return material;
}

// One drop of IV fluid.
export class Drop {
  constructor({ detail = 48, seed = 0, ...opts } = {}) {
    this.uniforms = liquidUniforms(seed);
    this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, detail), liquidMaterial(this.uniforms, opts));
  }

  update(time, { amp = 0.05, drop = 0, stretch = 0 } = {}) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uAmp.value = amp;
    u.uDrop.value = drop;
    u.uStretch.value = stretch;
  }
}
