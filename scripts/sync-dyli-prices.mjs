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
import sharp from 'sharp';

const EXPLORE_URL = (page) =>
  `https://www.dyli.io/api/explore?page=${page}&limit=50&brandsSelected=${encodeURIComponent('["Vibes"]')}`;

const PAGE_DELAY_MS = 3000;
const MAX_PAGES = 80;

const rootDir = process.cwd();
const outFile = path.join(rootDir, 'src', 'data', 'dyliPrices.json');
const cardDataFile = path.join(rootDir, 'src', 'cardData.json');
const spoilerFile = path.join(rootDir, 'src', 'data', 'set3Spoilers.json');
const promoDataFile = path.join(rootDir, 'src', 'data', 'promoCards.js');
const promoImageDir = path.join(rootDir, 'public', 'promos');

// Which set each promo descends from (for display).
const SET_OF_ORIGIN = {
  'legend of the lils': 'Lotl',
  'enter the huddle': 'Eth',
  'birb & pengu': 'S3',
  'season 1': 'Eth',
};

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

  // Previous snapshot (for day-over-day price movement). Each variant
  // entry carries prevFloor/prevAt from the last time the floor CHANGED,
  // so movement survives syncs where nothing moved.
  let previous = null;
  try {
    previous = JSON.parse(await fs.readFile(outFile, 'utf8'));
  } catch { /* first run */ }

  const out = {};
  let matched = 0;
  const unmatched = [];
  const nowIso = new Date().toISOString();
  for (const card of ourCards) {
    let key = `${card.set}|${norm(card.name)}`;
    if (NORM_ALIASES.has(key)) key = NORM_ALIASES.get(key);
    const hit = index.get(key);
    if (!hit) {
      unmatched.push(`${card.set}: ${card.name}`);
      continue;
    }
    matched += 1;

    // Carry forward price-movement history per variant.
    const prevCard = previous?.prices?.[card.id];
    for (const [variant, entry] of Object.entries(hit)) {
      const prevEntry = prevCard?.[variant];
      if (!prevEntry) continue;
      const prevEffective = prevEntry.floor ?? prevEntry.primary ?? null;
      const nowEffective = entry.floor ?? entry.primary ?? null;
      if (prevEffective !== null && nowEffective !== null && prevEffective !== nowEffective) {
        entry.prevFloor = prevEffective;
        entry.prevAt = previous?._meta?.generatedAt ?? nowIso;
      } else if (prevEntry.prevFloor !== undefined) {
        entry.prevFloor = prevEntry.prevFloor;
        entry.prevAt = prevEntry.prevAt;
      }
    }
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

  // Regenerate the S3 special-foil support map (which of birbFoil /
  // fishFoil each Set 3 card comes in). cardMetadata.supportsVariant
  // consults this via a plain JS module so it works in both Node and Vite.
  const foilKinds = {};
  for (const [id, variants] of Object.entries(out)) {
    if (!id.startsWith('S3')) continue;
    if (variants.birbFoil) foilKinds[id] = 'birbFoil';
    else if (variants.fishFoil) foilKinds[id] = 'fishFoil';
  }
  const kindLines = Object.entries(foilKinds)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  const foilSrc =
    '// Generated by scripts/sync-dyli-prices.mjs — which special foil each\n' +
    '// Set 3 card comes in (every S3 card has exactly one of the two).\n' +
    'export default {\n' + kindLines.join('\n') + '\n};\n';
  await fs.writeFile(path.join(rootDir, 'src', 'data', 'set3FoilKinds.js'), foilSrc);
  console.log(`Set 3 foil kinds: ${Object.keys(foilKinds).length} entries`);

  // ---- Promo cards -----------------------------------------------------
  // Promos are standalone DYLI products (no game stats). Each becomes a
  // trackable card in the "Promo" set with a mirrored image + its floor.
  await syncPromos(products, out, previous);

  // Re-write dyliPrices.json now that promo prices were merged into `out`.
  payload._meta.generatedAt = new Date().toISOString();
  await fs.writeFile(outFile, JSON.stringify(payload, null, 1) + '\n');

  // ---- Sketch gallery --------------------------------------------------
  // The hand-drawn sketch cards have their own art on DYLI. Build a
  // gallery dataset (one entry per unique sketch card, cheapest floor).
  await syncSketches(products);
}

const sketchImageDir = path.join(rootDir, 'public', 'sketches');
const sketchDataFile = path.join(rootDir, 'src', 'data', 'sketchCards.js');

function sketchBaseName(name) {
  let n = name.replace(/^vibes\s*-\s*/i, '').trim();
  n = n.replace(/\s*-\s*(Legend of the Lils|Enter [Tt]he Huddle|Birb & Pengu|Season 1)\s*\$?$/i, '').trim();
  n = n.replace(/\s*\d+\/\d+/g, '');       // drop serial "X/10"
  n = n.replace(/\s*\(Error\)/ig, '');
  return n.trim();
}

async function syncSketches(products) {
  const raw = products.filter(
    (p) =>
      p.category === 'TCG' &&
      p.subcategory === 'Ungraded Card' &&
      /\bsketch\b/i.test(p.name || '') &&
      !/sketch baron/i.test(p.name || '')
  );

  // Group serials by base card; keep the cheapest live floor + a product
  // image (prefer a real uploaded sketch image over anything generic).
  const groups = new Map();
  for (const p of raw) {
    const base = sketchBaseName(p.name);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(p);
  }

  await fs.mkdir(sketchImageDir, { recursive: true });
  const cards = [];

  for (const [base, ps] of groups) {
    const withImg = ps.filter((p) => (promoImageUrl(p) || '').includes('productImages'));
    const pick = (withImg[0] || ps[0]);
    const imgSrc = promoImageUrl(pick);
    const floors = ps.map((p) => p.lowest_price).filter((v) => typeof v === 'number' && v > 0);
    const floor = floors.length ? Math.min(...floors) : null;
    const setOfOrigin = promoSetOrigin(ps[0].name);

    const id = `sketch-${slugifyForUrl(base)}`;
    const dest = path.join(sketchImageDir, `${id}.webp`);

    let haveImage = false;
    try { await fs.access(dest); haveImage = true; } catch {}
    if (!haveImage && imgSrc) {
      try {
        const res = await fetch(imgSrc, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const webp = await sharp(buf)
            .resize({ width: 600, withoutEnlargement: true, fit: 'inside' })
            .webp({ quality: 82 })
            .toBuffer();
          await fs.writeFile(dest, webp);
          haveImage = true;
        }
      } catch (err) {
        console.warn(`  sketch image failed for ${base}: ${err.message}`);
      }
      await sleep(120);
    }

    cards.push({
      id,
      name: base,
      setOfOrigin,
      floor,
      serials: ps.length,
      url: `https://www.dyli.io/drop/${pick.id}-${slugifyForUrl(pick.name)}`,
      image: haveImage ? `/sketches/${id}.webp` : (imgSrc || ''),
    });
  }

  cards.sort((a, b) => a.name.localeCompare(b.name));
  const src =
    '// Generated by scripts/sync-dyli-prices.mjs — the hand-drawn sketch\n' +
    '// cards, one entry per unique card, with their real sketch art and\n' +
    '// cheapest live DYLI floor.\n' +
    'export default ' + JSON.stringify(cards, null, 1) + ';\n';
  await fs.writeFile(sketchDataFile, src);
  console.log(`Wrote ${cards.length} sketch cards -> ${sketchDataFile}`);
}

function promoImageUrl(product) {
  const v = product.overwriteImages || product.images;
  if (Array.isArray(v) && v.length) return v[0];
  if (typeof v === 'string' && v) return v;
  return null;
}

function isPromoProduct(p) {
  if (p.category !== 'TCG' || p.subcategory !== 'Ungraded Card') return false;
  const n = p.name || '';
  if (/sketch baron/i.test(n)) return false; // 1/1 tournament trophies
  // Only true named-"Promo" cards. Season 1 holos/sketches are variant
  // printings, not promos — they belong in the sketch gallery / variants.
  return /\bpromo\b/i.test(n);
}

function cleanPromoName(name) {
  // Drop a leading "Vibes - " and the trailing " - <Set>" suffix.
  let n = name.replace(/^vibes\s*-\s*/i, '').trim();
  n = n.replace(/\s*-\s*(Legend of the Lils|Enter [Tt]he Huddle|Birb & Pengu|Season 1)\s*\$?$/i, '').trim();
  return n;
}

function promoSetOrigin(name) {
  const m = name.match(/-\s*(Legend of the Lils|Enter [Tt]he Huddle|Birb & Pengu|Season 1)\s*\$?$/i);
  return m ? SET_OF_ORIGIN[m[1].toLowerCase()] || null : null;
}

async function syncPromos(products, priceOut, previous) {
  const promos = products.filter(isPromoProduct);
  console.log(`Promos found: ${promos.length}`);
  await fs.mkdir(promoImageDir, { recursive: true });

  const cards = [];
  const seen = new Set();
  const nowIso = new Date().toISOString();

  for (const p of promos) {
    const id = `promo-${p.id}`;
    if (seen.has(id)) continue; // DYLI lists some products twice
    seen.add(id);
    const src = promoImageUrl(p);
    const dest = path.join(promoImageDir, `${id}.webp`);

    // Mirror the image once (resize to thumbnail webp like everything else).
    let haveImage = false;
    try {
      await fs.access(dest);
      haveImage = true;
    } catch { /* not mirrored */ }
    if (!haveImage && src) {
      try {
        const res = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const webp = await sharp(buf)
            .resize({ width: 600, withoutEnlargement: true, fit: 'inside' })
            .webp({ quality: 82 })
            .toBuffer();
          await fs.writeFile(dest, webp);
          haveImage = true;
        }
      } catch (err) {
        console.warn(`  promo image failed for ${p.name}: ${err.message}`);
      }
      await sleep(120);
    }

    const floor = typeof p.lowest_price === 'number' && p.lowest_price > 0 ? p.lowest_price : null;
    const primary = typeof p.price === 'number' && p.price > 0 ? p.price : null;

    // Price movement carry-forward.
    const prevEntry = previous?.prices?.[id]?.normal;
    const entry = {
      floor,
      primary,
      dyliId: p.id,
      url: `https://www.dyli.io/drop/${p.id}-${slugifyForUrl(p.name)}`,
    };
    if (prevEntry) {
      const pe = prevEntry.floor ?? prevEntry.primary ?? null;
      const ne = floor ?? primary ?? null;
      if (pe !== null && ne !== null && pe !== ne) {
        entry.prevFloor = pe;
        entry.prevAt = previous?._meta?.generatedAt ?? nowIso;
      } else if (prevEntry.prevFloor !== undefined) {
        entry.prevFloor = prevEntry.prevFloor;
        entry.prevAt = prevEntry.prevAt;
      }
    }
    priceOut[id] = { normal: entry };

    cards.push({
      id,
      name: cleanPromoName(p.name),
      set: 'Promo',
      setOfOrigin: promoSetOrigin(p.name),
      rarity: 'Promo',
      color: null,
      type: null,
      cost: null,
      vibe: null,
      imageUrl: haveImage ? `/promos/${id}.webp` : (src || ''),
      dyliId: p.id,
      released: true,
    });
  }

  cards.sort((a, b) => a.name.localeCompare(b.name));
  const src =
    '// Generated by scripts/sync-dyli-prices.mjs — promo cards pulled from\n' +
    '// the DYLI catalog (name contains "Promo" or ends with "Season 1").\n' +
    '// Standalone cards in the "Promo" set; prices live in dyliPrices.json.\n' +
    'export default ' + JSON.stringify(cards, null, 1) + ';\n';
  await fs.writeFile(promoDataFile, src);
  console.log(`Wrote ${cards.length} promo cards -> ${promoDataFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
