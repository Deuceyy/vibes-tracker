import { Link } from 'react-router-dom';
import { VARIANTS } from '../hooks/useCollection';
import { usePrices } from '../hooks/usePrices';
import { useListings } from '../hooks/useMarketplace';
import { formatPrice, formatShippingPrice } from './MarketplaceCommon';

const VARIANT_LABELS = { normal: 'Normal', foil: 'Foil', arctic: 'Arctic', sketch: 'Sketch' };

export default function CardModal({ card, variants, onClose, onAdjustVariant }) {
  const { getCardPrices } = usePrices();
  const { listings, loading: listingsLoading } = useListings({ status: 'active', cardId: card?.id });

  if (!card) return null;

  const cardText = card.cardText?.replace(/\|/g, '<br>').replace(/_([A-Z])_/g, '[$1]') || 'No card text';
  const prices = getCardPrices(card.id);
  const activeListings = listings
    .filter((listing) => listing.cardId === card.id && listing.status === 'active')
    .sort((left, right) => (left.price ?? 0) - (right.price ?? 0));
  const totalForSale = activeListings.reduce((sum, listing) => sum + Number(listing.quantity || 0), 0);
  const previewListings = activeListings.slice(0, 3);

  return (
    <div className="modal-overlay active" onClick={(event) => {
      if (event.target.classList.contains('modal-overlay')) onClose();
    }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{card.name}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="modal-card-content">
            <div className="modal-card-image">
              <img
                src={card.imageUrl}
                alt={card.name}
                style={{ width: '100%', borderRadius: '8px' }}
                onError={(event) => {
                  event.target.outerHTML = `<div class="card-image-placeholder" style="aspect-ratio: 3/4; display: flex;"><span class="penguin-emoji">P</span><span>${card.name}</span></div>`;
                }}
              />
            </div>
            <div className="modal-card-details">
              <p><strong>Type:</strong> {card.type}</p>
              {card.cost && <p><strong>Cost:</strong> {card.cost.amount} Fish</p>}
              {card.vibe !== null && <p><strong>Vibe:</strong> {card.vibe}</p>}
              <p><strong>Rarity:</strong> {card.rarity}</p>
              <p><strong>Set:</strong> {card.set === 'Eth' ? 'Enter the Huddle' : 'Legend of the Lils'} #{card.setNumber || '?'}</p>
              <div className="modal-card-links">
                <Link to={`/cards/${card.id}`} className="action-btn primary" onClick={onClose}>
                  View marketplace page
                </Link>
              </div>
              <div className="card-text-box" dangerouslySetInnerHTML={{ __html: cardText }} />

              {prices && (
                <div className="card-prices">
                  <h4>SCG Prices</h4>
                  {prices.normal?.price && (
                    <div className="price-row">
                      <span className="variant-name">Normal:</span>
                      <span className="variant-price">{formatPrice(prices.normal.price)}</span>
                    </div>
                  )}
                  {prices.foil?.price && (
                    <div className="price-row">
                      <span className="variant-name">Foil:</span>
                      <span className="variant-price">{formatPrice(prices.foil.price)}</span>
                    </div>
                  )}
                  {prices.arctic?.price && (
                    <div className="price-row">
                      <span className="variant-name">Arctic:</span>
                      <span className="variant-price">{formatPrice(prices.arctic.price)}</span>
                    </div>
                  )}
                  {prices.sketch?.price && (
                    <div className="price-row">
                      <span className="variant-name">Sketch:</span>
                      <span className="variant-price">{formatPrice(prices.sketch.price)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="card-prices marketplace-preview">
                <div className="section-header compact">
                  <h4>Marketplace Snapshot</h4>
                  {activeListings.length > 0 && <span>{totalForSale} total for sale</span>}
                </div>
                {listingsLoading ? (
                  <div className="muted-copy">Loading listings...</div>
                ) : activeListings.length === 0 ? (
                  <div className="muted-copy">No active community listings right now.</div>
                ) : (
                  <>
                    <div className="muted-copy">{activeListings.length} seller{activeListings.length === 1 ? '' : 's'} currently listing this card.</div>
                    <div className="modal-marketplace-preview-list">
                      {previewListings.map((listing) => (
                        <div key={listing.id} className="modal-marketplace-preview-row">
                          <div>
                            <Link to={`/u/${listing.sellerUsername}`} className="listing-seller-link" onClick={onClose}>
                              {listing.sellerDisplayName || listing.sellerUsername}
                            </Link>
                            <div className="listing-card-meta">
                              {Number(listing.sellerReviewCount || 0) > 0 && (
                                <span className="seller-rating-pill">
                                  {Number(listing.sellerAverageRating || 0).toFixed(1)}/5
                                </span>
                              )}
                              <span>Qty {listing.quantity}</span>
                              <span>{listing.condition}</span>
                              <span>{listing.variant || 'normal'}</span>
                            </div>
                          </div>
                          <div className="modal-marketplace-preview-price">
                            <strong>{formatPrice(listing.price)}</strong>
                            <span>{formatShippingPrice(listing.shippingPrice)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {onAdjustVariant && (
            <div className="modal-variants">
              <h4>Your Collection</h4>
              <div className="modal-variant-grid">
                {VARIANTS.map((variant) => (
                  <div key={variant} className="modal-variant-row">
                    <span className={`modal-variant-label variant-label ${variant}`}>{VARIANT_LABELS[variant]}</span>
                    <div className="modal-variant-counter">
                      <button className="modal-variant-btn" onClick={() => onAdjustVariant(card.id, variant, -1)}>−</button>
                      <span className={`modal-variant-count ${variants[variant] > 0 ? 'has-cards' : ''}`}>{variants[variant]}</span>
                      <button className="modal-variant-btn" onClick={() => onAdjustVariant(card.id, variant, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
