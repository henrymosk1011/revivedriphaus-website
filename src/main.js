import '@fontsource/anton/400.css';
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

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const capture = params.has('capture');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const loaderBar = document.querySelector('.loader__bar');
const setProgress = (p) => loaderBar?.style.setProperty('--p', String(p));

// --- Smooth scroll ------------------------------------------------------------
let lenis = null;
if (!reduceMotion && !capture) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.3 });
  lenis.on('scroll', ScrollTrigger.update);
}
const scrollTo = (target, opts = {}) => {
  if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6, ...opts });
  else if (typeof target === 'number') window.scrollTo({ top: target, behavior: reduceMotion ? 'auto' : 'smooth' });
  else document.querySelector(target)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
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

// --- WebGL film (loaded on demand) --------------------------------------------
let film = null;
let ready = false;

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

function reveal() {
  if (ready) return;
  ready = true;
  root.classList.add('is-ready');
  remeasure();
  initAnimations({ reduceMotion, timeline });
  playIntro({ reduceMotion });
}

async function boot() {
  setProgress(0.15);
  if (!webglOK()) {
    root.classList.add('no-webgl');
    setProgress(1);
    reveal();
    return;
  }
  try {
    const { Film } = await import('./scene/Film.js');
    setProgress(0.3);
    film = new Film(document.getElementById('film'), { reduceMotion, capture });
    await film.init(setProgress);
  } catch (err) {
    console.error('[film] failed to start, falling back to static background', err);
    film = null;
    root.classList.add('no-webgl');
  }
  setTimeout(reveal, 250);
}

// Safety net: never leave visitors on the loader.
setTimeout(reveal, 9000);
boot();

// --- Main loop: smooth scroll → film time → render ------------------------------
let clock = 0;
gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 0.1);
  lenis?.raf(time * 1000);
  if (capture) return;
  clock += dt;
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
      return !!film && ready;
    },
    anchors: () => timeline.anchors,
    // T: film time, t: seconds into the recording (drives GSAP + shaders)
    frame(T, t) {
      if (base === null) {
        base = gsap.ticker.time;
        gsap.ticker.remove(gsap.updateRoot);
      }
      const y = timeline.scrollFor(T);
      window.scrollTo(0, y);
      ScrollTrigger.update();
      gsap.updateRoot(base + t);
      hud.update(T, 1 / 24);
      if (film) {
        film.update(T, 1 / 30, t, true);
        film.render();
      }
      return y;
    },
  };
}
