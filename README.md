# Revive Drip Haus · concept redesign

A redesign of [revivedriphaus.com](https://www.revivedriphaus.com) built around one idea: **the IV drip**. The whole homepage plays like one continuous macro film as you scroll, rendered live in WebGL (three.js) rather than pre-recorded footage. The page around it is a bright, clinical-luxury design in the brand's greens, with type and details borrowed from IV-bag labels. All copy, prices and photos are carried over from the live site.

## The film

Scrolling is the play button. Each page section is a chapter, and the camera eases toward the scroll position so it feels like scrubbing video. A thin IV line on the right fills with fluid as you go, and the meter at the bottom counts the millilitres "infused".

| # | Section | What plays |
|---|---|---|
| 01 Bag | Hero | A glossy IV bag of green fluid hangs in a white studio, with a printed Revive label and a gentle slosh |
| 02 Drop | "We come to you" | Macro shot inside the drip chamber: a drop swells at the tip, falls, and splashes into the pool |
| 03 Line | Benefits | The camera follows the fluid as it fills the clear IV line, past the Y-site and roller clamp |
| 04 Formula | IV menu | A dive into the fluid itself: light shafts, bubbles and the vitamin and mineral molecules in each drip |
| 05 Revive | About | Back out through the surface, a single drop lands: a crown splash in bullet time |
| 06 Book | FAQ + contact | A jet rises and releases one perfect drop, which hovers beside the booking details |

The IV menu cards are styled as IV bags too: a hanger tab, a frosted bag whose fluid level fills when the card appears, a printed label with the drip's details, and a port at the bottom.

## Run it

```bash
npm install
npm run dev       # local dev server
npm run build     # production build in dist/
npm run preview   # serve the production build
```

Deploy to Vercel (`vercel.json` is included: clean URLs, redirects from the old site's URLs, caching and security headers) or any static host. Build command `npm run build`, output folder `dist`.

The production address used for canonical URLs, social cards and the sitemap defaults to `https://www.revivedriphaus.com`. Override it with `SITE_URL=https://example.com npm run build`.

## Editing content

- **Menu, prices, ingredients, FAQ:** `src/data/content.js`. The menu, FAQ and the consent form's drip list are rendered into the HTML at build time from this file.
- **Page copy:** `index.html` and `consent-form.html`.
- **Service areas:** `serviceAreas` in `content.js` (shown on the page and in the search-engine data).
- **Photos & video:** `public/media/` (client photos converted to WebP).
- **Colours & type:** CSS variables at the top of `src/styles/main.css`. Brand greens from the live site: `#116935` and `#19a352`. Type: Instrument Serif (headlines), IBM Plex Mono (label details) and Manrope (body).
- **Logo:** `public/media/revive-logo.png` (the client's logo, cropped to its edges).

## Forms

The site is static, so forms need somewhere to send submissions. Add endpoint URLs in `src/config.js`. Until then:

- **Contact:** opens the visitor's email app with the message pre-filled.
- **Newsletter:** opens an email subscribe request.
- **Consent form:** asks the patient to call or text, so no medical data leaves the page.

The consent form collects medical history (PHI). Connect it only to a HIPAA-compliant form service that will sign a BAA.

## Accessibility (WCAG 2.2 AA)

What's built in:

- **Motion control:** a "Pause animation" button (bottom left) freezes the ambient 3D animation, transition flashes, CSS animations and the looping video. It's remembered between visits, and it's on by default when the visitor's device asks for reduced motion. Scrolling still moves the story, because the visitor controls that.
- **Flashes:** none. Scene changes are a slow liquid wipe (a waterline sweeping across the frame), not a flash.
- **Contrast:** a soft field of light runs in from the left behind every block of copy that floats over the 3D film (a dark one in the underwater menu chapter), and the nav, HUD, buttons and cards have solid or frosted backings.
- **Keyboard:**
  - Skip link to the main content, and visible focus rings throughout.
  - In-page links move keyboard focus to the section they jump to.
  - The mobile menu traps focus while open, makes the page behind it inert, and closes on Esc.
  - The ingredient pop-up is a native modal dialog.
  - Scroll padding keeps focused items clear of the fixed nav and HUD (2.4.11).
- **Screen readers:**
  - Landmarks, one H1 and no skipped heading levels.
  - Descriptive link names, e.g. "Book Myers Cocktail by text message".
  - A live region announces menu filter results, and the decorative canvas and HUD readouts are hidden.
  - Split-text animations keep a single readable label.
- **Forms:**
  - Visible labels, autocomplete hints and a "required" legend.
  - A specific error message under each invalid field, linked with `aria-describedby`, and focus jumps to the first problem.
  - Checkbox and radio groups are properly labelled.
- **Target sizes:** all controls are at least 24×24px.

How it was verified:

- axe-core (WCAG 2.0/2.1/2.2 A and AA, plus best practices) reports 0 violations on the homepage, consent form and 404 page, at desktop and phone sizes.
- axe can't judge text over a WebGL canvas, so contrast was measured from rendered pixels at 17 moments of the film, at desktop and phone sizes: every text sample passes AA (lines partly scrolled under the fixed nav or HUD are skipped).
- 19 scripted keyboard and screen-reader behaviour checks pass.

Re-run the audits after changes (they need Playwright with Chromium installed, and the preview server running via `npm run build && npm run preview`):

```bash
node scripts/audit/axe.cjs /
node scripts/audit/axe.cjs /consent-form mobile
node scripts/audit/keyboard.cjs
node scripts/audit/contrast.cjs desktop 0,0.5,1.2,1.4,1.9,2.2,2.5,2.8,3.1,3.4,3.7,4.2,4.5,4.8,5.2,5.5,5.8
```

Still recommended before calling it compliant: a manual pass with VoiceOver (iOS/macOS) and NVDA (Windows), and a review by an accessibility auditor. Automated tools catch roughly half of real-world issues.

## SEO

- Keyword-focused title (57 characters) and description (159 characters), a canonical URL, and Open Graph and Twitter cards with a 1200×630 share image (`public/og-image.jpg`).
- Structured data (JSON-LD) generated from `content.js`:
  - `MedicalBusiness` / `LocalBusiness` with phone, 24/7 hours and every city served.
  - An offer catalog with all 17 priced drips and add-ons.
  - `FAQPage` with all 5 questions.
- All content (menu, FAQ, service areas) is in the static HTML, so crawlers don't need JavaScript.
- `robots.txt` and `sitemap.xml` are generated at build time. The consent form and 404 page are `noindex`.
- `vercel.json` 301-redirects the old site's URLs: `/about-us`, `/iv-menu` and `/contact` go to their sections, and the consent form keeps its old `/consent-form` address.
- Speed: the main headline fonts are preloaded, the 3D engine loads after the page, there's no blocking loader, and images are WebP with fixed dimensions.

Worth doing at launch (outside the code): verify the domain in Google Search Console and submit the sitemap, claim the Google Business Profile with the same name, phone and service area, and add the real social profile links.

## Performance

- Quality adapts to the device: lighter scenes on phones, and resolution drops automatically if frame rate falls.
- Without WebGL, a static gradient background is shown and the site still works fully.

## Code map

```
index.html                 homepage
consent-form.html, 404.html other pages
vercel.json                redirects, clean URLs, headers
src/main.js                boot, smooth scroll (Lenis), render loop
src/timeline.js            scroll position → film time, HUD
src/animations.js          GSAP text reveals
src/ui.js                  nav, menu filters, ingredient dialog, forms, video
src/motion.js              pause-animation control
src/render.js              build-time HTML for menu, FAQ, service areas, JSON-LD
src/scene/Film.js          renderer, post-processing, colour grade, timeline
src/scene/Director.js      camera shots (splines + monotone timing)
src/scene/IVBag.js         the bag, label, drip chamber, macro drop
src/scene/Line.js          IV line with Y-site and roller clamp
src/scene/FluidWorld.js    inside the fluid: bubbles, light, molecules
src/scene/Splash.js        crown splash, jet and hovering drop
src/scene/*.js             Droplet, Molecules, Sky, environment, FinalShader
```

## Content to confirm with the client

These were fixed or rewritten from the live site and are marked `REVIEW` in `content.js`:

1. **Magnesium:** the live site repeats the Manganese description; a correct one was written.
2. **Taurine:** the live description is cut off mid-sentence; it was completed.
3. **Consent form:** "Lunch conditions" is now "Lung conditions". The medication question used to ask for allergies; there are now separate medication and allergy fields. The four consent statements are now a required "I agree" checkbox.
4. **Social links** on the live site point to the generic x.com, youtube.com, facebook.com and instagram.com homepages, so they were left out until real profile URLs are available.
5. **Template leftovers** on the live site (tennis-court locations, "Join a camp", city labels like "Austin, TX") were not carried over.
6. **Service areas:** the city list (Santa Monica, Pasadena, Thousand Oaks, Irvine…) was added for local search. Confirm every city is actually served.
7. **Vitamin B Complex:** the one-line summary in its pop-up is new copy; the B1–B12 list is from the live site.
