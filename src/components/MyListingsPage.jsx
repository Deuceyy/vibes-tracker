import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Header from './Header';
import { ListingCard, MarketplaceNotice } from './MarketplaceCommon';
import {
  LISTING_CONDITIONS,
  LISTING_LANGUAGES,
  LISTING_STATUSES,
  LISTING_VARIANTS,
  getSellerAccessStatus,
  useListings,
  useMarketplace,
  useVerificationRequest
} from '../hooks/useMarketplace';
import { useAuth } from '../hooks/useAuth';
import { cardData } from '../hooks/useCollection';

const blankForm = {
  cardId: '',
  quantity: 1,
  condition: LISTING_CONDITIONS[1],
  price: '',
  shippingPrice: '0.00',
  notes: '',
  language: 'English',
  variant: 'normal',
  status: 'active'
};

export default function MyListingsPage() {
  const { user, userProfile, loading } = useAuth();
  const { listings, loading: listingsLoading } = useListings({ sellerUserId: user?.uid });
  const { saveListing, updateListingStatus, busy, sellerCanList } = useMarketplace();
  const { request: verificationRequest } = useVerificationRequest(user?.uid, Boolean(user));
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeCount = useMemo(() => listings.filter((listing) => listing.status === 'active').length, [listings]);
  const sellerAccessStatus = getSellerAccessStatus(userProfile || {}, verificationRequest);

  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  const handleEdit = (listing) => {
    setError('');
    setMessage('');
    setEditingId(listing.id);
    setForm({
      cardId: listing.cardId,
      quantity: listing.quantity,
      condition: listing.condition,
      price: listing.price,
      shippingPrice: listing.shippingPrice ?? 0,
      notes: listing.notes || '',
      language: listing.language || 'English',
      variant: listing.variant || 'normal',
      status: listing.status || 'active'
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(blankForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!form.cardId) {
      setError('Choose a card before saving.');
      return;
    }
    if (Number(form.quantity) < 1) {
      setError('Quantity must be at least 1.');
      return;
    }
    if (Number(form.price) <= 0) {
      setError('Price must be greater than 0.');
      return;
    }
    if (Number(form.shippingPrice) < 0) {
      setError('Shipping must be 0 or greater.');
      return;
    }

    try {
      await saveListing(form, editingId);
      setMessage(editingId ? 'Listing updated.' : 'Listing created.');
      resetForm();
    } catch (submitError) {
      setError(submitError.message || 'Unable to save listing.');
    }
  };

  const handleStatus = async (listingId, status) => {
    setError('');
    setMessage('');
    try {
      await updateListingStatus(listingId, status);
      setMessage(`Listing marked ${status}.`);
    } catch (statusError) {
      setError(statusError.message || 'Unable to update listing status.');
    }
  };

  return (
    <div className="app">
      <Header />
      <div className="container">
        <div className="page-header marketplace-page-header">
          <div>
            <h1>My Listings</h1>
            <p>
              {sellerCanList
                ? 'Manage your active inventory, update statuses, and keep buyer conversations on-platform.'
                : 'Seller approval is required before you can post cards to the marketplace.'}
            </p>
          </div>
          <div className="dashboard-summary">
            <span className={`status-pill ${sellerCanList ? 'active' : sellerAccessStatus}`}>
              {sellerCanList ? `${activeCount} active` : `Seller ${sellerAccessStatus}`}
            </span>
            <Link to="/messages" className="action-btn secondary">Open inbox</Link>
          </div>
        </div>

        <MarketplaceNotice />

        <div className="seller-settings-grid">
          {sellerCanList ? (
            <form className="panel seller-settings-form" onSubmit={handleSubmit}>
              <div className="section-header compact">
                <h2>{editingId ? 'Edit listing' : 'Create listing'}</h2>
                {userProfile?.username && (
                  <Link to={`/u/${userProfile.username}`} className="text-link">
                    View seller profile
                  </Link>
                )}
              </div>

              <div className="form-grid">
                <label className="form-group full">
                  <span>Card</span>
                  <select
                    className="search-input"
                    value={form.cardId}
                    onChange={(event) => setForm((prev) => ({ ...prev, cardId: event.target.value }))}
                    required
                  >
                    <option value="">Select a card</option>
                    {cardData.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name} - {card.set} #{card.setNumber}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-group">
                  <span>Quantity</span>
                  <input
                    type="number"
                    min="1"
                    className="search-input"
                    value={form.quantity}
                    onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                  />
                </label>

                <label className="form-group">
                  <span>Price</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="search-input"
                    value={form.price}
                    onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                  />
                </label>

                <label className="form-group">
                  <span>Shipping</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="search-input"
                    value={form.shippingPrice}
                    onChange={(event) => setForm((prev) => ({ ...prev, shippingPrice: event.target.value }))}
                  />
                </label>

                <label className="form-group">
                  <span>Condition</span>
                  <select className="search-input" value={form.condition} onChange={(event) => setForm((prev) => ({ ...prev, condition: event.target.value }))}>
                    {LISTING_CONDITIONS.map((condition) => (
                      <option key={condition} value={condition}>{condition}</option>
                    ))}
                  </select>
                </label>

                <label className="form-group">
                  <span>Status</span>
                  <select className="search-input" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                    {LISTING_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>

                <label className="form-group">
                  <span>Language</span>
                  <select className="search-input" value={form.language} onChange={(event) => setForm((prev) => ({ ...prev, language: event.target.value }))}>
                    {LISTING_LANGUAGES.map((language) => (
                      <option key={language} value={language}>{language}</option>
                    ))}
                  </select>
                </label>

                <label className="form-group">
                  <span>Variant</span>
                  <select className="search-input" value={form.variant} onChange={(event) => setForm((prev) => ({ ...prev, variant: event.target.value }))}>
                    {LISTING_VARIANTS.map((variant) => (
                      <option key={variant} value={variant}>{variant}</option>
                    ))}
                  </select>
                </label>

                <label className="form-group full">
                  <span>Notes</span>
                  <textarea
                    className="search-input textarea-input"
                    rows="4"
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Optional notes about print quality, bundle pricing, ship timing, or trade preferences"
                  />
                </label>
              </div>

              <div className="form-actions">
                <button type="submit" className="action-btn primary" disabled={busy}>
                  {busy ? 'Saving...' : editingId ? 'Save changes' : 'Create listing'}
                </button>
                {editingId && (
                  <button type="button" className="action-btn secondary" onClick={resetForm}>
                    Cancel edit
                  </button>
                )}
              </div>
              {message && <p className="success-text">{message}</p>}
              {error && <p className="error-text">{error}</p>}
            </form>
          ) : (
            <section className="panel seller-settings-form">
              <div className="section-header compact">
                <h2>Seller approval required</h2>
                <span className={`status-pill ${sellerAccessStatus}`}>{sellerAccessStatus}</span>
              </div>

              <p className="muted-copy">
                Only approved sellers can create marketplace listings. Set up your seller profile and submit your request for review.
              </p>

              {sellerAccessStatus === 'pending' && (
                <p className="muted-copy">
                  Your request is currently pending review. You will be able to post listings as soon as it is approved.
                </p>
              )}

              {sellerAccessStatus === 'rejected' && (
                <p className="muted-copy">
                  Your last request was not approved. Update your profile, add stronger references, and submit again when you are ready.
                </p>
              )}

              {verificationRequest?.reviewNote && (
                <div className="verification-status-block">
                  <span className="muted-copy">Admin note: {verificationRequest.reviewNote}</span>
                </div>
              )}

              <div className="form-actions">
                <Link to="/settings/seller" className="action-btn primary">
                  {sellerAccessStatus === 'pending' ? 'View seller request' : 'Apply to sell'}
                </Link>
                {userProfile?.username && (
                  <Link to={`/u/${userProfile.username}`} className="action-btn secondary">
                    View public profile
                  </Link>
                )}
              </div>
            </section>
          )}

          <div className="panel">
            <div className="section-header compact">
              <h2>Listing status guide</h2>
            </div>
            <ul className="seller-trust-list">
              <li><strong>Active:</strong> visible in browse and on the card page.</li>
              <li><strong>Pending:</strong> temporarily held while you work with a buyer.</li>
              <li><strong>Sold:</strong> kept for your records but hidden from discovery.</li>
              <li><strong>Inactive:</strong> hidden without marking the card sold.</li>
              <li><strong>Shipping:</strong> shown separately so buyers see expected shipped cost before they commit.</li>
            </ul>
          </div>
        </div>

        <section className="listing-stack">
          {listingsLoading ? (
            <div className="loading">Loading your listings...</div>
          ) : listings.length === 0 ? (
            <div className="empty-state">
              <h3>{sellerCanList ? 'No listings yet' : 'No listings available to manage'}</h3>
              <p>
                {sellerCanList
                  ? 'Create your first community listing to start taking buyer messages.'
                  : 'Once your seller request is approved, your listing dashboard will unlock here.'}
              </p>
            </div>
          ) : (
            listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                showStatus
                showSeller={false}
                actions={sellerCanList ? (
                  <>
                    <button className="action-btn secondary" onClick={() => handleEdit(listing)}>
                      Edit
                    </button>
                    <button className="action-btn secondary" onClick={() => handleStatus(listing.id, listing.status === 'active' ? 'inactive' : 'active')}>
                      {listing.status === 'active' ? 'Deactivate' : 'Reactivate'}
                    </button>
                    {listing.status !== 'pending' && (
                      <button className="action-btn secondary" onClick={() => handleStatus(listing.id, 'pending')}>
                        Mark pending
                      </button>
                    )}
                    {listing.status !== 'sold' && (
                      <button className="action-btn primary" onClick={() => handleStatus(listing.id, 'sold')}>
                        Mark sold
                      </button>
                    )}
                  </>
                ) : null}
              />
            ))
          )}
        </section>
      </div>
    </div>
  );
}
