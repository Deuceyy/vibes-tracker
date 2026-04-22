import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from './Header';
import { ListingCard, MarketplaceNotice } from './MarketplaceCommon';
import { LISTING_CONDITIONS, getSellerAccessStatus, useListings, useMarketplace, useVerificationRequest } from '../hooks/useMarketplace';
import { useAuth } from '../hooks/useAuth';
import { cardData } from '../hooks/useCollection';

export default function MarketplacePage() {
  const navigate = useNavigate();
  const { user, userProfile, signInWithGoogle } = useAuth();
  const { listings, loading } = useListings({ status: 'active' });
  const { createOrOpenConversation, busy } = useMarketplace();
  const { request: verificationRequest } = useVerificationRequest(user?.uid, Boolean(user));
  const [filters, setFilters] = useState({
    search: '',
    set: 'All',
    rarity: 'All',
    condition: 'All',
    sort: 'price-asc'
  });
  const [actionError, setActionError] = useState('');
  const sellerAccessStatus = getSellerAccessStatus(userProfile || {}, verificationRequest);

  const filteredListings = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const rows = listings.filter((listing) => {
      if (search && !`${listing.cardName} ${listing.sellerDisplayName} ${listing.sellerUsername}`.toLowerCase().includes(search)) return false;
      if (filters.set !== 'All' && listing.set !== filters.set) return false;
      if (filters.rarity !== 'All' && listing.rarity !== filters.rarity) return false;
      if (filters.condition !== 'All' && listing.condition !== filters.condition) return false;
      return true;
    });

    rows.sort((left, right) => {
      switch (filters.sort) {
        case 'price-desc':
          return (right.price ?? 0) - (left.price ?? 0);
        case 'newest':
          return (right.createdAt || '').localeCompare(left.createdAt || '');
        case 'card-asc':
          return (left.cardName || '').localeCompare(right.cardName || '');
        case 'price-asc':
        default:
          return (left.price ?? 0) - (right.price ?? 0);
      }
    });

    return rows;
  }, [filters, listings]);

  const handleAction = async (listing, intentType) => {
    setActionError('');
    try {
      if (!user) {
        await signInWithGoogle();
        return;
      }
      const conversationId = await createOrOpenConversation({ listing, intentType });
      if (conversationId) {
        navigate(`/messages/${conversationId}`);
      }
    } catch (error) {
      setActionError(error.message || 'Unable to start conversation.');
    }
  };

  return (
    <div className="app">
      <Header />
      <div className="container">
        <div className="page-header marketplace-page-header">
          <div>
            <h1>Marketplace</h1>
            <p>Browse community listings by card, compare prices, and contact sellers without leaving the site.</p>
          </div>
          {user ? (
            <Link to={sellerAccessStatus === 'approved' ? '/marketplace/my-listings' : '/settings/seller'} className="action-btn primary">
              {sellerAccessStatus === 'approved'
                ? 'My listings'
                : sellerAccessStatus === 'pending'
                  ? 'Seller request pending'
                  : 'Apply to sell'}
            </Link>
          ) : (
            <button className="action-btn primary" onClick={signInWithGoogle}>
              Sign in to sell
            </button>
          )}
        </div>

        <MarketplaceNotice />

        {user && sellerAccessStatus !== 'approved' && (
          <section className="panel">
            <div className="section-header compact">
              <h2>Sell on the marketplace</h2>
              <span className={`status-pill ${sellerAccessStatus}`}>{sellerAccessStatus}</span>
            </div>
            <p className="muted-copy">
              Only approved sellers can post listings. Build out your seller profile and submit your request before listing cards.
            </p>
            <div className="form-actions">
              <Link to="/settings/seller" className="action-btn primary">
                {sellerAccessStatus === 'pending' ? 'View seller request' : 'Apply to sell'}
              </Link>
            </div>
          </section>
        )}

        <section className="filters-section">
          <div className="filters-row">
            <div className="filter-group">
              <label className="filter-label">Search</label>
              <input
                className="search-input"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder="Card or seller"
              />
            </div>
            <div className="filter-group small">
              <label className="filter-label">Set</label>
              <select className="search-input" value={filters.set} onChange={(event) => setFilters((prev) => ({ ...prev, set: event.target.value }))}>
                <option value="All">All sets</option>
                {[...new Set(cardData.map((card) => card.set))].sort().map((setName) => (
                  <option key={setName} value={setName}>{setName}</option>
                ))}
              </select>
            </div>
            <div className="filter-group small">
              <label className="filter-label">Rarity</label>
              <select className="search-input" value={filters.rarity} onChange={(event) => setFilters((prev) => ({ ...prev, rarity: event.target.value }))}>
                <option value="All">All rarities</option>
                {[...new Set(cardData.map((card) => card.rarity))].sort().map((rarity) => (
                  <option key={rarity} value={rarity}>{rarity}</option>
                ))}
              </select>
            </div>
            <div className="filter-group small">
              <label className="filter-label">Condition</label>
              <select className="search-input" value={filters.condition} onChange={(event) => setFilters((prev) => ({ ...prev, condition: event.target.value }))}>
                <option value="All">All conditions</option>
                {LISTING_CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>{condition}</option>
                ))}
              </select>
            </div>
            <div className="filter-group small">
              <label className="filter-label">Sort</label>
              <select className="search-input" value={filters.sort} onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value }))}>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="newest">Newest first</option>
                <option value="card-asc">Card name</option>
              </select>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="loading">Loading listings...</div>
        ) : filteredListings.length === 0 ? (
          <div className="empty-state">
            <div className="penguin-emoji">P2P</div>
            <h3>No listings match those filters</h3>
            <p>Try widening the search or create the first listing for a card you own.</p>
          </div>
        ) : (
          <section className="listing-stack">
            {filteredListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                actions={(
                  <>
                    <button className="action-btn secondary" onClick={() => handleAction(listing, 'contact')} disabled={busy}>
                      Contact seller
                    </button>
                    <button className="action-btn primary" onClick={() => handleAction(listing, 'commit')} disabled={busy}>
                      Commit to buy
                    </button>
                  </>
                )}
              />
            ))}
          </section>
        )}

        {actionError && <p className="error-text">{actionError}</p>}
      </div>
    </div>
  );
}
