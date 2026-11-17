import { ingredients, drips, business } from './data/content.js';
import { FORM_ENDPOINTS } from './config.js';

export function initUI({ scrollTo, lenis } = {}) {
  initNav(scrollTo, lenis);
  initMenuFilters();
  initIngredientDialog(lenis);
  initForms();
  initVideo();
  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
}

// --- Navigation ----------------------------------------------------------------
function initNav(scrollTo, lenis) {
  const nav = document.getElementById('nav');
  const toggle = nav?.querySelector('.nav__toggle');
  const menu = document.getElementById('mobile-menu');

  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 40);
    const menuOpen = toggle?.getAttribute('aria-expanded') === 'true';
    nav.classList.toggle('is-hidden', !menuOpen && y > 400 && y > lastY + 2);
    if (y < lastY - 2) nav.classList.remove('is-hidden');
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Open menu';
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) lenis?.stop();
    else lenis?.start();
  };
  toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') setMenu(false);
  });

  // In-page links glide through the film instead of jumping.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id === '#' || id === '#main') return;
    const target = id === '#top' ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    if (!menu.hidden) setMenu(false);
    scrollTo(target, { offset: id === '#top' ? 0 : -20 });
    history.replaceState(null, '', id === '#top' ? location.pathname : id);
  });

  // Highlight the current section in the nav.
  const links = [...document.querySelectorAll('.nav__links a[href^="#"]')];
  const map = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        links.forEach((l) => l.classList.remove('is-active'));
        map.get(en.target.id)?.classList.add('is-active');
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
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      const f = b.dataset.filter;
      buttons.forEach((x) => {
        x.classList.toggle('is-active', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      cards.forEach((c) => {
        const show = f === 'all' || c.dataset.tag === f;
        c.classList.toggle('is-hidden', !show);
      });
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
function validate(form) {
  let first = null;
  form.querySelectorAll('input, select, textarea').forEach((el) => {
    const bad = !el.checkValidity();
    el.setAttribute('aria-invalid', String(bad));
    if (bad && !first) first = el;
  });
  // Grouped checkboxes marked data-require-one need at least one tick.
  form.querySelectorAll('[data-require-one]').forEach((group) => {
    const any = [...group.querySelectorAll('input[type="checkbox"]')].some((c) => c.checked);
    group.toggleAttribute('data-invalid', !any);
    if (!any && !first) first = group.querySelector('input');
  });
  if (first) first.focus();
  return !first;
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
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate(form)) {
        say('Please fill in the highlighted fields.', true);
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
        say('Opening your email app… or call/text us for the fastest reply.');
      } else if (kind === 'newsletter') {
        location.href = `${business.emailHref}?subject=${encodeURIComponent('Newsletter signup')}&body=${encodeURIComponent(`Please add ${data.get('email')} to the Revive Drip Haus newsletter.`)}`;
        say('Opening your email app to confirm…');
      } else {
        say(`Online intake isn't connected yet. Please call or text ${business.phoneDisplay} to complete your consent form.`, true);
      }
    });
  });
}

// --- Video: only play while on screen ---------------------------------------------------
function initVideo() {
  const v = document.querySelector('.arrive__video video');
  if (!v) return;
  const io = new IntersectionObserver(
    ([en]) => {
      if (en.isIntersecting) {
        if (v.preload === 'none') v.preload = 'auto';
        v.play().catch(() => {});
      } else v.pause();
    },
    { threshold: 0.2 }
  );
  io.observe(v);
}
