import { useEffect } from 'react';
import { getSetLabel, getSupportedVariants, getCanonicalCardType, getCharacterSubtypes } from '../lib/cardMetadata.js';
import { usePrices } from '../hooks/usePrices';

const VARIANT_LABELS = {
  normal: 'Normal',
  foil: 'Foil',
  arctic: 'Arctic',
  sketch: 'Sketch',
  birbFoil: 'Birb Foil',
  fishFoil: 'Fish Foil',
  penguFoil: 'Pengu Foil'
};
const DYLI_VARIANT_ORDER = ['normal', 'foil', 'arctic', 'sketch', 'birbFoil', 'fishFoil', 'penguFoil'];

export default function CardModal({ card, variants, onClose, onAdjustVariant, onNavigate, hasPrev, hasNext }) {
  const { getCardPrices, getDyliVariants, formatPrice } = usePrices();

  // Keyboard: Esc to close, ←/→ to page through the filtered list.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && onNavigate && hasPrev) onNavigate(-1);
      else if (e.key === 'ArrowRight' && onNavigate && hasNext) onNavigate(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate, hasPrev, hasNext]);

  if (!card) return null;

  const cardText = card.cardText?.replace(/\|/g, '<br>').replace(/_([A-Z])_/g, '[$1]') || 'No card text';
  const prices = getCardPrices(card.id);
  const dyli = getDyliVariants(card.id);
  const supportedVariants = getSupportedVariants(card);
  const canonicalType = getCanonicalCardType(card);
  const subtypes = getCharacterSubtypes(card);
  const typeLine = subtypes.length > 0 ? `${canonicalType} - ${subtypes.join(', ')}` : canonicalType;

  return (
    <div className="modal-overlay active" onClick={(e) => {
      if (e.target.classList.contains('modal-overlay')) onClose();
    }}>
      {onNavigate && hasPrev && (
        <button
          className="modal-nav modal-nav--prev"
          onClick={(e) => { e.stopPropagation(); onNavigate(-1); }}
          aria-label="Previous card"
        >‹</button>
      )}
      {onNavigate && hasNext && (
        <button
          className="modal-nav modal-nav--next"
          onClick={(e) => { e.stopPropagation(); onNavigate(1); }}
          aria-label="Next card"
        >›</button>
      )}
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
                onError={(e) => {
                  e.target.outerHTML = `<div class="card-image-placeholder" style="aspect-ratio: 3/4; display: flex;"><span class="penguin-emoji">🐧</span><span>${card.name}</span></div>`;
                }}
              />
            </div>
            <div className="modal-card-details">
              <p><strong>Type:</strong> {typeLine}</p>
              {card.cost && <p><strong>Cost:</strong> {card.cost.amount} Fish</p>}
              {card.vibe !== null && <p><strong>Vibe:</strong> {card.vibe}</p>}
              <p><strong>Rarity:</strong> {card.rarity}</p>
              <p><strong>Set:</strong> {getSetLabel(card.set)} #{card.setNumber || '?'}</p>
              {card.illustrator && <p><strong>Artist:</strong> {card.illustrator}</p>}
              <div className="card-text-box" dangerouslySetInnerHTML={{ __html: cardText }} />
              
              {/* DYLI live marketplace prices */}
              {dyli && (
                <div className="card-prices">
                  <h4>💰 DYLI Market</h4>
                  {DYLI_VARIANT_ORDER.filter((v) => dyli[v]).map((v) => {
                    const entry = dyli[v];
                    const shown = entry.floor ?? entry.primary;
                    if (shown == null) return null;
                    return (
                      <div key={v} className="price-row">
                        <span className="variant-name">{VARIANT_LABELS[v] || v}:</span>
                        <span className="variant-price">
                          {formatPrice(shown)}
                          {entry.url && (
                            <a
                              className="buy-link"
                              href={entry.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Buy →
                            </a>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SCG list prices (fallback reference) */}
              {prices && (
                <div className="card-prices card-prices--secondary">
                  <h4>SCG</h4>
                  {['normal', 'foil', 'arctic', 'sketch']
                    .filter((v) => supportedVariants.includes(v) && prices[v]?.price)
                    .map((v) => (
                      <div key={v} className="price-row">
                        <span className="variant-name">{VARIANT_LABELS[v]}:</span>
                        <span className="variant-price">{formatPrice(prices[v].price)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {onAdjustVariant && (
            <div className="modal-variants">
              <h4>Your Collection</h4>
              <div className="modal-variant-grid">
                {supportedVariants.map(v => (
                  <div key={v} className="modal-variant-row">
                    <span className={`modal-variant-label variant-label ${v}`}>{VARIANT_LABELS[v]}</span>
                    <div className="modal-variant-counter">
                      <button className="modal-variant-btn" onClick={() => onAdjustVariant(card.id, v, -1)}>−</button>
                      <span className={`modal-variant-count ${variants[v] > 0 ? 'has-cards' : ''}`}>{variants[v]}</span>
                      <button className="modal-variant-btn" onClick={() => onAdjustVariant(card.id, v, 1)}>+</button>
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
