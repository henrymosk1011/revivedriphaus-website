// node axe.js <path> [mobile]  — runs axe-core (WCAG 2.2 AA) against the preview server
const { chromium, devices } = require('playwright');
const fs = require('fs');
(async () => {
  const [path = '/', mode] = process.argv.slice(2);
  const b = await chromium.launch();
  const ctx = await b.newContext(mode === 'mobile' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto('' + (process.env.BASE_URL || 'http://localhost:4173') + '' + path, { waitUntil: 'load' });
  await p.waitForTimeout(3000);
  await p.addScriptTag({ content: fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8') });
  const r = await p.evaluate(async () => {
    const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    const fmt = (v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, nodes: v.nodes.slice(0, 4).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(0, 2).join(' | ')) });
    return { violations: res.violations.map(fmt), incomplete: res.incomplete.map((v) => ({ id: v.id, n: v.nodes.length })) };
  });
  console.log(`== ${path} ${mode || 'desktop'}: ${r.violations.length} violation types`);
  for (const v of r.violations) { console.log(`- [${v.impact}] ${v.id} (${v.n}): ${v.help}`); v.nodes.forEach((n) => console.log('    ' + n.slice(0, 220))); }
  console.log('needs review:', r.incomplete.map((i) => `${i.id}(${i.n})`).join(', '));
  await b.close();
})();
