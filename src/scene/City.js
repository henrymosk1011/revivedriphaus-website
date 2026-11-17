import * as THREE from 'three';
import { hash } from './glsl.js';
import { rng } from './util.js';

export const GROUND_Y = -60;
const BLOCK = 14;

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

// "We come to you": a night city in the brand palette. The falling drop lands
// on a street and becomes a light trail that races to a beacon at your door.
export class City {
  constructor({ quality = 'high' } = {}) {
    this.group = new THREE.Group();
    const low = quality === 'low';

    this.shared = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uFogColor: { value: new THREE.Color('#03140c') },
      uFogDensity: { value: 0.0085 },
      uHead: { value: new THREE.Vector3(0, GROUND_Y, 0) },
      uHeadAmt: { value: 0 },
    };

    // --- Route ------------------------------------------------------------
    const pts = [
      [0, 0], [0, -22], [9, -50], [-5, -84], [-27, -110], [-35, -146],
      [-15, -180], [17, -203], [34, -234], [31, -262],
    ].map(([x, z]) => new THREE.Vector3(x, GROUND_Y + 0.35, z));
    this.route = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.landing = pts[0].clone();
    this.destination = pts[pts.length - 1].clone();
    const routeSamples = this.route.getSpacedPoints(260);

    this.buildGround();
    this.buildBuildings(routeSamples, low ? 0.55 : 1);
    this.buildHorizon(low ? 3500 : 7000);
    this.buildTrail();
    this.buildBeacon();
    this.buildSplash();
  }

  buildGround() {
    const mat = new THREE.ShaderMaterial({
      uniforms: this.shared,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uHead;
        uniform float uHeadAmt;
        varying vec3 vWorld;
        ${fogChunk}
        void main(){
          vec2 p = vWorld.xz;
          float blk = ${BLOCK.toFixed(1)};
          vec2 d = abs(fract(p / blk + 0.5) - 0.5) * blk;
          float m = min(d.x, d.y);
          float street = 1.0 - smoothstep(0.0, 1.8, m);
          float lane = 1.0 - smoothstep(0.0, 0.09, m);
          vec3 col = vec3(0.004, 0.013, 0.009);
          col += vec3(0.018, 0.06, 0.035) * street;
          col += vec3(0.25, 0.8, 0.45) * lane * 0.22;
          // traffic: little light dashes moving along both street directions
          float row = floor(p.y / blk + 0.5);
          float colI = floor(p.x / blk + 0.5);
          float carsX = step(d.y, 0.45) * pow(fract(p.x * 0.045 + uTime * (0.35 + fract(row * 0.37) * 0.4) + row * 0.37), 24.0);
          float carsZ = step(d.x, 0.45) * pow(fract(-p.y * 0.045 + uTime * (0.3 + fract(colI * 0.61) * 0.4) + colI * 0.61), 24.0);
          col += vec3(1.0, 0.82, 0.55) * carsX * 1.6 + vec3(0.55, 1.0, 0.72) * carsZ * 1.3;
          float dh = length(p - uHead.xz);
          col += vec3(0.3, 1.0, 0.55) * uHeadAmt * (exp(-dh * 0.2) * 0.9 + exp(-dh * 0.05) * 0.05);
          gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
        }`,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, GROUND_Y, -130);
    this.group.add(ground);
  }

  buildBuildings(routeSamples, density) {
    const rand = rng(20251117);
    const lots = [];
    const nearRoute = (x, z, r) => {
      for (let i = 0; i < routeSamples.length; i++) {
        const s = routeSamples[i];
        const dx = s.x - x;
        const dz = s.z - z;
        if (dx * dx + dz * dz < r * r) return true;
      }
      return false;
    };
    const clusters = [
      { x: -72, z: -150, r: 34, h: 70 }, // "downtown"
      { x: 58, z: -70, r: 26, h: 34 },
      { x: 70, z: -250, r: 30, h: 46 },
    ];
    for (let i = -10; i < 10; i++) {
      for (let j = -24; j < 6; j++) {
        const cx = (i + 0.5) * BLOCK;
        const cz = (j + 0.5) * BLOCK;
        const inner = BLOCK - 3.4;
        const split = rand() < 0.55 ? 2 : 1;
        for (let a = 0; a < split; a++) {
          for (let b = 0; b < split; b++) {
            if (rand() > density) continue;
            const size = inner / split;
            const w = size * (0.62 + rand() * 0.34);
            const d = size * (0.62 + rand() * 0.34);
            const x = cx - inner / 2 + size * (a + 0.5);
            const z = cz - inner / 2 + size * (b + 0.5);
            if (nearRoute(x, z, Math.max(w, d) * 0.5 + 6.5)) continue;
            if (Math.hypot(x - this.destination.x, z - this.destination.z) < 12) continue;
            if (Math.hypot(x - this.landing.x, z - this.landing.z) < 22) continue;
            let h = 2.5 + rand() * rand() * 12;
            for (const c of clusters) {
              const dd = Math.hypot(x - c.x, z - c.z);
              h += c.h * Math.exp(-(dd * dd) / (2 * c.r * c.r)) * (0.35 + rand() * 0.9);
            }
            lots.push([x, z, w, h, d, rand()]);
          }
        }
      }
    }

    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const info = new Float32Array(lots.length * 4);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.shared,
      vertexShader: /* glsl */ `
        attribute vec4 aInfo;
        varying vec3 vWorld;
        varying vec3 vN;
        varying vec2 vUv;
        varying vec4 vInfo;
        void main(){
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vN = normal;
          vUv = uv;
          vInfo = aInfo;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uHead;
        uniform float uHeadAmt;
        varying vec3 vWorld;
        varying vec3 vN;
        varying vec2 vUv;
        varying vec4 vInfo;
        ${hash}
        ${fogChunk}
        void main(){
          vec3 n = normalize(vN);
          float seed = vInfo.w;
          vec3 col = mix(vec3(0.008, 0.026, 0.017), vec3(0.018, 0.05, 0.034), seed);
          if (abs(n.y) < 0.5) {
            float faceW = abs(n.x) > 0.5 ? vInfo.z : vInfo.x;
            vec2 cells = vec2(max(1.0, floor(faceW / 0.8)), max(1.0, floor(vInfo.y / 1.1)));
            vec2 g = vUv * cells;
            vec2 id = floor(g);
            vec2 f = fract(g);
            float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.28, f.y) * step(f.y, 0.78);
            float r = hash21(id + seed * 91.7 + n.xz * 13.1);
            float lit = step(0.6, r);
            float flick = 0.85 + 0.15 * sin(uTime * (0.4 + r * 2.0) + r * 40.0);
            vec3 warm = vec3(1.0, 0.84, 0.58);
            vec3 green = vec3(0.42, 1.0, 0.62);
            vec3 wc = mix(warm, green, step(0.5, hash21(id.yx + seed * 13.0)));
            col += wc * win * lit * flick * (0.32 + 0.6 * hash21(id * 1.7 + seed));
            col *= 0.75 + 0.25 * vUv.y;
          } else {
            vec2 e = abs(vUv - 0.5) * 2.0;
            col += vec3(0.12, 0.6, 0.3) * smoothstep(0.9, 1.0, max(e.x, e.y)) * 0.35;
          }
          vec3 toH = uHead - vWorld;
          float dH = length(toH);
          float facing = max(dot(n, toH / max(dH, 0.001)), 0.0);
          col += vec3(0.35, 1.0, 0.6) * uHeadAmt * facing * 6.0 / (1.0 + dH * dH * 0.12);
          gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
        }`,
    });

    const mesh = new THREE.InstancedMesh(geo, mat, lots.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    lots.forEach(([x, z, w, h, d, seed], i) => {
      p.set(x, GROUND_Y, z);
      s.set(w, h, d);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      info.set([w, h, d, seed], i * 4);
    });
    geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4));
    mesh.frustumCulled = false;
    this.buildings = mesh;
    this.group.add(mesh);
  }

  // A carpet of far-off lights so the city runs to the horizon.
  buildHorizon(count) {
    const rand = rng(7);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = 140 + Math.pow(rand(), 0.7) * 520;
      const gx = Math.round((Math.cos(a) * r) / 7) * 7 + (rand() - 0.5) * 2;
      const gz = Math.round((Math.sin(a) * r) / 7) * 7 + (rand() - 0.5) * 2;
      pos.set([gx, GROUND_Y + 0.4, gz - 130], i * 3);
      seed[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.horizonUniforms = { uTime: this.shared.uTime, uPixelRatio: { value: 1 }, uAmt: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.horizonUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uPixelRatio;
        attribute float aSeed;
        varying float vA;
        varying float vSeed;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = -mv.z;
          gl_PointSize = uPixelRatio * (1.2 + aSeed * 2.4) * clamp(220.0 / dist, 0.6, 3.0);
          vA = (0.35 + 0.65 * aSeed) * smoothstep(900.0, 250.0, dist) * (0.75 + 0.25 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 50.0));
          vSeed = aSeed;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAmt;
        varying float vA;
        varying float vSeed;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          vec3 col = mix(vec3(1.0, 0.83, 0.56), vec3(0.45, 1.0, 0.66), step(0.55, vSeed));
          gl_FragColor = vec4(col * 1.3, a * vA * uAmt);
        }`,
    });
    this.horizon = new THREE.Points(geo, mat);
    this.horizon.frustumCulled = false;
    this.group.add(this.horizon);
  }

  buildTrail() {
    this.trailUniforms = { uTime: this.shared.uTime, uFill: { value: 0 } };
    const geo = new THREE.TubeGeometry(this.route, 900, 0.34, 10, false);
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
          float traveled = step(0.0, behind) * step(0.0005, uFill);
          float tail = exp(-max(behind, 0.0) * 5.0);
          float head = exp(-abs(behind) * 140.0) * step(0.0005, uFill);
          float pulse = 0.5 + 0.5 * sin(x * 700.0 - uTime * 12.0);
          vec3 c = vec3(0.12, 0.9, 0.45) * (0.3 + 0.7 * tail) * (0.65 + 0.35 * pulse) * traveled * 1.9;
          c += vec3(0.85, 1.0, 0.8) * head * 5.0;
          float ahead = (1.0 - traveled);
          float dash = step(0.62, fract(x * 160.0 + uTime * 0.5));
          c += vec3(0.5, 1.0, 0.4) * ahead * dash * 0.16;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.trail = new THREE.Mesh(geo, mat);
    this.trail.frustumCulled = false;
    this.group.add(this.trail);

    // A glowing head: the nurse en route.
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
            float g = exp(-d * d * 26.0) * 1.5 + exp(-d * 6.0) * 0.1;
            gl_FragColor = vec4(vec3(0.55, 1.0, 0.7) * g * uAmt, 1.0);
          }`,
      })
    );
    this.head.scale.setScalar(3.2);
    this.group.add(this.head);
  }

  buildBeacon() {
    this.beaconUniforms = { uTime: this.shared.uTime, uAmt: { value: 0 } };
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 2.4, 160, 48, 1, true),
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
            float edge = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
            float core = 1.0 - edge;
            float fade = pow(1.0 - vUv.y, 2.2);
            float flow = 0.75 + 0.25 * sin(vUv.y * 60.0 - uTime * 6.0);
            vec3 c = vec3(0.45, 1.0, 0.65) * (core * 1.2 + 0.2) * fade * flow * 0.6;
            gl_FragColor = vec4(c * uAmt, 1.0);
          }`,
      })
    );
    beam.position.copy(this.destination).setY(GROUND_Y + 80);
    this.group.add(beam);

    const rings = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShaderMaterial({
        uniforms: this.beaconUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uAmt, uTime; varying vec2 vUv;
          void main(){
            float r = length(vUv - 0.5) * 60.0;
            float w = fract(r / 9.0 - uTime * 0.55);
            float ring = smoothstep(0.0, 0.04, w) * smoothstep(0.16, 0.04, w);
            float fade = smoothstep(30.0, 4.0, r);
            float core = exp(-r * 0.4) * 2.5;
            vec3 c = vec3(0.45, 1.0, 0.65) * (ring * fade * 0.9 + core * 0.18);
            gl_FragColor = vec4(c * uAmt, 1.0);
          }`,
      })
    );
    rings.rotation.x = -Math.PI / 2;
    rings.position.copy(this.destination).setY(GROUND_Y + 0.08);
    this.group.add(rings);
  }

  buildSplash() {
    const mk = (color) =>
      new THREE.Mesh(
        new THREE.RingGeometry(0.92, 1, 96),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color).multiplyScalar(2.5),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        })
      );
    this.splashA = mk('#bfffd9');
    this.splashB = mk('#ceff65');
    for (const s of [this.splashA, this.splashB]) {
      s.rotation.x = -Math.PI / 2;
      s.position.copy(this.landing).setY(GROUND_Y + 0.12);
      this.group.add(s);
    }
  }

  // fill: trail progress 0-1, splash: 0-1 progress of the landing ripple,
  // beacon: 0-1 destination intensity.
  update(time, camera, pixelRatio, { fill, splash, beacon }) {
    this.shared.uTime.value = time;
    this.shared.uCam.value.copy(camera.position);
    this.horizonUniforms.uPixelRatio.value = pixelRatio;
    this.trailUniforms.uFill.value = fill;

    const head = this.route.getPointAt(Math.min(fill, 1));
    this.shared.uHead.value.copy(head);
    this.shared.uHeadAmt.value = fill > 0.0005 ? Math.min(1, fill * 30) * (1 - beacon * 0.6) : 0;
    this.head.position.copy(head).setY(head.y + 0.6);
    this.head.quaternion.copy(camera.quaternion);
    this.head.material.uniforms.uAmt.value = this.shared.uHeadAmt.value * (1 - beacon);

    this.beaconUniforms.uAmt.value = beacon;

    const s1 = splash;
    const s2 = Math.max(0, splash - 0.15) / 0.85;
    this.splashA.scale.setScalar(1 + s1 * 16);
    this.splashA.material.opacity = s1 > 0 && s1 < 1 ? (1 - s1) * 1.2 : 0;
    this.splashB.scale.setScalar(1 + s2 * 9);
    this.splashB.material.opacity = s2 > 0 && s2 < 1 ? (1 - s2) : 0;
  }
}
