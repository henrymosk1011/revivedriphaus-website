# Archive of the old revivedriphaus.com (Webflow)

A snapshot of the live Webflow site, saved on **22 Nov 2026** just before it was taken offline. The site itself was last published on **6 Sep 2026**. Use this folder as the reference for anything the old site said or showed.

None of this is part of the new site's build: Vite only builds the pages listed in `vite.config.js`, and Vercel serves only `dist/`.

## What's here

| Folder | Contents |
|---|---|
| `content/` | Every page as readable Markdown: all copy (including the ingredient pop-ups and FAQ answers that are hidden until opened), links, image file names, and form fields with their names, types and options. **Start here.** |
| `screenshots/` | Full-page captures of every page at desktop (1440px) and phone (iPhone 13) width. |
| `pages/` | The raw HTML of each page as served, plus the site's stylesheet (`webflow-site.css`). |
| `assets/` | The site's own images, logo, favicons, icons and hero video, at original resolution. |
| `assets/template-leftovers/` | Stock images and a logo from the Webflow template (tennis club, "Elysian Fitness Studios") that were still on the site. Not Revive's content. |

## Pages

| URL | Title | What's on it |
|---|---|---|
| `/` | Revive Drip Haus - Home | Hero "On-demand mobile IV hydration" with the header-drip video, "Text or call us to book", "Mobile hydration, straight to you", five benefit cards, FAQ, footer |
| `/about-us` | Revive Drip Haus - About Us | One paragraph about the team and service |
| `/iv-menu` | Revive Drip Haus - IV Menu | 11 drips with ingredient pop-ups, add-ons, a "Book now" phone link on every price |
| `/contact` | Revive Drip Haus - Contact | Phone, email, contact form, photo |
| `/consent-form` | Revive Drip Haus - Consent Form | Consent for treatment and medical history form |
| `/404`, `/401` | Not Found, Protected page | Webflow's default utility pages (still template-branded) |

There was no sitemap, an empty `robots.txt`, no meta descriptions and no social share image. Webflow site ID: `691e617643d1d852bb73f793`.

## Business details as published

- **Name:** Revive Drip Haus (the consent form spells it "RevIVe Drip Haus")
- **Phone:** (818) 482-9426 (every "Book now" button dialled this number)
- **Email:** Info@ReviveDripHaus.com
- **Hours:** Open 24/7
- **Area:** "Serving LA, Ventura & OC"
- **Response time:** "someone will be in touch with you within 2 hours"
- **Tagline (footer):** "Helping You Achieve Wellness"
- **Designed by:** TenElevenMedia (tenelevenmedia.com), credited in the footer
- **Social links:** pointed at the generic x.com, youtube.com, facebook.com and instagram.com home pages; no real profiles were linked

## Brand

- **Greens:** `#116935` (main), `#106a35`, `#19a352` (lighter accent). Otherwise black, white and greys.
- **Headline font:** Coolvetica Condensed (Typodermic), all caps
- **Body font:** Satoshi (Fontshare, free)
- **Logo:** `assets/Header-Logo.png`, the cartoon nurse holding a syringe beside "REVIVE drip haus" with "IV" in green. The favicons are the nurse alone.

## IV menu and prices

| Drip | Price | Ingredients |
|---|---|---|
| Myers Cocktail | $250 | Vitamin C, B Complex, Glutathione, Zinc, Magnesium, Copper, Manganese |
| Quick Boost | $165 | IV fluids + choice of 3 additives from the Myers list |
| NAD+ Drip | 100 mg $150 (injection or IV), 250 mg $425 (IV), 500 mg $700 (IV) | NAD+ |
| Immunity Booster | $310 | Myers list + Vitamin D |
| Immunity Booster + | $335 | As above, higher dose Vitamin C and Zinc |
| Elite Athlete Drip | $250 | Myers list + High Dose Amino Blend + Taurine |
| Limitless Drip | $310 | Myers list (higher doses) + amino acids + Taurine |
| Hangover Cure | $265 | Myers list + Zofran; nausea and pain meds as needed |
| Pre/Post Op Drip | $310 | Myers list |
| Liver Detox Drip | $310 | Myers list |
| Nausea / Vomiting / Diarrhea Drip | $275 | Myers list + Zofran |

**Add-ons:** Extra bag of IV fluids $75 · Zofran $25 · Toradol $25 · NAD+ injection (100 mg) $100

The full descriptions and ingredient pop-up text are in `content/iv-menu.md`. On 22 Nov 2026 every price and description was checked against `src/data/content.js` and they match (apart from the fixes marked `REVIEW` there).

## Forms

All forms were Webflow's built-in forms, so **submissions were stored in the Webflow dashboard**, not emailed anywhere permanent.

| Form | Pages | Fields |
|---|---|---|
| Contact | `/contact` | `first_name`, `last_name`, `email`, `phone`, `message` (all required) |
| Newsletter ("Subscribe Form") | footer of every page | `email` |
| Consent | `/consent-form` | See below |

**Consent form fields:** Full name of patient\* · Date of birth (MM-DD-YYYY) · Email · Gender\* (Male / Female / Pregnant) · Phone\* · Address (street, city, state, zip) · Medical conditions\* (checkboxes: N/A, Asthma, High Blood Pressure, Heart Conditions, "Lunch Conditions", Cancer, Other, Neurological Conditions, Seizures, Diabetes, Liver Conditions, Kidney Conditions) · Other medical conditions (text) · "Are you currently taking any medication?" Yes/No\* · "If Yes, please list allergy and reaction"\* · Type of IV (dropdown) · Date of service\* · Time frame.

**Type of IV dropdown options:** Myers Cocktail $250, Immunity Booster $310, Limitless Drip $310, Hangover/Food Poisoning Cure $265, Elite Athlete $250, Pre/Post Op Drip $310, Liver Detox Drip $310, NAD+ 100mgs, NAD+ 250mgs, NAD+ 500mgs. Quick Boost, Immunity Booster + and the Nausea drip were missing from it.

**Consent statements (shown under the form, no checkbox):**

1. I understand the information provided on this form and agree to all statements made above.
2. Intravenous infusion therapy has been adequately explained to me by Registered Nurse/ or physician and understand the risks and benefits involved.
3. I have received all the information and explanation I desire concerning the procedure.
4. I authorize RevIVe Drip Haus, and all medical staff from all liabilities for any complications or damages associated with my IV infusion therapy.

## Problems on the old site

Kept here so nobody copies them back by accident. Most are already fixed in the new site (see "Content to confirm with the client" in the main README).

- **Copy:** Magnesium's description was a copy of Manganese's. Taurine's description stops mid-sentence ("additional supplementation."). Myers Cocktail said "liver liver detoxification". The consent form said "Lunch Conditions" (lung).
- **Consent form data was partly unusable.** Past submissions in Webflow can't be fully trusted:
  - All 11 medical-condition checkboxes shared one field name (`checkbox`), so a submission doesn't say *which* conditions were ticked.
  - The medication Yes and No radio buttons both sent the value "Radio", so the answer wasn't recorded.
  - The allergy field reused the name `Phone-Number` and the time-frame field reused `Date-of-Service`, so each collided with another field.
  - The medication follow-up asked for allergies instead, and the consent statements had no "I agree" checkbox.
- **Template leftovers.** Visible: the tennis photo behind the footer on every page, and the 404 and password pages branded "Elysian Fitness Studios © 2024". Hidden in the page code but still crawlable: benefit-card city labels ("Austin, TX", "Miami, FL", "Chicago, IL", "Los Angeles, CA"), an "Our Locations" block of tennis centres, a "Join a camp" button, a tennis photo on the About page, and an unused "Let's experience wellness together / Stay up to date" newsletter block on the home page.
- **SEO:** no meta descriptions, no sitemap, empty robots.txt, no share image.

## Where the assets went in the new site

| Old file (`assets/`) | New site |
|---|---|
| `Header-Logo.png` | `public/media/revive-logo.png`, `public/media/nurse-avatar.png` |
| `IV-Nurse-Old-Man-No-Travel.jpg` | `public/media/no-travel.webp` |
| `IV-Nurse-No-Waiting.jpg` | `public/media/no-waiting.webp` |
| `IV-arm-Fast-Efficient.jpg` | `public/media/fast-efficient.webp` |
| `IV-girl-on-her-phone.png` | `public/media/multi-task.webp` |
| `IV-girl-running-Fast-Recovery.jpg` | `public/media/fast-recovery.webp` |
| `Contact-page.jpg` | `public/media/contact.webp` |
| `header-drip.mp4`, `header-drip-poster.jpg` | `public/media/at-home-drip.mp4`, `at-home-drip-poster.jpg` (same 17 s clip, re-encoded smaller) |
| `favicon-*.png` | `public/icons/` |

The old page URLs (`/about-us`, `/iv-menu`, `/contact`, `/consent-form`) are redirected in `vercel.json`.

## Not saved, and why

- **Font files** (Coolvetica Condensed, Satoshi): licensed fonts, and the new site doesn't use them. Satoshi is free from fontshare.com; Coolvetica is from Typodermic.
- **The WebM copy of the hero video**: the same clip as the MP4, at 5 MB.
- **Webflow's smaller resized copies of each photo** and **Webflow's JavaScript**: generated by Webflow, and the originals are here.
