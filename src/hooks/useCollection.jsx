import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import cardData from '../cardData.json';

const VARIANTS = ['normal', 'foil', 'arctic', 'sketch'];
const LOCAL_STORAGE_KEY = 'vibes_collection_local';

export function useCollection(userId = null) {
  const { user } = useAuth();
  const [collection, setCollection] = useState({});
  const [loading, setLoading] = useState(true);

  const targetUserId = userId || user?.uid;
  const isOwnCollection = !userId || userId === user?.uid;

  useEffect(() => {
    if (targetUserId) {
      const collectionRef = doc(db, 'collections', targetUserId);
      const unsubscribe = onSnapshot(collectionRef, (docSnap) => {
        if (docSnap.exists()) {
          setCollection(docSnap.data().cards || {});
        } else {
          setCollection({});
        }
        setLoading(false);
      }, (error) => {
        console.error('Error loading collection:', error);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          setCollection(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Failed to load local collection:', e);
      }
      setLoading(false);
    }
  }, [targetUserId]);

  const saveCollection = useCallback(async (newCollection) => {
    setCollection(newCollection);
    if (user && isOwnCollection) {
      const collectionRef = doc(db, 'collections', user.uid);
      await setDoc(collectionRef, { 
        cards: newCollection,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } else if (!user) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newCollection));
    }
  }, [user, isOwnCollection]);

  const getCardVariants = useCallback((cardId) => {
    return collection[cardId] || { normal: 0, foil: 0, arctic: 0, sketch: 0 };
  }, [collection]);

  const setVariantCount = useCallback((cardId, variant, count) => {
    const update = (prevCollection) => {
      const newCollection = { ...prevCollection };
      if (!newCollection[cardId]) {
        newCollection[cardId] = { normal: 0, foil: 0, arctic: 0, sketch: 0 };
      }
      newCollection[cardId] = { ...newCollection[cardId] };
      newCollection[cardId][variant] = Math.max(0, Math.min(count, 99));
      const variants = newCollection[cardId];
      if (variants.normal === 0 && variants.foil === 0 && variants.arctic === 0 && variants.sketch === 0) {
        delete newCollection[cardId];
      }
      return newCollection;
    };
    
    setCollection(prev => {
      const newCollection = update(prev);
      // Save to Firebase/localStorage
      if (user && isOwnCollection) {
        const collectionRef = doc(db, 'collections', user.uid);
        setDoc(collectionRef, { 
          cards: newCollection,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else if (!user) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newCollection));
      }
      return newCollection;
    });
  }, [user, isOwnCollection]);

  const adjustVariant = useCallback((cardId, variant, delta) => {
    setCollection(prev => {
      const current = prev[cardId]?.[variant] || 0;
      const newCount = Math.max(0, Math.min(current + delta, 99));
      
      const newCollection = { ...prev };
      if (!newCollection[cardId]) {
        newCollection[cardId] = { normal: 0, foil: 0, arctic: 0, sketch: 0 };
      }
      newCollection[cardId] = { ...newCollection[cardId] };
      newCollection[cardId][variant] = newCount;
      
      const variants = newCollection[cardId];
      if (variants.normal === 0 && variants.foil === 0 && variants.arctic === 0 && variants.sketch === 0) {
        delete newCollection[cardId];
      }
      
      // Save to Firebase/localStorage
      if (user && isOwnCollection) {
        const collectionRef = doc(db, 'collections', user.uid);
        setDoc(collectionRef, { 
          cards: newCollection,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else if (!user) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newCollection));
      }
      
      return newCollection;
    });
  }, [user, isOwnCollection]);

  const getTotalOwned = useCallback((cardId) => {
    const v = getCardVariants(cardId);
    return v.normal + v.foil + v.arctic + v.sketch;
  }, [getCardVariants]);

  const hasPlayset = useCallback((cardId) => {
    const v = getCardVariants(cardId);
    return (v.normal + v.foil + v.arctic + v.sketch) >= 4;
  }, [getCardVariants]);

  const hasMasterSet = useCallback((cardId) => {
    const v = getCardVariants(cardId);
    return v.normal >= 1 && v.foil >= 1 && v.arctic >= 1 && v.sketch >= 1;
  }, [getCardVariants]);

  const stats = {
    uniqueCards: cardData.filter(c => getTotalOwned(c.id) > 0).length,
    totalCards: cardData.reduce((sum, c) => sum + getTotalOwned(c.id), 0),
    playsetComplete: cardData.filter(c => hasPlayset(c.id)).length,
    masterComplete: cardData.filter(c => hasMasterSet(c.id)).length,
    totalInSet: cardData.length
  };

  const importCollection = useCallback((data) => {
    let newCollection = {};
    if (data.collection) {
      newCollection = data.collection;
    } else if (data.cards) {
      newCollection = data.cards;
    } else {
      newCollection = data;
    }
    saveCollection(newCollection);
  }, [saveCollection]);

  const exportCollection = useCallback(() => {
    return {
      version: 2,
      exportDate: new Date().toISOString(),
      collection: collection
    };
  }, [collection]);

  const resetCollection = useCallback(() => {
    saveCollection({});
  }, [saveCollection]);

  return {
    collection,
    loading,
    isOwnCollection,
    getCardVariants,
    setVariantCount,
    adjustVariant,
    getTotalOwned,
    hasPlayset,
    hasMasterSet,
    stats,
    importCollection,
    exportCollection,
    resetCollection
  };
}

export { cardData, VARIANTS };
