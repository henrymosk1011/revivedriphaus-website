// Visitor-controlled motion (WCAG 2.2.2 Pause, Stop, Hide).
// Defaults to paused when the OS asks for reduced motion; the choice is
// remembered. Pausing freezes ambient 3D animation, transition flashes, CSS
// animations and the looping video. Scrolling still moves the camera.

const KEY = 'rdh-motion';
const listeners = new Set();
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function stored() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let paused = stored() ? stored() === 'paused' : prefersReduced;

export const motion = {
  prefersReduced,
  get paused() {
    return paused;
  },
  set(value) {
    paused = value;
    try {
      localStorage.setItem(KEY, value ? 'paused' : 'playing');
    } catch {
      /* private mode: keep the choice for this visit only */
    }
    apply();
  },
  onChange(fn) {
    listeners.add(fn);
    fn(paused);
  },
};

function apply() {
  document.documentElement.classList.toggle('motion-paused', paused);
  document.querySelectorAll('[data-motion-toggle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(paused));
    const label = btn.querySelector('[data-motion-label]');
    if (label) label.textContent = paused ? 'Play animation' : 'Pause animation';
  });
  listeners.forEach((fn) => fn(paused));
}

export function initMotionToggle() {
  document.querySelectorAll('[data-motion-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => motion.set(!paused));
  });
  apply();
}
