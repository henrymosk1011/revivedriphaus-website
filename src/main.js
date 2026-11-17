import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/manrope/index.css';
import './styles/main.css';

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Timeline, Hud } from './timeline.js';
import { initUI } from './ui.js';
import { initAnimations, playIntro } from './animations.js';
import { motion, initMotionToggle } from './motion.js';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const capture = params.has('capture');
const calmAtLoad = motion.paused && !capture;

// --- Smooth scroll (off when the OS asks for reduced motion) ------------------
let lenis = null;
if (!motion.prefersReduced && !capture) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.3 });
  lenis.on('scroll', ScrollTrigger.update);
}
const scrollTo = (target, opts = {}) => {
  if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6, ...opts });
  else if (typeof target === 'number') window.scrollTo({ top: target, behavior: motion.paused ? 'auto' : 'smooth' });
  else target?.scrollIntoView?.({ behavior: motion.paused ? 'auto' : 'smooth' });
};

// --- Film time ----------------------------------------------------------------
const timeline = new Timeline();
const remeasure = () => {
  timeline.measure();
  ScrollTrigger.refresh();
};
window.addEventListener('resize', () => timeline.measure());
new ResizeObserver(() => timeline.measure()).observe(document.body);
document.fonts?.ready.then(remeasure);

const hud = new Hud(document.querySelector('.hud'), timeline, (i) => scrollTo(timeline.anchors[i] + (i === 0 ? 0 : 2)));

initUI({ scrollTo, lenis, timeline });
initMotionToggle();

// Copy and its animations start straight away; nothing waits on WebGL.
initAnimations({ reduceMotion: calmAtLoad, timeline });
playIntro({ reduceMotion: calmAtLoad });

// --- WebGL film (loaded on demand, fades in when ready) --------------------------
let film = null;

function webglOK() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

async function boot() {
  if (!webglOK()) {
    root.classList.add('no-webgl');
    return;
  }
  try {
    const { Film } = await import('./scene/Film.js');
    const f = new Film(document.getElementById('film'), { reduceMotion: motion.prefersReduced, capture });
    await f.init();
    film = f; // only hand the film to the render loop once it is fully built
    motion.onChange((paused) => film.setMotionPaused(paused && !capture));
    root.classList.add('is-ready');
    remeasure();
  } catch (err) {
    console.error('[film] failed to start, falling back to static background', err);
    film = null;
    root.classList.add('no-webgl');
  }
}
boot();

// --- Main loop: smooth scroll → film time → render ------------------------------
let clock = 0;
gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 0.1);
  lenis?.raf(time * 1000);
  if (capture) return;
  if (!motion.paused) clock += dt; // paused: ambient animation holds still
  const T = timeline.timeAt(window.scrollY);
  hud.update(film ? film.T : T, dt);
  if (film && document.visibilityState === 'visible') {
    film.update(T, dt, clock);
    film.render();
  }
});

// --- Capture hook for rendering preview videos frame-by-frame ---------------------
if (capture) {
  let base = null;
  window.__film = {
    get ready() {
      return !!film;
    },
    anchors: () => timeline.anchors,
    // T: film time, t: seconds into the recording (drives GSAP + shaders).
    // draw=false advances scroll and page animations without rendering the film.
    frame(T, t, draw = true) {
      if (base === null) {
        base = gsap.ticker.time;
        gsap.ticker.remove(gsap.updateRoot);
      }
      const y = timeline.scrollFor(T);
      window.scrollTo(0, y);
      ScrollTrigger.update();
      gsap.updateRoot(base + t);
      hud.update(T, 1 / 24);
      if (film && draw) {
        film.update(T, 1 / 30, t, true);
        film.render();
      }
      return y;
    },
  };
}
