import { VARIANTS } from '../hooks/useCollection';
import { usePrices } from '../hooks/usePrices';

const VARIANT_LABELS = { normal: 'Normal', foil: 'Foil', arctic: 'Arctic', sketch: 'Sketch' };

export default function CardModal({ card, variants, onClose, onAdjustVariant }) {
  const { getCardPrices, formatPrice } = usePrices();
  
  if (!card) return null;

  const cardText = card.cardText?.replace(/\|/g, '<br>').replace(/_([A-Z])_/g, '[$1]') || 'No card text';
  const prices = getCardPrices(card.id);

  return (
    <div className="modal-overlay active" onClick={(e) => {
      if (e.target.classList.contains('modal-overlay')) onClose();
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
                onError={(e) => {
                  e.target.outerHTML = `<div class="card-image-placeholder" style="aspect-ratio: 3/4; display: flex;"><span class="penguin-emoji">🐧</span><span>${card.name}</span></div>`;
                }}
              />
            </div>
            <div className="modal-card-details">
              <p><strong>Type:</strong> {card.type}</p>
              {card.cost && <p><strong>Cost:</strong> {card.cost.amount} Fish</p>}
              {card.vibe !== null && <p><strong>Vibe:</strong> {card.vibe}</p>}
              <p><strong>Rarity:</strong> {card.rarity}</p>
              <p><strong>Set:</strong> {card.set === 'Eth' ? 'Enter the Huddle' : 'Legend of the Lils'} #{card.setNumber || '?'}</p>
              <div className="card-text-box" dangerouslySetInnerHTML={{ __html: cardText }} />
              
              {/* SCG Prices */}
              {prices && (
                <div className="card-prices">
                  <h4>💰 SCG Prices</h4>
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
            </div>
          </div>

          {onAdjustVariant && (
            <div className="modal-variants">
              <h4>Your Collection</h4>
              <div className="modal-variant-grid">
                {VARIANTS.map(v => (
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
