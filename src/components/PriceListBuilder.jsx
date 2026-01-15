import { useState, useMemo } from 'react';
import { cardData } from '../hooks/useCollection';
import { usePrices } from '../hooks/usePrices';
import Header from './Header';

const VARIANTS = ['normal', 'foil', 'arctic', 'sketch'];
const VARIANT_LABELS = { normal: 'Normal', foil: 'Foil', arctic: 'Arctic', sketch: 'Sketch' };

export default function PriceListBuilder() {
  const { getPrice, getCardPrices, formatPrice } = usePrices();
  const [search, setSearch] = useState('');
  const [listItems, setListItems] = useState([]); // { cardId, variant, quantity }

  const filteredCards = useMemo(() => {
    if (!search) return [];
    return cardData.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 20);
  }, [search]);

  const addToList = (cardId, variant) => {
    setListItems(prev => {
      const existing = prev.find(i => i.cardId === cardId && i.variant === variant);
      if (existing) {
        return prev.map(i => 
          i.cardId === cardId && i.variant === variant 
            ? { ...i, quantity: Math.min(99, i.quantity + 1) }
            : i
        );
      }
      return [...prev, { cardId, variant, quantity: 1 }];
    });
    setSearch('');
  };

  const updateQuantity = (cardId, variant, qty) => {
    if (qty <= 0) {
      setListItems(prev => prev.filter(i => !(i.cardId === cardId && i.variant === variant)));
    } else {
      setListItems(prev => prev.map(i => 
        i.cardId === cardId && i.variant === variant ? { ...i, quantity: qty } : i
      ));
    }
  };

  const removeItem = (cardId, variant) => {
    setListItems(prev => prev.filter(i => !(i.cardId === cardId && i.variant === variant)));
  };

  const totalCost = useMemo(() => {
    let total = 0;
    let missing = 0;
    listItems.forEach(({ cardId, variant, quantity }) => {
      const price = getPrice(cardId, variant);
      if (price !== null) {
        total += price * quantity;
      } else {
        missing += quantity;
      }
    });
    return { total, missing };
  }, [listItems, getPrice]);

  const totalCards = listItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="app">
      <Header />
      <div className="container price-list-builder">
        <h1>💰 Price List Builder</h1>
        <p className="subtitle">Build a custom list with specific variants to calculate total cost</p>

        {/* Search & Add */}
        <div className="list-search-section">
          <input
            type="text"
            placeholder="Search cards to add..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          {filteredCards.length > 0 && (
            <div className="search-results">
              {filteredCards.map(card => {
                const prices = getCardPrices(card.id);
                return (
                  <div key={card.id} className="search-result-item">
                    <span className="result-name">{card.name}</span>
                    <div className="result-variants">
                      {VARIANTS.map(v => {
                        const price = prices?.[v]?.price;
                        if (!price) return null;
                        return (
                          <button 
                            key={v} 
                            className={`variant-add-btn ${v}`}
                            onClick={() => addToList(card.id, v)}
                          >
                            {VARIANT_LABELS[v]} {formatPrice(price)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* List */}
        <div className="price-list">
          {listItems.length === 0 ? (
            <div className="empty-list">Search and add cards above</div>
          ) : (
            <>
              <div className="list-header">
                <span>Card</span>
                <span>Variant</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Subtotal</span>
                <span></span>
              </div>
              {listItems.map(({ cardId, variant, quantity }) => {
                const card = cardData.find(c => c.id === cardId);
                const price = getPrice(cardId, variant);
                const subtotal = price !== null ? price * quantity : null;
                return (
                  <div key={`${cardId}-${variant}`} className="list-row">
                    <span className="list-card-name">{card?.name || cardId}</span>
                    <span className={`list-variant ${variant}`}>{VARIANT_LABELS[variant]}</span>
                    <input
                      type="number"
                      value={quantity}
                      min="1"
                      max="99"
                      onChange={(e) => updateQuantity(cardId, variant, parseInt(e.target.value) || 0)}
                      className="list-qty-input"
                    />
                    <span className="list-price">{formatPrice(price)}</span>
                    <span className="list-subtotal">{subtotal !== null ? formatPrice(subtotal) : '—'}</span>
                    <button className="list-remove" onClick={() => removeItem(cardId, variant)}>×</button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Total */}
        {listItems.length > 0 && (
          <div className="list-total">
            <div className="total-row">
              <span>Total Cards:</span>
              <span>{totalCards}</span>
            </div>
            <div className="total-row grand-total">
              <span>Total Cost:</span>
              <span>{formatPrice(totalCost.total)}</span>
            </div>
            {totalCost.missing > 0 && (
              <div className="total-missing">{totalCost.missing} cards missing price data</div>
            )}
            <button className="clear-list-btn" onClick={() => setListItems([])}>Clear List</button>
          </div>
        )}
      </div>
    </div>
  );
}
