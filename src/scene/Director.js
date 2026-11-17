import * as THREE from 'three';
import { monotone, smooth } from './util.js';

// A camera "shot": keyframes of position, look-at target, horizontal framing
// shift and field of view. Positions run along centripetal Catmull-Rom splines
// and time is mapped with a monotone cubic, so motion never stops or jerks at
// a keyframe. Several shots joined by cuts make up the film.
export class Shot {
  constructor(keys) {
    this.keys = keys;
    this.t0 = keys[0].t;
    this.t1 = keys[keys.length - 1].t;
    this.pos = new THREE.CatmullRomCurve3(keys.map((k) => k.p.clone()), false, 'centripetal');
    this.look = new THREE.CatmullRomCurve3(keys.map((k) => k.l.clone()), false, 'centripetal');
    this.toU = monotone(
      keys.map((k) => k.t),
      keys.map((_, i) => i / (keys.length - 1))
    );
  }

  sample(t, out) {
    const u = Math.min(1, Math.max(0, this.toU(t)));
    this.pos.getPoint(u, out.pos);
    this.look.getPoint(u, out.look);
    // framing + fov ease between neighbouring keys
    const k = this.keys;
    let i = 0;
    while (i < k.length - 2 && t > k[i + 1].t) i++;
    const f = smooth(k[i].t, k[i + 1].t, t);
    const a = k[i];
    const b = k[i + 1];
    out.shift = (a.shift ?? 0) + ((b.shift ?? 0) - (a.shift ?? 0)) * f;
    out.fov = (a.fov ?? 40) + ((b.fov ?? 40) - (a.fov ?? 40)) * f;
    return out;
  }
}

export class Director {
  constructor(shots) {
    this.shots = shots;
    this.state = { pos: new THREE.Vector3(), look: new THREE.Vector3(), shift: 0, fov: 40 };
  }

  sample(t) {
    let shot = this.shots[0];
    for (const s of this.shots) if (t >= s.t0) shot = s;
    return shot.sample(t, this.state);
  }
}
