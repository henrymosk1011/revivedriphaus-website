// Maps the page's scroll position to "film time" T (0 → 6). Each chapter
// begins when its section's top edge crosses the middle of the viewport, so
// the 3D story stays in sync with the copy however tall each section is.
export class Timeline {
  constructor(selector = '[data-chapter]') {
    this.sections = [...document.querySelectorAll(selector)];
    this.chapters = this.sections.length;
    this.anchors = [];
    this.measure();
  }

  measure() {
    const vh = window.innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    const a = this.sections.map((el, i) => {
      if (i === 0) return 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      return Math.min(max - 1, Math.max(0, top - vh * 0.5));
    });
    a.push(max);
    for (let i = 1; i < a.length; i++) a[i] = Math.max(a[i], a[i - 1] + 1);
    this.anchors = a;
    this.max = max;
  }

  timeAt(y) {
    const a = this.anchors;
    if (y <= a[0]) return 0;
    for (let i = 0; i < a.length - 1; i++) {
      if (y < a[i + 1]) return i + (y - a[i]) / (a[i + 1] - a[i]);
    }
    return a.length - 1;
  }

  scrollFor(T) {
    const a = this.anchors;
    const i = Math.min(a.length - 2, Math.max(0, Math.floor(T)));
    const f = Math.min(1, Math.max(0, T - i));
    return a[i] + (a[i + 1] - a[i]) * f;
  }
}

// The HUD treats scrolling as the play button.
export class Hud {
  constructor(el, timeline, goTo) {
    this.el = el;
    this.timeline = timeline;
    this.time = el.querySelector('[data-hud-time]');
    this.label = el.querySelector('.hud__label');
    this.buttons = [...el.querySelectorAll('[data-goto]')];
    this.lastY = window.scrollY;
    this.idle = 0;
    this.chapter = -1;
    this.buttons.forEach((b) =>
      b.addEventListener('click', () => goTo(Number(b.dataset.goto)))
    );
  }

  update(T, dt) {
    const total = this.timeline.chapters;
    const p = Math.min(1, T / total);
    this.el.style.setProperty('--p', p.toFixed(4));
    const secs = Math.round(p * 60);
    const text = `00:${String(secs).padStart(2, '0')}`;
    if (this.time.textContent !== text) this.time.textContent = secs >= 60 ? '01:00' : text;

    const y = window.scrollY;
    const moving = Math.abs(y - this.lastY) > 0.5;
    this.lastY = y;
    this.idle = moving ? 0 : this.idle + dt;
    const playing = this.idle < 0.25;
    if (playing !== this.playing) {
      this.playing = playing;
      this.el.classList.toggle('is-playing', playing);
      this.label.textContent = playing ? 'Playing' : p > 0.99 ? 'The end' : y < 10 ? 'Scroll to play' : 'Paused';
    }

    const c = Math.min(total - 1, Math.floor(T + 0.02));
    if (c !== this.chapter) {
      this.chapter = c;
      this.buttons.forEach((b, i) => b.classList.toggle('is-active', i === c));
    }
  }
}
