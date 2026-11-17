# Revive Drip Haus · concept redesign

A redesign of [revivedriphaus.com](https://www.revivedriphaus.com) built around a **scroll-driven 3D film**: the whole homepage plays like one continuous video as you scroll, with real-time WebGL (three.js) rather than pre-rendered footage. All copy, prices and photos are carried over from the live site.

## The film

Scrolling is the play button. Each page section is a chapter, and the camera eases toward the scroll position so it feels like scrubbing video:

| # | Section | What plays |
|---|---|---|
| 01 Arrive | Hero | A morphing drop of liquid glass with halo rings and falling drip streaks |
| 02 Travel | "We come to you" | The drop falls onto a night-time city and becomes a light trail racing through the streets to a beacon at your door |
| 03 Absorb | Benefits | A flash cut into the bloodstream: living vessel walls, drifting cells, streams of nutrients |
| 04 Choose | IV menu | Out of the vessel into a field of glassy vitamin molecules |
| 05 Revive | About | Thousands of particles assemble into a glowing orb around a re-formed drop |
| 06 Book | FAQ + contact | The orb breathes beside the booking details |

## Run it

```bash
npm install
npm run dev       # local dev server
npm run build     # production build in dist/
npm run preview   # serve the production build
```

Deploy `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, S3…). Build command `npm run build`, output folder `dist`.

## Editing content

- **Menu, prices, ingredients, FAQ:** `src/data/content.js`. The menu, FAQ and the consent form's drip list are rendered into the HTML at build time from this file.
- **Page copy:** `index.html` and `consent.html`.
- **Photos & video:** `public/media/` (client photos converted to WebP).
- **Colours & type:** CSS variables at the top of `src/styles/main.css`. Brand greens from the live site: `#116935` and `#19a352`.

## Forms

The site is static, so forms need somewhere to send submissions. Add endpoint URLs in `src/config.js`. Until then:

- **Contact:** opens the visitor's email app with the message pre-filled.
- **Newsletter:** opens an email subscribe request.
- **Consent form:** asks the patient to call or text, so no medical data leaves the page.

The consent form collects medical history (PHI). Connect it only to a HIPAA-compliant form service that will sign a BAA.

## Performance & accessibility

- The 3D engine (`src/scene/`) is code-split and loads after the page. Text and links work immediately.
- Quality adapts to the device: lighter scenes on phones, and resolution drops automatically if frame rate falls.
- `prefers-reduced-motion` turns off smooth scrolling and text animations and slows the scene.
- Without WebGL, a static gradient background is shown and the site still works fully.

## Code map

```
index.html, consent.html   pages
src/main.js                boot, smooth scroll (Lenis), render loop
src/timeline.js            scroll position → film time, HUD
src/animations.js          GSAP text reveals
src/ui.js                  nav, menu filters, ingredient dialog, forms
src/render.js              build-time HTML for menu / FAQ
src/scene/Film.js          renderer, post-processing, colour grade, timeline
src/scene/Director.js      camera shots (splines + monotone timing)
src/scene/*.js             Droplet, City, Tunnel, Molecules, Orb, Sky, Dust
```

## Content to confirm with the client

These were fixed or rewritten from the live site and are marked `REVIEW` in `content.js`:

1. **Magnesium:** the live site repeats the Manganese description; a correct one was written.
2. **Taurine:** the live description is cut off mid-sentence; it was completed.
3. **Consent form:** "Lunch conditions" is now "Lung conditions". The medication question used to ask for allergies; there are now separate medication and allergy fields. The four consent statements are now a required "I agree" checkbox.
4. **Social links** on the live site point to the generic x.com, youtube.com, facebook.com and instagram.com homepages, so they were left out until real profile URLs are available.
5. **Template leftovers** on the live site (tennis-court locations, "Join a camp", city labels like "Austin, TX") were not carried over.
