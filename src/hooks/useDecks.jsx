import { useState, useEffect, useCallback } from 'react';
import { track } from '@vercel/analytics';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, limit, where, updateDoc, arrayUnion, arrayRemove, getDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import cardData from '../cardData.json';

export function useDecks() {
  const { user } = useAuth();
  const [publicDecks, setPublicDecks] = useState([]);
  const [myDecks, setMyDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load public decks
  useEffect(() => {
    const q = query(
      collection(db, 'decks'),
      where('isPublic', '==', true),
      orderBy('upvotes', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const decks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPublicDecks(decks);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load user's decks
  useEffect(() => {
    if (!user) {
      setMyDecks([]);
      return;
    }
    const q = query(
      collection(db, 'decks'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const decks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMyDecks(decks);
    });
    return () => unsubscribe();
  }, [user]);

  const saveDeck = useCallback(async (deckData, deckId = null) => {
    if (!user) return null;
    
    const id = deckId || doc(collection(db, 'decks')).id;
    const colors = [...new Set(deckData.cards.flatMap(c => {
      const card = cardData.find(cd => cd.id === c.cardId);
      return card?.color?.split(', ') || [];
    }))];

    const deck = {
      ...deckData,
      colors,
      userId: user.uid,
      username: user.displayName || 'Anonymous',
      updatedAt: new Date().toISOString(),
      ...(deckId ? {} : { 
        createdAt: new Date().toISOString(),
        upvotes: 0,
        upvotedBy: [],
        isPublic: deckData.isPublic ?? true
      })
    };

    await setDoc(doc(db, 'decks', id), deck, { merge: true });
    return id;
  }, [user]);

  const deleteDeck = useCallback(async (deckId) => {
    if (!user) return;
    await deleteDoc(doc(db, 'decks', deckId));
  }, [user]);

  const toggleUpvote = useCallback(async (deckId) => {
    if (!user) return;
    const deckRef = doc(db, 'decks', deckId);
    const deckSnap = await getDoc(deckRef);
    if (!deckSnap.exists()) return;

    const upvotedBy = deckSnap.data().upvotedBy || [];
    const hasUpvoted = upvotedBy.includes(user.uid);

    await updateDoc(deckRef, {
      upvotedBy: hasUpvoted ? arrayRemove(user.uid) : arrayUnion(user.uid),
      upvotes: hasUpvoted ? (deckSnap.data().upvotes || 1) - 1 : (deckSnap.data().upvotes || 0) + 1
    });
    // Only count upvote-additions; removing an upvote isn't engagement.
    if (!hasUpvoted) {
      track('deck_upvoted', { is_own_deck: deckSnap.data().userId === user.uid });
    }
  }, [user]);

  const getDeck = useCallback(async (deckId) => {
    const deckSnap = await getDoc(doc(db, 'decks', deckId));
    if (deckSnap.exists()) {
      return { id: deckSnap.id, ...deckSnap.data() };
    }
    return null;
  }, []);

  // Best-effort view counter. Soft-fails if Firestore rules don't allow
  // non-owner writes — the page must never break over analytics.
  const recordView = useCallback(async (deckId) => {
    try {
      await updateDoc(doc(db, 'decks', deckId), { views: increment(1) });
    } catch {
      /* ignore */
    }
  }, []);

  return {
    publicDecks,
    myDecks,
    loading,
    saveDeck,
    deleteDeck,
    toggleUpvote,
    getDeck,
    recordView
  };
}

export function validateDeck(cards) {
  const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);
  const errors = [];
  
  if (totalCards !== 52) {
    errors.push(`Deck must have exactly 52 cards (currently ${totalCards})`);
  }
  
  cards.forEach(c => {
    if (c.quantity > 4) {
      const card = cardData.find(cd => cd.id === c.cardId);
      errors.push(`${card?.name || c.cardId} exceeds 4 copies (${c.quantity})`);
    }
  });

  return { valid: errors.length === 0, errors, totalCards };
}
