import { useState, useEffect, createContext, useContext } from 'react';
import { collection as firestoreCollection, doc, getDoc, getDocs } from 'firebase/firestore';
import defaultPricesData from '../defaultPrices.json';
import { db } from '../firebase';
import { ALL_VARIANTS, sanitizeCardPrices } from '../utils/cardVariants';

const PricesContext = createContext(null);

const DEFAULT_PRICES = Object.fromEntries(
  Object.entries(defaultPricesData.cards || {}).map(([cardId, priceEntry]) => [
    cardId,
    sanitizeCardPrices(cardId, priceEntry)
  ])
);

const DEFAULT_LAST_UPDATED = defaultPricesData._metadata?.lastUpdated
  ? new Date(defaultPricesData._metadata.lastUpdated)
  : null;

const MIN_MARKET_COMPS = 5;
const MAX_MARKET_COMPS = 20;

function getMedian(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
  }

  return Number(sorted[middle].toFixed(2));
}

function buildMarketPriceMap(listings = []) {
  const grouped = new Map();

  listings.forEach((listing) => {
    if (listing.status !== 'sold') return;
    const finalSalePrice = Number(listing.finalSalePrice);
    if (!listing.cardId || !listing.variant || Number.isNaN(finalSalePrice) || finalSalePrice <= 0) {
      return;
    }

    const key = `${listing.cardId}:${listing.variant}`;
    const current = grouped.get(key) || [];
    current.push({
      price: finalSalePrice,
      soldAt: listing.soldAt || listing.salePriceConfirmedAt || listing.updatedAt || listing.createdAt || ''
    });
    grouped.set(key, current);
  });

  const marketPrices = {};

  grouped.forEach((sales, key) => {
    const [cardId, variant] = key.split(':');
    const recentSales = sales
      .filter((sale) => sale.soldAt)
      .sort((left, right) => String(right.soldAt).localeCompare(String(left.soldAt)))
      .slice(0, MAX_MARKET_COMPS);

    if (recentSales.length < MIN_MARKET_COMPS) {
      return;
    }

    const marketPrice = getMedian(recentSales.map((sale) => sale.price));
    if (marketPrice == null) {
      return;
    }

    if (!marketPrices[cardId]) {
      marketPrices[cardId] = {};
    }

    marketPrices[cardId][variant] = {
      price: marketPrice,
      updated: recentSales[0].soldAt,
      source: 'market',
      compCount: recentSales.length
    };
  });

  return marketPrices;
}

function mergePrices(defaultPrices, livePrices, marketPrices = {}) {
  const merged = {};
  const allCardIds = new Set([
    ...Object.keys(defaultPrices || {}),
    ...Object.keys(livePrices || {}),
    ...Object.keys(marketPrices || {})
  ]);

  allCardIds.forEach((cardId) => {
    const defaultEntry = sanitizeCardPrices(cardId, defaultPrices?.[cardId] || {});
    const liveEntry = sanitizeCardPrices(cardId, livePrices?.[cardId] || {});
    const marketEntry = sanitizeCardPrices(cardId, marketPrices?.[cardId] || {});
    const mergedEntry = {
      name: marketEntry?.name || liveEntry?.name || defaultEntry?.name,
      set: marketEntry?.set || liveEntry?.set || defaultEntry?.set
    };

    ALL_VARIANTS.forEach((variant) => {
      if (marketEntry?.[variant]?.price != null) {
        mergedEntry[variant] = marketEntry[variant];
      } else if (defaultEntry?.[variant]?.price != null) {
        mergedEntry[variant] = defaultEntry[variant];
      } else if (liveEntry?.[variant]?.price != null) {
        mergedEntry[variant] = liveEntry[variant];
      }
    });

    merged[cardId] = mergedEntry;
  });

  return merged;
}

export function PricesProvider({ children }) {
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(DEFAULT_LAST_UPDATED);

  useEffect(() => {
    loadPrices();
  }, []);

  const loadPrices = async () => {
    try {
      const [priceSnapshot, listingSnapshot, metaSnap] = await Promise.all([
        getDocs(firestoreCollection(db, 'prices')),
        getDocs(firestoreCollection(db, 'listings')),
        getDoc(doc(db, 'prices', '_metadata'))
      ]);
      const livePrices = {};
      const soldListings = listingSnapshot.docs.map((listingDoc) => listingDoc.data());

      priceSnapshot.forEach((priceDoc) => {
        if (priceDoc.id !== '_metadata') {
          livePrices[priceDoc.id] = sanitizeCardPrices(priceDoc.id, priceDoc.data());
        }
      });

      const marketPrices = buildMarketPriceMap(soldListings);
      setPrices(mergePrices(DEFAULT_PRICES, livePrices, marketPrices));

      if (metaSnap.exists()) {
        const data = metaSnap.data();
        if (data.lastUpdated) {
          const liveUpdatedAt = data.lastUpdated.toDate();
          setLastUpdated(
            DEFAULT_LAST_UPDATED && DEFAULT_LAST_UPDATED > liveUpdatedAt
              ? DEFAULT_LAST_UPDATED
              : liveUpdatedAt
          );
        }
      }
    } catch (err) {
      console.error('Error loading prices:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPrice = (cardId, variant = 'normal') => {
    const cardPrices = prices[cardId];
    if (!cardPrices || !cardPrices[variant]) return null;
    return cardPrices[variant].price;
  };

  const getCardPrices = (cardId) => {
    return prices[cardId] || null;
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '--';
    return `$${price.toFixed(2)}`;
  };

  const calculateCollectionValue = (userCollection) => {
    let total = 0;
    const breakdown = { normal: 0, foil: 0, arctic: 0, sketch: 0 };
    let cardCount = 0;
    let pricedCount = 0;

    Object.entries(userCollection).forEach(([cardId, variants]) => {
      const cardPrices = prices[cardId];

      Object.entries(variants).forEach(([variant, count]) => {
        if (count > 0) {
          cardCount += count;
          if (cardPrices && cardPrices[variant]?.price != null) {
            const value = cardPrices[variant].price * count;
            total += value;
            breakdown[variant] = (breakdown[variant] || 0) + value;
            pricedCount += count;
          }
        }
      });
    });

    return {
      total,
      breakdown,
      cardCount,
      pricedCount,
      missingPrices: cardCount - pricedCount
    };
  };

  const calculateDeckCost = (deck, variant = 'normal') => {
    let total = 0;
    const missing = [];

    const cards = deck.cards || deck.mainDeck || [];

    cards.forEach((card) => {
      const cardId = card.id || card.cardId;
      const quantity = card.quantity || card.count || 1;
      const price = getPrice(cardId, variant);

      if (price !== null) {
        total += price * quantity;
      } else {
        missing.push(cardId);
      }
    });

    return { total, missing };
  };

  const value = {
    prices,
    loading,
    lastUpdated,
    getPrice,
    getCardPrices,
    formatPrice,
    calculateCollectionValue,
    calculateDeckCost,
    refreshPrices: loadPrices
  };

  return (
    <PricesContext.Provider value={value}>
      {children}
    </PricesContext.Provider>
  );
}

export function usePrices() {
  const context = useContext(PricesContext);
  if (!context) {
    throw new Error('usePrices must be used within a PricesProvider');
  }
  return context;
}

export default usePrices;
