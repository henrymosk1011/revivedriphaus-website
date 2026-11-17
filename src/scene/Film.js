import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { Sky } from './Sky.js';
import { Dust } from './Dust.js';
import { Droplet, HeroSet } from './Droplet.js';
import { Coast, GROUND_Y, SUN_DIR } from './Coast.js';
import { Tunnel, TUNNEL_ORIGIN, TUNNEL_LENGTH, bend } from './Tunnel.js';
import { Molecules } from './Molecules.js';
import { Orb } from './Orb.js';
import { FinalShader } from './FinalShader.js';
import { createEnvironment } from './environment.js';
import { Director, Shot } from './Director.js';
import { clamp, lerp, invLerp, smooth, window4, easeInOut } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HERO_GLOW_DIR = new THREE.Vector3(0.45, 0.35, -1).normalize();
const DUST_A = new THREE.Color('#9af2c0');
const DUST_B = new THREE.Color('#ceff65');
const DUST_WARM_A = new THREE.Color('#ffd2a8');
const DUST_WARM_B = new THREE.Color('#ffb0c0');

// Timeline (film time T runs 0 → 6, one unit per page chapter)
const T_FALL = [1.0, 1.34];
const T_TRAIL = [1.34, 1.9];
const T_CUT = 2.0;
const T_EXIT = 3.0;

// Colour grade per moment: [T, skyTop, skyBottom, glow, glowAmt, fog]
const GRADE = [
  [0.0, '#082a1c', '#010805', '#1fb867', 0.5, 0.0],
  [0.9, '#072519', '#010604', '#2bd47a', 0.45, 0.0],
  [1.14, '#0a102c', '#0b0714', '#ff9a5c', 0.12, 0.0],
  [1.3, '#111a3a', '#24132a', '#ff9a5c', 0.6, 0.0],
  [1.99, '#111a3a', '#24132a', '#ff9a5c', 0.6, 0.0],
  [2.0, '#14030a', '#070103', '#ff6b6b', 0.3, 0.0],
  [3.0, '#0b3222', '#020f09', '#ceff65', 0.42, 0.006],
  [3.9, '#0a3020', '#020c07', '#9af2c0', 0.55, 0.008],
  [4.6, '#0b3524', '#010805', '#3be07f', 0.65, 0.004],
  [6.0, '#08291b', '#010604', '#3be07f', 0.55, 0.004],
];

const BLOOM = [
  [0, 0.7], [0.9, 0.7], [1.2, 0.6], [1.85, 0.62], [2.0, 1.0], [2.15, 0.85], [2.8, 0.9], [3.2, 0.7], [4.2, 0.8], [6, 0.75],
];

function table(rows, t, col) {
  if (t <= rows[0][0]) return rows[0][col];
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (t <= b[0]) return lerp(a[col], b[col], smooth(a[0], b[0], t));
  }
  return rows[rows.length - 1][col];
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
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor('#020b07');
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.environment = createEnvironment(renderer);
    scene.fog = new THREE.FogExp2('#020c07', 0);
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2500);
    onProgress(0.35);

    // --- Cast ------------------------------------------------------------
    this.sky = new Sky();
    this.dust = new Dust({ count: low ? 900 : 1800 });
    this.droplet = new Droplet({ detail: low ? 40 : 72 });
    this.heroSet = new HeroSet({ streaks: low ? 50 : 90 });
    this.coast = new Coast({ quality: this.quality, sky: this.sky });
    this.tunnel = new Tunnel({ quality: this.quality });

    const exitLocal = bend(-TUNNEL_LENGTH);
    this.exit = V(exitLocal.x, exitLocal.y, -TUNNEL_LENGTH - 2).add(TUNNEL_ORIGIN);
    this.molecules = new Molecules({ center: this.exit.clone().add(V(0, 0, -34)), count: low ? 7 : 10, spread: [30, 14, 150] });
    this.orbCenter = this.exit.clone().add(V(0, 0, -215));
    this.orb = new Orb({ center: this.orbCenter, radius: 6.2, count: low ? 6000 : 14000 });

    scene.add(this.sky.mesh, this.dust.points, this.heroSet.group, this.droplet.group, this.coast.group, this.tunnel.group, this.molecules.group, this.orb.group);

    // A little direct light for the cells and molecules on top of the env map.
    const key = new THREE.DirectionalLight('#eafff3', 1.4);
    key.position.set(4, 8, 6);
    scene.add(key, key.target);
    this.key = key;
    scene.add(new THREE.HemisphereLight('#9af2c0', '#03140c', 0.35));

    this.buildDirector();
    onProgress(0.55);

    // --- Post ------------------------------------------------------------
    const rt = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      samples: low ? 0 : 4,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.42, 0.95);
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

    // Compile every material up front (everything visible), so no chapter
    // stutters the first time it appears.
    const groups = [this.heroSet.group, this.droplet.group, this.coast.group, this.tunnel.group, this.molecules.group, this.orb.group];
    groups.forEach((g) => (g.visible = true));
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
    const S = () => (this.wide ? 0.21 : 0);
    const dropY = (t) => {
      const k = invLerp(T_FALL[0], T_FALL[1], t);
      return lerp(0, GROUND_Y + 1, k * k);
    };
    this.dropY = dropY;
    this.trailFill = (t) => easeInOut(invLerp(T_TRAIL[0], T_TRAIL[1], t));

    const route = this.coast.route;
    const dest = this.coast.destination;
    const shot1 = () => {
      const keys = [
        { t: 0.0, p: V(0, 0.25, 8.2), l: V(0, 0, 0), shift: S(), fov: 36 },
        { t: 0.5, p: V(2.6, 0.9, 7.0), l: V(0, 0.1, 0), shift: S() * 0.95, fov: 36 },
        { t: 0.95, p: V(0.7, 1.9, 6.1), l: V(0, -0.4, 0), shift: S() * 0.6, fov: 38 },
      ];
      for (const [t, up, back, look] of [
        [1.08, 2.1, 6.6, 2.6],
        [1.17, 3.0, 8.4, 8.5],
        [1.26, 5.5, 12.5, 30],
      ]) {
        const y = dropY(t);
        keys.push({ t, p: V(0.6, y + up, back), l: V(0, Math.max(GROUND_Y, y - look), -1.5), shift: 0, fov: 42 });
      }
      // Landing on the coast road, sunset glowing ahead.
      keys.push({ t: 1.36, p: V(6, GROUND_Y + 12, 16), l: V(0, GROUND_Y + 0.5, -10), shift: 0, fov: 48 });
      // Chase the light trail along the coast, low and fast.
      const tan = new THREE.Vector3();
      [1.43, 1.5, 1.57, 1.64, 1.71, 1.78, 1.85].forEach((t, i) => {
        const s = this.trailFill(t);
        const behind = route.getPointAt(Math.max(0, s - 0.03));
        const ahead = route.getPointAt(Math.min(1, s + 0.055));
        route.getTangentAt(Math.min(0.999, Math.max(0.001, s)), tan);
        const side = V(-tan.z, 0, tan.x).normalize().multiplyScalar(0.3 + (i % 2) * 0.6);
        keys.push({
          t,
          p: behind.clone().add(V(0, 3.2 + Math.sin(i * 1.3) * 0.9, 0)).add(side),
          l: ahead.clone().add(V(-1.5, 1.8, 0)),
          shift: 0,
          fov: 54,
        });
      });
      // Arrive at the house in the hills, then dive into the beacon.
      keys.push({ t: 1.93, p: dest.clone().add(V(-16, 9, 14)), l: dest.clone().add(V(4, 2, -2)), shift: 0, fov: 50 });
      keys.push({ t: T_CUT, p: dest.clone().add(V(-0.6, 4, 1.4)), l: dest.clone().add(V(0.3, -4, -0.3)), shift: 0, fov: 60 });
      return new Shot(keys);
    };

    const shot2 = () => {
      const keys = [];
      for (let i = 0; i <= 10; i++) {
        const t = lerp(T_CUT, T_EXIT, i / 10);
        const z = 8 - (TUNNEL_LENGTH + 10) * (i / 10);
        const b = bend(z);
        const bl = bend(z - 14);
        const wob = V(Math.sin(i * 1.9) * 1.4, Math.cos(i * 1.3) * 1.0, 0);
        keys.push({
          t,
          p: V(b.x, b.y, z).add(wob).add(TUNNEL_ORIGIN),
          l: V(bl.x, bl.y, z - 14).add(TUNNEL_ORIGIN),
          shift: 0,
          fov: i === 0 ? 70 : 60,
        });
      }
      const E = this.exit;
      const O = this.orbCenter;
      keys.push({ t: 3.22, p: E.clone().add(V(-1, 0.6, -36)), l: E.clone().add(V(-2, 0, -72)), shift: 0, fov: 46 });
      keys.push({ t: 3.46, p: E.clone().add(V(4.5, -1.5, -72)), l: E.clone().add(V(0, 0, -112)), shift: 0, fov: 44 });
      keys.push({ t: 3.7, p: E.clone().add(V(-3.5, 1.2, -112)), l: E.clone().add(V(1, 0, -150)), shift: 0, fov: 44 });
      keys.push({ t: 3.95, p: E.clone().add(V(1.5, 0.5, -152)), l: O.clone(), shift: 0, fov: 42 });
      keys.push({ t: 4.3, p: O.clone().add(V(0, 1.5, 34)), l: O.clone(), shift: 0, fov: 40 });
      keys.push({ t: 4.65, p: O.clone().add(V(13, 3, 26)), l: O.clone(), shift: 0, fov: 40 });
      keys.push({ t: 5.0, p: O.clone().add(V(-11, -1.5, 24)), l: O.clone(), shift: S(), fov: 40 });
      keys.push({ t: 5.5, p: O.clone().add(V(-5, 3, 28)), l: O.clone(), shift: S(), fov: 40 });
      keys.push({ t: 6.0, p: O.clone().add(V(0, 0.5, 36)), l: O.clone(), shift: S(), fov: 40 });
      return new Shot(keys);
    };

    this._buildShots = () => {
      this.director = new Director([shot1(), shot2()]);
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

  // Visitors can pause ambient motion; scroll still drives the camera.
  setMotionPaused(paused) {
    this.motionPaused = paused;
  }

  update(targetT, dt, time, snap = false) {
    // Ease the film towards the scroll position: this is what makes scrolling
    // feel like scrubbing a video rather than jumping between states.
    if (snap || this.capture) this.T = targetT;
    else {
      const k = this.reduceMotion ? 12 : 4.2;
      this.T += (targetT - this.T) * (1 - Math.exp(-dt * k));
      if (Math.abs(targetT - this.T) < 1e-4) this.T = targetT;
    }
    if (dt > 0) this.adapt(dt);
    const T = this.T;
    const calm = this.reduceMotion || this.motionPaused;
    const t = time;

    // --- Camera -----------------------------------------------------------
    const cam = this.camera;
    const shot = this.director.sample(T);
    if (!calm) this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 2.5));
    else this.pointerSmooth.set(0, 0);
    cam.position.copy(shot.pos);
    cam.lookAt(shot.look);
    const par = T > 1.3 && T < 2 ? 0.7 : 0.35;
    cam.translateX(this.pointerSmooth.x * par);
    cam.translateY(this.pointerSmooth.y * par * 0.6);
    cam.lookAt(shot.look);
    let fov = shot.fov;
    if (this.aspect < 1) fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) / Math.max(this.aspect, 0.45) * 0.78));
    cam.fov = Math.min(fov, 82);
    cam.aspect = this.aspect;
    cam.updateProjectionMatrix();
    // Horizontal framing shift (keeps the subject beside the copy on desktop).
    cam.projectionMatrix.elements[8] -= shot.shift * 2;
    // On narrow screens lift the hero drop above the headline.
    if (!this.wide) cam.projectionMatrix.elements[9] -= 0.2 * 2 * (1 - smooth(0.55, 1.0, T));
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    // --- Grade ------------------------------------------------------------
    const tmpA = this._ca || (this._ca = new THREE.Color());
    const tmpB = this._cb || (this._cb = new THREE.Color());
    const gradeColor = (col, out) => {
      if (T <= GRADE[0][0]) return out.set(GRADE[0][col]);
      for (let i = 0; i < GRADE.length - 1; i++) {
        if (T <= GRADE[i + 1][0]) {
          const f = smooth(GRADE[i][0], GRADE[i + 1][0], T);
          return out.set(GRADE[i][col]).lerp(tmpB.set(GRADE[i + 1][col]), f);
        }
      }
      return out.set(GRADE[GRADE.length - 1][col]);
    };
    const su = this.sky.uniforms;
    gradeColor(1, su.uTop.value);
    gradeColor(2, su.uBottom.value);
    gradeColor(3, su.uGlow.value);
    su.uGlowAmt.value = table(GRADE, T, 4);
    this.scene.fog.density = table(GRADE, T, 5);
    this.scene.fog.color.copy(su.uBottom.value).lerp(tmpA.copy(su.uTop.value), 0.35);
    // Dusk on the coast: horizon band, sun, stars.
    // Falls through a starry indigo night first, then the sunset rises.
    const out = 1 - smooth(1.995, 2.0, T);
    const night = smooth(1.0, 1.14, T) * out;
    const dusk = smooth(1.1, 1.3, T) * out;
    su.uHorizon.value.set('#ff8a50');
    su.uHorizonAmt.value = dusk * 0.95;
    su.uSunAmt.value = dusk;
    su.uStars.value = night * 0.85;
    su.uClouds.value = 1 - night;
    su.uGlowDir.value.copy(HERO_GLOW_DIR).lerp(SUN_DIR, night).normalize();
    this.sky.update(cam, t);
    this.dust.update(cam, t, this.dpr);
    this.dust.uniforms.uOpacity.value = 0.75 - night * 0.5;
    this.dust.uniforms.uColorA.value.copy(DUST_A).lerp(DUST_WARM_A, night);
    this.dust.uniforms.uColorB.value.copy(DUST_B).lerp(DUST_WARM_B, night);

    // --- Chapter 1: hero drop ----------------------------------------------
    const heroOn = T < 1.42;
    const orbDrop = T > 4.0;
    this.droplet.group.visible = heroOn || orbDrop;
    if (heroOn) {
      const fall = invLerp(T_FALL[0], T_FALL[1], T);
      this.droplet.group.position.set(this.coast.landing.x * smooth(0.2, 1, fall), this.dropY(T), 0);
      this.droplet.group.scale.setScalar(lerp(1.35, 0.75, smooth(0, 1, fall)) * (1 - smooth(0.97, 1, fall)) + 0.0001);
      this.droplet.update(t, {
        amp: 0.1 + smooth(0, 1, T) * 0.05 - smooth(0, 0.5, fall) * 0.08,
        drop: smooth(0.0, 0.35, fall),
        stretch: smooth(0.15, 0.9, fall) * 0.35,
        spin: T * 1.4,
        satellites: 1 - smooth(0.75, 1.05, T),
      });
    } else if (orbDrop) {
      this.droplet.group.position.copy(this.orbCenter);
      this.droplet.group.scale.setScalar(smooth(4.0, 4.7, T) * 2.3 + 0.0001);
      this.droplet.update(t, { amp: 0.14, drop: 0, stretch: 0, spin: T * 0.8, satellites: 0, glow: 0.35 });
    }
    const heroAmt = 1 - smooth(0.95, 1.18, T);
    this.heroSet.group.visible = heroAmt > 0.001;
    if (this.heroSet.group.visible) {
      this.heroSet.group.position.y = -smooth(0.9, 1.2, T) * 4;
      this.heroSet.update(t, cam, heroAmt);
    }

    // --- Chapter 2: the coast at dusk -----------------------------------------
    // The world emerges from haze as the drop falls towards it.
    this.coast.group.visible = T > 0.98 && T < T_CUT + 0.02;
    if (this.coast.group.visible) {
      const haze = tmpA.copy(su.uTop.value).lerp(tmpB.copy(su.uHorizon.value), 0.22 * dusk);
      const fogColor = this._fogc || (this._fogc = new THREE.Color());
      fogColor.copy(su.uBottom.value).lerp(haze, night);
      const fogDensity = lerp(0.06, 0.0036, smooth(1.02, 1.22, T));
      this.scene.fog.color.copy(fogColor);
      this.scene.fog.density = fogDensity;
      this.coast.update(t, cam, this.dpr, {
        fill: this.trailFill(T),
        splash: invLerp(1.335, 1.5, T),
        beacon: smooth(1.74, 1.93, T),
        fogColor,
        fogDensity,
        sunColor: su.uGlow.value,
      });
    }

    // --- Chapter 3: bloodstream ---------------------------------------------
    this.tunnel.group.visible = T >= T_CUT - 0.001 && T < T_EXIT + 0.12;
    if (this.tunnel.group.visible) this.tunnel.update(t, cam, this.dpr, { exit: smooth(2.75, 3.0, T) * 0.32 });

    // --- Chapter 4: molecules ----------------------------------------------
    this.molecules.group.visible = T > 2.85 && T < 4.45;
    if (this.molecules.group.visible) this.molecules.update(t, { assemble: smooth(2.9, 3.15, T) * (1 - smooth(4.05, 4.4, T)) });

    // --- Chapter 5–6: the orb ------------------------------------------------
    this.orb.group.visible = T > 3.35;
    if (this.orb.group.visible) {
      this.orb.update(t, this.dpr, {
        morph: smooth(3.45, 4.55, T),
        amount: lerp(1, 0.8, window4(4.1, 4.4, 4.85, 5.0, T)) * (this.wide ? 1 : 1 - smooth(4.9, 5.3, T) * 0.65),
      });
    }

    // --- Light & post -----------------------------------------------------
    this.key.position.copy(cam.position).add(V(4, 8, 6));
    this.key.target.position.copy(shot.look);
    this.bloom.strength = table(BLOOM, T, 1);
    // Transition flashes are soft (well under photosensitivity limits) and off
    // entirely when motion is reduced or paused.
    const flash = calm ? 0 : Math.exp(-Math.pow((T - T_CUT) / 0.05, 2)) * 0.55 + Math.exp(-Math.pow((T - T_EXIT) / 0.05, 2)) * 0.15;
    const fu = this.final.uniforms;
    fu.uFlash.value = flash;
    fu.uTime.value = t;
    this.renderer.toneMappingExposure = 1.0 + flash * 0.4;
  }

  render() {
    this.composer.render();
  }
}
