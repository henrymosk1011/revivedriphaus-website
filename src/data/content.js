// All copy below is carried over from the live revivedriphaus.com site.
// Obvious typos were fixed; anything rewritten is marked "REVIEW" so the
// client can confirm it before launch.

export const business = {
  name: 'Revive Drip Haus',
  phoneDisplay: '(818) 482-9426',
  phoneHref: 'tel:+18184829426',
  smsHref: 'sms:+18184829426',
  email: 'Info@ReviveDripHaus.com',
  emailHref: 'mailto:info@revivedriphaus.com',
  hours: 'Open 24/7',
  area: ['Los Angeles', 'Ventura', 'Orange County'],
  responseTime: 'within 2 hours',
};

// REVIEW: cities listed for local search. The live site says "Serving LA,
// Ventura & OC"; confirm these are all within the client's service area.
export const serviceAreas = [
  ['Los Angeles County', ['Los Angeles', 'Santa Monica', 'Beverly Hills', 'West Hollywood', 'Hollywood', 'Venice', 'Malibu', 'Pasadena', 'Burbank', 'Glendale', 'Sherman Oaks', 'Studio City', 'Encino', 'Calabasas']],
  ['Ventura County', ['Thousand Oaks', 'Westlake Village', 'Simi Valley', 'Camarillo', 'Ventura', 'Oxnard']],
  ['Orange County', ['Irvine', 'Newport Beach', 'Costa Mesa', 'Huntington Beach', 'Laguna Beach', 'Anaheim']],
];

export const ingredients = {
  vitc: {
    name: 'Vitamin C',
    text: "Vitamin C (Ascorbic Acid) is a vitamin and antioxidant that plays a key role in immune function, skin health, and overall wellness. Since the body doesn't produce or store it, IV supplementation is essential.",
  },
  bcomplex: {
    name: 'Vitamin B Complex',
    // REVIEW: summary line added for the ingredient pop-up; the list below is from the live site.
    text: 'The full family of B vitamins for energy, nerves, skin and blood.',
    list: [
      ['B1 (Thiamine)', 'Supports energy metabolism, nerve function, and brain health.'],
      ['B2 (Riboflavin)', 'Helps convert food into energy and supports healthy skin and eyes.'],
      ['B3 (Niacin)', 'Aids in digestion, promotes cardiovascular health, and supports cholesterol balance.'],
      ['B5 (Pantothenic Acid)', 'Helps with hormone production, stress management, and energy metabolism.'],
      ['B6 (Pyridoxine)', 'Supports brain function, neurotransmitter production, and red blood cell formation.'],
      ['B7 (Biotin)', 'Essential for healthy hair, skin, and nails.'],
      ['B9 (Folate/Folic Acid)', 'Important for cell growth, DNA synthesis, and red blood cell production.'],
      ['B12 (Cobalamin)', 'Boosts energy, supports nerve function, and helps with red blood cell formation.'],
    ],
  },
  vitd: {
    name: 'Vitamin D',
    text: 'Essential for immune function, bone health, and mood regulation. Often used in IV therapy to combat deficiency and support overall wellness.',
  },
  glutathione: {
    name: 'Glutathione',
    text: 'A powerful antioxidant made up of three amino acids. It plays a crucial role in detoxifying the body & liver, boosting the immune system, and protecting cells from oxidative stress.',
  },
  zinc: {
    name: 'Zinc',
    text: "An essential mineral that plays a crucial role in immune function, wound healing, and overall cellular health. Since the body doesn't naturally produce or store zinc, it must be obtained through food, supplements, or IV therapy for optimal benefits.",
  },
  magnesium: {
    name: 'Magnesium',
    // REVIEW: the live site repeats the Manganese description here.
    text: 'An essential mineral involved in hundreds of processes in the body, including muscle and nerve function, energy production, and relaxation.',
  },
  copper: {
    name: 'Copper',
    text: 'An essential trace mineral that plays a crucial role in immune function, red blood cell production, and collagen formation. It is often included in IV therapy to support overall wellness, enhance energy levels, and promote skin and hair health.',
  },
  manganese: {
    name: 'Manganese',
    text: 'An essential trace mineral that plays a key role in bone formation, metabolism, and antioxidant function. Although the body needs it in small amounts, it is crucial for overall health.',
  },
  amino: {
    name: 'High Dose Amino Blend',
    text: 'Arginine, Citrulline, Lysine, and Proline: a specialized mix of essential and non-essential amino acids designed to support muscle recovery, energy production, and overall wellness.',
  },
  taurine: {
    name: 'Taurine',
    // REVIEW: the live site's sentence is cut off ("...additional supplementation.").
    text: 'A powerful amino acid that plays a key role in energy production, heart health, brain function, and muscle performance. While the body naturally produces taurine, additional supplementation can support performance and recovery.',
  },
  zofran: {
    name: 'Zofran',
    text: 'Anti-nausea medication.',
  },
  nad: {
    name: 'NAD+',
    text: 'Nicotinamide Adenine Dinucleotide, often called the "Fountain of Youth", is a coenzyme that plays a crucial role in energy production, cellular repair, and overall health. It is vital for metabolism, DNA repair, mental clarity and mitochondrial function. NAD+ levels drop by 50% around 30 years old, so supplementation is key to anti-aging.',
  },
};

const core = ['vitc', 'bcomplex', 'glutathione', 'zinc', 'magnesium', 'copper', 'manganese'];

export const drips = [
  {
    id: 'myers',
    name: 'Myers Cocktail',
    tag: 'wellness',
    price: 250,
    lede: 'Best for overall wellness.',
    body: 'Supports the immune system, energy, liver detoxification, mental clarity, healthy hair, skin & nails, bones & metabolism.',
    ingredients: core,
  },
  {
    id: 'quick-boost',
    name: 'Quick Boost',
    tag: 'wellness',
    price: 165,
    lede: 'IV fluids + your choice of 3 additives.',
    body: 'Perfect for a fast, low-cost hydration and nutrient top-up.',
    ingredients: core,
    choose: 3,
  },
  {
    id: 'nad',
    name: 'NAD+ Drip',
    tag: 'anti-aging',
    price: 150,
    from: true,
    lede: '"The Fountain of Youth"',
    body: 'NAD+ supports energy production, DNA repair, and cellular health. Levels drop 50% by age 30, so replenishment is key to anti-aging, mental clarity, and metabolism.',
    ingredients: ['nad'],
    doses: [
      ['100 mg', 'Injection or IV', 150],
      ['250 mg', 'IV', 425],
      ['500 mg', 'IV', 700],
    ],
  },
  {
    id: 'immunity',
    name: 'Immunity Booster',
    tag: 'immunity',
    price: 310,
    lede: 'For preventing or recovering from flu, cold, or COVID symptoms.',
    body: 'The most effective way to recover as fast as possible by treating the root cause of the illness.',
    ingredients: ['vitc', 'bcomplex', 'vitd', 'glutathione', 'zinc', 'magnesium', 'copper', 'manganese'],
  },
  {
    id: 'immunity-plus',
    name: 'Immunity Booster +',
    tag: 'immunity',
    price: 335,
    lede: 'The stronger version of our Immunity Booster.',
    body: 'A higher dose of Vitamin C & Zinc.',
    ingredients: ['vitc', 'bcomplex', 'vitd', 'glutathione', 'zinc', 'magnesium', 'copper', 'manganese'],
  },
  {
    id: 'elite-athlete',
    name: 'Elite Athlete',
    tag: 'performance',
    price: 250,
    lede: 'For athletes preparing for a big game or recovering from intense training.',
    body: 'Speeds up muscle recovery, aids muscle building, reduces inflammation and risk of injury, prevents cramping, and replenishes electrolytes & fluids lost through sweat.',
    ingredients: [...core, 'amino', 'taurine'],
  },
  {
    id: 'limitless',
    name: 'Limitless Drip',
    tag: 'performance',
    price: 310,
    lede: 'A Myers Cocktail with higher doses of every vitamin & mineral, plus amino acids and taurine.',
    body: 'Boosts muscle recovery, energy, and performance.',
    ingredients: [...core, 'amino', 'taurine'],
  },
  {
    id: 'hangover',
    name: 'Hangover Cure',
    tag: 'recovery',
    price: 265,
    lede: 'Quick relief from nausea, headache, and dehydration.',
    body: 'Flush out alcohol and toxins and support liver repair. Includes nausea & pain meds as needed.',
    ingredients: [...core, 'zofran'],
  },
  {
    id: 'pre-post-op',
    name: 'Pre/Post Op Drip',
    tag: 'recovery',
    price: 310,
    lede: 'Designed for surgical prep & recovery.',
    body: 'Helps flush anesthesia, reduce inflammation, support tissue healing, and prevent infection.',
    ingredients: core,
  },
  {
    id: 'liver-detox',
    name: 'Liver Detox Drip',
    tag: 'recovery',
    price: 310,
    lede: 'Supports natural liver detox pathways.',
    body: 'Flushes heavy metals, microplastics, alcohol toxins & everyday environmental waste.',
    ingredients: core,
  },
  {
    id: 'nvd',
    name: 'Nausea / Vomiting / Diarrhea',
    tag: 'recovery',
    price: 275,
    lede: 'Relief through anti-nausea medication and replenished electrolytes, minerals & vitamins.',
    body: 'Rapid rehydration, immediate symptom relief, and a fast recovery that helps prevent complications.',
    ingredients: [...core, 'zofran'],
  },
];

export const addons = [
  { name: 'Extra Bag of IV Fluids', price: 75, text: 'Max hydration to replenish fluids, electrolytes, and support rapid recovery.' },
  { name: 'Zofran', price: 25, text: 'Anti-nausea medication.' },
  { name: 'Toradol', price: 25, text: 'Potent non-narcotic pain relief for headaches, muscle aches, and inflammation.' },
  { name: 'NAD+ Injection (100 mg)', price: 100, text: 'Supports cellular energy production, mental clarity, and anti-aging benefits.' },
];

export const filters = [
  ['all', 'All drips'],
  ['wellness', 'Wellness'],
  ['immunity', 'Immunity'],
  ['performance', 'Performance'],
  ['recovery', 'Recovery'],
  ['anti-aging', 'Anti-aging'],
];

export const faqs = [
  {
    q: 'What is mobile IV hydration?',
    a: 'Mobile IV hydration is a service where a licensed medical professional administers IV fluids, vitamins, and electrolytes directly into your bloodstream in the comfort of your home, office, hotel, or other location.',
  },
  {
    q: 'How does IV hydration work?',
    a: 'IV therapy delivers fluids and nutrients directly into your bloodstream, bypassing the digestive system. This allows for faster absorption and quicker relief from dehydration, fatigue, illness, or hangovers.',
  },
  {
    q: 'What are the benefits of IV hydration?',
    a: 'IV hydration can help with:',
    list: [
      'Dehydration recovery',
      'Boosting energy and immunity',
      'Hangover relief/prevention',
      'Migraine and headache relief',
      'Athletic recovery',
      'Skin and beauty enhancement',
      'Cold and flu symptoms',
    ],
  },
  {
    q: 'Is IV hydration safe?',
    a: 'Yes! Our treatments use medical-grade fluids and are administered by trained professionals. We conduct a brief health assessment before treatment to ensure safety.',
  },
  {
    q: 'Does IV hydration hurt?',
    a: 'You may feel a small pinch when the needle is inserted, but most people find the process comfortable and relaxing.',
  },
];
