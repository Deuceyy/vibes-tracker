/**
 * Pull live Vibes card prices from the DYLI marketplace API and write
 * them to src/data/dyliPrices.json, keyed by our tracker card IDs.
 *
 * DYLI models every variant as its own product:
 *   "Lil Shaker  - Legend of the Lils"             -> normal
 *   "Lil Shaker Holo - Legend of the Lils"         -> foil
 *   "Lil Shaker Arctic Foil - Legend of the Lils"  -> arctic
 *   "Lil Shaker Sketch 4/10 - Legend of the Lils"  -> sketch (serialized,
 *                                                     several products/card)
 *
 * Per variant we record:
 *   floor   - lowest_price (live marketplace floor; the price we trust)
 *   primary - price (DYLI's primary drop price; fallback when no floor)
 *   dyliId  - product id (deep link: dyli.io/drop/<id>-<slug>)
 *
 * The API is public but rate-limited — keep the page delay >= 2.5s.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const EXPLORE_URL = (page) =>
  `https://www.dyli.io/api/explore?page=${page}&limit=50&brandsSelected=${encodeURIComponent('["Vibes"]')}`;

const PAGE_DELAY_MS = 3000;
const MAX_PAGES = 80;

const rootDir = process.cwd();
const outFile = path.join(rootDir, 'src', 'data', 'dyliPrices.json');
const cardDataFile = path.join(rootDir, 'src', 'cardData.json');
const spoilerFile = path.join(rootDir, 'src', 'data', 'set3Spoilers.json');

// DYLI set suffix -> our set code
const SET_TAGS = {
  'legend of the lils': 'Lotl',
  'enter the huddle': 'Eth',
  'birb & pengu': 'S3',
};

// normalized-name overrides: "<set>|<ourNorm>" -> "<set>|<dyliNorm>"
// (DYLI names a few cards differently than the official spoiler sheet)
const NORM_ALIASES = new Map([
  ['S3|e mc birb', 'S3|e mcbirb'],
  ['S3|the crown of house vibesalot', 'S3|crown of house vibesalot'],
  ['Lotl|honey i shrunk the pengs', 'Lotl|honey i shrunk the penguins'],
]);

function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/['’‘!?,.]/g, '')
    .replace(/[=^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyForUrl(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const res = await fetch(EXPLORE_URL(page), {
        headers: { 'User-Agent': 'vibes-tracker price sync (github.com/Deuceyy/vibes-tracker)' },
      });
      if (res.status === 429) {
        await sleep(10000 * attempt);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 5) throw err;
      await sleep(5000 * attempt);
    }
  }
  throw new Error('unreachable');
}

async function pullCatalog() {
  const products = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await fetchPage(page);
    const batch = data.products ?? [];
    products.push(...batch);
    process.stdout.write(`  page ${page}: +${batch.length} (total ${products.length})\n`);
    if (!data.hasMore || batch.length === 0) break;
    await sleep(PAGE_DELAY_MS);
  }
  return products;
}

function indexCatalog(products) {
  // key: "<setCode>|<norm base name>" -> { variant: {floor, primary, dyliId, dyliName} }
  const index = new Map();

  for (const p of products) {
    if (p.category !== 'TCG' || p.subcategory !== 'Ungraded Card') continue;
    const m = p.name.match(/^(.*?)\s*-\s*(Legend of the Lils|Enter [Tt]he Huddle|Birb & Pengu)\s*$/);
    if (!m) continue;

    let base = m[1].trim();
    const setKey = SET_TAGS[m[2].toLowerCase()];
    if (!setKey) continue;

    let variant = 'normal';
    let mm;
    if ((mm = base.match(/^(.*?)\s+Sketch(?:\s+\d+\/\d+)?$/i))) { variant = 'sketch'; base = mm[1]; }
    else if ((mm = base.match(/^(.*?)\s+Arctic(?:\s+Foil)?$/i))) { variant = 'arctic'; base = mm[1]; }
    else if ((mm = base.match(/^(.*?)\s+Holo$/i))) { variant = 'foil'; base = mm[1]; }
    // Set 3's special foils — not tracked as collection variants (yet),
    // but we record their prices so the data is ready when we add them.
    else if ((mm = base.match(/^(.*?)\s+Birb\s+Foil$/i))) { variant = 'birbFoil'; base = mm[1]; }
    else if ((mm = base.match(/^(.*?)\s+Fish\s+Foil$/i))) { variant = 'fishFoil'; base = mm[1]; }
    else if ((mm = base.match(/^(.*?)\s+Pengu\s+Foil$/i))) { variant = 'penguFoil'; base = mm[1]; }

    const key = `${setKey}|${norm(base)}`;
    if (!index.has(key)) index.set(key, {});
    const slot = index.get(key);

    const floor = typeof p.lowest_price === 'number' && p.lowest_price > 0 ? p.lowest_price : null;
    const primary = typeof p.price === 'number' && p.price > 0 ? p.price : null;
    const entry = {
      floor,
      primary,
      dyliId: p.id,
      url: `https://www.dyli.io/drop/${p.id}-${slugifyForUrl(p.name)}`,
    };

    const existing = slot[variant];
    if (!existing) {
      slot[variant] = entry;
    } else {
      // Multiple products per variant (serialized sketches): keep the
      // cheapest live floor; fall back to cheapest primary.
      const a = existing.floor ?? existing.primary ?? Infinity;
      const b = entry.floor ?? entry.primary ?? Infinity;
      if (b < a) slot[variant] = entry;
    }
  }
  return index;
}

async function loadOurCards() {
  const set12 = JSON.parse(await fs.readFile(cardDataFile, 'utf8'));
  const spoilers = JSON.parse(await fs.readFile(spoilerFile, 'utf8'));
  const { buildSet3TrackerCard } = await import(
    'file://' + path.join(rootDir, 'src', 'lib', 'cardMetadata.js').replace(/\\/g, '/')
  );
  const set3 = spoilers.cards.map(buildSet3TrackerCard);
  return [...set12, ...set3];
}

async function main() {
  console.log('Pulling DYLI Vibes catalog...');
  const products = await pullCatalog();
  console.log(`Catalog: ${products.length} products`);

  const index = indexCatalog(products);
  console.log(`Indexed ${index.size} distinct cards`);

  const ourCards = await loadOurCards();

  const out = {};
  let matched = 0;
  const unmatched = [];
  for (const card of ourCards) {
    let key = `${card.set}|${norm(card.name)}`;
    if (NORM_ALIASES.has(key)) key = NORM_ALIASES.get(key);
    const hit = index.get(key);
    if (!hit) {
      unmatched.push(`${card.set}: ${card.name}`);
      continue;
    }
    matched += 1;
    out[card.id] = hit;
  }

  const payload = {
    _meta: {
      generatedAt: new Date().toISOString(),
      source: 'dyli.io',
      matchedCards: matched,
      totalCards: ourCards.length,
      unmatched,
    },
    prices: out,
  };

  await fs.writeFile(outFile, JSON.stringify(payload, null, 1) + '\n');
  console.log(`Matched ${matched}/${ourCards.length} cards -> ${outFile}`);
  if (unmatched.length) {
    console.log('Unmatched:', unmatched.join('; '));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
