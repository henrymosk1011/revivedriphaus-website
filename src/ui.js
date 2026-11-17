import { ingredients, drips, filters as filterLabels, business } from './data/content.js';
import { FORM_ENDPOINTS } from './config.js';
import { motion } from './motion.js';

export function initUI({ scrollTo, lenis } = {}) {
  initNav(scrollTo, lenis);
  initMenuFilters();
  initIngredientDialog(lenis);
  initForms();
  initVideo();
  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
}

// Move keyboard focus to a section after jumping to it, without re-scrolling.
function focusTarget(el) {
  if (!el || typeof el.focus !== 'function') return;
  if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

// --- Navigation ----------------------------------------------------------------
function initNav(scrollTo, lenis) {
  const nav = document.getElementById('nav');
  const toggle = nav?.querySelector('.nav__toggle');
  const menu = document.getElementById('mobile-menu');
  const background = [...document.querySelectorAll('main, footer, .hud, .skip-link')];

  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 40);
    const menuOpen = toggle?.getAttribute('aria-expanded') === 'true';
    const focusInNav = nav.contains(document.activeElement);
    nav.classList.toggle('is-hidden', !menuOpen && !focusInNav && y > 400 && y > lastY + 2);
    if (y < lastY - 2) nav.classList.remove('is-hidden');
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
  onScroll();

  const setMenu = (open, { restoreFocus = true } = {}) => {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Open menu';
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    // Keep focus inside the open menu: everything behind it is inert.
    background.forEach((el) => (el.inert = open));
    if (open) {
      lenis?.stop();
      menu.querySelector('a')?.focus();
    } else {
      lenis?.start();
      if (restoreFocus) toggle.focus();
    }
  };
  toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') setMenu(false);
  });

  // In-page links glide through the film instead of jumping, then move focus.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id === '#') return;
    const target = id === '#top' ? document.getElementById('top') : document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (menu && !menu.hidden) setMenu(false, { restoreFocus: false });
    scrollTo(id === '#top' ? 0 : target, { offset: id === '#top' ? 0 : -20 });
    focusTarget(target);
    history.replaceState(null, '', id === '#top' ? location.pathname : id);
  });

  // Mark the section currently in view.
  const links = [...document.querySelectorAll('.nav__links a[href^="#"]')];
  const map = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        links.forEach((l) => {
          l.classList.remove('is-active');
          l.removeAttribute('aria-current');
        });
        const link = map.get(en.target.id);
        if (link) {
          link.classList.add('is-active');
          link.setAttribute('aria-current', 'true');
        }
      }
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  map.forEach((_, id) => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });
}

// --- IV menu filters ---------------------------------------------------------------
function initMenuFilters() {
  const buttons = [...document.querySelectorAll('.filter')];
  const cards = [...document.querySelectorAll('.drip')];
  const status = document.getElementById('menu-status');
  const labels = Object.fromEntries(filterLabels);
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      const f = b.dataset.filter;
      buttons.forEach((x) => {
        x.classList.toggle('is-active', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      let shown = 0;
      cards.forEach((c) => {
        const show = f === 'all' || c.dataset.tag === f;
        if (show) shown++;
        c.classList.toggle('is-hidden', !show);
        // the visitor is interacting: show cards immediately, skip any pending reveal
        c.style.opacity = '';
        c.style.transform = '';
      });
      if (status) status.textContent = f === 'all' ? `Showing all ${shown} drips.` : `Showing ${shown} ${labels[f].toLowerCase()} drips.`;
      window.dispatchEvent(new Event('resize'));
    })
  );
}

// --- Ingredient dialog --------------------------------------------------------------
function initIngredientDialog(lenis) {
  const dialog = document.getElementById('ingredient-dialog');
  if (!dialog) return;
  const title = dialog.querySelector('#ingredient-title');
  const body = dialog.querySelector('.ingredient-dialog__body');
  const inDrips = dialog.querySelector('.ingredient-dialog__in');

  document.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-ingredient]');
    if (!chip) return;
    const ing = ingredients[chip.dataset.ingredient];
    if (!ing) return;
    title.textContent = ing.name;
    body.replaceChildren();
    const p = document.createElement('p');
    p.textContent = ing.text;
    body.append(p);
    if (ing.list) {
      const dl = document.createElement('dl');
      for (const [k, v] of ing.list) {
        const dt = document.createElement('dt');
        dt.textContent = k;
        const dd = document.createElement('dd');
        dd.textContent = v;
        dl.append(dt, dd);
      }
      body.append(dl);
    }
    const found = drips.filter((d) => d.ingredients.includes(chip.dataset.ingredient)).map((d) => d.name);
    inDrips.textContent = found.length ? `Found in: ${found.join(', ')}` : '';
    dialog.showModal();
    lenis?.stop();
  });
  dialog.addEventListener('close', () => lenis?.start());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

// --- Forms ----------------------------------------------------------------------------
let uid = 0;
const idFor = (el) => el.id || (el.id = `f-${el.name || 'field'}-${++uid}`);

function labelText(el) {
  const label = el.closest('label');
  if (!label) return el.getAttribute('aria-label') || 'This field';
  const clone = label.cloneNode(true);
  clone.querySelectorAll('input, select, textarea, .req, .field-error').forEach((n) => n.remove());
  return clone.textContent.trim().replace(/\s+/g, ' ') || 'This field';
}

function messageFor(el) {
  const v = el.validity;
  const name = labelText(el);
  if (v.valueMissing) {
    if (el.type === 'checkbox') return 'Please tick this box to continue.';
    if (el.tagName === 'SELECT') return `Please choose ${name.toLowerCase()}.`;
    return `Please enter your ${name.toLowerCase()}.`;
  }
  if (v.typeMismatch && el.type === 'email') return 'Please enter a valid email address, like name@example.com.';
  if (v.patternMismatch && el.name.includes('zip')) return 'Please enter a 5-digit ZIP code.';
  return el.validationMessage || 'Please check this field.';
}

// Show (or clear) an error message tied to a field or group via aria-describedby.
function setError(host, describe, msg) {
  const errId = `${idFor(describe)}-error`;
  let err = document.getElementById(errId);
  if (msg) {
    if (!err) {
      err = document.createElement('span');
      err.className = 'field-error';
      err.id = errId;
      host.after(err);
    }
    err.textContent = msg;
    const ids = new Set((describe.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
    ids.add(errId);
    describe.setAttribute('aria-describedby', [...ids].join(' '));
    describe.setAttribute('aria-invalid', 'true');
  } else {
    err?.remove();
    const ids = (describe.getAttribute('aria-describedby') || '').split(' ').filter((x) => x && x !== errId);
    if (ids.length) describe.setAttribute('aria-describedby', ids.join(' '));
    else describe.removeAttribute('aria-describedby');
    describe.removeAttribute('aria-invalid');
  }
}

function validate(form) {
  const problems = [];
  // Radio groups and "tick at least one" groups are checked as a whole.
  form.querySelectorAll('[role="radiogroup"]').forEach((group) => {
    const radios = [...group.querySelectorAll('input[type="radio"]')];
    const bad = radios.some((r) => r.required) && !radios.some((r) => r.checked);
    setError(group, group, bad ? 'Please choose yes or no.' : '');
    if (bad) problems.push(radios[0]);
  });
  form.querySelectorAll('[data-require-one]').forEach((group) => {
    const bad = ![...group.querySelectorAll('input[type="checkbox"]')].some((c) => c.checked);
    group.toggleAttribute('data-invalid', bad);
    setError(group, group, bad ? 'Please tick at least one option. Choose "None of these" if none apply.' : '');
    if (bad) problems.push(group.querySelector('input'));
  });
  form.querySelectorAll('input:not([type="radio"]), select, textarea').forEach((el) => {
    if (el.closest('[data-require-one]')) return;
    const bad = !el.checkValidity();
    const host = el.type === 'checkbox' ? el.closest('label') : el;
    setError(host, el, bad ? messageFor(el) : '');
    if (bad) problems.push(el);
  });
  // Report in document order.
  problems.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  if (problems[0]) problems[0].focus();
  return problems.length;
}

function initForms() {
  document.querySelectorAll('form[data-form]').forEach((form) => {
    const kind = form.dataset.form;
    const status = form.querySelector('.form__status');
    const say = (msg, error = false) => {
      if (!status) return;
      status.textContent = msg;
      status.classList.toggle('is-error', error);
    };
    // Clear a field's error as soon as it becomes valid.
    form.addEventListener('input', (e) => {
      const el = e.target;
      if (el.getAttribute('aria-invalid') === 'true' && el.checkValidity() && el.type !== 'radio') {
        setError(el.type === 'checkbox' ? el.closest('label') : el, el, '');
      }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const count = validate(form);
      if (count) {
        say(`Please fix ${count === 1 ? 'the highlighted field' : `the ${count} highlighted fields`} and try again.`, true);
        return;
      }
      const endpoint = FORM_ENDPOINTS[kind];
      const data = new FormData(form);
      if (endpoint) {
        say('Sending…');
        try {
          const res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error(String(res.status));
          form.reset();
          say(kind === 'newsletter' ? "You're on the list. Welcome!" : `Thank you! We'll be in touch ${business.responseTime}.`);
        } catch {
          say(`Something went wrong. Please call or text ${business.phoneDisplay}.`, true);
        }
        return;
      }
      // No backend yet: fall back to the visitor's own email app.
      if (kind === 'contact') {
        const name = `${data.get('first_name') || ''} ${data.get('last_name') || ''}`.trim();
        const bodyText = `${data.get('message') || ''}\n\n— ${name}\n${data.get('email') || ''}\n${data.get('phone') || ''}`;
        location.href = `${business.emailHref}?subject=${encodeURIComponent(`Booking enquiry from ${name}`)}&body=${encodeURIComponent(bodyText)}`;
        say('Opening your email app… or call or text us for the fastest reply.');
      } else if (kind === 'newsletter') {
        location.href = `${business.emailHref}?subject=${encodeURIComponent('Newsletter signup')}&body=${encodeURIComponent(`Please add ${data.get('email')} to the Revive Drip Haus newsletter.`)}`;
        say('Opening your email app to confirm…');
      } else {
        say(`Online intake isn't connected yet. Please call or text ${business.phoneDisplay} to complete your consent form.`, true);
      }
    });
  });
}

// --- Video: plays only on screen, can be paused, respects the motion setting ---------------
function initVideo() {
  const v = document.querySelector('.video-card video');
  const btn = document.querySelector('[data-video-toggle]');
  if (!v) return;
  let onScreen = false;
  let userPaused = false;
  const sync = () => {
    const shouldPlay = onScreen && !userPaused && !motion.paused;
    if (shouldPlay) {
      if (v.preload === 'none') v.preload = 'auto';
      v.play().catch(() => {});
    } else v.pause();
    if (btn) {
      const playing = !userPaused && !motion.paused;
      btn.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
      btn.dataset.state = playing ? 'playing' : 'paused';
    }
  };
  new IntersectionObserver(
    ([en]) => {
      onScreen = en.isIntersecting;
      sync();
    },
    { threshold: 0.2 }
  ).observe(v);
  btn?.addEventListener('click', () => {
    const playing = !userPaused && !motion.paused;
    if (playing) userPaused = true;
    else {
      userPaused = false;
      if (motion.paused) motion.set(false);
    }
    sync();
  });
  motion.onChange(sync);
}
