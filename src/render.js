// Renders data-driven parts of the pages into static HTML at build time
// (see vite.config.js), so the menu and FAQ are crawlable and work without JS.
import { business, ingredients, drips, addons, filters, faqs, serviceAreas } from './data/content.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const tagLabel = Object.fromEntries(filters);
const pad = (n) => String(n).padStart(2, '0');

const smsFor = (text) => `${business.smsHref}?&body=${encodeURIComponent(text)}`;

const arrow =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const phone =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6A2.1 2.1 0 0 1 18.4 20 15.9 15.9 0 0 1 4 5.6 2.1 2.1 0 0 1 6.6 3.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';

function chips(ids) {
  return ids
    .map(
      (id) =>
        `<li><button type="button" class="chip" data-ingredient="${esc(id)}" aria-haspopup="dialog">${esc(ingredients[id].name)}</button></li>`
    )
    .join('');
}

function dripCard(d, i) {
  const doses = d.doses
    ? `<ul class="drip__doses">${d.doses
        .map(
          ([amt, how, price]) =>
            `<li><span><strong>${esc(amt)}</strong> ${esc(how)}</span><a class="dose__book" href="${esc(
              smsFor(`Hi! I'd like to book an NAD+ ${amt} drip.`)
            )}">$${price}<span class="sr-only">: book NAD+ ${esc(amt)} by text message</span> ${arrow}</a></li>`
        )
        .join('')}</ul>`
    : '';
  const chooseNote = d.choose ? `<p class="drip__note">Choose any ${d.choose}:</p>` : '';
  return `
<article class="drip glass" data-tag="${esc(d.tag)}" id="drip-${esc(d.id)}" style="--i:${i}">
  <div class="drip__head">
    <span class="drip__num">${pad(i + 1)}</span>
    <span class="drip__tag">${esc(tagLabel[d.tag])}</span>
  </div>
  <div class="drip__bag" aria-hidden="true"><span class="drip__liquid"></span><span class="drip__line"></span></div>
  <h3 class="drip__name">${esc(d.name)}</h3>
  <p class="drip__lede">${esc(d.lede)}</p>
  <p class="drip__body">${esc(d.body)}</p>
  ${doses}
  <div class="drip__ing">
    ${chooseNote || `<p class="drip__note">What's inside</p>`}
    <ul class="chips">${chips(d.ingredients)}</ul>
  </div>
  <div class="drip__foot">
    <p class="drip__price">${d.from ? '<small>from</small>' : ''}<span class="cur">$</span>${d.price}</p>
    <a class="btn btn--primary btn--sm" href="${esc(smsFor(`Hi! I'd like to book a ${d.name}.`))}">Book<span class="sr-only"> ${esc(d.name)} by text message</span> ${arrow}</a>
  </div>
</article>`;
}

export function renderMenu() {
  return drips.map(dripCard).join('\n');
}

export function renderFilters() {
  return filters
    .map(
      ([id, label], i) =>
        `<button type="button" class="filter${i === 0 ? ' is-active' : ''}" data-filter="${esc(id)}" aria-pressed="${
          i === 0 ? 'true' : 'false'
        }">${esc(label)}</button>`
    )
    .join('');
}

export function renderAddons() {
  return addons
    .map(
      (a) =>
        `<li class="addon"><div><h4>${esc(a.name)}</h4><p>${esc(a.text)}</p></div><span class="addon__price">+$${a.price}</span></li>`
    )
    .join('');
}

export function renderFaq() {
  return faqs
    .map(
      (f, i) => `
<details class="faq__item"${i === 0 ? ' open' : ''}>
  <summary><span class="faq__q">${esc(f.q)}</span><span class="faq__icon" aria-hidden="true"></span></summary>
  <div class="faq__a"><p>${esc(f.a)}</p>${
    f.list ? `<ul>${f.list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''
  }</div>
</details>`
    )
    .join('');
}

export function renderDripOptions() {
  const opts = [];
  for (const d of drips) {
    if (d.doses) {
      for (const [amt, how, price] of d.doses) opts.push(`NAD+ ${amt} (${how}) · $${price}`);
    } else {
      opts.push(`${d.name} · $${d.price}`);
    }
  }
  return opts.map((o) => `<option>${esc(o)}</option>`).join('');
}

export function renderServiceAreas() {
  return serviceAreas
    .map(
      ([county, cities]) =>
        `<div class="areas__group"><h4>${esc(county)}</h4><p>${cities.map(esc).join(', ')}</p></div>`
    )
    .join('');
}

// Structured data for search engines, generated from the same content as the
// page so prices and answers never drift apart.
export function renderJsonLd(siteUrl) {
  const site = siteUrl.replace(/\/$/, '');
  const offers = [
    ...drips.flatMap((d) =>
      d.doses
        ? d.doses.map(([amt, how, price]) => ({ name: `NAD+ ${amt} (${how})`, description: d.body, price }))
        : [{ name: d.name, description: `${d.lede} ${d.body}`, price: d.price }]
    ),
    ...addons.map((a) => ({ name: `${a.name} (add-on)`, description: a.text, price: a.price })),
  ];
  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${site}/#website`,
      url: `${site}/`,
      name: business.name,
      inLanguage: 'en-US',
      publisher: { '@id': `${site}/#business` },
    },
    {
      '@type': ['MedicalBusiness', 'LocalBusiness'],
      '@id': `${site}/#business`,
      name: business.name,
      url: `${site}/`,
      description:
        'On-demand mobile IV hydration therapy. Licensed medical professionals bring IV fluids, vitamins, minerals and NAD+ to your home, office, hotel or event.',
      telephone: '+1-818-482-9426',
      email: 'info@revivedriphaus.com',
      image: `${site}/og-image.jpg`,
      logo: `${site}/icons/icon-192.png`,
      priceRange: '$$',
      currenciesAccepted: 'USD',
      openingHoursSpecification: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '00:00',
        closes: '23:59',
      },
      areaServed: serviceAreas.flatMap(([county, cities]) => [
        { '@type': 'AdministrativeArea', name: `${county}, CA` },
        ...cities.map((c) => ({ '@type': 'City', name: `${c}, CA` })),
      ]),
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'IV Therapy Menu',
        itemListElement: offers.map((o) => ({
          '@type': 'Offer',
          price: String(o.price),
          priceCurrency: 'USD',
          itemOffered: { '@type': 'Service', name: o.name, description: o.description, serviceType: 'Mobile IV therapy' },
        })),
      },
    },
    {
      '@type': 'FAQPage',
      '@id': `${site}/#faq`,
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.list ? `${f.a} ${f.list.join(', ')}.` : f.a },
      })),
    },
  ];
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

export const icons = { arrow, phone };

export function renderAll(html, { siteUrl = 'https://www.revivedriphaus.com' } = {}) {
  return html
    .replaceAll('%SITE_URL%', siteUrl.replace(/\/$/, ''))
    .replace('<!-- render:jsonld -->', renderJsonLd(siteUrl))
    .replace('<!-- render:areas -->', renderServiceAreas())
    .replace('<!-- render:menu -->', renderMenu())
    .replace('<!-- render:filters -->', renderFilters())
    .replace('<!-- render:addons -->', renderAddons())
    .replace('<!-- render:faq -->', renderFaq())
    .replace('<!-- render:drip-options -->', renderDripOptions())
    .replaceAll('<!-- icon:arrow -->', arrow)
    .replaceAll('<!-- icon:phone -->', phone);
}
