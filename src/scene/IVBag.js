import * as THREE from 'three';
import { Drop, LIQUID_GREEN } from './Droplet.js';
import { clamp, invLerp, smooth, lerp, rng } from './util.js';

// Dimensions in world units. The bag hangs from a hook; a drip chamber hangs
// beneath it and the IV line leaves from the chamber's bottom.
export const BAG = { w: 2.0, h: 3.0, t: 0.36 };
export const CHAMBER = { top: -2.05, bottom: -3.15, r: 0.22, tipY: -2.25, poolY: -2.9 };
export const TUBE_START = new THREE.Vector3(0, -3.34, 0);

// Clear medical plastic: almost invisible face-on, milky at grazing angles,
// with crisp studio reflections.
export function plasticMaterial({ opacity = 1, tint = '#ffffff' } = {}) {
  const uniforms = { uOpacity: { value: opacity } };
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(tint),
    roughness: 0.14,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    specularIntensity: 1,
    envMapIntensity: 1.6,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uOpacity;')
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
        float glint = clamp(dot(outgoingLight, vec3(0.333)) - 0.78, 0.0, 1.0) * 1.6;
        gl_FragColor = vec4(outgoingLight, clamp(mix(0.05, 0.6, fres) + glint, 0.0, 0.95) * uOpacity);`
      );
  };
  m.customProgramCacheKey = () => 'iv-plastic';
  m.userData.uniforms = uniforms;
  return m;
}

// Map the unit square onto a softly rounded rectangle. Smooth everywhere, so
// printed text stays straight and the plastic has no creases.
function squircle(u, v, c = 0.3) {
  return [u * Math.sqrt(1 - (c * v * v) / 2), v * Math.sqrt(1 - (c * u * u) / 2)];
}

// An inflated pillow: front and back surfaces that meet in a flat sealed rim.
function pillowGeometry({ w, h, t, segU = 64, segV = 96, inset = 0.93, sides = [1, -1], planarUV = false }) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (const s of sides) {
    const base = pos.length / 3;
    for (let j = 0; j <= segV; j++) {
      const v = -1 + (2 * j) / segV;
      for (let i = 0; i <= segU; i++) {
        const u = -1 + (2 * i) / segU;
        const [x, y] = squircle(u, v);
        const uu = clamp(Math.abs(u) / inset, 0, 1);
        const vv = clamp(Math.abs(v) / inset, 0, 1);
        const f = Math.pow(Math.max(0, (1 - uu ** 6) * (1 - vv ** 6)), 0.42);
        pos.push((x * w) / 2, (y * h) / 2, s * t * f);
        uv.push(planarUV ? (x + 1) / 2 : (u + 1) / 2, planarUV ? (y + 1) / 2 : (v + 1) / 2);
      }
    }
    for (let j = 0; j < segV; j++) {
      for (let i = 0; i < segU; i++) {
        const a = base + j * (segU + 1) + i;
        const b = a + 1;
        const c = a + segU + 1;
        const d = c + 1;
        if (s > 0) idx.push(a, b, d, a, d, c);
        else idx.push(a, d, b, a, c, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// The printed ink on the bag: brand, volume, graduations, barcode.
function drawLabel(canvas) {
  const W = canvas.width;
  const H = canvas.height;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, W, H);
  const ink = 'rgba(8, 40, 24, 0.9)';
  const green = '#0f7a3b';
  const mono = (w, s) => `${w} ${s}px "IBM Plex Mono", ui-monospace, monospace`;
  const m = 96;

  c.fillStyle = ink;
  c.textBaseline = 'alphabetic';
  // wordmark
  c.font = `300 ${92}px "Manrope Variable", Manrope, sans-serif`;
  const rev = 'REV';
  let x = m;
  const y0 = 230;
  c.save();
  if ('letterSpacing' in c) c.letterSpacing = '14px';
  c.fillText(rev, x, y0);
  x += c.measureText(rev).width;
  c.fillStyle = green;
  c.fillText('IV', x, y0);
  x += c.measureText('IV').width;
  c.fillStyle = ink;
  c.fillText('E', x, y0);
  c.restore();
  c.font = `300 ${58}px "Manrope Variable", Manrope, sans-serif`;
  c.fillText('drip haus', m + 120, y0 + 66);

  c.font = mono(500, 30);
  c.textAlign = 'right';
  c.fillText('Rx only', W - m, 170);
  c.fillText('IV · 24/7', W - m, 214);
  c.textAlign = 'left';

  c.fillRect(m, 360, W - m * 2, 3);
  c.font = mono(500, 34);
  c.fillText('ON-DEMAND IV HYDRATION', m, 430);
  c.font = mono(400, 28);
  c.fillText('Mobile IV therapy · Los Angeles', m, 476);

  c.font = `400 ${250}px "Instrument Serif", Georgia, serif`;
  c.fillText('1000', m - 6, 760);
  c.font = `italic 400 ${120}px "Instrument Serif", Georgia, serif`;
  c.fillStyle = green;
  c.fillText('mL', m + 560, 760);
  c.fillStyle = ink;

  c.font = mono(400, 26);
  const lines = ['Fluids · Vitamin C · B-Complex', 'Glutathione · Zinc · Magnesium', 'Administered by licensed nurses'];
  lines.forEach((l, i) => c.fillText(l, m, 860 + i * 42));

  // graduation scale down the right-hand side
  const gx = W - m;
  for (let k = 0; k <= 18; k++) {
    const gy = 560 + k * 44;
    const major = k % 2 === 0;
    c.fillRect(gx - (major ? 70 : 38), gy, major ? 70 : 38, 4);
    if (major && k > 0 && k < 18) {
      c.font = mono(500, 24);
      c.textAlign = 'right';
      c.fillText(String(k * 50), gx - 82, gy + 9);
      c.textAlign = 'left';
    }
  }

  // barcode + lot
  const rand = rng(1011);
  let bx = m;
  const by = 1260;
  while (bx < m + 420) {
    const bw = 3 + Math.floor(rand() * 9);
    if (rand() > 0.35) c.fillRect(bx, by, bw, 120);
    bx += bw + 3;
  }
  c.font = mono(400, 24);
  c.fillText('LOT RDH-2026   EXP 24/7', m, by + 160);
  c.textAlign = 'right';
  c.fillText('(818) 482-9426', W - m, by + 160);
  c.textAlign = 'left';
}

const DROP_R = 0.055;
// Where the drop's centre is at a given drip phase (shared with the camera).
export function dripY(phase) {
  const { tipY, poolY } = CHAMBER;
  const p = clamp(phase, 0, 1);
  if (p < 0.5) {
    const k = Math.pow(smooth(0, 0.5, p), 0.7);
    const r = DROP_R * (0.25 + 0.75 * k);
    return tipY - r * (1.0 + 0.9 * k);
  }
  const k = invLerp(0.5, 0.86, p);
  return lerp(tipY - DROP_R * 1.9, poolY + DROP_R * 0.6, k * k);
}

export class IVBag {
  constructor({ quality = 'high' } = {}) {
    const low = quality === 'low';
    this.group = new THREE.Group();
    this.sway = new THREE.Group(); // swings gently from the hook
    this.group.add(this.sway);
    this.time = 0;

    const plastic = plasticMaterial();
    this.plastic = plastic;

    // --- Bag ---------------------------------------------------------------
    const bagGeo = pillowGeometry({ ...BAG, segU: low ? 40 : 64, segV: low ? 60 : 96 });
    const bag = new THREE.Mesh(bagGeo, plastic);
    bag.renderOrder = 3;
    this.sway.add(bag);

    // --- Liquid inside, clipped at a sloshing surface -------------------------
    this.liquidUniforms = {
      uTime: { value: 0 },
      uLevel: { value: 0.9 },
      uTilt: { value: 0 },
      uSlosh: { value: 0 },
    };
    const liqGeo = pillowGeometry({ w: BAG.w * 0.9, h: BAG.h * 0.93, t: BAG.t * 0.8, inset: 0.86, segU: low ? 40 : 64, segV: low ? 70 : 110 });
    const liqMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.03,
      transmission: 1,
      thickness: 0.6,
      ior: 1.34,
      attenuationColor: LIQUID_GREEN,
      attenuationDistance: 0.16,
      specularIntensity: 1,
      envMapIntensity: 1.1,
    });
    liqMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.liquidUniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform float uTime, uLevel, uTilt, uSlosh;
          float wave(vec2 p){
            return sin(p.x * 2.4 + uTime * 1.5 + uSlosh) * 0.022 + sin(p.y * 9.0 - uTime * 2.2) * 0.008 + sin(p.x * 6.1 - uTime * 2.7) * 0.006 + p.x * uTilt;
          }`
        )
        .replace(
          '#include <beginnormal_vertex>',
          /* glsl */ `
          float lvl = uLevel + wave(position.xz);
          float above = step(lvl, position.y);
          float e = 0.01;
          vec3 surfN = normalize(vec3(-(wave(position.xz + vec2(e, 0.0)) - wave(position.xz)) / e, 1.0, -(wave(position.xz + vec2(0.0, e)) - wave(position.xz)) / e));
          vec3 objectNormal = normalize(mix(normal, surfN, above));
          #ifdef USE_TANGENT
            vec3 objectTangent = vec3(tangent.xyz);
          #endif`
        )
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, min(position.y, lvl), position.z);');
    };
    this.liquid = new THREE.Mesh(liqGeo, liqMat);
    this.liquid.renderOrder = 1;
    this.sway.add(this.liquid);

    // --- Printed ink ------------------------------------------------------------
    this.labelCanvas = document.createElement('canvas');
    this.labelCanvas.width = 1024;
    this.labelCanvas.height = 1536;
    drawLabel(this.labelCanvas);
    this.labelTex = new THREE.CanvasTexture(this.labelCanvas);
    this.labelTex.colorSpace = THREE.SRGBColorSpace;
    this.labelTex.anisotropy = 8;
    const labelGeo = pillowGeometry({ ...BAG, t: BAG.t + 0.004, sides: [1], segU: 64, segV: 96, planarUV: true });
    const label = new THREE.Mesh(
      labelGeo,
      new THREE.MeshBasicMaterial({ map: this.labelTex, transparent: true, depthWrite: false })
    );
    label.renderOrder = 4;
    this.sway.add(label);
    // Redraw once the web fonts are ready.
    document.fonts?.ready.then(() => {
      drawLabel(this.labelCanvas);
      this.labelTex.needsUpdate = true;
    });

    // --- Hanger tab, hook and pole --------------------------------------------
    const tab = new THREE.Shape();
    const tw = 0.9;
    const tb = 1.38;
    const tt = 1.95;
    const rr = 0.12;
    tab.moveTo(-tw / 2, tb);
    tab.lineTo(tw / 2, tb);
    tab.lineTo(tw / 2, tt - rr);
    tab.quadraticCurveTo(tw / 2, tt, tw / 2 - rr, tt);
    tab.lineTo(-tw / 2 + rr, tt);
    tab.quadraticCurveTo(-tw / 2, tt, -tw / 2, tt - rr);
    tab.lineTo(-tw / 2, tb);
    const hole = new THREE.Path();
    hole.absellipse(0, 1.75, 0.13, 0.08, 0, Math.PI * 2, true);
    tab.holes.push(hole);
    const tabMesh = new THREE.Mesh(new THREE.ShapeGeometry(tab, 24), plastic);
    tabMesh.renderOrder = 3;
    this.sway.add(tabMesh);

    const chrome = new THREE.MeshStandardMaterial({ color: '#dfe7e2', metalness: 1, roughness: 0.16, envMapIntensity: 1.4 });
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 12, 48, Math.PI * 1.35), chrome);
    hook.rotation.set(Math.PI / 2, 0, Math.PI * 0.82);
    hook.position.set(0, 1.86, 0);
    this.group.add(hook);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 9, 16), chrome);
    pole.position.set(0.12, 1.86 + 4.5, 0);
    this.group.add(pole);

    // --- Ports, spike and drip chamber ----------------------------------------
    const white = new THREE.MeshPhysicalMaterial({ color: '#f3f6f4', roughness: 0.32, clearcoat: 0.4, envMapIntensity: 1.1 });
    const cap = new THREE.MeshPhysicalMaterial({ color: '#116935', roughness: 0.3, clearcoat: 0.6, envMapIntensity: 1.1 });
    const port = (x, len, mat) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, len, 24), mat);
      m.position.set(x, -1.5 - len / 2 + 0.06, 0);
      this.sway.add(m);
      return m;
    };
    port(0, 0.32, white);
    port(0.42, 0.26, white);
    const capMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 24), cap);
    capMesh.position.set(0.42, -1.82, 0);
    this.sway.add(capMesh);

    const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.42, 20), white);
    spike.position.set(0, -1.84, 0);
    this.sway.add(spike);
    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.13, 40), white);
    topCap.position.set(0, CHAMBER.top, 0);
    this.sway.add(topCap);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.16, 16), white);
    tip.position.set(0, CHAMBER.tipY + 0.08, 0);
    this.sway.add(tip);
    const chamberH = CHAMBER.top - CHAMBER.bottom;
    const chamber = new THREE.Mesh(
      new THREE.CylinderGeometry(CHAMBER.r, CHAMBER.r - 0.015, chamberH, 48, 1, true),
      plasticMaterial({ opacity: 0.85 })
    );
    chamber.position.set(0, (CHAMBER.top + CHAMBER.bottom) / 2, 0);
    chamber.renderOrder = 3;
    this.sway.add(chamber);
    const bottomCap = new THREE.Mesh(new THREE.CylinderGeometry(CHAMBER.r - 0.01, 0.07, 0.2, 40), white);
    bottomCap.position.set(0, CHAMBER.bottom - 0.09, 0);
    this.sway.add(bottomCap);

    // Fluid pool in the chamber, its surface rippled after each drop lands.
    this.poolUniforms = { uTime: { value: 0 }, uRipple: { value: 10 }, uAmp: { value: 0 } };
    const poolH = CHAMBER.poolY - CHAMBER.bottom;
    const poolGeo = new THREE.CylinderGeometry(CHAMBER.r - 0.02, CHAMBER.r - 0.03, poolH, 48, 1, false);
    const poolMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: 0.02,
      transmission: 1,
      thickness: 0.3,
      ior: 1.34,
      attenuationColor: LIQUID_GREEN,
      attenuationDistance: 0.08,
      envMapIntensity: 1.2,
    });
    poolMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.poolUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vLocalPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalPos = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime, uRipple, uAmp;\nvarying vec3 vLocalPos;')
        .replace(
          '#include <normal_fragment_maps>',
          /* glsl */ `#include <normal_fragment_maps>
          if (vLocalPos.y > ${(poolH / 2 - 0.001).toFixed(4)}) {
            float r = length(vLocalPos.xz);
            float w = sin(r * 90.0 - uRipple * 22.0) * exp(-uRipple * 2.2) * smoothstep(uRipple * 0.5 + 0.02, 0.0, r - 0.0) * uAmp;
            vec3 g = vec3(vLocalPos.x, 0.0, vLocalPos.z) / max(r, 1e-4) * w * 0.9;
            normal = normalize(normal + (viewMatrix * vec4(g, 0.0)).xyz);
          }`
        );
    };
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.set(0, CHAMBER.bottom + poolH / 2, 0);
    this.sway.add(pool);

    // The falling drop and a few splash droplets.
    // thickness is in object units (scaled by the mesh), so a unit sphere is ~1.8 thick
    this.drop = new Drop({ detail: low ? 24 : 40, attenuationDistance: 0.05, thickness: 1.8 });
    this.drop.mesh.scale.setScalar(0.055);
    this.sway.add(this.drop.mesh);
    this.splash = [];
    for (let i = 0; i < 4; i++) {
      const d = new Drop({ detail: 10, seed: i * 3.1, attenuationDistance: 0.02, thickness: 1.8 });
      d.mesh.visible = false;
      d.dir = new THREE.Vector3(Math.cos(i * 1.7 + 0.4), 0, Math.sin(i * 1.7 + 0.4));
      this.splash.push(d);
      this.sway.add(d.mesh);
    }

    // --- Bubbles rising through the bag ------------------------------------------
    const rand = rng(77);
    const nB = low ? 14 : 26;
    this.bubbles = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 2),
      new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.55, envMapIntensity: 2, clearcoat: 1 }),
      nB
    );
    this.bubbles.renderOrder = 2;
    this.bubbleData = Array.from({ length: nB }, () => ({
      x: (rand() - 0.5) * BAG.w * 0.7,
      z: (rand() - 0.5) * BAG.t * 0.6,
      s: 0.012 + rand() * rand() * 0.035,
      speed: 0.12 + rand() * 0.25,
      ph: rand(),
    }));
    this.sway.add(this.bubbles);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  // phase: 0 → 1 through one drip (forming, falling, landing).
  setDrip(phase, time) {
    const { tipY, poolY } = CHAMBER;
    const d = this.drop;
    const p = clamp(phase, 0, 1);
    const R = 0.055;
    if (p < 0.5) {
      const k = Math.pow(smooth(0, 0.5, p), 0.7);
      const r = R * (0.25 + 0.75 * k);
      d.mesh.visible = true;
      d.mesh.scale.setScalar(r);
      d.mesh.position.set(0, tipY - r * (1.0 + 0.9 * k), 0);
      d.update(time, { amp: 0.015 + 0.015 * k, drop: 0.75 + 0.2 * k, stretch: 0.15 * smooth(0.35, 0.5, p) });
    } else if (p < 0.86) {
      const k = invLerp(0.5, 0.86, p);
      const y = lerp(tipY - R * 1.9, poolY + R * 0.6, k * k);
      d.mesh.visible = true;
      d.mesh.scale.setScalar(R);
      d.mesh.position.set(0, y, 0);
      const wob = Math.sin(k * 18) * Math.exp(-k * 4);
      d.update(time, { amp: 0.018, drop: 0.95 * Math.exp(-k * 9), stretch: 0.18 * wob });
    } else {
      d.mesh.visible = false;
    }
    // ripples and splash after landing
    const age = p >= 0.86 ? (p - 0.86) / 0.14 : 10;
    this.poolUniforms.uRipple.value = age * 1.6;
    this.poolUniforms.uAmp.value = age < 1 ? 1 : 0;
    this.splash.forEach((s, i) => {
      const a = age;
      const show = a < 0.9;
      s.mesh.visible = show;
      if (!show) return;
      const v0 = 0.32 + i * 0.05;
      const r = 0.012 + (i % 2) * 0.006;
      s.mesh.scale.setScalar(r * (1 - a * 0.6));
      s.mesh.position.set(s.dir.x * a * 0.12, poolY + 0.02 + v0 * a - 0.75 * a * a, s.dir.z * a * 0.12);
      s.update(time, { amp: 0.08 });
    });
  }

  update(time, { level = 0.9, dripPhase = null, sway = 1 } = {}) {
    this.time = time;
    this.sway.rotation.y = Math.sin(time * 0.35) * 0.08 * sway;
    this.sway.rotation.z = Math.sin(time * 0.5) * 0.004 * sway;
    const lu = this.liquidUniforms;
    lu.uTime.value = time;
    lu.uLevel.value = level;
    lu.uTilt.value = -this.sway.rotation.z * 2;
    this.poolUniforms.uTime.value = time;

    this.setDrip(dripPhase ?? (time / 1.8) % 1, time);

    // bubbles rise and respawn at the bottom
    const bottom = -BAG.h / 2 * 0.85;
    for (let i = 0; i < this.bubbleData.length; i++) {
      const b = this.bubbleData[i];
      const span = level - bottom;
      const y = bottom + ((time * b.speed + b.ph * 10) % Math.max(span, 0.01));
      this._v.set(b.x + Math.sin(time * 2 + b.ph * 20) * 0.02, y, b.z);
      const fade = smooth(level, level - 0.12, y);
      this._s.setScalar(b.s * fade + 1e-5);
      this._m.compose(this._v, this._q, this._s);
      this.bubbles.setMatrixAt(i, this._m);
    }
    this.bubbles.instanceMatrix.needsUpdate = true;
  }
}
