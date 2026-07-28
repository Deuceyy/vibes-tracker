import set3FoilKinds from '../data/set3FoilKinds.js';

export const ENABLE_SET3 = true;

// birbFoil / fishFoil are Set 3's special foils — each S3 card comes in
// exactly one of the two (see set3FoilKinds.js, generated from DYLI).
export const VARIANTS = ['normal', 'foil', 'arctic', 'sketch', 'birbFoil', 'fishFoil'];
export const TRACKER_CARD_TYPES = [
  'Character',
  'Action',
  'Saucy Action',
  'Rod',
  'Relic',
  'Location Relic',
  'Fit'
];
export const CHARACTER_SUBTYPES = ['Penguin', 'Lil', 'Birb'];

const SKETCHLESS_IDS = new Set(['NyanCat']);

export function getVariantTemplate() {
  return { normal: 0, foil: 0, arctic: 0, sketch: 0, birbFoil: 0, fishFoil: 0 };
}

export function normalizeSubtypeToken(token) {
  const normalized = String(token || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('lil')) return 'Lil';
  if (normalized.includes('birb')) return 'Birb';
  if (normalized.includes('penguin')) return 'Penguin';
  return null;
}

export function getCharacterSubtypes(card) {
  if (!card) return [];

  if (Array.isArray(card.subtypes) && card.subtypes.length > 0) {
    return [...new Set(card.subtypes.map(normalizeSubtypeToken).filter(Boolean))];
  }

  const subtypes = new Set();
  const rawType = String(card.rawType || card.type || '');

  rawType
    .split('-')
    .slice(1)
    .flatMap((part) => part.split(/[,\s/]+/))
    .map(normalizeSubtypeToken)
    .filter(Boolean)
    .forEach((subtype) => subtypes.add(subtype));

  if (/^penguin(?:\(ish\))?$/i.test(rawType)) {
    if (card.id !== 'NyanCat') {
      subtypes.add('Penguin');
    }
  }

  if (/^lil\b/i.test(card.name || '')) {
    subtypes.add('Lil');
    if (card.id !== 'NyanCat') {
      subtypes.add('Penguin');
    }
  }

  if (/\bbirb\b/i.test(rawType) || /\bbirb\b/i.test(card.name || '')) {
    subtypes.add('Birb');
  }

  return CHARACTER_SUBTYPES.filter((subtype) => subtypes.has(subtype));
}

export function getCanonicalCardType(card) {
  if (!card) return 'Character';

  // Promo cards carry no game stats; keep them out of the real type
  // filters by giving them their own bucket.
  if (card.set === 'Promo') return 'Promo';

  const rawType = String(card.rawType || card.type || '').trim();

  if (/^fit$/i.test(rawType)) return 'Fit';
  if (/^rod$/i.test(rawType)) return 'Rod';
  if (/^relic\s*-\s*location$/i.test(rawType)) return 'Location Relic';
  if (/^relic$/i.test(rawType)) {
    const relicText = (card.cardText || card.effect || '').replace(/[|\s]+/g, ' ');
    if (/whenever another Location enters play/i.test(relicText)) {
      return 'Location Relic';
    }
    return 'Relic';
  }
  if (/^saucy action$/i.test(rawType) || /^action\s*-\s*saucy$/i.test(rawType)) return 'Saucy Action';
  if (/^action$/i.test(rawType) || rawType === '???') {
    const normalizedText = (card.cardText || card.effect || '').replace(/[|\s]+/g, ' ');
    if (/play this Action if it's face-down as a Rod/i.test(normalizedText)) {
      return 'Saucy Action';
    }
    return 'Action';
  }
  if (/^character\b/i.test(rawType) || /^penguin(?:\(ish\))?$/i.test(rawType)) {
    return 'Character';
  }

  return 'Character';
}

export function supportsVariant(card, variant) {
  if (!card) return true;
  // Promos are single-printing products — only the base copy is tracked.
  if (card.set === 'Promo') return variant === 'normal';
  if (variant === 'normal' || variant === 'foil') return true;
  if (variant === 'arctic') {
    return card.set === 'Lotl';
  }
  if (variant === 'sketch') {
    if (card.set !== 'Eth' && card.set !== 'Lotl') return false;
    return !SKETCHLESS_IDS.has(card.id);
  }
  if (variant === 'birbFoil' || variant === 'fishFoil') {
    return card.set === 'S3' && set3FoilKinds[card.id] === variant;
  }
  return false;
}

export function getSupportedVariants(card) {
  return VARIANTS.filter((variant) => supportsVariant(card, variant));
}

export function getSetLabel(setCode) {
  switch (setCode) {
    case 'Eth':
      return 'Enter the Huddle';
    case 'Lotl':
      return 'Legend of the Lils';
    case 'S3':
      return 'Birb and Pengu';
    case 'Promo':
      return 'Promos';
    default:
      return setCode || 'Unknown Set';
  }
}

export function isReleasedTrackerCard(card) {
  if (!card) return false;
  if (card.set === 'S3') return ENABLE_SET3;
  return card.released !== false;
}

function parseCollectorNumber(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function slugToIdFragment(value) {
  return String(value || '')
    .replace(/['’]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function buildSet3TrackerCard(spoilerCard) {
  const setNumber = parseCollectorNumber(spoilerCard.collectorNumber);
  const canonicalType = getCanonicalCardType({ ...spoilerCard, rawType: spoilerCard.type, set: 'S3' });
  const subtypes = getCharacterSubtypes({ ...spoilerCard, rawType: spoilerCard.type, set: 'S3', id: `S3${setNumber || ''}` });
  const costColor = canonicalType === 'Character' || canonicalType === 'Location Relic' || canonicalType === 'Relic'
    ? 'Fish'
    : spoilerCard.color || 'Colorless';

  return {
    id: `S3${String(setNumber || 0).padStart(3, '0')}${slugToIdFragment(spoilerCard.name)}`,
    name: spoilerCard.name,
    color: spoilerCard.color,
    type: canonicalType,
    rawType: spoilerCard.type,
    subtypes,
    cardText: spoilerCard.effect || '',
    border: spoilerCard.color,
    rarity: spoilerCard.rarity === 'Mythic' ? 'Epic' : (spoilerCard.rarity || 'Unknown'),
    vibe: spoilerCard.vibe ?? null,
    cost: spoilerCard.cost == null ? null : { amount: spoilerCard.cost, color: costColor },
    pudge: null,
    turnedOn: false,
    released: false,
    source: 'spoiler',
    set: 'S3',
    setNumber,
    imageUrl: spoilerCard.image,
    illustrator: spoilerCard.illustrator || '',
    featuringPudgy: spoilerCard.featuringPudgy || ''
  };
}
