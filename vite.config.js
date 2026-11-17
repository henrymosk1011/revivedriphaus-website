import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { renderAll } from './src/render.js';

// The production address. Canonical URLs, social cards, the sitemap and the
// structured data all use it. Override with SITE_URL=https://… npm run build.
const SITE_URL = (process.env.SITE_URL || 'https://www.revivedriphaus.com').replace(/\/$/, '');

const pages = {
  main: 'index.html',
  consent: 'consent-form.html',
  notFound: '404.html',
};

export default defineConfig({
  // Root-relative URLs: the site is served from the domain root (and the 404
  // page must load its assets from any path depth).
  base: '/',
  appType: 'mpa',
  plugins: [
    {
      name: 'render-content',
      transformIndexHtml: { order: 'pre', handler: (html) => renderAll(html, { siteUrl: SITE_URL }) },
    },
    {
      // Preload the two fonts the first screen needs, so the headline paints
      // in its real typeface straight away.
      name: 'preload-fonts',
      transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
          if (!ctx.bundle) return html;
          const files = Object.keys(ctx.bundle).filter((f) =>
            /(anton-latin-400-normal|manrope-latin-wght-normal)-[\w-]+\.woff2$/.test(f)
          );
          const tags = files
            .map((f) => `<link rel="preload" href="/${f}" as="font" type="font/woff2" crossorigin />`)
            .join('\n    ');
          return html.replace('</title>', `</title>\n    ${tags}`);
        },
      },
    },
    {
      name: 'seo-files',
      generateBundle() {
        const today = new Date().toISOString().slice(0, 10);
        this.emitFile({
          type: 'asset',
          fileName: 'robots.txt',
          source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
        });
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>
</urlset>
`,
        });
      },
    },
    {
      // Serve /consent-form like Vercel's cleanUrls does, for local previews.
      name: 'clean-urls',
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/consent-form' || req.url?.startsWith('/consent-form?')) req.url = req.url.replace('/consent-form', '/consent-form.html');
          next();
        });
      },
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/consent-form' || req.url?.startsWith('/consent-form?')) req.url = req.url.replace('/consent-form', '/consent-form.html');
          next();
        });
      },
    },
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: Object.fromEntries(Object.entries(pages).map(([k, f]) => [k, resolve(import.meta.dirname, f)])),
    },
  },
  server: { host: true },
  preview: { host: true },
});
