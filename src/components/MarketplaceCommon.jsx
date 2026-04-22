import { Link } from 'react-router-dom';
import { buildSellerTrustSignals } from '../hooks/useMarketplace';

function formatPrice(price) {
  const numeric = Number(price);
  if (Number.isNaN(numeric)) return '$0.00';
  return `$${numeric.toFixed(2)}`;
}

function formatShippingPrice(price) {
  const numeric = Number(price || 0);
  if (numeric <= 0) return 'Free shipping';
  return `+$${numeric.toFixed(2)} shipping`;
}

function getEstimatedTotal(listing) {
  return Number(listing.price || 0) + Number(listing.shippingPrice || 0);
}

function formatDate(value) {
  if (!value) return 'Just now';
  return new Date(value).toLocaleString();
}

export function MarketplaceNotice({ compact = false, className = '' }) {
  return (
    <div className={`marketplace-notice ${compact ? 'compact' : ''} ${className}`.trim()}>
      <strong>Marketplace note:</strong> Listings are peer-to-peer. Vibes Tracker is not the seller of record, does not process payments, and recommends protected payment methods. Buyer-seller messages stay private from the public, but admins may review message records for moderation, safety, support, fraud prevention, dispute review, and platform operations.
    </div>
  );
}

export function SellerTrustCard({ profile = {} }) {
  const trust = buildSellerTrustSignals(profile);
  const sellerProfile = profile.sellerProfile || {};

  return (
    <div className="seller-trust-card">
      <div className="seller-trust-header">
        <h3>Trust Signals</h3>
        <span className={`trust-pill ${trust.verified ? 'verified' : ''}`}>
          {trust.verified ? 'Verified seller' : 'Verification pending'}
        </span>
      </div>
      <div className="trust-meter">
        <div className="trust-meter-bar">
          <div className="trust-meter-fill" style={{ width: `${trust.percentage}%` }} />
        </div>
        <span>{trust.percentage}% profile complete</span>
      </div>
      <ul className="seller-trust-list">
        <li>{sellerProfile.shippingRegion || sellerProfile.location ? 'Shipping details shared' : 'Shipping details not provided yet'}</li>
        <li>{sellerProfile.contactMethods ? 'Contact methods listed' : 'Contact methods not listed yet'}</li>
        <li>{(sellerProfile.socialLinks || []).length > 0 ? 'Social references linked' : 'No social references linked yet'}</li>
        <li>{(sellerProfile.externalLinks || []).length > 0 ? 'External store links added' : 'No external store links added yet'}</li>
        <li>{trust.reviewCount > 0 ? `${trust.reviewCount} review${trust.reviewCount === 1 ? '' : 's'} with ${trust.averageRating.toFixed(1)}/5 average` : 'No seller reviews yet'}</li>
      </ul>
    </div>
  );
}

export function ListingCard({
  listing,
  showSeller = true,
  showStatus = false,
  actions = null,
  footer = null
}) {
  return (
    <article className="listing-card">
      <div className="listing-card-media">
        {listing.cardImageUrl ? (
          <img src={listing.cardImageUrl} alt={listing.cardName} className="listing-card-image" />
        ) : (
          <div className="listing-card-fallback">{listing.cardName?.slice(0, 1) || '?'}</div>
        )}
      </div>
      <div className="listing-card-content">
        <div className="listing-card-top">
          <div>
            <Link to={`/cards/${listing.cardId}`} className="listing-card-title">
              {listing.cardName}
            </Link>
            <div className="listing-card-meta">
              <span>{listing.set || 'Set TBD'}</span>
              {listing.rarity && <span>{listing.rarity}</span>}
              <span>{listing.variant || 'normal'}</span>
            </div>
          </div>
          <div className="listing-price-group">
            <div className="listing-price">{formatPrice(listing.price)}</div>
            <div className="listing-shipping">{formatShippingPrice(listing.shippingPrice)}</div>
            <div className="listing-total">Est. total {formatPrice(getEstimatedTotal(listing))}</div>
          </div>
        </div>

        <div className="listing-card-details">
          <span>Qty {listing.quantity}</span>
          <span>{listing.condition}</span>
          {listing.language && <span>{listing.language}</span>}
          <span>{formatShippingPrice(listing.shippingPrice)}</span>
          {showStatus && <span className={`status-pill ${listing.status}`}>{listing.status}</span>}
        </div>

        {showSeller && (
          <div className="listing-seller-line">
            <Link to={`/u/${listing.sellerUsername}`} className="listing-seller-link">
              {listing.sellerDisplayName || listing.sellerUsername || 'Seller'}
            </Link>
            {listing.sellerVerified && <span className="verified-badge">Verified</span>}
            {Number(listing.sellerReviewCount || 0) > 0 && (
              <span className="seller-rating-pill">
                {Number(listing.sellerAverageRating || 0).toFixed(1)}/5 · {listing.sellerReviewCount} review{listing.sellerReviewCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}

        {listing.notes && <p className="listing-notes">{listing.notes}</p>}

        {(actions || footer) && (
          <div className="listing-card-footer">
            {actions && <div className="listing-card-actions">{actions}</div>}
            {footer}
          </div>
        )}
      </div>
    </article>
  );
}

export function ThreadListingSummary({ conversation }) {
  if (!conversation?.listingSnapshot) return null;

  const listing = conversation.listingSnapshot;
  return (
    <div className="thread-listing-summary">
      <div>
        <div className="thread-listing-eyebrow">Linked listing</div>
        <Link to={`/cards/${listing.cardId}`} className="thread-listing-title">
          {listing.cardName}
        </Link>
        <div className="listing-card-details">
          <span>{formatPrice(listing.price)}</span>
          <span>{formatShippingPrice(listing.shippingPrice)}</span>
          <span>Est. total {formatPrice(getEstimatedTotal(listing))}</span>
          <span>Qty {listing.quantity}</span>
          <span>{listing.condition}</span>
          <span>{listing.variant}</span>
        </div>
      </div>
      <div className="thread-listing-side">
        <span className={`status-pill ${listing.status}`}>{listing.status}</span>
        <span>{conversation.intentType === 'commit' ? 'Commit to buy' : 'Contact seller'}</span>
      </div>
    </div>
  );
}

export { formatPrice, formatDate, formatShippingPrice };
