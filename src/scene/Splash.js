import * as THREE from 'three';
import { Drop, liquidMaterial, liquidUniforms, LIQUID_GREEN } from './Droplet.js';
import { clamp, invLerp, smooth, lerp } from './util.js';

export const SPLASH_ORIGIN = new THREE.Vector3(0, -1000, 0);
const SPIKES = 13;
const SEED = 1.7;

// Same crown function in JS (for droplet placement) and GLSL (for the mesh).
function crownJS(th, v, s, c) {
  const rise = Math.sin(s * 1.5708);
  const H = 0.95 * rise * (1 - c * c);
  const R0 = 0.32 + 0.6 * s + 0.35 * c;
  const spikes = Math.pow(Math.max(Math.cos(th * SPIKES + 0.7 * Math.sin(th * 3 + SEED)), 0), 12);
  const rim = Math.min(1, Math.max(0, (v - 0.55) / 0.45));
  const rimS = rim * rim * (3 - 2 * rim);
  const flare = (0.3 * s + 0.25 * c) * Math.pow(v, 1.7);
  const y = v * H + spikes * rimS * 0.42 * rise * (1 - c) - c * 0.6;
  const r = R0 + flare + spikes * rimS * 0.06 * s + 0.02 * Math.sin(th * 5 + v * 7 + SEED);
  return new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
}
const crownGLSL = /* glsl */ `
  uniform float uS;
  vec3 crown(float th, float v){
    float s = clamp(uS, 0.0, 1.0);
    float c = clamp(uS - 1.0, 0.0, 1.0);
    float rise = sin(s * 1.5708);
    float H = 0.95 * rise * (1.0 - c * c);
    float R0 = 0.32 + 0.6 * s + 0.35 * c;
    float spikes = pow(max(cos(th * ${SPIKES.toFixed(1)} + 0.7 * sin(th * 3.0 + ${SEED.toFixed(2)})), 0.0), 12.0);
    float rim = smoothstep(0.55, 1.0, v);
    float flare = (0.3 * s + 0.25 * c) * pow(v, 1.7);
    float y = v * H + spikes * rim * 0.42 * rise * (1.0 - c) - c * 0.6;
    float r = R0 + flare + spikes * rim * 0.06 * s + 0.02 * sin(th * 5.0 + v * 7.0 + ${SEED.toFixed(2)});
    return vec3(cos(th) * r, y, sin(th) * r);
  }
`;

export class Splash {
  constructor({ quality = 'high' } = {}) {
    const low = quality === 'low';
    this.group = new THREE.Group();
    this.group.position.copy(SPLASH_ORIGIN);

    // --- The liquid surface, rippled per pixel --------------------------------
    this.surfUniforms = { uTime: { value: 0 }, uImpact: { value: 0 }, uImpactAmp: { value: 0 }, uAmbient: { value: 0 } };
    const surfGeo = new THREE.PlaneGeometry(400, 400, 1, 1);
    surfGeo.rotateX(-Math.PI / 2);
    const surfMat = new THREE.MeshPhysicalMaterial({
      color: '#3fbf78',
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 0.95,
      specularIntensity: 1,
    });
    surfMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.surfUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSplashPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplashPos = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime, uImpact, uImpactAmp, uAmbient;\nvarying vec3 vSplashPos;')
        .replace(
          '#include <normal_fragment_maps>',
          /* glsl */ `#include <normal_fragment_maps>
          {
            float r = length(vSplashPos.xz);
            float env = exp(-pow((r - 0.4 - uImpact * 1.7) / (0.45 + uImpact * 0.5), 2.0)) * exp(-uImpact * 0.5) * uImpactAmp;
            float g = cos(r * 16.0 - uImpact * 24.0) * env;
            float amb = cos(r * 9.0 - uTime * 2.2) * exp(-r * 0.5) * 0.22 * uAmbient;
            amb += cos(r * 23.0 - uTime * 3.4) * exp(-r * 0.9) * 0.08 * uAmbient;
            vec2 grad = (vSplashPos.xz / max(r, 1e-3)) * (g + amb) * 0.4;
            vec3 nW = normalize(vec3(-grad.x, 1.0, -grad.y));
            normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
          }`
        );
    };
    this.surface = new THREE.Mesh(surfGeo, surfMat);
    this.group.add(this.surface);

    // --- The crown ----------------------------------------------------------------
    this.crownUniforms = { uS: { value: 0 } };
    const crownMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: 0.02,
      transmission: 1,
      thickness: 0.12,
      ior: 1.34,
      attenuationColor: LIQUID_GREEN,
      attenuationDistance: 0.22,
      envMapIntensity: 1.3,
      clearcoat: 1,
      side: THREE.DoubleSide,
    });
    crownMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.crownUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${crownGLSL}`)
        .replace(
          '#include <beginnormal_vertex>',
          /* glsl */ `
          float th = atan(position.z, position.x);
          float v = position.y + 0.5;
          vec3 cp = crown(th, v);
          vec3 cA = crown(th + 0.01, v);
          vec3 cB = crown(th, v + 0.01);
          vec3 objectNormal = normalize(cross(cB - cp, cA - cp));
          #ifdef USE_TANGENT
            vec3 objectTangent = vec3(tangent.xyz);
          #endif`
        )
        .replace('#include <begin_vertex>', 'vec3 transformed = cp;');
    };
    this.crown = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, low ? 120 : 180, low ? 28 : 44, true), crownMat);
    this.crown.frustumCulled = false;
    this.group.add(this.crown);

    // Spike tips, found numerically so droplets sit exactly on them.
    this.tips = [];
    for (let k = 0; k < SPIKES; k++) {
      let best = 0;
      let bestTh = 0;
      for (let i = 0; i < 400; i++) {
        const th = ((k - 0.5) / SPIKES) * Math.PI * 2 + (i / 400) * (Math.PI * 2) / SPIKES;
        const val = Math.cos(th * SPIKES + 0.7 * Math.sin(th * 3 + SEED));
        if (val > best) {
          best = val;
          bestTh = th;
        }
      }
      this.tips.push(bestTh);
    }
    this.dropletUniforms = liquidUniforms(4);
    this.droplets = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, low ? 3 : 4),
      liquidMaterial(this.dropletUniforms, { attenuationDistance: 0.12, thickness: 0.08 }),
      SPIKES
    );
    this.droplets.frustumCulled = false;
    this.group.add(this.droplets);

    // --- The jet that rises after the crown collapses ---------------------------
    const jetMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: 0.02,
      transmission: 1,
      thickness: 0.2,
      ior: 1.34,
      attenuationColor: LIQUID_GREEN,
      attenuationDistance: 0.3,
      envMapIntensity: 1.3,
      clearcoat: 1,
    });
    const jetGeo = new THREE.CylinderGeometry(0.45, 1, 1, 40, 1, false);
    jetGeo.translate(0, 0.5, 0);
    this.jet = new THREE.Mesh(jetGeo, jetMat);
    this.group.add(this.jet);

    // The falling drop and the drop the jet pinches off (which then hovers).
    this.fallDrop = new Drop({ detail: low ? 32 : 56, attenuationDistance: 0.3, thickness: 1.8 });
    this.hoverDrop = new Drop({ detail: low ? 40 : 72, seed: 9, attenuationDistance: 0.32, thickness: 1.8 });
    this.group.add(this.fallDrop.mesh, this.hoverDrop.mesh);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
  }

  // fall: 0→1 drop falls; s: 0→1 crown rises, 1→2 collapses; jet 0→1; hover 0→1
  update(time, { fall, s, jet, hover }) {
    // falling drop
    const fd = this.fallDrop;
    fd.mesh.visible = fall > 0 && fall < 1;
    if (fd.mesh.visible) {
      const y = lerp(3.4, 0.12, fall * fall);
      fd.mesh.position.set(0, y, 0);
      fd.mesh.scale.setScalar(0.17);
      fd.update(time, { amp: 0.05, drop: 0.25 * (1 - fall), stretch: 0.25 * fall });
    }

    // crown
    this.crownUniforms.uS.value = s;
    this.crown.visible = s > 0.002 && s < 1.9;
    const c = clamp(s - 1, 0, 1);
    const sr = clamp(s, 0, 1);
    for (let k = 0; k < SPIKES; k++) {
      const th = this.tips[k];
      let pos;
      let scale;
      if (s < 0.72) {
        pos = crownJS(th, 1, sr, c);
        pos.y += 0.04;
        scale = 0.05 * smooth(0.35, 0.72, s);
      } else {
        const a = (s - 0.72) * 1.3;
        const base = crownJS(th, 1, 0.72, 0);
        const out = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
        pos = base.addScaledVector(out, a * (0.8 + (k % 3) * 0.15));
        pos.y += 0.04 + a * (1.3 + (k % 4) * 0.12) - a * a * 2.1;
        scale = pos.y > 0 ? 0.048 : 0;
      }
      this._s.setScalar(Math.max(scale, 1e-5));
      this._m.compose(pos, this._q, this._s);
      this.droplets.setMatrixAt(k, this._m);
    }
    this.droplets.instanceMatrix.needsUpdate = true;
    this.droplets.visible = s > 0.3 && s < 1.9;
    this.dropletUniforms.uTime.value = time;
    this.dropletUniforms.uAmp.value = 0.08;

    // jet and the drop it releases
    const rise = smooth(0, 0.8, jet);
    const fallBack = smooth(0.8, 1, jet);
    const jh = 0.9 * rise * (1 - fallBack * 0.9);
    this.jet.visible = jet > 0.01 && jet < 0.995;
    this.jet.scale.set(0.15, Math.max(jh, 0.001), 0.15);
    const hd = this.hoverDrop;
    hd.mesh.visible = jet > 0.05;
    const tipY = jh + 0.1;
    const freeY = lerp(0.9 + 0.12, 1.3, smooth(0.8, 1, jet));
    const y = jet < 0.8 ? tipY : lerp(freeY, 1.3, hover);
    const bob = Math.sin(time * 1.2) * 0.05 * hover;
    hd.mesh.position.set(0, y + bob, 0);
    hd.mesh.scale.setScalar((0.15 + 0.11 * hover) * smooth(0.05, 0.5, jet));
    hd.mesh.rotation.y = time * 0.3;
    hd.update(time, { amp: lerp(0.08, 0.05, hover), drop: jet < 0.8 ? 0.35 : 0.25 * (1 - hover), stretch: 0 });

    // ripples
    const su = this.surfUniforms;
    su.uTime.value = time;
    su.uImpact.value = Math.max(0, s) * 2.4 + jet * 1.2;
    su.uImpactAmp.value = s > 0 ? 1 - smooth(1.6, 2.0, s) * 0.6 : 0;
    su.uAmbient.value = hover;
  }
}
