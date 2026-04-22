import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { cardData } from './useCollection';

export const LISTING_STATUSES = ['active', 'pending', 'sold', 'inactive'];
export const LISTING_CONDITIONS = ['Mint', 'Near Mint', 'Light Play', 'Moderate Play', 'Heavy Play', 'Damaged'];
export const LISTING_VARIANTS = ['normal', 'foil', 'arctic', 'sketch'];
export const LISTING_LANGUAGES = ['English', 'Japanese', 'Other'];
export const VERIFICATION_REQUEST_STATUSES = ['pending', 'approved', 'rejected'];
export const SELLER_ACCESS_STATUSES = ['none', 'pending', 'approved', 'rejected'];

const cardMap = new Map(cardData.map((card) => [card.id, card]));

function nowIso() {
  return new Date().toISOString();
}

function sortByDateDesc(left, right, field = 'updatedAt') {
  return (right[field] || '').localeCompare(left[field] || '');
}

function normalizeMultilineLinks(value) {
  return (value || '')
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getSellerAccessStatus(profile = {}, verificationRequest = null) {
  const profileStatus = profile?.sellerAccessStatus;
  if (SELLER_ACCESS_STATUSES.includes(profileStatus)) {
    return profileStatus;
  }

  const requestStatus = verificationRequest?.status;
  if (VERIFICATION_REQUEST_STATUSES.includes(requestStatus)) {
    return requestStatus;
  }

  if (profile?.sellerProfile?.verified) {
    return 'approved';
  }

  return 'none';
}

export function canUserSell(profile = {}, verificationRequest = null) {
  return getSellerAccessStatus(profile, verificationRequest) === 'approved';
}

function createSellerSnapshot(uid, profile = {}) {
  const sellerProfile = profile.sellerProfile || {};
  const sellerAccessStatus = getSellerAccessStatus(profile);
  return {
    userId: uid,
    username: profile.username || '',
    displayName: sellerProfile.displayName || profile.displayName || profile.username || 'Seller',
    avatarUrl: sellerProfile.avatarUrl || profile.photoURL || '',
    verified: sellerAccessStatus === 'approved',
    averageRating: Number(profile.sellerStats?.averageRating || 0),
    reviewCount: Number(profile.sellerStats?.reviewCount || 0),
    shippingRegion: sellerProfile.shippingRegion || '',
    location: sellerProfile.location || ''
  };
}

export function buildSellerTrustSignals(profile = {}) {
  const sellerProfile = profile.sellerProfile || {};
  const signals = [
    sellerProfile.displayName,
    profile.username,
    sellerProfile.bio,
    sellerProfile.shippingRegion || sellerProfile.location,
    sellerProfile.contactMethods,
    ...(sellerProfile.externalLinks || []),
    ...(sellerProfile.socialLinks || [])
  ];
  const completed = signals.filter(Boolean).length;
  return {
    completed,
    total: 7,
    percentage: Math.round((completed / 7) * 100),
    verified: getSellerAccessStatus(profile) === 'approved',
    reviewCount: Number(profile.sellerStats?.reviewCount || 0),
    averageRating: Number(profile.sellerStats?.averageRating || 0)
  };
}

function buildListingRecord(listing, user, userProfile) {
  const card = cardMap.get(listing.cardId);
  const timestamp = nowIso();
  const seller = createSellerSnapshot(user.uid, userProfile);

  return {
    cardId: listing.cardId,
    cardName: card?.name || listing.cardId,
    cardImageUrl: card?.imageUrl || '',
    set: card?.set || '',
    setNumber: card?.setNumber ?? null,
    rarity: card?.rarity || '',
    type: card?.type || '',
    searchText: `${card?.name || ''} ${card?.set || ''} ${card?.rarity || ''} ${seller.displayName} ${seller.username}`.toLowerCase(),
    sellerUserId: user.uid,
    sellerUsername: seller.username,
    sellerDisplayName: seller.displayName,
    sellerAvatarUrl: seller.avatarUrl,
    sellerVerified: seller.verified,
    sellerAverageRating: seller.averageRating,
    sellerReviewCount: seller.reviewCount,
    quantity: Number(listing.quantity),
    condition: listing.condition,
    price: Number(listing.price),
    shippingPrice: Number(listing.shippingPrice || 0),
    notes: listing.notes?.trim() || '',
    language: listing.language || 'English',
    variant: listing.variant || 'normal',
    status: listing.status || 'active',
    updatedAt: timestamp,
    ...(listing.createdAt ? {} : { createdAt: timestamp })
  };
}

function buildConversationSnapshot(listing, buyer, buyerProfile, sellerProfile, intentType) {
  const timestamp = nowIso();
  return {
    listingId: listing.id,
    listingSnapshot: {
      cardId: listing.cardId,
      cardName: listing.cardName,
      cardImageUrl: listing.cardImageUrl || '',
      price: listing.price,
      shippingPrice: Number(listing.shippingPrice || 0),
      sellerAverageRating: Number(listing.sellerAverageRating || 0),
      sellerReviewCount: Number(listing.sellerReviewCount || 0),
      quantity: listing.quantity,
      condition: listing.condition,
      variant: listing.variant,
      status: listing.status
    },
    buyerUserId: buyer.uid,
    sellerUserId: listing.sellerUserId,
    participantIds: [buyer.uid, listing.sellerUserId],
    participantProfiles: {
      [buyer.uid]: createSellerSnapshot(buyer.uid, buyerProfile || buyer),
      [listing.sellerUserId]: createSellerSnapshot(listing.sellerUserId, sellerProfile || {})
    },
    intentType,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastMessageAt: timestamp,
    lastMessagePreview: intentType === 'commit' ? 'Buyer opened a commit-to-buy conversation.' : 'Buyer contacted the seller.',
    messageCount: 0,
    unreadBy: [listing.sellerUserId]
  };
}

async function hydrateListingSellerSnapshots(rows = []) {
  const sellerIds = [...new Set(rows.map((row) => row.sellerUserId).filter(Boolean))];
  if (sellerIds.length === 0) return rows;

  const sellerDocs = await Promise.all(
    sellerIds.map(async (sellerUserId) => {
      const sellerSnap = await getDoc(doc(db, 'users', sellerUserId));
      return [sellerUserId, sellerSnap.exists() ? createSellerSnapshot(sellerUserId, sellerSnap.data()) : null];
    })
  );

  const sellerById = new Map(sellerDocs);

  return rows.map((row) => {
    const seller = sellerById.get(row.sellerUserId);
    if (!seller) return row;

    return {
      ...row,
      sellerUsername: row.sellerUsername || seller.username,
      sellerDisplayName: row.sellerDisplayName || seller.displayName,
      sellerAvatarUrl: row.sellerAvatarUrl || seller.avatarUrl,
      sellerVerified: typeof row.sellerVerified === 'boolean' ? row.sellerVerified : seller.verified,
      sellerAverageRating: seller.averageRating,
      sellerReviewCount: seller.reviewCount
    };
  });
}

export function useListings(filters = {}) {
  const { status, sellerUserId, cardId } = filters;
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let listingsQuery = collection(db, 'listings');
    const constraints = [];
    if (status) constraints.push(where('status', '==', status));
    if (sellerUserId) constraints.push(where('sellerUserId', '==', sellerUserId));
    if (cardId) constraints.push(where('cardId', '==', cardId));
    if (constraints.length > 0) {
      listingsQuery = query(collection(db, 'listings'), ...constraints);
    }

      const unsubscribe = onSnapshot(listingsQuery, async (snapshot) => {
        const rows = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        const hydratedRows = await hydrateListingSellerSnapshots(rows);
        const sortedRows = hydratedRows.sort((left, right) => {
          if (left.status === 'active' && right.status === 'active') {
            return (left.price ?? 0) - (right.price ?? 0) || sortByDateDesc(left, right, 'createdAt');
          }
          return sortByDateDesc(left, right);
        });
        setListings(sortedRows);
        setLoading(false);
      }, () => setLoading(false));

    return () => unsubscribe();
  }, [status, sellerUserId, cardId]);

  return { listings, loading };
}

export function useConversations(options = {}) {
  const { scope = 'mine', userId, enabled = true } = options;
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setConversations([]);
      setLoading(false);
      return undefined;
    }

    let conversationsQuery;
    if (scope === 'admin') {
      conversationsQuery = collection(db, 'conversations');
    } else if (userId) {
      conversationsQuery = query(collection(db, 'conversations'), where('participantIds', 'array-contains', userId));
    } else {
      setConversations([]);
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((left, right) => sortByDateDesc(left, right, 'lastMessageAt'));
      setConversations(rows);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsubscribe();
  }, [enabled, scope, userId]);

  return { conversations, loading };
}

export function useConversationMessages(conversationId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return undefined;
    }

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const rows = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((left, right) => (left.createdAt || '').localeCompare(right.createdAt || ''));
      setMessages(rows);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsubscribe();
  }, [conversationId]);

  return { messages, loading };
}

export function useSellerReviews(sellerUserId, enabled = true) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !sellerUserId) {
      setReviews([]);
      setLoading(false);
      return undefined;
    }

    const reviewsQuery = query(collection(db, 'sellerReviews'), where('sellerUserId', '==', sellerUserId));
    const unsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((left, right) => sortByDateDesc(left, right, 'createdAt'));
      setReviews(rows);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsubscribe();
  }, [enabled, sellerUserId]);

  return { reviews, loading };
}

export function useAdminReviews(enabled = true) {
  const { rows, loading } = useAdminCollection('sellerReviews', { enabled, sortField: 'updatedAt' });
  return { reviews: rows, loading };
}

export function useVerificationRequest(userId, enabled = true) {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !userId) {
      setRequest(null);
      setLoading(false);
      return undefined;
    }

    const requestRef = doc(db, 'verificationRequests', userId);
    const unsubscribe = onSnapshot(requestRef, (snapshot) => {
      setRequest(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsubscribe();
  }, [enabled, userId]);

  return { request, loading };
}

export function useAdminVerificationRequests(enabled = true) {
  const { rows, loading } = useAdminCollection('verificationRequests', { enabled, sortField: 'requestedAt' });
  return { requests: rows, loading };
}

export function useAdminAlerts(enabled = true) {
  const { requests, loading } = useAdminVerificationRequests(enabled);
  const pendingVerificationRequests = requests.filter((request) => request.status === 'pending').length;

  return {
    pendingVerificationRequests,
    pendingReports: 0,
    totalPending: pendingVerificationRequests,
    loading
  };
}

function useAdminCollection(collectionName, options = {}) {
  const { enabled = true, sortField = 'updatedAt' } = options;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(collection(db, collectionName), (snapshot) => {
      const nextRows = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((left, right) => {
          const primary = sortByDateDesc(left, right, sortField);
          if (primary !== 0) return primary;
          return sortByDateDesc(left, right, 'createdAt');
        });
      setRows(nextRows);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsubscribe();
  }, [collectionName, enabled, sortField]);

  return { rows, loading };
}

async function syncSellerListingMetadata(sellerUserId, sellerProfileData = {}) {
  if (!sellerUserId) return;

  const snapshot = createSellerSnapshot(sellerUserId, sellerProfileData);
  const listingsQuery = query(collection(db, 'listings'), where('sellerUserId', '==', sellerUserId));
  const listingsSnapshot = await getDocs(listingsQuery);

  await Promise.all(listingsSnapshot.docs.map((entry) => updateDoc(doc(db, 'listings', entry.id), {
    sellerUsername: snapshot.username,
    sellerDisplayName: snapshot.displayName,
    sellerAvatarUrl: snapshot.avatarUrl,
    sellerVerified: snapshot.verified,
    sellerAverageRating: snapshot.averageRating,
    sellerReviewCount: snapshot.reviewCount,
    updatedAt: nowIso()
  })));
}

async function recalculateSellerStats(sellerUserId) {
  const sellerReviewsQuery = query(collection(db, 'sellerReviews'), where('sellerUserId', '==', sellerUserId));
  const snapshot = await getDocs(sellerReviewsQuery);
  const reviews = snapshot.docs.map((entry) => entry.data());
  const totalRating = reviews.reduce((sum, entry) => sum + Number(entry.rating || 0), 0);
  const reviewCount = reviews.length;
  const averageRating = reviewCount > 0 ? Number((totalRating / reviewCount).toFixed(2)) : 0;

  await setDoc(doc(db, 'users', sellerUserId), {
    sellerStats: {
      reviewCount,
      averageRating
    },
    updatedAt: nowIso()
  }, { merge: true });

  const sellerDoc = await getDoc(doc(db, 'users', sellerUserId));
  if (sellerDoc.exists()) {
    await syncSellerListingMetadata(sellerUserId, sellerDoc.data());
  }

  return { reviewCount, averageRating };
}

export function useAdminUsers(enabled = true) {
  const { rows, loading } = useAdminCollection('users', { enabled, sortField: 'createdAt' });
  return { users: rows, loading };
}

export function useAdminDecks(enabled = true) {
  const { rows, loading } = useAdminCollection('decks', { enabled, sortField: 'updatedAt' });
  return { decks: rows, loading };
}

export function useAdminCollections(enabled = true) {
  const { rows, loading } = useAdminCollection('collections', { enabled, sortField: 'updatedAt' });
  return { collections: rows, loading };
}

export function useMarketplace() {
  const { user, userProfile, updateUserProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  const isAdmin = Boolean(userProfile?.isAdmin || userProfile?.role === 'admin');
  const sellerTrust = useMemo(() => buildSellerTrustSignals(userProfile || {}), [userProfile]);
  const sellerAccessStatus = useMemo(() => getSellerAccessStatus(userProfile || {}), [userProfile]);
  const sellerCanList = useMemo(() => canUserSell(userProfile || {}), [userProfile]);

  const saveSellerProfile = useCallback(async (profileInput) => {
    if (!user) return false;
    setBusy(true);
    try {
      const currentSeller = userProfile?.sellerProfile || {};
      const nextSeller = {
        ...currentSeller,
        displayName: profileInput.displayName?.trim() || userProfile?.displayName || '',
        bio: profileInput.bio?.trim() || '',
        location: profileInput.location?.trim() || '',
        shippingRegion: profileInput.shippingRegion?.trim() || '',
        contactMethods: profileInput.contactMethods?.trim() || '',
        externalLinks: normalizeMultilineLinks(profileInput.externalLinks),
        socialLinks: normalizeMultilineLinks(profileInput.socialLinks),
        avatarUrl: profileInput.avatarUrl?.trim() || currentSeller.avatarUrl || userProfile?.photoURL || '',
        verified: getSellerAccessStatus(userProfile || {}) === 'approved'
      };
      await updateUserProfile({ sellerProfile: nextSeller });
      await syncSellerListingMetadata(user.uid, { ...(userProfile || {}), sellerProfile: nextSeller });
      return true;
    } finally {
      setBusy(false);
    }
  }, [updateUserProfile, user, userProfile]);

  const saveListing = useCallback(async (listingInput, listingId = null) => {
    if (!user) return null;
    if (!sellerCanList && !isAdmin) {
      throw new Error('Seller approval is required before you can create or edit listings.');
    }
    const listingRecord = buildListingRecord(listingInput, user, userProfile || {});
    if (!LISTING_STATUSES.includes(listingRecord.status)) {
      throw new Error('Invalid listing status.');
    }
    if (!LISTING_CONDITIONS.includes(listingRecord.condition)) {
      throw new Error('Invalid listing condition.');
    }
    if (Number.isNaN(listingRecord.shippingPrice) || listingRecord.shippingPrice < 0) {
      throw new Error('Invalid shipping price.');
    }
    if (!cardMap.has(listingRecord.cardId)) {
      throw new Error('Card not found.');
    }

    setBusy(true);
    try {
      if (listingId) {
        const listingRef = doc(db, 'listings', listingId);
        const existing = await getDoc(listingRef);
        if (!existing.exists() || existing.data().sellerUserId !== user.uid) {
          throw new Error('You can only edit your own listings.');
        }
        await setDoc(listingRef, listingRecord, { merge: true });
        return listingId;
      }

      const listingRef = await addDoc(collection(db, 'listings'), listingRecord);
      return listingRef.id;
    } finally {
      setBusy(false);
    }
  }, [isAdmin, sellerCanList, user, userProfile]);

  const updateListingStatus = useCallback(async (listingId, status) => {
    if (!user) return;
    if (!sellerCanList && !isAdmin) {
      throw new Error('Seller approval is required before you can manage listings.');
    }
    if (!LISTING_STATUSES.includes(status)) {
      throw new Error('Invalid listing status.');
    }
    const listingRef = doc(db, 'listings', listingId);
    const listingSnap = await getDoc(listingRef);
    if (!listingSnap.exists() || listingSnap.data().sellerUserId !== user.uid) {
      throw new Error('You can only update your own listings.');
    }
    await updateDoc(listingRef, { status, updatedAt: nowIso() });
  }, [isAdmin, sellerCanList, user]);

  const createOrOpenConversation = useCallback(async ({ listing, intentType = 'contact' }) => {
    if (!user || !listing) return null;
    if (listing.sellerUserId === user.uid) {
      throw new Error('You cannot message your own listing.');
    }

    setBusy(true);
    try {
      const existingQuery = query(
        collection(db, 'conversations'),
        where('listingId', '==', listing.id),
        where('buyerUserId', '==', user.uid),
        where('sellerUserId', '==', listing.sellerUserId)
      );
      const existing = await getDocs(existingQuery);
      if (!existing.empty) {
        return existing.docs[0].id;
      }

      const sellerDoc = await getDoc(doc(db, 'users', listing.sellerUserId));
      const conversation = buildConversationSnapshot(
        listing,
        user,
        userProfile || {},
        sellerDoc.exists() ? sellerDoc.data() : {},
        intentType
      );

      const conversationRef = await addDoc(collection(db, 'conversations'), conversation);
      const openingMessage = intentType === 'commit'
        ? `Commit to buy: I'm ready to move forward on ${listing.cardName} for $${Number(listing.price).toFixed(2)} plus $${Number(listing.shippingPrice || 0).toFixed(2)} shipping (estimated total $${(Number(listing.price) + Number(listing.shippingPrice || 0)).toFixed(2)}). Let me know the next step and your preferred protected payment method.`
        : `Hi! I'm interested in your ${listing.cardName} listing for $${Number(listing.price).toFixed(2)}${Number(listing.shippingPrice || 0) > 0 ? ` plus $${Number(listing.shippingPrice).toFixed(2)} shipping` : ' with free shipping'}. Is it still available?`;

      await addDoc(collection(db, 'conversations', conversationRef.id, 'messages'), {
        authorId: user.uid,
        authorDisplayName: userProfile?.sellerProfile?.displayName || userProfile?.displayName || user.displayName || 'Buyer',
        body: openingMessage,
        createdAt: nowIso(),
        system: false
      });

      await updateDoc(conversationRef, {
        messageCount: 1,
        lastMessagePreview: openingMessage,
        lastMessageAt: nowIso(),
        updatedAt: nowIso()
      });

      return conversationRef.id;
    } finally {
      setBusy(false);
    }
  }, [user, userProfile]);

  const sendMessage = useCallback(async (conversationId, body) => {
    if (!user || !conversationId || !body?.trim()) return;

    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);
    if (!conversationSnap.exists()) {
      throw new Error('Conversation not found.');
    }

    const conversation = conversationSnap.data();
    const participantIds = conversation.participantIds || [];
    if (!participantIds.includes(user.uid) && !isAdmin) {
      throw new Error('You do not have access to this conversation.');
    }

    const otherParticipants = participantIds.filter((participantId) => participantId !== user.uid);
    const messageBody = body.trim();
    const timestamp = nowIso();

    await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
      authorId: user.uid,
      authorDisplayName: userProfile?.sellerProfile?.displayName || userProfile?.displayName || user.displayName || 'User',
      body: messageBody,
      createdAt: timestamp,
      system: false
    });

    await updateDoc(conversationRef, {
      updatedAt: timestamp,
      lastMessageAt: timestamp,
      lastMessagePreview: messageBody.slice(0, 160),
      messageCount: (conversation.messageCount || 0) + 1,
      unreadBy: otherParticipants
    });
  }, [isAdmin, user, userProfile]);

  const markConversationRead = useCallback(async (conversationId) => {
    if (!user || !conversationId) return;
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      unreadBy: arrayRemove(user.uid)
    });
  }, [user]);

  const submitVerificationRequest = useCallback(async ({ note = '' } = {}) => {
    if (!user) throw new Error('Sign in required.');
    const timestamp = nowIso();
    await setDoc(doc(db, 'users', user.uid), {
      sellerAccessStatus: 'pending',
      updatedAt: timestamp
    }, { merge: true });
    await setDoc(doc(db, 'verificationRequests', user.uid), {
      userId: user.uid,
      username: userProfile?.username || '',
      displayName: userProfile?.sellerProfile?.displayName || userProfile?.displayName || user.displayName || 'Seller',
      note: note.trim(),
      status: 'pending',
      requestedAt: timestamp,
      updatedAt: timestamp
    }, { merge: true });
  }, [user, userProfile]);

  const submitSellerReview = useCallback(async ({ sellerUserId, rating, comment = '', conversationId = '' }) => {
    if (!user) throw new Error('Sign in required.');
    if (!sellerUserId || sellerUserId === user.uid) {
      throw new Error('You cannot review yourself.');
    }
    const numericRating = Number(rating);
    if (numericRating < 1 || numericRating > 5) {
      throw new Error('Rating must be between 1 and 5.');
    }

    const reviewId = `${sellerUserId}_${user.uid}`;
    const timestamp = nowIso();
    const reviewPayload = {
      sellerUserId,
      reviewerUserId: user.uid,
      reviewerUsername: userProfile?.username || '',
      reviewerDisplayName: userProfile?.sellerProfile?.displayName || userProfile?.displayName || user.displayName || 'Trader',
      rating: numericRating,
      comment: comment.trim(),
      conversationId: conversationId || '',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await setDoc(doc(db, 'sellerReviews', reviewId), reviewPayload, { merge: true });
    await recalculateSellerStats(sellerUserId);
  }, [user, userProfile]);

  const adminSetUserAdmin = useCallback(async (targetUserId, nextValue) => {
    if (!isAdmin) throw new Error('Admin access required.');
    await setDoc(doc(db, 'users', targetUserId), {
      isAdmin: Boolean(nextValue),
      role: nextValue ? 'admin' : 'user',
      updatedAt: nowIso()
    }, { merge: true });
  }, [isAdmin]);

  const adminSetSellerVerified = useCallback(async (targetUserId, verified) => {
    if (!isAdmin) throw new Error('Admin access required.');
    const timestamp = nowIso();
    await updateDoc(doc(db, 'users', targetUserId), {
      'sellerProfile.verified': Boolean(verified),
      sellerAccessStatus: verified ? 'approved' : 'none',
      updatedAt: timestamp
    });
    await setDoc(doc(db, 'verificationRequests', targetUserId), {
      status: verified ? 'approved' : 'pending',
      reviewedAt: timestamp,
      reviewedBy: user?.uid || '',
      updatedAt: timestamp
    }, { merge: true });
    const sellerDoc = await getDoc(doc(db, 'users', targetUserId));
    if (sellerDoc.exists()) {
      await syncSellerListingMetadata(targetUserId, sellerDoc.data());
    }
  }, [isAdmin, user]);

  const adminUpdateListingStatus = useCallback(async (listingId, status) => {
    if (!isAdmin) throw new Error('Admin access required.');
    if (!LISTING_STATUSES.includes(status)) {
      throw new Error('Invalid listing status.');
    }
    await updateDoc(doc(db, 'listings', listingId), {
      status,
      updatedAt: nowIso()
    });
  }, [isAdmin]);

  const adminDeleteListing = useCallback(async (listingId) => {
    if (!isAdmin) throw new Error('Admin access required.');
    await deleteDoc(doc(db, 'listings', listingId));
  }, [isAdmin]);

  const adminToggleDeckVisibility = useCallback(async (deckId, isPublic) => {
    if (!isAdmin) throw new Error('Admin access required.');
    await updateDoc(doc(db, 'decks', deckId), {
      isPublic: Boolean(isPublic),
      updatedAt: nowIso()
    });
  }, [isAdmin]);

  const adminDeleteDeck = useCallback(async (deckId) => {
    if (!isAdmin) throw new Error('Admin access required.');
    await deleteDoc(doc(db, 'decks', deckId));
  }, [isAdmin]);

  const adminUpdateVerificationRequest = useCallback(async (targetUserId, status, reviewNote = '') => {
    if (!isAdmin) throw new Error('Admin access required.');
    if (!VERIFICATION_REQUEST_STATUSES.includes(status)) {
      throw new Error('Invalid verification request status.');
    }
    const timestamp = nowIso();
    await setDoc(doc(db, 'verificationRequests', targetUserId), {
      status,
      reviewNote: reviewNote.trim(),
      reviewedAt: timestamp,
      reviewedBy: user.uid,
      updatedAt: timestamp
    }, { merge: true });

    if (status === 'approved') {
      await setDoc(doc(db, 'users', targetUserId), {
        sellerAccessStatus: 'approved',
        sellerProfile: {
          verified: true
        },
        updatedAt: timestamp
      }, { merge: true });
    } else if (status === 'rejected') {
      await setDoc(doc(db, 'users', targetUserId), {
        sellerAccessStatus: 'rejected',
        sellerProfile: {
          verified: false
        },
        updatedAt: timestamp
      }, { merge: true });
    } else if (status === 'pending') {
      await setDoc(doc(db, 'users', targetUserId), {
        sellerAccessStatus: 'pending',
        sellerProfile: {
          verified: false
        },
        updatedAt: timestamp
      }, { merge: true });
    }
    const sellerDoc = await getDoc(doc(db, 'users', targetUserId));
    if (sellerDoc.exists()) {
      await syncSellerListingMetadata(targetUserId, sellerDoc.data());
    }
  }, [isAdmin, user]);

  const adminSeedDemoReviews = useCallback(async (targetUserId) => {
    if (!isAdmin) throw new Error('Admin access required.');

    const sellerDoc = await getDoc(doc(db, 'users', targetUserId));
    if (!sellerDoc.exists()) throw new Error('Seller not found.');

    const demoReviews = [
      {
        reviewerUserId: 'demo-reviewer-arctic',
        reviewerUsername: 'arcticcollector',
        reviewerDisplayName: 'Arctic Collector',
        rating: 5,
        comment: 'Fast replies, card matched the listing, and packaging was excellent.'
      },
      {
        reviewerUserId: 'demo-reviewer-lotl',
        reviewerUsername: 'lotltrader',
        reviewerDisplayName: 'LOTL Trader',
        rating: 4,
        comment: 'Smooth trade overall. Shipping took a little extra time but seller communicated clearly.'
      },
      {
        reviewerUserId: 'demo-reviewer-pengu',
        reviewerUsername: 'penguprime',
        reviewerDisplayName: 'Pengu Prime',
        rating: 5,
        comment: 'Would buy again. Honest condition notes and easy transaction.'
      }
    ];

    const timestamp = nowIso();
    await Promise.all(demoReviews.map((review) => setDoc(
      doc(db, 'sellerReviews', `${targetUserId}_${review.reviewerUserId}`),
      {
        sellerUserId: targetUserId,
        conversationId: '',
        createdAt: timestamp,
        updatedAt: timestamp,
        ...review
      },
      { merge: true }
    )));

    await recalculateSellerStats(targetUserId);
  }, [isAdmin]);

  const adminDeleteReview = useCallback(async (reviewId) => {
    if (!isAdmin) throw new Error('Admin access required.');
    const reviewRef = doc(db, 'sellerReviews', reviewId);
    const reviewSnap = await getDoc(reviewRef);
    if (!reviewSnap.exists()) throw new Error('Review not found.');
    const sellerUserId = reviewSnap.data().sellerUserId;
    await deleteDoc(reviewRef);
    await recalculateSellerStats(sellerUserId);
  }, [isAdmin]);

  const adminDeleteDemoReviews = useCallback(async (targetUserId) => {
    if (!isAdmin) throw new Error('Admin access required.');
    const reviewsQuery = query(collection(db, 'sellerReviews'), where('sellerUserId', '==', targetUserId));
    const snapshot = await getDocs(reviewsQuery);
    const demoDocs = snapshot.docs.filter((entry) => String(entry.data().reviewerUserId || '').startsWith('demo-reviewer-'));
    await Promise.all(demoDocs.map((entry) => deleteDoc(doc(db, 'sellerReviews', entry.id))));
    await recalculateSellerStats(targetUserId);
  }, [isAdmin]);

  return {
    isAdmin,
    busy,
    sellerTrust,
    sellerAccessStatus,
    sellerCanList,
    saveSellerProfile,
    saveListing,
    updateListingStatus,
    createOrOpenConversation,
    sendMessage,
    markConversationRead,
    submitVerificationRequest,
    submitSellerReview,
    adminSetUserAdmin,
    adminSetSellerVerified,
    adminUpdateListingStatus,
    adminDeleteListing,
    adminToggleDeckVisibility,
    adminDeleteDeck,
    adminUpdateVerificationRequest,
    adminSeedDemoReviews,
    adminDeleteReview,
    adminDeleteDemoReviews
  };
}

export function getCardRecord(cardId) {
  return cardMap.get(cardId) || null;
}
