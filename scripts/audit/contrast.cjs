// Pixel-based WCAG contrast audit for text that sits over the WebGL film.
// node contrast.js <desktop|mobile> <T,T,...>
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
(async () => {
  const [mode, list, path = '/?capture'] = process.argv.slice(2);
  const Ts = list.split(',').map(Number);
  const vp = mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1, isMobile: mode === 'mobile', hasTouch: mode === 'mobile' });
  await p.goto((process.env.BASE_URL || 'http://localhost:4173') + path, { waitUntil: 'load' });
  const isFilm = path.includes('capture');
  if (isFilm) await p.waitForFunction(() => window.__film && window.__film.ready, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  // measure settled states only: no CSS transitions mid-flight
  await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' });
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (r, g, bb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bb);
  const fails = [];
  let checked = 0;
  let clock = 3;
  for (const T of Ts) {
    clock += 4; // GSAP time must only move forward
    if (isFilm) await p.evaluate(([T, c]) => { window.__film.frame(T, c); window.__film.frame(T, c + 3); }, [T, clock]);
    else await p.evaluate((f) => window.scrollTo(0, f * innerHeight), T);
    clock += 3;
    await p.waitForTimeout(1600);
    const items = await p.evaluate(() => {
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim()) continue;
        const el = node.parentElement;
        if (!el || seen.has(el) || el.closest('[aria-hidden="true"], .sr-only, script, style, dialog:not([open]), [hidden]')) continue;
        seen.add(el);
        const r = document.createRange(); r.selectNodeContents(node);
        const rect = r.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2 || rect.top < 0 || rect.bottom > innerHeight || rect.right < 0 || rect.left > innerWidth) continue; // fully on screen only
        if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        // effective opacity of the element chain
        let op = 1; for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
        if (op < 0.05) continue;
        // skip text currently covered by a fixed bar (nav, HUD): that's scrolled-under content
        const cx = (Math.max(0, rect.left) + Math.min(innerWidth, rect.right)) / 2, cy = (Math.max(0, rect.top) + Math.min(innerHeight, rect.bottom)) / 2;
        const top = document.elementFromPoint(cx, cy);
        if (top && !el.contains(top) && !top.contains(el) && top.closest('.nav, .hud, .hud__bar, .dripline')) { window.__occluded = (window.__occluded || 0) + 1; continue; }
        if (!el.closest('.nav, .hud') && [...document.querySelectorAll('.nav, .hud__bar, .dripline')].some((bar) => { const q = bar.getBoundingClientRect(); return q.width && rect.left < q.right && rect.right > q.left && rect.top < q.bottom && rect.bottom > q.top; })) { window.__occluded = (window.__occluded || 0) + 1; continue; }
        const cs = getComputedStyle(el);
        const m = cs.color.match(/[\d.]+/g).map(Number);
        const a = (m[3] ?? 1) * op;
        if (a < 0.05) continue; // gradient-clipped text, checked separately
        const size = parseFloat(cs.fontSize); const weight = parseInt(cs.fontWeight, 10);
        out.push({ y: Math.round(rect.top), text: node.textContent.trim().slice(0, 40), sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''),
          rect: [Math.max(0, rect.left), Math.max(0, rect.top), Math.min(innerWidth, rect.right), Math.min(innerHeight, rect.bottom)], color: [m[0], m[1], m[2], a],
          large: size >= 24 || (size >= 18.66 && weight >= 700) });
      }
      return out;
    });
    // hide every glyph, keep backgrounds, then photograph what's behind the text
    await p.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important} *::placeholder{color:transparent!important}' }).then((h) => p.evaluate((n) => n.id = 'hide-text', h));
    const png = PNG.sync.read(await p.screenshot());
    await p.evaluate(() => document.getElementById('hide-text')?.remove());
    for (const it of items) {
      const [x0, y0, x1, y1] = it.rect.map(Math.round);
      const lums = [];
      let worst = null; let worstL = -1;
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
        const i = (y * png.width + x) * 4; const L = lum(png.data[i], png.data[i + 1], png.data[i + 2]);
        lums.push(L); if (L > worstL) { worstL = L; worst = [png.data[i], png.data[i + 1], png.data[i + 2]]; }
      }
      if (!lums.length) continue;
      lums.sort((a, b) => a - b);
      const [r, g, bl, a] = it.color;
      const darkText = lum(r, g, bl) < 0.2;
      const bgL = darkText ? lums[Math.floor(lums.length * 0.05)] : lums[Math.floor(lums.length * 0.95)];
      // blend text colour over a background of that luminance (approximate with grey of same luminance)
      const bgC = Math.round(255 * (bgL <= 0.0031308 ? bgL * 12.92 : 1.055 * Math.pow(bgL, 1 / 2.4) - 0.055));
      const mix = (c) => c * a + bgC * (1 - a);
      const tL = lum(mix(r), mix(g), mix(bl));
      const ratio = (Math.max(tL, bgL) + 0.05) / (Math.min(tL, bgL) + 0.05);
      checked++;
      const need = it.large ? 3 : 4.5;
      if (ratio < need) fails.push(`T=${T} ${ratio.toFixed(2)} < ${need} y=${it.y} a=${it.color[3].toFixed(2)} ${it.sel} "${it.text}"`);
    }
  }
  console.log(`${mode}: checked ${checked} text samples, ${fails.length} below AA (skipped ${await p.evaluate(() => window.__occluded || 0)} covered by fixed bars)`);
  console.log(fails.slice(0, 60).join('\n'));
  await b.close();
})();
