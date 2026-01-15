import { usePrices } from '../hooks/usePrices';
import { useCollection } from '../hooks/useCollection';

/**
 * Displays the total value of the user's collection
 * Add this component to CollectionPage.jsx
 */
export function CollectionValue() {
  const { calculateCollectionValue, formatPrice, loading: pricesLoading, lastUpdated } = usePrices();
  const { collection, loading: collectionLoading } = useCollection();

  if (pricesLoading || collectionLoading) {
    return <div className="collection-value loading">Loading prices...</div>;
  }

  const { total, breakdown, cardCount, pricedCount, missingPrices } = calculateCollectionValue(collection);

  return (
    <div className="collection-value">
      <div className="collection-value-header">
        <h3>Collection Value</h3>
        {lastUpdated && (
          <span className="price-updated">
            Prices from {lastUpdated.toLocaleDateString()}
          </span>
        )}
      </div>
      
      <div className="collection-value-total">
        <span className="label">Total Value:</span>
        <span className="amount">{formatPrice(total)}</span>
      </div>
      
      <div className="collection-value-breakdown">
        {breakdown.normal > 0 && (
          <div className="breakdown-item">
            <span>Normal:</span>
            <span>{formatPrice(breakdown.normal)}</span>
          </div>
        )}
        {breakdown.foil > 0 && (
          <div className="breakdown-item">
            <span>Foil:</span>
            <span>{formatPrice(breakdown.foil)}</span>
          </div>
        )}
        {breakdown.arctic > 0 && (
          <div className="breakdown-item">
            <span>Arctic:</span>
            <span>{formatPrice(breakdown.arctic)}</span>
          </div>
        )}
        {breakdown.sketch > 0 && (
          <div className="breakdown-item">
            <span>Sketch:</span>
            <span>{formatPrice(breakdown.sketch)}</span>
          </div>
        )}
      </div>
      
      <div className="collection-value-stats">
        <span>{pricedCount} of {cardCount} cards priced</span>
        {missingPrices > 0 && (
          <span className="missing">({missingPrices} missing prices)</span>
        )}
      </div>
    </div>
  );
}

/**
 * Inline price display for individual cards
 * Use: <CardPrice cardId="LilMoonlight" variant="foil" />
 */
export function CardPrice({ cardId, variant = 'normal', showVariant = false }) {
  const { getPrice, formatPrice } = usePrices();
  const price = getPrice(cardId, variant);
  
  if (price === null) return null;
  
  return (
    <span className="card-price">
      {showVariant && <span className="variant">{variant}: </span>}
      {formatPrice(price)}
    </span>
  );
}

/**
 * Shows all variant prices for a card
 * Use in CardModal or card details view
 */
export function CardPriceDetails({ cardId }) {
  const { getCardPrices, formatPrice } = usePrices();
  const prices = getCardPrices(cardId);
  
  if (!prices) {
    return <div className="card-prices">No price data available</div>;
  }
  
  const variants = ['normal', 'foil', 'arctic', 'sketch'];
  const availableVariants = variants.filter(v => prices[v]?.price);
  
  if (availableVariants.length === 0) {
    return <div className="card-prices">No price data available</div>;
  }
  
  return (
    <div className="card-prices">
      <h4>SCG Prices</h4>
      {availableVariants.map(variant => (
        <div key={variant} className="price-row">
          <span className="variant-name">{variant.charAt(0).toUpperCase() + variant.slice(1)}:</span>
          <span className="variant-price">{formatPrice(prices[variant].price)}</span>
        </div>
      ))}
    </div>
  );
}

export default CollectionValue;
