import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { Sky } from './Sky.js';
import { IVBag, dripY } from './IVBag.js';
import { Line } from './Line.js';
import { FluidWorld, FLUID_ORIGIN } from './FluidWorld.js';
import { Splash, SPLASH_ORIGIN } from './Splash.js';
import { FinalShader } from './FinalShader.js';
import { createEnvironment } from './environment.js';
import { Director, Shot } from './Director.js';
import { lerp, invLerp, smooth } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Film time T runs 0 → 6, one unit per page chapter:
// 0 the bag · 1 the drop · 2 the line · 3 the formula · 4 revive · 5 book
const T_DRIP = [1.03, 1.62]; // the macro drop, scrubbed by scroll
const T_FILL = [1.6, 2.97]; // fluid running down the line
const T_IN = [2.9, 3.0]; // plunge into the fluid
const T_SURFACE = 3.97; // surface into the splash
const T_OUT = [3.93, 4.06];

const BLOOM = [
  [0, 0.16], [2.85, 0.18], [3.0, 0.55], [3.9, 0.55], [4.0, 0.2], [6, 0.2],
];
function table(rows, t) {
  if (t <= rows[0][0]) return rows[0][1];
  for (let i = 0; i < rows.length - 1; i++) {
    if (t <= rows[i + 1][0]) return lerp(rows[i][1], rows[i + 1][1], smooth(rows[i][0], rows[i + 1][0], t));
  }
  return rows[rows.length - 1][1];
}

export class Film {
  constructor(canvas, { reduceMotion = false, capture = false } = {}) {
    this.canvas = canvas;
    this.reduceMotion = reduceMotion;
    this.capture = capture;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    this.quality = coarse || small ? 'low' : 'high';
    this.T = 0;
    this.motionPaused = false;
    this.pointer = new THREE.Vector2();
    this.pointerSmooth = new THREE.Vector2();
    this.frameTimes = [];
    this.adapted = 0;
    this.maxDpr = this.quality === 'low' ? 1.5 : 1.75;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
  }

  async init(onProgress = () => {}) {
    const low = this.quality === 'low';
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor('#eef4f0');
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.environment = createEnvironment(renderer);
    scene.fog = new THREE.FogExp2('#e3ede7', 0);
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.01, 2500);
    onProgress(0.35);

    this.sky = new Sky();
    this.bag = new IVBag({ quality: this.quality });
    this.line = new Line({ quality: this.quality });
    this.fluid = new FluidWorld({ quality: this.quality });
    this.splash = new Splash({ quality: this.quality });
    scene.add(this.sky.mesh, this.bag.group, this.line.group, this.fluid.group, this.splash.group);

    const key = new THREE.DirectionalLight('#ffffff', 1.3);
    scene.add(key, key.target);
    this.key = key;
    this.hemi = new THREE.HemisphereLight('#ffffff', '#3fbf7a', 0.55);
    scene.add(this.hemi);

    this.buildDirector();
    onProgress(0.55);

    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: low ? 0 : 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.2, 0.35, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);

    this.resize();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this.canvas);
    window.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    });

    // Compile every material up front so no chapter stutters on first sight.
    [this.bag.group, this.line.group, this.fluid.group, this.splash.group].forEach((g) => (g.visible = true));
    this.camera.position.set(0, 0, 8);
    this.camera.lookAt(0, 0, 0);
    try {
      await renderer.compileAsync(scene, this.camera);
    } catch {
      renderer.compile(scene, this.camera);
    }
    onProgress(0.85);
    this.update(0, 0, 0, true);
    this.composer.render();
    onProgress(1);
  }

  buildDirector() {
    const S = () => (this.wide ? 0.2 : 0);
    this.dripPhase = (t) => invLerp(T_DRIP[0], T_DRIP[1], t);
    // the fluid's head stops short of the line's end, which stays off-screen
    this.fill = (t) => invLerp(T_FILL[0], T_FILL[1], t) * 0.8;
    const curve = this.line.curve;
    const up = V(0, 1, 0);

    const shot1 = () => {
      const k = [
        { t: 0.0, p: V(0.0, 0.2, this.wide ? 8.4 : 11.5), l: V(0, -0.12, 0), shift: S(), fov: 34 },
        { t: 0.5, p: V(-1.7, 0.1, 6.4), l: V(0, -0.4, 0), shift: S() * 0.9, fov: 34 },
        { t: 0.92, p: V(0.25, -1.7, 3.4), l: V(0, -2.35, 0), shift: S() * 0.9, fov: 32 },
        // macro: the drop forms at the tip, falls and lands
      ];
      // the camera tracks the drop itself while it forms and falls
      [1.06, 1.16, 1.26, 1.34, 1.4, 1.46, 1.52].forEach((t) => {
        const y = dripY(this.dripPhase(t));
        k.push({ t, p: V(0.05, y + 0.03, 0.62), l: V(0, y - 0.01, 0), shift: S() * 1.1, fov: 30 });
      });
      k.push(
        { t: 1.57, p: V(0.32, -2.74, 0.7), l: V(0, -2.9, 0), shift: S() * 1.0, fov: 32 },
        { t: 1.66, p: V(0.7, -2.72, 1.1), l: V(0, -3.0, 0), shift: S() * 0.6, fov: 34 },
        // pull out and follow the fluid into the line
        { t: 1.8, p: V(1.5, -3.3, 2.5), l: V(0, -4.0, 0), shift: 0, fov: 36 },
        { t: 1.93, p: V(3.0, -5.0, 5.0), l: V(0.3, -7.0, -0.5), shift: 0, fov: 40 },
        { t: 2.03, p: V(6.0, -8.5, 9.0), l: V(0, -12.5, -0.5), shift: 0, fov: 42 }
      );
      const tan = new THREE.Vector3();
      const side = new THREE.Vector3();
      [2.16, 2.3, 2.44, 2.58, 2.72, 2.84].forEach((t, i) => {
        const f = this.fill(t);
        const head = curve.getPointAt(f);
        curve.getTangentAt(f, tan);
        side.crossVectors(tan, up).normalize().multiplyScalar(i % 2 ? 1.9 : -1.9);
        k.push({
          t,
          p: head.clone().add(side).addScaledVector(up, 0.7).addScaledVector(tan, -1.1),
          l: head.clone().addScaledVector(tan, 0.5),
          shift: 0,
          fov: 40,
        });
      });
      // dive into the tube at the fluid's leading edge
      const f = this.fill(2.95);
      const head = curve.getPointAt(f);
      curve.getTangentAt(f, tan);
      side.crossVectors(tan, up).normalize();
      k.push({ t: 2.93, p: head.clone().addScaledVector(side, 0.55).addScaledVector(up, 0.12), l: head.clone(), shift: 0, fov: 44 });
      k.push({ t: T_IN[1], p: head.clone().addScaledVector(side, 0.05), l: head.clone().addScaledVector(side, -1), shift: 0, fov: 60 });
      return new Shot(k);
    };

    const shot2 = () => {
      const F = FLUID_ORIGIN;
      const o = (x, y, z) => F.clone().add(V(x, y, z));
      return new Shot([
        { t: T_IN[1], p: o(0, 0.5, 8), l: o(0, 0, -10), shift: 0, fov: 55 },
        { t: 3.25, p: o(1.5, -0.3, -18), l: o(-1, 0, -40), shift: 0, fov: 48 },
        { t: 3.5, p: o(-2, 0.4, -45), l: o(1, 0, -70), shift: 0, fov: 46 },
        { t: 3.75, p: o(1, -0.2, -72), l: o(0, 0, -100), shift: 0, fov: 46 },
        { t: T_SURFACE, p: o(0, 0.6, -96), l: o(0, 2.5, -120), shift: 0, fov: 52 },
      ]);
    };

    const shot3 = () => {
      const O = SPLASH_ORIGIN;
      const o = (x, y, z) => O.clone().add(V(x, y, z));
      return new Shot([
        { t: T_SURFACE, p: o(0, 2.2, 7.4), l: o(0, 1.9, 0), shift: 0, fov: 36 },
        { t: 4.12, p: o(0.4, 1.6, 6.6), l: o(0, 1.1, 0), shift: 0, fov: 36 },
        { t: 4.3, p: o(1.8, 1.2, 5.6), l: o(0, 0.6, 0), shift: 0, fov: 36 },
        // bullet time: orbit the frozen crown
        { t: 4.55, p: o(4.6, 1.5, 2.4), l: o(0, 0.65, 0), shift: 0, fov: 36 },
        { t: 4.8, p: o(3.4, 2.0, -3.8), l: o(0, 0.6, 0), shift: 0, fov: 36 },
        { t: 5.0, p: o(-2.6, 1.7, -4.4), l: o(0, 0.6, 0), shift: 0, fov: 36 },
        { t: 5.25, p: o(-3.3, 1.15, 1.2), l: o(0, 0.75, 0), shift: S() * 0.5, fov: 36 },
        { t: 5.55, p: o(-2.0, 1.4, 4.2), l: o(0, 1.15, 0), shift: S(), fov: 34 },
        { t: 6.0, p: o(0, 1.45, 4.4), l: o(0, 1.2, 0), shift: S(), fov: 34 },
      ]);
    };

    this._buildShots = () => {
      this.director = new Director([shot1(), shot2(), shot3()]);
    };
    this._buildShots();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (w === this._w && Math.abs(h - this._h) < 2) return;
    this._w = w;
    this._h = h;
    this.aspect = w / h;
    const wide = w >= 900 && this.aspect > 1.1;
    if (wide !== this.wide) {
      this.wide = wide;
      if (this._buildShots) this._buildShots();
    }
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.dpr);
    this.composer.setSize(w, h);
    this.final.uniforms.uRes.value.set(w * this.dpr, h * this.dpr);
  }

  setDpr(dpr) {
    this.dpr = dpr;
    this._w = 0;
    this.resize();
  }

  // Visitors can pause ambient motion; scroll still drives the camera.
  setMotionPaused(paused) {
    this.motionPaused = paused;
  }

  // Lower resolution if the device can't hold a smooth frame rate.
  adapt(dt) {
    if (this.capture || this.adapted >= 2) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    this.frameTimes.length = 0;
    if (median > 1 / 38) {
      this.adapted++;
      if (this.dpr > 1) this.setDpr(Math.max(1, this.dpr * 0.7));
      else this.bloom.enabled = false;
    } else {
      this.adapted = 2;
    }
  }

  update(targetT, dt, time, snap = false) {
    // Ease the film towards the scroll position: scrolling scrubs the film.
    if (snap || this.capture) this.T = targetT;
    else {
      const k = this.reduceMotion ? 12 : 4.2;
      this.T += (targetT - this.T) * (1 - Math.exp(-dt * k));
      if (Math.abs(targetT - this.T) < 1e-4) this.T = targetT;
    }
    if (dt > 0) this.adapt(dt);
    const T = this.T;
    const t = time;
    const calm = this.reduceMotion || this.motionPaused;

    // --- Camera -----------------------------------------------------------
    const cam = this.camera;
    const shot = this.director.sample(T);
    if (!calm) this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 2.5));
    else this.pointerSmooth.set(0, 0);
    cam.position.copy(shot.pos);
    cam.lookAt(shot.look);
    // parallax shrinks during the macro shots so the drop stays framed
    const macro = smooth(0.95, 1.06, T) * (1 - smooth(1.62, 1.75, T));
    const par = 0.3 * (1 - macro * 0.92);
    cam.translateX(this.pointerSmooth.x * par);
    cam.translateY(this.pointerSmooth.y * par * 0.6);
    cam.lookAt(shot.look);
    let fov = shot.fov;
    if (this.aspect < 1) fov = THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(THREE.MathUtils.degToRad(fov) / 2) / Math.max(this.aspect, 0.45)) * 0.8));
    cam.fov = Math.min(fov, 80);
    cam.aspect = this.aspect;
    cam.updateProjectionMatrix();
    cam.projectionMatrix.elements[8] -= shot.shift * 2;
    // phones: lift the bag, then the drop, above the copy
    if (!this.wide) cam.projectionMatrix.elements[9] -= 2 * (0.25 * (1 - smooth(0.6, 0.95, T)) + 0.2 * macro);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    // --- Worlds -------------------------------------------------------------
    const inFluid = T >= T_IN[1] && T < T_SURFACE;
    this.sky.uniforms.uFluid.value = inFluid ? 1 : 0;
    this.sky.update(cam, t);
    this.scene.fog.color.set(inFluid ? '#0b4a28' : '#e3ede7');
    this.scene.fog.density = inFluid ? 0.022 : T >= T_SURFACE ? 0.03 : 0;
    this.hemi.color.set(inFluid ? '#c9ffe0' : '#ffffff');
    this.hemi.groundColor.set(inFluid ? '#0b5a30' : '#3fbf7a');

    // 01–02: the bag and the drop
    this.bag.group.visible = T < 2.35;
    if (this.bag.group.visible) {
      const scrubbed = T >= 0.97 && T < 1.75;
      this.bag.update(t, {
        level: lerp(0.98, 0.62, smooth(0, 3, T)),
        dripPhase: scrubbed ? Math.max(0.04, this.dripPhase(T)) : null,
        sway: 1 - macro,
      });
    }

    // 03: the line
    this.line.group.visible = T > 1.45 && T < T_IN[1];
    if (this.line.group.visible) this.line.update(t, this.dpr, { fill: this.fill(T) });

    // 04: inside the fluid
    this.fluid.group.visible = inFluid;
    if (inFluid) this.fluid.update(t, this.dpr, { assemble: smooth(3.0, 3.15, T) });

    // 05–06: the splash
    this.splash.group.visible = T >= T_SURFACE;
    if (this.splash.group.visible) {
      let s;
      if (T < 4.2) s = 0;
      else if (T < 4.55) s = lerp(0, 0.9, invLerp(4.2, 4.55, T));
      else if (T < 5.0) s = lerp(0.9, 1.05, invLerp(4.55, 5.0, T));
      else s = lerp(1.05, 2.0, invLerp(5.0, 5.32, T));
      this.splash.update(t, {
        fall: invLerp(4.02, 4.2, T),
        s,
        jet: invLerp(5.18, 5.62, T),
        hover: smooth(5.55, 5.85, T),
      });
    }

    // --- Light & post -----------------------------------------------------
    this.key.position.copy(cam.position).add(V(3, 6, 4));
    this.key.target.position.copy(shot.look);
    this.key.intensity = inFluid ? 0.9 : 1.3;
    // bloom only underwater; in the bright studio it would just haze the frame
    this.bloom.enabled = inFluid;
    this.bloom.strength = table(BLOOM, T);
    this.bloom.threshold = 0.75;

    // The liquid wipe: rises as we plunge in, drains as we surface.
    const fu = this.final.uniforms;
    let level = -0.2;
    let tint = 0;
    if (T >= T_IN[0] && T < T_IN[1]) {
      level = lerp(-0.1, 1.2, smooth(T_IN[0], T_IN[1], T));
      tint = 1;
    } else if (T >= T_IN[1] && T < T_IN[1] + 0.06) {
      level = 1.2;
      tint = 1 - smooth(T_IN[1], T_IN[1] + 0.06, T);
    } else if (T >= T_OUT[0] && T < T_SURFACE) {
      level = 1.2;
      tint = smooth(T_OUT[0], T_SURFACE, T);
    } else if (T >= T_SURFACE && T < T_OUT[1]) {
      level = lerp(1.2, -0.1, smooth(T_SURFACE, T_OUT[1], T));
      tint = 1;
    }
    fu.uWipeLevel.value = level;
    fu.uWipeTint.value = tint;
    fu.uTime.value = t;
  }

  render() {
    this.composer.render();
  }
}
