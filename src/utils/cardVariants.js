import cardData from '../cardData.json';

export const ALL_VARIANTS = ['normal', 'foil', 'arctic', 'sketch'];

export const VARIANT_LABELS = {
  normal: 'Normal',
  foil: 'Foil',
  arctic: 'Arctic',
  sketch: 'Sketch'
};

export const VARIANT_SHORT_LABELS = {
  normal: 'N',
  foil: 'F',
  arctic: 'A',
  sketch: 'S'
};

const cardsById = new Map(cardData.map((card) => [card.id, card]));

export function getCardById(cardId) {
  return cardsById.get(cardId) || null;
}

export function getAvailableVariants(cardOrId) {
  const card = typeof cardOrId === 'string' ? getCardById(cardOrId) : cardOrId;

  if (!card) {
    return ALL_VARIANTS;
  }

  if (card.set === 'Eth') {
    return ['normal', 'foil', 'sketch'];
  }

  return ALL_VARIANTS;
}

export function isVariantAvailable(cardOrId, variant) {
  return getAvailableVariants(cardOrId).includes(variant);
}

export function getEmptyVariantCounts() {
  return {
    normal: 0,
    foil: 0,
    arctic: 0,
    sketch: 0
  };
}

export function sanitizeVariantCounts(cardOrId, counts = {}) {
  return {
    ...getEmptyVariantCounts(),
    ...counts,
    ...(isVariantAvailable(cardOrId, 'arctic') ? {} : { arctic: 0 })
  };
}

export function sanitizeCardPrices(cardOrId, priceEntry = {}) {
  if (!priceEntry) return null;

  const sanitized = {
    name: priceEntry.name,
    set: priceEntry.set
  };

  ALL_VARIANTS.forEach((variant) => {
    if (!isVariantAvailable(cardOrId, variant)) {
      return;
    }

    if (priceEntry[variant]?.price != null) {
      sanitized[variant] = priceEntry[variant];
    }
  });

  return sanitized;
}
