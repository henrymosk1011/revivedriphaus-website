import * as THREE from 'three';
import { snoise, pointFrag } from './glsl.js';
import { rng } from './util.js';

export const TUNNEL_ORIGIN = new THREE.Vector3(0, -500, 0);
export const TUNNEL_LENGTH = 420;
export const TUNNEL_RADIUS = 7;

// The vessel bends gently; camera, walls and particles share this curve.
export function bend(z, out = new THREE.Vector2()) {
  return out.set(Math.sin(z * 0.013) * 7 + Math.sin(z * 0.031) * 2, Math.cos(z * 0.0095) * 4 - 4 + Math.sin(z * 0.027) * 1.5);
}
const bendGlsl = /* glsl */ `
  vec2 bend(float z){
    return vec2(sin(z * 0.013) * 7.0 + sin(z * 0.031) * 2.0, cos(z * 0.0095) * 4.0 - 4.0 + sin(z * 0.027) * 1.5);
  }
`;

// Inside the bloodstream: living walls, drifting cells and streams of
// glowing nutrients, the "how it works" part of the story.
export class Tunnel {
  constructor({ quality = 'high' } = {}) {
    const low = quality === 'low';
    this.group = new THREE.Group();
    this.group.position.copy(TUNNEL_ORIGIN);
    this.uniforms = {
      uTime: { value: 0 },
      uCamZ: { value: 0 },
      uPixelRatio: { value: 1 },
      uExit: { value: 0 },
    };

    this.buildWalls(low);
    this.buildCells(low ? 120 : 240);
    this.buildNutrients(low ? 2500 : 5200);
    this.buildPortal();
  }

  buildWalls(low) {
    const L = TUNNEL_LENGTH + 40;
    const geo = new THREE.CylinderGeometry(TUNNEL_RADIUS, TUNNEL_RADIUS, L, low ? 48 : 80, low ? 200 : 360, true);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -L / 2 + 20);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vLocal;
        varying float vAngle;
        varying float vDisp;
        varying vec3 vViewPos;
        ${snoise}
        ${bendGlsl}
        void main(){
          vec3 p = position;
          float a = atan(p.y, p.x);
          vec3 q = vec3(cos(a) * 1.6, sin(a) * 1.6, p.z * 0.045 + uTime * 0.12);
          float n = snoise(q) * 0.9 + snoise(q * 2.7) * 0.35;
          float throb = sin(p.z * 0.25 - uTime * 2.2) * 0.25;
          float r = ${TUNNEL_RADIUS.toFixed(1)} + n * 1.4 + throb;
          vec2 b = bend(p.z);
          p.xy = vec2(cos(a), sin(a)) * r + b;
          vLocal = p;
          vAngle = a;
          vDisp = n;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vViewPos = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uExit;
        varying vec3 vLocal;
        varying float vAngle;
        varying float vDisp;
        varying vec3 vViewPos;
        ${snoise}
        void main(){
          float z = vLocal.z;
          vec3 q = vec3(cos(vAngle) * 2.2, sin(vAngle) * 2.2, z * 0.07 - uTime * 0.25);
          float v = abs(snoise(q));
          float v2 = abs(snoise(q * 2.3 + 4.0));
          float veins = smoothstep(0.07, 0.0, v) + smoothstep(0.05, 0.0, v2) * 0.55;
          vec3 base = mix(vec3(0.035, 0.002, 0.007), vec3(0.17, 0.012, 0.026), smoothstep(-0.8, 0.9, vDisp));
          vec3 col = base;
          col += vec3(1.0, 0.3, 0.33) * veins * 0.42;
          float band = smoothstep(0.65, 1.0, sin(z * 0.35 + uTime * 3.0) * 0.5 + 0.5);
          col += vec3(0.38, 0.03, 0.06) * band * 0.25;
          float dist = length(vViewPos);
          float fog = 1.0 - exp(-dist * 0.028);
          vec3 fogCol = mix(vec3(0.022, 0.0, 0.004), vec3(0.75, 1.0, 0.85), uExit * smoothstep(40.0, 120.0, dist));
          col = mix(col, fogCol, fog);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.walls = new THREE.Mesh(geo, mat);
    this.walls.frustumCulled = false;
    this.group.add(this.walls);
  }

  buildCells(count) {
    // A biconcave disc: the classic red blood cell.
    const prof = [
      [0, 0.16], [0.3, 0.19], [0.62, 0.3], [0.86, 0.36], [0.99, 0.24], [1.03, 0],
      [0.99, -0.24], [0.86, -0.36], [0.62, -0.3], [0.3, -0.19], [0, -0.16],
    ]
      .reverse() // bottom-to-top so faces point outward
      .map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(prof, 40);
    geo.computeVertexNormals();
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#c3141f'),
      roughness: 0.34,
      metalness: 0,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
      sheen: 1,
      sheenColor: new THREE.Color('#ff9a9a'),
      sheenRoughness: 0.4,
      emissive: new THREE.Color('#3d0307'),
      emissiveIntensity: 0.7,
      envMapIntensity: 0.55,
    });
    this.cells = new THREE.InstancedMesh(geo, mat, count);
    this.cells.frustumCulled = false;
    const rand = rng(99);
    this.cellData = [];
    for (let i = 0; i < count; i++) {
      const z = 10 - rand() * (TUNNEL_LENGTH + 10);
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * (TUNNEL_RADIUS - 2.2);
      this.cellData.push({
        z,
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        s: 0.55 + rand() * 0.55,
        rx: rand() * Math.PI,
        ry: rand() * Math.PI,
        sp: 0.2 + rand() * 0.5,
        ph: rand() * 10,
      });
    }
    this.group.add(this.cells);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._b = new THREE.Vector2();
    this.layoutCells(0, 0, Infinity);
  }

  layoutCells(time, camZ, range) {
    for (let i = 0; i < this.cellData.length; i++) {
      const c = this.cellData[i];
      const z = c.z + Math.sin(time * 0.3 + c.ph) * 1.5;
      // only animate cells near the camera; the rest keep their last pose
      if (Math.abs(z - camZ) > range) continue;
      const b = bend(z, this._b);
      this._p.set(c.x + b.x + Math.sin(time * c.sp + c.ph) * 0.35, c.y + b.y + Math.cos(time * c.sp * 0.8 + c.ph) * 0.35, z);
      this._e.set(c.rx + time * c.sp * 0.6, c.ry + time * c.sp * 0.4, 0);
      this._q.setFromEuler(this._e);
      this._s.setScalar(c.s);
      this._m.compose(this._p, this._q, this._s);
      this.cells.setMatrixAt(i, this._m);
    }
    this.cells.instanceMatrix.needsUpdate = true;
  }

  buildNutrients(count) {
    const rand = rng(5);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.pow(rand(), 0.6) * (TUNNEL_RADIUS - 0.8);
      pos.set([Math.cos(a) * r, Math.sin(a) * r, -rand() * TUNNEL_LENGTH], i * 3);
      seed[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uPixelRatio;
        attribute float aSeed;
        varying float vSeed;
        varying float vA;
        ${bendGlsl}
        void main(){
          vec3 p = position;
          float L = ${TUNNEL_LENGTH.toFixed(1)};
          p.z = -mod(-p.z + uTime * (3.0 + aSeed * 7.0), L);
          float sw = uTime * (0.4 + aSeed) + aSeed * 30.0;
          p.x += sin(sw) * 0.4;
          p.y += cos(sw * 1.3) * 0.4;
          p.xy += bend(p.z);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = max(-mv.z, 0.01);
          gl_PointSize = uPixelRatio * (14.0 + aSeed * 46.0) / dist;
          vA = smoothstep(0.2, 2.0, dist) * smoothstep(160.0, 40.0, dist);
          vSeed = aSeed;
        }`,
      fragmentShader: /* glsl */ `
        varying float vSeed;
        varying float vA;
        ${pointFrag}
        void main(){
          float a = softDot(gl_PointCoord);
          vec3 col = vSeed > 0.8 ? vec3(0.85, 1.0, 0.45) : (vSeed > 0.45 ? vec3(0.45, 1.0, 0.68) : vec3(0.9, 1.0, 0.95));
          gl_FragColor = vec4(col * 2.0, a * vA);
        }`,
    });
    this.nutrients = new THREE.Points(geo, mat);
    this.nutrients.frustumCulled = false;
    this.group.add(this.nutrients);
  }

  // A bright opening at the end of the vessel that the camera flies through.
  buildPortal() {
    const portal = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; varying vec2 vUv;
          void main(){
            float d = length(vUv - 0.5) * 2.0;
            float g = exp(-d * d * 8.0) * 0.6 + exp(-d * 3.5) * 0.12;
            float rays = 0.85 + 0.15 * sin(atan(vUv.y - 0.5, vUv.x - 0.5) * 14.0 + uTime);
            gl_FragColor = vec4(vec3(0.7, 1.0, 0.82) * g * rays, 1.0);
          }`,
      })
    );
    const b = bend(-TUNNEL_LENGTH);
    portal.position.set(b.x, b.y, -TUNNEL_LENGTH - 6);
    this.portal = portal;
    this.group.add(portal);
  }

  update(time, camera, pixelRatio, { exit = 0 } = {}) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uPixelRatio.value = pixelRatio;
    u.uExit.value = exit;

    this.layoutCells(time, camera.position.z - TUNNEL_ORIGIN.z, 140);
  }
}
