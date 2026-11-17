const { chromium, devices } = require('playwright');
const ok = (c, msg) => console.log(`${c ? 'PASS' : 'FAIL'}  ${msg}`);
(async () => {
  const b = await chromium.launch();
  // Desktop
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  let p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('' + (process.env.BASE_URL || 'http://localhost:4173') + '/', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  await p.keyboard.press('Tab');
  ok(await p.evaluate(() => document.activeElement.classList.contains('skip-link')), 'first Tab lands on "Skip to content"');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.activeElement.id === 'main'), 'skip link moves focus to <main>');
  // focus ring visible
  await p.evaluate(() => document.querySelector('.nav__links a').focus());
  const outline = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  ok(outline !== 'none', `nav link shows a focus outline (${outline})`);
  // motion toggle
  const btn = p.locator('[data-motion-toggle]');
  const before = await btn.getAttribute('aria-pressed');
  await btn.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  const after = await btn.getAttribute('aria-pressed');
  ok(before === 'false' && after === 'true', `motion toggle flips aria-pressed (${before} → ${after}), label "${(await btn.innerText()).trim()}"`);
  ok(await p.evaluate(() => document.documentElement.classList.contains('motion-paused')), 'pausing adds html.motion-paused');
  ok(await p.evaluate(() => localStorage.getItem('rdh-motion') === 'paused'), 'choice is remembered');
  await p.keyboard.press('Enter');
  // in-page link focus
  await p.evaluate(() => document.querySelector('.nav__links a[href="#faq"]').click());
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.activeElement.id === 'faq'), 'nav link moves keyboard focus to the target section');
  // ingredient dialog
  const chip = p.locator('.drip .chip').first();
  await chip.scrollIntoViewIfNeeded(); await chip.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.getElementById('ingredient-dialog').open), 'Enter on an ingredient opens the dialog');
  ok(await p.evaluate(() => document.getElementById('ingredient-dialog').contains(document.activeElement)), 'focus moves into the dialog');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById('ingredient-dialog').open && document.activeElement.classList.contains('chip')), 'Esc closes the dialog and returns focus to the chip');
  // filter live region
  await p.locator('.filter[data-filter="recovery"]').click(); await p.waitForTimeout(200);
  ok((await p.textContent('#menu-status')).includes('4 recovery'), `filter announces: "${await p.textContent('#menu-status')}"`);
  // contact form errors
  await p.locator('.contact .form button[type=submit]').click(); await p.waitForTimeout(300);
  const f = await p.evaluate(() => {
    const a = document.activeElement; const d = a.getAttribute('aria-describedby');
    return { name: a.name, invalid: a.getAttribute('aria-invalid'), err: d && document.getElementById(d)?.textContent, count: document.querySelectorAll('.contact .field-error').length, status: document.querySelector('.contact .form__status').textContent };
  });
  ok(f.name === 'first_name' && f.invalid === 'true' && f.err, `empty submit focuses first invalid field with message "${f.err}" (${f.count} errors; status "${f.status}")`);
  await p.fill('.contact input[name=email]', 'not-an-email'); await p.locator('.contact .form button[type=submit]').click(); await p.waitForTimeout(200);
  ok((await p.evaluate(() => document.getElementById(document.querySelector('.contact input[name=email]').getAttribute('aria-describedby'))?.textContent || '')).includes('valid email'), 'bad email gets a specific message');
  // video toggle
  const vt = p.locator('[data-video-toggle]');
  await vt.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  const l1 = await vt.getAttribute('aria-label'); await vt.click(); await p.waitForTimeout(200); const l2 = await vt.getAttribute('aria-label');
  ok(l1 === 'Pause video' && l2 === 'Play video' && (await p.evaluate(() => document.querySelector('.arrive__video video').paused)), `video button pauses the video (${l1} → ${l2})`);
  await ctx.close();

  // Mobile menu
  ctx = await b.newContext({ ...devices['iPhone 13'] }); p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('' + (process.env.BASE_URL || 'http://localhost:4173') + '/', { waitUntil: 'load' }); await p.waitForTimeout(2000);
  await p.locator('.nav__toggle').focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById('mobile-menu').hidden && document.getElementById('mobile-menu').contains(document.activeElement)), 'mobile menu opens with focus inside');
  ok(await p.evaluate(() => document.querySelector('main').inert && document.querySelector('footer').inert), 'page behind the open menu is inert');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.getElementById('mobile-menu').hidden && document.activeElement.classList.contains('nav__toggle') && !document.querySelector('main').inert), 'Esc closes the menu and returns focus to the button');
  ok(await p.evaluate(() => { const r = document.querySelector('[data-motion-toggle]').getBoundingClientRect(); return r.width >= 24 && r.height >= 24 && r.bottom <= innerHeight; }), 'pause-animation button is visible and at least 24px on mobile');

  // Consent form groups
  await p.goto('' + (process.env.BASE_URL || 'http://localhost:4173') + '/consent-form', { waitUntil: 'load' }); await p.waitForTimeout(1000);
  await p.locator('form[data-form=consent] button[type=submit]').click(); await p.waitForTimeout(300);
  const g = await p.evaluate(() => ({
    conditions: document.getElementById(document.querySelector('[data-require-one]').getAttribute('aria-describedby') || 'x')?.textContent,
    radio: document.getElementById(document.querySelector('[role=radiogroup]').getAttribute('aria-describedby') || 'x')?.textContent,
    consent: document.getElementById(document.querySelector('input[name=consent]').getAttribute('aria-describedby') || 'x')?.textContent,
    status: document.querySelector('.form__status').textContent,
  }));
  ok(g.conditions && g.radio && g.consent, `consent groups report errors: conditions="${g.conditions}" | medication="${g.radio}" | consent="${g.consent}"`);
  console.log('status:', g.status);
  console.log('page errors:', errs.length ? errs : 'none');
  await b.close();
})();
