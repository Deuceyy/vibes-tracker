import { useState, useEffect, createContext, useContext } from 'react';
import { db } from '../firebase';
import { collection as firestoreCollection, doc, getDoc, getDocs } from 'firebase/firestore';

const PricesContext = createContext(null);

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

  // Get price for a specific card and variant
  const getPrice = (cardId, variant = 'normal') => {
    const cardPrices = prices[cardId];
    if (!cardPrices || !cardPrices[variant]) return null;
    return cardPrices[variant].price;
  };

  // Get all prices for a card
  const getCardPrices = (cardId) => {
    return prices[cardId] || null;
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
      const cardPrices = prices[cardId];
      
      Object.entries(variants).forEach(([variant, count]) => {
        if (count > 0) {
          cardCount += count;
          if (cardPrices && cardPrices[variant]?.price) {
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
