import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { snoise, hash } from './glsl.js';
import { skyChunk } from './Sky.js';
import { rng, lerp } from './util.js';

// "We come to you": the Pacific coast at dusk. The falling drop lands on a
// coastal road and becomes a light trail that races past palms and street
// lamps, with the sun setting over the ocean, to a house in the hills.

export const GROUND_Y = -60;
const SEA_Y = GROUND_Y - 2.4;
const ROAD_END = -296;
const LANE = 1.3; // the trail drives in the inland lane
const ROAD_W = 8;
const LAMP_GAP = 16;
const LAMP_DX = 4.8;
const S13 = Math.sin(1.3);

export const SUN_DIR = new THREE.Vector3(-0.5, 0.07, -1).normalize();

// The road's centre line, shared by JS and GLSL so everything lines up.
export const roadX = (z) => Math.sin(z * 0.011) * 16 + (Math.sin(z * 0.029 + 1.3) - S13) * 5;
const roadGlsl = /* glsl */ `
  float roadX(float z){ return sin(z * 0.011) * 16.0 + (sin(z * 0.029 + 1.3) - ${S13.toFixed(6)}) * 5.0; }
`;
const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Ground height on the ocean side of the road (no noise there, so JS can match).
const beachY = (dx) => GROUND_Y - 0.3 - smoothstep(-5.5, -18, dx) * 9;

const fogChunk = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uCam;
  vec3 applyFog(vec3 col, vec3 world){
    float dist = length(world - uCam);
    float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    return mix(col, uFogColor, f);
  }
`;

const landGlsl = /* glsl */ `
  ${roadGlsl}
  float fbm(vec2 p){
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++){ s += a * snoise(vec3(p, 1.7)); p = p * 2.07 + 13.1; a *= 0.5; }
    return s;
  }
  float landH(vec2 p){
    float dx = p.x - roadX(p.y);
    float inland = smoothstep(7.0, 120.0, dx);
    float hills = pow(inland, 1.15) * (70.0 + 38.0 * fbm(p * 0.006)) + fbm(p * 0.035) * 4.0 * smoothstep(9.0, 30.0, dx);
    float beach = smoothstep(-5.5, -18.0, dx);
    return ${GROUND_Y.toFixed(1)} - 0.3 + hills - beach * 9.0 - smoothstep(-18.0, -60.0, dx) * 10.0;
  }
`;

function palmGeometry(rand) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const lean = 0.06 + rand() * 0.12;
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(lean * 0.25, 0.35, 0), V(lean * 0.75, 0.7, 0), V(lean, 1, 0)]);
  const TS = 10;
  const RS = 6;
  const trunk = new THREE.TubeGeometry(curve, TS, 0.02, RS, false);
  const pos = trunk.attributes.position;
  const tmp = new THREE.Vector3();
  for (let i = 0; i <= TS; i++) {
    const c = curve.getPointAt(i / TS);
    const taper = lerp(1.35, 0.7, i / TS);
    for (let j = 0; j <= RS; j++) {
      const idx = i * (RS + 1) + j;
      tmp.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(taper).add(c);
      pos.setXYZ(idx, tmp.x, tmp.y, tmp.z);
    }
  }
  trunk.deleteAttribute('normal');
  trunk.deleteAttribute('uv');
  const parts = [trunk];

  const top = curve.getPointAt(1);
  const fronds = 9 + Math.floor(rand() * 3);
  for (let k = 0; k < fronds; k++) {
    const a = (k / fronds) * Math.PI * 2 + rand() * 0.35;
    const L = 0.36 + rand() * 0.14;
    const rise = 0.2 + rand() * 0.25;
    const S = 10;
    const verts = [];
    const idx = [];
    const dir = V(Math.cos(a), 0, Math.sin(a));
    const perp = V(-Math.sin(a), 0, Math.cos(a));
    for (let s = 0; s <= S; s++) {
      const t = s / S;
      const c = top.clone().addScaledVector(dir, L * t);
      c.y += L * (rise * t - (rise + 0.8) * t * t);
      const w = 0.07 * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (1 - 0.35 * t);
      const l = c.clone().addScaledVector(perp, w);
      const r = c.clone().addScaledVector(perp, -w);
      l.y -= w * 0.35;
      r.y -= w * 0.35;
      verts.push(l.x, l.y, l.z, c.x, c.y + w * 0.15, c.z, r.x, r.y, r.z);
      if (s < S) {
        const b = s * 3;
        idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

export class Coast {
  constructor({ quality = 'high', sky } = {}) {
    const low = quality === 'low';
    this.group = new THREE.Group();
    this.shared = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uFogColor: { value: new THREE.Color('#2a1a2a') },
      uFogDensity: { value: 0.005 },
      uHead: { value: new THREE.Vector3(0, GROUND_Y, 0) },
      uHeadAmt: { value: 0 },
      uSunDir: { value: SUN_DIR.clone() },
      uSunCol: { value: new THREE.Color('#ff9a5c') },
      uReveal: { value: 1 },
    };
    // The ocean reflects the same sky the dome draws.
    this.skyUniforms = sky.uniforms;

    // --- Route: the road, then a turn into the driveway --------------------
    const pts = [];
    for (let z = 0; z >= ROAD_END + 8; z -= 6) pts.push(new THREE.Vector3(roadX(z) + LANE, GROUND_Y + 0.5, z));
    const zEnd = ROAD_END;
    this.beaconPos = new THREE.Vector3(roadX(zEnd) + 10, GROUND_Y + 0.1, zEnd);
    pts.push(new THREE.Vector3(roadX(zEnd + 3) + 3.5, GROUND_Y + 0.5, zEnd + 3));
    pts.push(new THREE.Vector3(roadX(zEnd) + 7.5, GROUND_Y + 0.5, zEnd));
    this.route = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.landing = new THREE.Vector3(LANE, GROUND_Y + 0.4, 0);
    this.destination = this.beaconPos.clone();

    this.buildOcean();
    this.buildLand(low ? 170 : 280);
    this.buildRoad();
    this.buildLamps();
    this.buildPalms(low);
    this.buildRidges();
    this.buildBayLights(low ? 300 : 650);
    this.buildHouse();
    this.buildTrail();
    this.buildBeacon();
    this.buildSplash();
  }

  buildOcean() {
    const uniforms = { ...this.shared, ...this.skyUniforms };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWorld;
        ${skyChunk}
        ${fogChunk}
        vec2 waveGrad(vec2 p, float t){
          vec2 g = vec2(0.0);
          vec2 d; float ph;
          d = normalize(vec2(1.0, 0.3));  ph = dot(d, p) * 0.12 + t * 0.9; g += d * cos(ph) * 0.072;
          d = normalize(vec2(-0.4, 1.0)); ph = dot(d, p) * 0.21 + t * 1.2; g += d * cos(ph) * 0.063;
          d = normalize(vec2(0.7, -0.6)); ph = dot(d, p) * 0.47 + t * 1.7; g += d * cos(ph) * 0.056;
          d = normalize(vec2(-0.9, -0.2)); ph = dot(d, p) * 0.93 + t * 2.3; g += d * cos(ph) * 0.056;
          d = normalize(vec2(0.2, 0.9));  ph = dot(d, p) * 1.9 + t * 3.1; g += d * cos(ph) * 0.057;
          d = normalize(vec2(-0.6, 0.7)); ph = dot(d, p) * 3.7 + t * 4.0; g += d * cos(ph) * 0.055;
          return g;
        }
        void main(){
          vec3 V = normalize(uCam - vWorld);
          float dist = length(uCam - vWorld);
          vec2 g = waveGrad(vWorld.xz, uTime) * mix(1.0, 0.18, smoothstep(40.0, 700.0, dist));
          vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
          vec3 R = reflect(-V, N);
          R.y = abs(R.y);
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 col = mix(vec3(0.01, 0.018, 0.035), skyColor(R), fres);
          float sp = max(dot(R, normalize(uGlowDir)), 0.0);
          col += vec3(1.0, 0.72, 0.45) * (pow(sp, 700.0) * 14.0 + pow(sp, 70.0) * 0.45) * uSunAmt;
          gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
        }`,
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), mat);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.y = SEA_Y;
    this.ocean.frustumCulled = false;
    this.group.add(this.ocean);
  }

  buildLand(seg) {
    const mat = new THREE.ShaderMaterial({
      uniforms: this.shared,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        varying vec3 vN;
        ${snoise}
        ${landGlsl}
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec2 p = wp.xz;
          float h = landH(p);
          float e = 1.5;
          vN = normalize(vec3(h - landH(p + vec2(e, 0.0)), e, h - landH(p + vec2(0.0, e))));
          wp.y = h;
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir, uSunCol, uHead;
        uniform float uHeadAmt;
        varying vec3 vWorld;
        varying vec3 vN;
        ${hash}
        ${fogChunk}
        void main(){
          vec3 n = normalize(vN);
          float hgt = vWorld.y - (${GROUND_Y.toFixed(1)});
          vec3 col = mix(vec3(0.03, 0.026, 0.04), vec3(0.07, 0.048, 0.058), smoothstep(0.0, 70.0, hgt));
          float sunL = max(dot(n, normalize(uSunDir)), 0.0);
          col += uSunCol * pow(sunL, 1.4) * 0.16;
          float sand = smoothstep(${(SEA_Y + 2.6).toFixed(2)}, ${(SEA_Y + 0.2).toFixed(2)}, vWorld.y);
          col = mix(col, vec3(0.13, 0.09, 0.08) + uSunCol * sunL * 0.12, sand);
          float wl = vWorld.y - (${SEA_Y.toFixed(2)}) - 0.1 * sin(uTime * 0.9 + vWorld.z * 0.08 + vWorld.x * 0.05);
          col += vec3(0.8, 0.74, 0.7) * smoothstep(0.3, 0.0, abs(wl - 0.12)) * 0.5;
          // houses lit up across the hills
          vec2 cell = floor(vWorld.xz / 7.0);
          vec2 f = fract(vWorld.xz / 7.0);
          float r = hash21(cell);
          float dm = smoothstep(0.15, 0.0, length(f - vec2(0.25 + 0.5 * hash21(cell + 3.1), 0.25 + 0.5 * hash21(cell + 7.7))));
          float band = smoothstep(10.0, 16.0, hgt) * (1.0 - smoothstep(80.0, 95.0, hgt));
          float flick = 0.85 + 0.15 * sin(uTime * (0.5 + r * 2.0) + r * 30.0);
          col += mix(vec3(1.0, 0.7, 0.4), vec3(1.0, 0.9, 0.74), hash21(cell + 9.0)) * step(0.82, r) * dm * band * flick * 1.5;
          float dh = length(vWorld - uHead);
          col += vec3(0.45, 1.0, 0.7) * uHeadAmt * 0.25 / (1.0 + dh * dh * 0.12);
          gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
        }`,
    });
    const geo = new THREE.PlaneGeometry(900, 900, seg, seg);
    geo.rotateX(-Math.PI / 2);
    this.land = new THREE.Mesh(geo, mat);
    this.land.position.set(0, 0, -200);
    this.land.frustumCulled = false;
    this.group.add(this.land);
  }

  buildRoad() {
    const verts = [];
    const uvs = [];
    const idx = [];
    let dist = 0;
    let prev = null;
    let i = 0;
    for (let z = 10; z >= ROAD_END - 40; z -= 0.6, i++) {
      const c = new THREE.Vector3(roadX(z), GROUND_Y - 0.2, z);
      const n = new THREE.Vector3(roadX(z - 0.3) - roadX(z + 0.3), 0, -0.6).normalize();
      const side = new THREE.Vector3(-n.z, 0, n.x);
      if (prev) dist += c.distanceTo(prev);
      prev = c;
      const l = c.clone().addScaledVector(side, -ROAD_W / 2);
      const r = c.clone().addScaledVector(side, ROAD_W / 2);
      verts.push(l.x, l.y, l.z, r.x, r.y, r.z);
      uvs.push(dist, 0, dist, 1);
      if (i > 0) {
        const b = (i - 1) * 2;
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.shared,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorld;
        void main(){
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uHead, uSunCol;
        uniform float uHeadAmt;
        varying vec2 vUv;
        varying vec3 vWorld;
        ${roadGlsl}
        ${fogChunk}
        void main(){
          float v = vUv.y;
          float s = vUv.x;
          vec3 col = vec3(0.02, 0.019, 0.024);
          float edge = smoothstep(0.04, 0.025, v) + smoothstep(0.96, 0.975, v);
          col += vec3(0.6, 0.57, 0.55) * edge * 0.45;
          float center = smoothstep(0.02, 0.01, abs(v - 0.5)) * step(0.5, fract(s * 0.11));
          col += vec3(0.95, 0.72, 0.3) * center * 0.45;
          float zl = floor(vWorld.z / ${LAMP_GAP.toFixed(1)} + 0.5) * ${LAMP_GAP.toFixed(1)};
          vec2 lamp = vec2(roadX(zl) + ${(LAMP_DX - 1.6).toFixed(2)}, zl);
          float dl = length(vWorld.xz - lamp);
          col += vec3(1.0, 0.7, 0.42) * exp(-dl * dl * 0.05) * 0.07;
          float dh = length(vWorld.xz - uHead.xz);
          col += vec3(0.55, 1.0, 0.75) * uHeadAmt * exp(-dh * 0.45) * 0.18;
          col += uSunCol * 0.025;
          gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
        }`,
    });
    this.road = new THREE.Mesh(geo, mat);
    this.road.frustumCulled = false;
    this.group.add(this.road);
  }

  buildLamps() {
    const pole = new THREE.CylinderGeometry(0.07, 0.1, 7.6, 6);
    pole.translate(0, 3.8, 0);
    const arm = new THREE.BoxGeometry(1.7, 0.08, 0.08);
    arm.translate(-0.85, 7.5, 0);
    const head = new THREE.BoxGeometry(0.5, 0.14, 0.24);
    head.translate(-1.55, 7.4, 0);
    const geo = mergeGeometries([pole, arm, head].map((g) => {
      g.deleteAttribute('normal');
      g.deleteAttribute('uv');
      return g;
    }));
    const zs = [];
    for (let z = 0; z >= ROAD_END - 20; z -= LAMP_GAP) zs.push(z);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#08060c' }), zs.length);
    const m4 = new THREE.Matrix4();
    const glow = new Float32Array(zs.length * 3);
    zs.forEach((z, i) => {
      const x = roadX(z) + LAMP_DX;
      m4.makeTranslation(x, GROUND_Y - 0.3, z);
      mesh.setMatrixAt(i, m4);
      glow.set([x - 1.55, GROUND_Y + 7.0, z], i * 3);
    });
    mesh.frustumCulled = false;
    this.group.add(mesh);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(glow, 3));
    this.lampUniforms = { uPixelRatio: { value: 1 }, uAmt: { value: 1 } };
    const pts = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.lampUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform float uPixelRatio;
          varying float vD;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            vD = -mv.z;
            gl_PointSize = uPixelRatio * clamp(260.0 / vD, 3.0, 90.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uAmt;
          varying float vD;
          void main(){
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float a = exp(-d * d * 7.0) * 1.4 + exp(-d * 2.5) * 0.25;
            gl_FragColor = vec4(vec3(1.0, 0.74, 0.46) * a * uAmt, 1.0);
          }`,
      })
    );
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  buildPalms(low) {
    const rand = rng(8128);
    const variants = [0, 1, 2].map(() => palmGeometry(rand));
    const spots = [[], [], []];
    const add = (x, y, z, s) => spots[Math.floor(rand() * 3)].push([x, y, z, s, rand() * Math.PI * 2]);
    // inland side of the road
    for (let z = 6; z >= ROAD_END - 30; z -= 7 + rand() * (low ? 9 : 6)) {
      const dx = 7 + rand() * 3;
      add(roadX(z) + dx, GROUND_Y - 0.3, z, 11 + rand() * 6);
    }
    // beach side
    for (let z = 2; z >= ROAD_END - 30; z -= 11 + rand() * (low ? 14 : 9)) {
      const dx = -(6.5 + rand() * 5);
      add(roadX(z) + dx, beachY(dx) - 0.2, z, 10 + rand() * 6);
    }
    // a cluster by the house
    for (let k = 0; k < 4; k++) {
      add(this.beaconPos.x + 4 + rand() * 12, GROUND_Y - 0.5, this.beaconPos.z + (rand() - 0.5) * 20, 12 + rand() * 4);
    }
    const mat = new THREE.MeshBasicMaterial({ color: '#07050b', side: THREE.DoubleSide });
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    variants.forEach((geo, vi) => {
      const list = spots[vi];
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, y, z, s, r], i) => {
        q.setFromAxisAngle(up, r);
        m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
        mesh.setMatrixAt(i, m4);
      });
      mesh.frustumCulled = false;
      this.group.add(mesh);
    });
  }

  // Distant ridges all around, open towards the sunset over the water.
  buildRidges() {
    const sunAz = Math.atan2(SUN_DIR.z, SUN_DIR.x);
    const mk = (R, base, amp, color, seed) => {
      const N = 360;
      const verts = [];
      const idx = [];
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        let d = Math.abs(a - sunAz) % (Math.PI * 2);
        if (d > Math.PI) d = Math.PI * 2 - d;
        const mask = smoothstep(0.3, 1.0, d);
        const h =
          (base +
            amp * (0.55 + 0.25 * Math.sin(a * 3 + seed) + 0.12 * Math.sin(a * 7 + seed * 2) + 0.08 * Math.sin(a * 17 + seed * 3))) *
          mask;
        const x = Math.cos(a) * R;
        const z = Math.sin(a) * R - 150;
        verts.push(x, SEA_Y - 4, z, x, SEA_Y + h, z);
        if (i < N) {
          const b = i * 2;
          idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false, transparent: true }));
      m.frustumCulled = false;
      this.group.add(m);
      return m;
    };
    this.ridges = [mk(980, 20, 120, '#3a2340', 1.3), mk(720, 10, 85, '#1d1222', 4.1)];
  }

  buildBayLights(count) {
    const rand = rng(77);
    const sunAz = Math.atan2(SUN_DIR.z, SUN_DIR.x);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const a = sunAz + side * (0.32 + rand() * 0.9);
      const R = 700 + rand() * 18;
      pos.set([Math.cos(a) * R, SEA_Y + 1 + Math.pow(rand(), 2) * 24, Math.sin(a) * R - 150], i * 3);
      seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.bayUniforms = { uTime: this.shared.uTime, uPixelRatio: { value: 1 }, uAmt: { value: 1 } };
    const pts = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.bayUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform float uTime, uPixelRatio;
          attribute float aSeed;
          varying float vA;
          void main(){
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uPixelRatio * (1.5 + aSeed * 2.0);
            vA = 0.6 + 0.4 * sin(uTime * (1.0 + aSeed * 4.0) + aSeed * 60.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uAmt;
          varying float vA;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            gl_FragColor = vec4(vec3(1.0, 0.8, 0.55) * smoothstep(0.5, 0.0, d) * vA * 1.6 * uAmt, 1.0);
          }`,
      })
    );
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  // A modern house on the hillside: the destination.
  buildHouse() {
    const b = this.beaconPos;
    const house = new THREE.Group();
    const dark = new THREE.MeshBasicMaterial({ color: '#0d0a10' });
    const slab = new THREE.MeshBasicMaterial({ color: '#1a1418' });
    const lower = new THREE.Mesh(new THREE.BoxGeometry(9, 4.6, 14), dark);
    lower.position.set(0, 0.3, 0);
    const base = new THREE.Mesh(new THREE.BoxGeometry(9.4, 3, 14.4), dark);
    base.position.set(0, -1.5, 0);
    const roof1 = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.35, 15.4), slab);
    roof1.position.set(-0.4, 2.75, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(7, 3.6, 9), dark);
    upper.position.set(1, 4.4, -1.5);
    const roof2 = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.3, 10.2), slab);
    roof2.position.set(0.6, 6.35, -1.5);
    house.add(base, lower, roof1, upper, roof2);
    // warm glass along the road-facing side
    const glass = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        void main(){
          vec2 g = fract(vUv * vec2(3.0, 2.0));
          float pane = step(0.05, g.x) * step(g.x, 0.95) * step(0.07, g.y) * step(g.y, 0.93);
          vec3 warm = mix(vec3(0.85, 0.42, 0.18), vec3(1.0, 0.72, 0.45), vUv.y) * 0.55;
          warm += vec3(1.0, 0.78, 0.5) * exp(-length(vUv - vec2(0.68, 0.7)) * 5.0) * 0.6;
          gl_FragColor = vec4(mix(vec3(0.02, 0.016, 0.02), warm, pane), 1.0);
        }`,
    });
    const win = (w, h, y, z, x) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
      m.rotation.y = -Math.PI / 2;
      m.position.set(x, y, z);
      house.add(m);
    };
    win(3.2, 2.6, 0.9, -4, -4.52);
    win(3.2, 2.6, 0.9, 0, -4.52);
    win(3.2, 2.6, 0.9, 4, -4.52);
    win(5.6, 2.2, 4.4, -1.5, -2.52);
    house.position.set(b.x + 8, GROUND_Y + 0.6, b.z);
    this.group.add(house);
  }

  buildTrail() {
    this.trailUniforms = { uTime: this.shared.uTime, uFill: { value: 0 } };
    const geo = new THREE.TubeGeometry(this.route, 1200, 0.09, 8, false);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.trailUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uFill, uTime;
        varying vec2 vUv;
        void main(){
          float x = vUv.x;
          float behind = uFill - x;
          float on = step(0.0005, uFill);
          float traveled = step(0.0, behind) * on;
          float tail = exp(-max(behind, 0.0) * 9.0);
          float head = exp(-abs(behind) * 220.0) * on;
          vec3 c = vec3(0.2, 1.0, 0.55) * tail * traveled * 0.85;
          c += vec3(0.9, 1.0, 0.92) * head * 1.8;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.trail = new THREE.Mesh(geo, mat);
    this.trail.frustumCulled = false;
    this.group.add(this.trail);

    this.head = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uAmt: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uAmt; varying vec2 vUv;
          void main(){
            float d = length(vUv - 0.5) * 2.0;
            float g = exp(-d * d * 34.0) * 0.38 + exp(-d * 6.0) * 0.03;
            gl_FragColor = vec4(vec3(0.7, 1.0, 0.82) * g * uAmt, 1.0);
          }`,
      })
    );
    this.head.scale.setScalar(2.6);
    this.group.add(this.head);
  }

  buildBeacon() {
    this.beaconUniforms = { uTime: this.shared.uTime, uAmt: { value: 0 } };
    const rings = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShaderMaterial({
        uniforms: this.beaconUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uAmt, uTime; varying vec2 vUv;
          void main(){
            float r = length(vUv - 0.5) * 40.0;
            float w = fract(r / 6.0 - uTime * 0.55);
            float ring = smoothstep(0.0, 0.05, w) * smoothstep(0.18, 0.05, w);
            float fade = smoothstep(20.0, 3.0, r);
            float core = exp(-r * 0.5);
            vec3 c = vec3(0.45, 1.0, 0.65) * (ring * fade * 0.9 + core * 0.5);
            gl_FragColor = vec4(c * uAmt, 1.0);
          }`,
      })
    );
    rings.rotation.x = -Math.PI / 2;
    rings.position.copy(this.beaconPos).setY(GROUND_Y - 0.05);
    this.group.add(rings);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 1.6, 40, 32, 1, true),
      new THREE.ShaderMaterial({
        uniforms: this.beaconUniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){
            vUv = uv;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uAmt, uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){
            float core = abs(dot(normalize(vN), normalize(vV)));
            float fade = pow(1.0 - vUv.y, 2.5);
            gl_FragColor = vec4(vec3(0.45, 1.0, 0.65) * core * fade * 0.5 * uAmt, 1.0);
          }`,
      })
    );
    beam.position.copy(this.beaconPos).setY(GROUND_Y + 20);
    this.group.add(beam);
  }

  buildSplash() {
    const mk = (color) =>
      new THREE.Mesh(
        new THREE.RingGeometry(0.92, 1, 96),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color).multiplyScalar(1.3),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide,
          fog: false,
        })
      );
    this.splashA = mk('#bfffd9');
    this.splashB = mk('#ceff65');
    for (const s of [this.splashA, this.splashB]) {
      s.rotation.x = -Math.PI / 2;
      s.position.copy(this.landing).setY(GROUND_Y - 0.12);
      this.group.add(s);
    }
  }

  update(time, camera, pixelRatio, { fill, splash, beacon, fogColor, fogDensity, sunColor }) {
    const s = this.shared;
    s.uTime.value = time;
    s.uCam.value.copy(camera.position);
    s.uFogColor.value.copy(fogColor);
    s.uFogDensity.value = fogDensity;
    if (sunColor) s.uSunCol.value.copy(sunColor);
    this.ocean.position.x = camera.position.x;
    this.ocean.position.z = camera.position.z;
    this.lampUniforms.uPixelRatio.value = pixelRatio;
    this.bayUniforms.uPixelRatio.value = pixelRatio;
    this.trailUniforms.uFill.value = fill;

    const head = this.route.getPointAt(Math.min(fill, 1));
    s.uHead.value.copy(head);
    s.uHeadAmt.value = fill > 0.0005 ? Math.min(1, fill * 30) * (1 - beacon * 0.7) : 0;
    this.head.position.copy(head).setY(head.y + 0.1);
    this.head.quaternion.copy(camera.quaternion);
    this.head.material.uniforms.uAmt.value = s.uHeadAmt.value * (1 - beacon);
    this.beaconUniforms.uAmt.value = beacon;

    // Ridges and bay lights fade in with the rest of the world.
    const reveal = Math.max(0, 1 - fogDensity * 14);
    for (const r of this.ridges) r.material.opacity = reveal;
    this.bayUniforms.uAmt.value = reveal;
    this.lampUniforms.uAmt.value = Math.max(0, 1 - fogDensity * 9);

    const s1 = splash;
    const s2 = Math.max(0, splash - 0.15) / 0.85;
    this.splashA.scale.setScalar(1 + s1 * 10);
    this.splashA.material.opacity = s1 > 0 && s1 < 1 ? 1 - s1 : 0;
    this.splashB.scale.setScalar(1 + s2 * 8);
    this.splashB.material.opacity = s2 > 0 && s2 < 1 ? 1 - s2 : 0;
  }
}
