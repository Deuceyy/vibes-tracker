import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useCollection, cardData } from '../hooks/useCollection';
import { useAuth } from '../hooks/useAuth';
import { getSellerAccessStatus, useConversations, useListings, useMarketplace, useSellerReviews } from '../hooks/useMarketplace';
import CardModal from './CardModal';
import Header from './Header';
import { ListingCard, MarketplaceNotice, SellerTrustCard } from './MarketplaceCommon';

const RARITY_ORDER = { Common: 1, Uncommon: 2, Rare: 3, Mythic: 4, Epic: 5 };

export default function ProfilePage() {
  const { username } = useParams();
  const { user } = useAuth();
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const { listings, loading: listingsLoading } = useListings({ sellerUserId: userId || 'pending' });
  const { reviews, loading: reviewsLoading } = useSellerReviews(userId, Boolean(userId));
  const { conversations } = useConversations({ userId: user?.uid, enabled: Boolean(user?.uid) });
  const { submitSellerReview } = useMarketplace();

  useEffect(() => {
    async function findUser() {
      try {
        const usersRef = collection(db, 'users');
        const profileQuery = query(usersRef, where('username', '==', username.toLowerCase()));
        const snapshot = await getDocs(profileQuery);

        if (snapshot.empty) {
          setNotFound(true);
        } else {
          const userDoc = snapshot.docs[0];
          setUserId(userDoc.id);
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error('Error finding user:', error);
        setNotFound(true);
      }
      setLoadingProfile(false);
    }

    findUser();
  }, [username]);

  const {
    loading: loadingCollection,
    getCardVariants,
    getTotalOwned,
    hasPlayset,
    hasMasterSet,
    stats
  } = useCollection(userId);

  const [filters, setFilters] = useState({
    search: '',
    color: 'All',
    type: 'All',
    rarity: 'All',
    set: 'All',
    owned: 'owned',
    sort: 'owned-desc'
  });

  const [selectedCard, setSelectedCard] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewError, setReviewError] = useState('');
  const isOwnProfile = Boolean(user && user.uid === userId);
  const sellerProfile = userProfile?.sellerProfile || {};
  const sellerAccessStatus = getSellerAccessStatus(userProfile || {});
  const activeListings = useMemo(
    () => listings.filter((listing) => listing.status === 'active').sort((left, right) => (left.price ?? 0) - (right.price ?? 0)),
    [listings]
  );
  const canLeaveReview = Boolean(
    user &&
    userId &&
    user.uid !== userId &&
    conversations.some((conversation) => conversation.sellerUserId === userId || conversation.buyerUserId === userId)
  );
  const existingReview = reviews.find((review) => review.reviewerUserId === user?.uid);

  const filteredCards = useMemo(() => {
    const cards = cardData.filter((card) => {
      if (filters.search && !card.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.color !== 'All' && card.color !== filters.color) return false;
      if (filters.type !== 'All' && !card.type.includes(filters.type)) return false;
      if (filters.rarity !== 'All' && card.rarity !== filters.rarity) return false;
      if (filters.set !== 'All' && card.set !== filters.set) return false;

      const total = getTotalOwned(card.id);
      if (filters.owned === 'owned' && total === 0) return false;
      if (filters.owned === 'missing' && total > 0) return false;

      return true;
    });

    const [field, dir] = filters.sort.split('-');
    const mult = dir === 'asc' ? 1 : -1;

    cards.sort((left, right) => {
      switch (field) {
        case 'name':
          return mult * left.name.localeCompare(right.name);
        case 'owned':
          return mult * (getTotalOwned(left.id) - getTotalOwned(right.id));
        case 'rarity':
          return mult * ((RARITY_ORDER[left.rarity] || 0) - (RARITY_ORDER[right.rarity] || 0));
        default:
          return 0;
      }
    });

    return cards;
  }, [filters, getTotalOwned]);

  if (loadingProfile) {
    return <div className="loading">Loading profile...</div>;
  }

  if (notFound) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="penguin-emoji">?</div>
          <h3>User not found</h3>
          <p>No user with username "{username}" exists.</p>
          <Link to="/" className="action-btn primary" style={{ marginTop: '1rem', display: 'inline-block', textDecoration: 'none' }}>
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (loadingCollection) {
    return <div className="loading">Loading collection...</div>;
  }

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    setReviewError('');
    setReviewMessage('');
    try {
      await submitSellerReview({
        sellerUserId: userId,
        rating: reviewForm.rating,
        comment: reviewForm.comment
      });
      setReviewMessage(existingReview ? 'Review updated.' : 'Review posted.');
      setReviewForm((prev) => ({ ...prev, comment: '' }));
    } catch (error) {
      setReviewError(error.message || 'Unable to submit review.');
    }
  };

  return (
    <div className="app">
      <Header />
      <div className="container">
        <section className="profile-hero panel">
          <div className="profile-hero-main">
            {(sellerProfile.avatarUrl || userProfile?.photoURL) && (
              <img src={sellerProfile.avatarUrl || userProfile?.photoURL} alt="" className="profile-avatar hero" />
            )}
            <div>
              <div className="profile-heading-row">
                <h1>{sellerProfile.displayName || userProfile?.displayName || username}</h1>
                {sellerProfile.verified && <span className="verified-badge">Verified seller</span>}
              </div>
              <div className="profile-username">@{username}</div>
              {sellerProfile.bio && <p className="profile-bio">{sellerProfile.bio}</p>}
              <div className="seller-profile-meta">
                {sellerProfile.location && <span>{sellerProfile.location}</span>}
                {sellerProfile.shippingRegion && <span>Ships to {sellerProfile.shippingRegion}</span>}
                {sellerProfile.contactMethods && <span>{sellerProfile.contactMethods}</span>}
              </div>
            </div>
          </div>
          <div className="profile-hero-actions">
            {isOwnProfile && (
              <>
                <Link to="/settings/seller" className="action-btn primary">Edit seller profile</Link>
                <Link to={sellerAccessStatus === 'approved' ? '/marketplace/my-listings' : '/settings/seller'} className="action-btn secondary">
                  {sellerAccessStatus === 'approved' ? 'Manage listings' : 'Apply to sell'}
                </Link>
              </>
            )}
          </div>
        </section>

        <MarketplaceNotice compact />

        <div className="seller-settings-grid">
          <SellerTrustCard profile={userProfile || {}} />
          <section className="panel">
            <div className="section-header compact">
              <h2>Links & references</h2>
            </div>
            <div className="link-chip-row">
              {(sellerProfile.externalLinks || []).map((link) => (
                <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="link-chip">{link}</a>
              ))}
              {(sellerProfile.socialLinks || []).map((link) => (
                <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="link-chip">{link}</a>
              ))}
              {(sellerProfile.externalLinks || []).length === 0 && (sellerProfile.socialLinks || []).length === 0 && (
                <p className="muted-copy">No external references linked yet.</p>
              )}
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="section-header">
            <h2>Active listings</h2>
            <span>{listingsLoading ? 'Loading...' : `${activeListings.length} live`}</span>
          </div>
          {activeListings.length === 0 ? (
            <div className="empty-state compact">
              <h3>No active listings yet</h3>
              <p>This seller has not posted any community listings yet.</p>
            </div>
          ) : (
            <div className="listing-stack">
              {activeListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} showSeller={false} />
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-header">
            <h2>Seller reviews</h2>
            <span>{reviewsLoading ? 'Loading...' : `${reviews.length} total`}</span>
          </div>

          {canLeaveReview && (
            <form className="review-form" onSubmit={handleReviewSubmit}>
              <div className="form-grid">
                <label className="form-group">
                  <span>Rating</span>
                  <select
                    className="search-input"
                    value={reviewForm.rating}
                    onChange={(event) => setReviewForm((prev) => ({ ...prev, rating: Number(event.target.value) }))}
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>{value} / 5</option>
                    ))}
                  </select>
                </label>

                <label className="form-group full">
                  <span>{existingReview ? 'Update your review' : 'Leave a review'}</span>
                  <textarea
                    className="search-input textarea-input"
                    rows="3"
                    value={reviewForm.comment}
                    onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
                    placeholder="How did the trade go? Packaging, communication, speed, accuracy..."
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="action-btn secondary">
                  {existingReview ? 'Update review' : 'Post review'}
                </button>
                {reviewMessage && <span className="success-text">{reviewMessage}</span>}
                {reviewError && <span className="error-text">{reviewError}</span>}
              </div>
            </form>
          )}

          {!canLeaveReview && !isOwnProfile && (
            <p className="muted-copy">Reviews unlock after you have at least one buyer-seller conversation with this seller.</p>
          )}

          {reviews.length === 0 ? (
            <div className="empty-state compact">
              <h3>No reviews yet</h3>
              <p>Completed trades can start building trust here.</p>
            </div>
          ) : (
            <div className="review-list">
              {reviews.map((review) => (
                <article key={review.id} className="review-card">
                  <div className="review-card-top">
                    <strong>{review.reviewerDisplayName || review.reviewerUsername || 'Trader'}</strong>
                    <div className="listing-card-details">
                      <span>{review.rating}/5</span>
                      <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {review.comment && <p className="listing-notes">{review.comment}</p>}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-header">
            <h2>Collection showcase</h2>
            <div className="stats-bar">
              <div className="stat-item">
                <div className="stat-value">{stats.uniqueCards}</div>
                <div className="stat-label">Unique</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.totalCards}</div>
                <div className="stat-label">Total</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{Math.round((stats.playsetComplete / stats.totalInSet) * 100)}%</div>
                <div className="stat-label">Playset</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{Math.round((stats.masterComplete / stats.totalInSet) * 100)}%</div>
                <div className="stat-label">Master</div>
              </div>
            </div>
          </div>

          <div className="filters-row">
            <div className="filter-group" style={{ flex: 2 }}>
              <label className="filter-label">Search</label>
              <input
                type="text"
                className="search-input"
                placeholder="Search cards..."
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
            </div>
            <div className="filter-group small">
              <label className="filter-label">Show</label>
              <select className="search-input" value={filters.owned} onChange={(event) => setFilters((prev) => ({ ...prev, owned: event.target.value }))}>
                <option value="owned">Owned only</option>
                <option value="All">All cards</option>
                <option value="missing">Missing only</option>
              </select>
            </div>
            <div className="filter-group small">
              <label className="filter-label">Sort</label>
              <select className="search-input" value={filters.sort} onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value }))}>
                <option value="owned-desc">Most owned</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="rarity-desc">Rarity</option>
              </select>
            </div>
          </div>

          <section className="card-grid">
            {filteredCards.map((card) => {
              const total = getTotalOwned(card.id);
              const variants = getCardVariants(card.id);
              const isPlaysetComplete = hasPlayset(card.id);
              const isMasterComplete = hasMasterSet(card.id);

              let statusClass = '';
              if (isMasterComplete) statusClass = 'master-complete';
              else if (isPlaysetComplete) statusClass = 'playset-complete';
              else if (total > 0) statusClass = 'owned';

              return (
                <div key={card.id} className={`card-item ${statusClass}`} onClick={() => setSelectedCard(card)}>
                  <div className="card-image-container">
                    <img className="card-image" src={card.imageUrl} alt={card.name} />
                    <div className={`rarity-badge ${card.rarity}`} />
                    <div className={`color-stripe ${card.color}`} />
                  </div>
                  <div className="card-info">
                    <div className="card-name">{card.name}</div>
                    <div className="card-details">
                      <span>{card.type}</span>
                      <span>
                        {variants.normal > 0 && `${variants.normal}N `}
                        {variants.foil > 0 && `${variants.foil}F `}
                        {variants.arctic > 0 && `${variants.arctic}A `}
                        {variants.sketch > 0 && `${variants.sketch}S`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </section>
      </div>

      {selectedCard && (
        <CardModal
          card={selectedCard}
          variants={getCardVariants(selectedCard.id)}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}
