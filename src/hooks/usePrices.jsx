import { useState, useEffect, createContext, useContext } from 'react';
import { db } from '../firebase';
import { collection as firestoreCollection, doc, getDoc, getDocs } from 'firebase/firestore';
import { allTrackerCards } from '../hooks/useCollection';
import { getSupportedVariants } from '../lib/cardMetadata.js';
import dyliData from '../data/dyliPrices.json';

const PricesContext = createContext(null);

// DYLI marketplace prices, bundled at build time and refreshed by the
// scheduled sync workflow. floor = live marketplace low; primary = DYLI
// drop price (fallback when nothing is listed).
const DYLI_PRICES = dyliData.prices || {};
const DYLI_UPDATED = dyliData._meta?.generatedAt ? new Date(dyliData._meta.generatedAt) : null;

function dyliPrice(cardId, variant) {
  const entry = DYLI_PRICES[cardId]?.[variant];
  if (!entry) return null;
  return entry.floor ?? entry.primary ?? null;
}

export function PricesProvider({ children }) {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadPrices();
  }, []);

  const loadPrices = async () => {
    try {
      const pricesRef = firestoreCollection(db, 'prices');
      const snapshot = await getDocs(pricesRef);
      const priceData = {};
      
      snapshot.forEach(doc => {
        if (doc.id !== '_metadata') {
          priceData[doc.id] = doc.data();
        }
      });
      
      setPrices(priceData);
      
      // Get metadata for last updated
      const metaRef = doc(db, 'prices', '_metadata');
      const metaSnap = await getDoc(metaRef);
      if (metaSnap.exists()) {
        const data = metaSnap.data();
        if (data.lastUpdated) {
          setLastUpdated(data.lastUpdated.toDate());
        }
      }
    } catch (err) {
      console.error('Error loading prices:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get price for a specific card and variant.
  // DYLI (live marketplace) wins; SCG (Firestore) is the fallback.
  const getPrice = (cardId, variant = 'normal') => {
    const dyli = dyliPrice(cardId, variant);
    if (dyli !== null) return dyli;
    const cardPrices = prices[cardId];
    if (!cardPrices || !cardPrices[variant]) return null;
    return cardPrices[variant].price;
  };

  // Get all SCG prices for a card (legacy shape from Firestore)
  const getCardPrices = (cardId) => {
    return prices[cardId] || null;
  };

  // Get the DYLI entry for a card+variant: {floor, primary, dyliId, url}
  const getDyliEntry = (cardId, variant = 'normal') => {
    return DYLI_PRICES[cardId]?.[variant] || null;
  };

  // All DYLI variants recorded for a card (includes S3 birbFoil/fishFoil)
  const getDyliVariants = (cardId) => {
    return DYLI_PRICES[cardId] || null;
  };

  // Format price for display
  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return `$${price.toFixed(2)}`;
  };

  // Calculate total value of a collection
  // collection format: { cardId: { normal: count, foil: count, arctic: count, sketch: count } }
  const calculateCollectionValue = (userCollection) => {
    let total = 0;
    let breakdown = { normal: 0, foil: 0, arctic: 0, sketch: 0 };
    let cardCount = 0;
    let pricedCount = 0;
    
    Object.entries(userCollection).forEach(([cardId, variants]) => {
      const card = allTrackerCards.find((entry) => entry.id === cardId);

      getSupportedVariants(card).forEach((variant) => {
        const count = variants[variant] || 0;
        if (count > 0) {
          cardCount += count;
          const price = getPrice(cardId, variant);
          if (price !== null) {
            const value = price * count;
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

  // Calculate deck cost
  // deck format: { cards: [{ id: cardId, quantity: number }] } or similar
  const calculateDeckCost = (deck, variant = 'normal') => {
    let total = 0;
    let missing = [];
    
    const cards = deck.cards || deck.mainDeck || [];
    
    cards.forEach(card => {
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
    dyliUpdated: DYLI_UPDATED,
    getPrice,
    getCardPrices,
    getDyliEntry,
    getDyliVariants,
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
