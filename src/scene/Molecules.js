import * as THREE from 'three';
import { rng } from './util.js';

// Stylised vitamin/mineral molecules: hexagonal rings with side chains,
// generated procedurally and rendered as glassy ball-and-stick models.
const ATOMS = {
  C: { color: '#0f6b3a', r: 0.42, emissive: 0.15 },
  O: { color: '#9af2c0', r: 0.38, emissive: 0.35 },
  N: { color: '#ceff65', r: 0.38, emissive: 0.6 },
  H: { color: '#eafff3', r: 0.24, emissive: 0.25 },
  S: { color: '#ffd76b', r: 0.46, emissive: 0.35 },
};

function generate(rand) {
  const atoms = [];
  const bonds = [];
  const add = (type, pos) => {
    atoms.push({ type, pos });
    return atoms.length - 1;
  };
  const bondLen = 1.45;
  const rings = 1 + Math.floor(rand() * 2.2);
  let origin = new THREE.Vector3();
  let ringAtoms = [];
  const normal = new THREE.Vector3(0, 0, 1);
  for (let r = 0; r < rings; r++) {
    const start = atoms.length;
    const ring = [];
    const size = rand() < 0.75 ? 6 : 5;
    const rad = bondLen / (2 * Math.sin(Math.PI / size));
    const rot = rand() * Math.PI;
    for (let k = 0; k < size; k++) {
      const a = rot + (k / size) * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, 0).add(origin);
      ring.push(add(rand() < 0.15 ? (rand() < 0.5 ? 'N' : 'O') : 'C', p));
    }
    for (let k = 0; k < size; k++) bonds.push([ring[k], ring[(k + 1) % size]]);
    if (r > 0 && ringAtoms.length) bonds.push([ringAtoms[Math.floor(rand() * ringAtoms.length)], start]);
    ringAtoms = ring;
    origin = origin.clone().add(new THREE.Vector3(rad * 2.2 + rand() * 1.5, (rand() - 0.5) * 2.5, (rand() - 0.5) * 2.0));
  }
  // Side chains and hydrogens off ring atoms.
  const base = atoms.length;
  for (let i = 0; i < base; i++) {
    if (rand() < 0.45) continue;
    const p = atoms[i].pos;
    const centroid = new THREE.Vector3();
    let n = 0;
    for (const [a, b] of bonds) {
      if (a === i) { centroid.add(atoms[b].pos); n++; }
      if (b === i) { centroid.add(atoms[a].pos); n++; }
    }
    centroid.divideScalar(Math.max(n, 1));
    const out = p.clone().sub(centroid).normalize();
    out.add(normal.clone().multiplyScalar((rand() - 0.5) * 0.9)).normalize();
    const chain = rand() < 0.4 ? 1 + Math.floor(rand() * 3) : 1;
    let prev = i;
    let cur = p.clone();
    for (let c = 0; c < chain; c++) {
      const type = c === chain - 1 ? (rand() < 0.5 ? 'H' : rand() < 0.7 ? 'O' : rand() < 0.5 ? 'N' : 'S') : 'C';
      const len = type === 'H' ? 1.05 : bondLen;
      const dir = out.clone().applyAxisAngle(normal, (rand() - 0.5) * 1.2);
      cur = cur.clone().add(dir.multiplyScalar(len));
      const idx = add(type, cur);
      bonds.push([prev, idx]);
      prev = idx;
    }
  }
  // Center it.
  const c = new THREE.Vector3();
  atoms.forEach((a) => c.add(a.pos));
  c.divideScalar(atoms.length);
  atoms.forEach((a) => a.pos.sub(c));
  return { atoms, bonds };
}

export class Molecules {
  constructor({ center, count = 9, spread = [30, 14, 150] } = {}) {
    this.group = new THREE.Group();
    this.group.position.copy(center);
    const rand = rng(424242);

    const sphere = new THREE.IcosahedronGeometry(1, 4);
    const cyl = new THREE.CylinderGeometry(0.11, 0.11, 1, 10, 1, true);
    cyl.translate(0, 0.5, 0);
    cyl.rotateX(Math.PI / 2); // along +z, from 0 to 1

    const atomMat = new THREE.MeshPhysicalMaterial({
      roughness: 0.16,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      iridescence: 0.4,
      iridescenceIOR: 1.4,
      envMapIntensity: 1.6,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.0,
    });
    // Per-instance emissive glow, scaled from instance colour.
    atomMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         #ifdef USE_COLOR
           totalEmissiveRadiance += vColor.rgb * vColor.rgb * 0.55;
         #endif`
      );
    };
    const bondMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b9e9cf'),
      roughness: 0.25,
      metalness: 0.7,
      envMapIntensity: 1.2,
      emissive: new THREE.Color('#1a5c38'),
      emissiveIntensity: 0.4,
    });

    this.items = [];
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const z = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < count; i++) {
      const { atoms, bonds } = generate(rand);
      const g = new THREE.Group();
      const am = new THREE.InstancedMesh(sphere, atomMat, atoms.length);
      atoms.forEach((a, k) => {
        const spec = ATOMS[a.type];
        m4.compose(a.pos, q.identity(), s.setScalar(spec.r));
        am.setMatrixAt(k, m4);
        am.setColorAt(k, new THREE.Color(spec.color));
      });
      const bm = new THREE.InstancedMesh(cyl, bondMat, bonds.length);
      bonds.forEach(([a, b], k) => {
        const pa = atoms[a].pos;
        const pb = atoms[b].pos;
        const dir = pb.clone().sub(pa);
        const len = dir.length();
        q.setFromUnitVectors(z, dir.normalize());
        m4.compose(pa, q, s.set(1, 1, len));
        bm.setMatrixAt(k, m4);
      });
      g.add(am, bm);

      // Lay molecules along the flight path, alternating sides.
      const side = i % 2 === 0 ? -1 : 1;
      g.position.set(
        side * (5 + rand() * spread[0] * 0.5),
        (rand() - 0.5) * spread[1],
        -(i / (count - 1)) * spread[2] + (rand() - 0.5) * 10
      );
      const sc = 0.8 + rand() * 0.9;
      g.scale.setScalar(sc);
      g.userData = {
        r0: new THREE.Vector3(rand() * 6, rand() * 6, rand() * 6),
        spin: new THREE.Vector3((rand() - 0.5) * 0.25, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.2),
        base: g.position.clone(),
        ph: rand() * 10,
        sc,
      };
      this.items.push(g);
      this.group.add(g);
    }
  }

  update(time, { assemble = 1 } = {}) {
    for (const g of this.items) {
      const d = g.userData;
      g.rotation.set(d.r0.x + d.spin.x * time, d.r0.y + d.spin.y * time, d.r0.z + d.spin.z * time);
      g.position.y = d.base.y + Math.sin(time * 0.5 + d.ph) * 0.6;
      g.scale.setScalar(d.sc * (0.0001 + assemble));
    }
  }
}
