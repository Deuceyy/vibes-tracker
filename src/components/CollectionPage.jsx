import { useState, useMemo } from 'react';
import { useCollection, cardData, VARIANTS } from '../hooks/useCollection';
import { usePrices } from '../hooks/usePrices';
import Header from './Header';
import CardModal from './CardModal';

const RARITY_ORDER = { 'Common': 1, 'Uncommon': 2, 'Rare': 3, 'Epic': 4 };
const SET_ORDER = { 'Eth': 1, 'Lotl': 2 };
const VARIANT_LABELS = { normal: 'N', foil: 'F', arctic: 'A', sketch: 'S' };

export default function CollectionPage() {
  const {
    loading,
    isOwnCollection,
    getCardVariants,
    adjustVariant,
    setVariantCount,
    getTotalOwned,
    hasPlayset,
    hasMasterSet,
    stats,
    importCollection,
    exportCollection,
    resetCollection
  } = useCollection();

  const { 
    getPrice, 
    formatPrice, 
    loading: pricesLoading,
    lastUpdated 
  } = usePrices();

  const [filters, setFilters] = useState({
    search: '',
    color: 'All',
    type: 'All',
    rarity: 'All',
    set: 'All',
    owned: 'All',
    variant: 'All',
    sort: 'set-asc'
  });

  const [selectedCard, setSelectedCard] = useState(null);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Calculate collection value by iterating through all cards
  const collectionValue = useMemo(() => {
    if (pricesLoading) return null;
    
    let total = 0;
    let breakdown = { normal: 0, foil: 0, arctic: 0, sketch: 0 };
    let cardCount = 0;
    let pricedCount = 0;
    
    cardData.forEach(card => {
      const variants = getCardVariants(card.id);
      
      ['normal', 'foil', 'arctic', 'sketch'].forEach(variant => {
        const count = variants[variant] || 0;
        if (count > 0) {
          cardCount += count;
          const price = getPrice(card.id, variant);
          if (price !== null) {
            const value = price * count;
            total += value;
            breakdown[variant] += value;
            pricedCount += count;
          }
        }
      });
    });
    
    return { 
      total, 
      breakdown, 
      cardCount,
      pricedCount,
      missingPrices: cardCount - pricedCount
    };
  }, [pricesLoading, getCardVariants, getPrice]);

  const filteredCards = useMemo(() => {
    let cards = cardData.filter(card => {
      if (filters.search && !card.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.color !== 'All' && card.color !== filters.color) return false;
      if (filters.type !== 'All' && !card.type.includes(filters.type)) return false;
      if (filters.rarity !== 'All' && card.rarity !== filters.rarity) return false;
      if (filters.set !== 'All' && card.set !== filters.set) return false;

      const variants = getCardVariants(card.id);
      const total = getTotalOwned(card.id);
      const isPlaysetComplete = hasPlayset(card.id);
      const isMasterComplete = hasMasterSet(card.id);

      switch (filters.owned) {
        case 'owned': if (total === 0) return false; break;
        case 'missing': if (total > 0) return false; break;
        case 'playset-incomplete': if (isPlaysetComplete) return false; break;
        case 'playset-complete': if (!isPlaysetComplete) return false; break;
        case 'master-incomplete': if (isMasterComplete) return false; break;
        case 'master-complete': if (!isMasterComplete) return false; break;
      }

      switch (filters.variant) {
        case 'normal': if (variants.normal === 0) return false; break;
        case 'foil': if (variants.foil === 0) return false; break;
        case 'arctic': if (variants.arctic === 0) return false; break;
        case 'sketch': if (variants.sketch === 0) return false; break;
        case 'missing-normal': if (variants.normal > 0) return false; break;
        case 'missing-foil': if (variants.foil > 0) return false; break;
        case 'missing-arctic': if (variants.arctic > 0) return false; break;
        case 'missing-sketch': if (variants.sketch > 0) return false; break;
      }

      return true;
    });

    const [field, dir] = filters.sort.split('-');
    const mult = dir === 'asc' ? 1 : -1;

    cards.sort((a, b) => {
      switch (field) {
        case 'name': return mult * a.name.localeCompare(b.name);
        case 'set': {
          // Sort by set first, then by set number
          const setDiff = (SET_ORDER[a.set] || 99) - (SET_ORDER[b.set] || 99);
          if (setDiff !== 0) return mult * setDiff;
          return mult * ((a.setNumber ?? 999) - (b.setNumber ?? 999));
        }
        case 'id': return mult * ((a.setNumber ?? 999) - (b.setNumber ?? 999));
        case 'owned': return mult * (getTotalOwned(a.id) - getTotalOwned(b.id));
        case 'cost': return mult * ((a.cost?.amount ?? 999) - (b.cost?.amount ?? 999));
        case 'vibe': return mult * ((a.vibe ?? 999) - (b.vibe ?? 999));
        case 'rarity': return mult * ((RARITY_ORDER[a.rarity] || 0) - (RARITY_ORDER[b.rarity] || 0));
        default: return 0;
      }
    });

    return cards;
  }, [filters, getCardVariants, getTotalOwned, hasPlayset, hasMasterSet]);

  const colorProgress = useMemo(() => {
    const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Colorless'];
    return colors.map(color => {
      const colorCards = cardData.filter(c => {
        if (c.color !== color) return false;
        if (filters.set !== 'All' && c.set !== filters.set) return false;
        return true;
      });
      const ownedCount = colorCards.filter(c => getTotalOwned(c.id) > 0).length;
      return { color, owned: ownedCount, total: colorCards.length };
    });
  }, [getTotalOwned, filters.set]);

  if (loading) {
    return <div className="loading">Loading collection...</div>;
  }

  return (
    <>
      <Header 
        stats={stats}
        onExport={exportCollection}
        onImport={importCollection}
        onReset={resetCollection}
        isOwnCollection={isOwnCollection}
      />
      
      <div className="container">
        {/* Collection Value Display */}
        {isOwnCollection && collectionValue && collectionValue.total > 0 && (
          <section className="collection-value">
            <div className="collection-value-header">
              <h3>💰 Collection Value</h3>
              {lastUpdated && (
                <span className="price-updated">
                  SCG prices from {lastUpdated.toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="collection-value-total">
              <span className="label">Total Value:</span>
              <span className="amount">{formatPrice(collectionValue.total)}</span>
            </div>
            <div className="collection-value-breakdown">
              {collectionValue.breakdown.normal > 0 && (
                <div className="breakdown-item">
                  <span>Normal:</span>
                  <span>{formatPrice(collectionValue.breakdown.normal)}</span>
                </div>
              )}
              {collectionValue.breakdown.foil > 0 && (
                <div className="breakdown-item">
                  <span>Foil:</span>
                  <span>{formatPrice(collectionValue.breakdown.foil)}</span>
                </div>
              )}
              {collectionValue.breakdown.arctic > 0 && (
                <div className="breakdown-item">
                  <span>Arctic:</span>
                  <span>{formatPrice(collectionValue.breakdown.arctic)}</span>
                </div>
              )}
              {collectionValue.breakdown.sketch > 0 && (
                <div className="breakdown-item">
                  <span>Sketch:</span>
                  <span>{formatPrice(collectionValue.breakdown.sketch)}</span>
                </div>
              )}
            </div>
            <div className="collection-value-stats">
              <span>{collectionValue.pricedCount} of {collectionValue.cardCount} cards priced</span>
              {collectionValue.missingPrices > 0 && (
                <span className="missing"> ({collectionValue.missingPrices} missing prices)</span>
              )}
            </div>
          </section>
        )}

        <section className="filters-section">
          <div className="filters-row">
            <div className="filter-group" style={{ flex: 2, minWidth: '200px' }}>
              <label className="filter-label">Search</label>
              <input
                type="text"
                className="search-input"
                placeholder="Search cards..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
              />
            </div>
            <div className="filter-group small">
              <label className="filter-label">Type</label>
              <select className="search-input" value={filters.type} onChange={(e) => updateFilter('type', e.target.value)}>
                <option value="All">All Types</option>
                <option value="Penguin">Penguin</option>
                <option value="Action">Action</option>
                <option value="Relic">Relic</option>
                <option value="Rod">Rod</option>
              </select>
            </div>
            <div className="filter-group small">
              <label className="filter-label">Rarity</label>
              <select className="search-input" value={filters.rarity} onChange={(e) => updateFilter('rarity', e.target.value)}>
                <option value="All">All Rarities</option>
                <option value="Common">Common</option>
                <option value="Uncommon">Uncommon</option>
                <option value="Rare">Rare</option>
                <option value="Epic">Epic</option>
              </select>
            </div>
            <div className="filter-group small">
              <label className="filter-label">Set</label>
              <select className="search-input" value={filters.set} onChange={(e) => updateFilter('set', e.target.value)}>
                <option value="All">All Sets</option>
                <option value="Eth">Enter the Huddle</option>
                <option value="Lotl">Legend of the Lils</option>
              </select>
            </div>
          </div>

          <div className="filters-row">
            <div className="filter-group small">
              <label className="filter-label">Collection</label>
              <select className="search-input" value={filters.owned} onChange={(e) => updateFilter('owned', e.target.value)}>
                <option value="All">All Cards</option>
                <option value="owned">Owned (Any)</option>
                <option value="missing">Missing (None)</option>
                <option value="playset-incomplete">Need for Playset</option>
                <option value="playset-complete">Playset Complete</option>
                <option value="master-incomplete">Need for Master</option>
                <option value="master-complete">Master Complete</option>
              </select>
            </div>
            <div className="filter-group small">
              <label className="filter-label">Variant</label>
              <select className="search-input" value={filters.variant} onChange={(e) => updateFilter('variant', e.target.value)}>
                <option value="All">All Variants</option>
                <option value="normal">Has Normal</option>
                <option value="foil">Has Foil</option>
                <option value="arctic">Has Arctic</option>
                <option value="sketch">Has Sketch</option>
                <option value="missing-normal">Missing Normal</option>
                <option value="missing-foil">Missing Foil</option>
                <option value="missing-arctic">Missing Arctic</option>
                <option value="missing-sketch">Missing Sketch</option>
              </select>
            </div>
            <div className="filter-group small">
              <label className="filter-label">Sort By</label>
              <select className="search-input" value={filters.sort} onChange={(e) => updateFilter('sort', e.target.value)}>
                <option value="set-asc">Set Order (ETH → LOTL)</option>
                <option value="set-desc">Set Order (LOTL → ETH)</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="id-asc">Set # (1-99)</option>
                <option value="id-desc">Set # (99-1)</option>
                <option value="owned-desc">Most Owned</option>
                <option value="owned-asc">Least Owned</option>
                <option value="cost-asc">Cost (Low-High)</option>
                <option value="cost-desc">Cost (High-Low)</option>
                <option value="vibe-asc">Vibe (Low-High)</option>
                <option value="vibe-desc">Vibe (High-Low)</option>
                <option value="rarity-asc">Rarity (C→E)</option>
                <option value="rarity-desc">Rarity (E→C)</option>
              </select>
            </div>
            <div className="filter-group" style={{ flex: 'none' }}>
              <label className="filter-label">Color</label>
              <div className="color-filters">
                {['All', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Colorless'].map(color => (
                  <button
                    key={color}
                    className={`color-pill ${filters.color === color ? 'active' : ''}`}
                    data-color={color}
                    onClick={() => updateFilter('color', color)}
                  >
                    {color === 'All' ? 'All' : 
                     color === 'Red' ? '🔴' :
                     color === 'Blue' ? '🔵' :
                     color === 'Green' ? '🟢' :
                     color === 'Yellow' ? '🟡' :
                     color === 'Purple' ? '🟣' : '⚪'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="progress-section">
          {colorProgress.map(({ color, owned, total }) => (
            <div key={color} className="progress-card">
              <div className="progress-header">
                <span className="progress-title" style={{ color: `var(--${color.toLowerCase()})` }}>{color}</span>
                <span className="progress-count">{owned} / {total}</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${total > 0 ? (owned / total) * 100 : 0}%`,
                    background: `var(--${color.toLowerCase()})`
                  }} 
                />
              </div>
            </div>
          ))}
        </section>

        {filteredCards.length === 0 ? (
          <div className="empty-state">
            <div className="penguin-emoji">🐧❄️</div>
            <h3>No cards found</h3>
            <p>Try adjusting your filters</p>
          </div>
        ) : (
          <section className="card-grid">
            {filteredCards.map(card => {
              const variants = getCardVariants(card.id);
              const total = getTotalOwned(card.id);
              const isPlaysetComplete = hasPlayset(card.id);
              const isMasterComplete = hasMasterSet(card.id);
              const normalPrice = getPrice(card.id, 'normal');

              let statusClass = '';
              if (isMasterComplete) statusClass = 'master-complete';
              else if (isPlaysetComplete) statusClass = 'playset-complete';
              else if (total > 0) statusClass = 'owned';

              return (
                <div key={card.id} className={`card-item ${statusClass}`}>
                  <div className="card-image-container" onClick={() => setSelectedCard(card)}>
                    <img 
                      className="card-image"
                      src={card.imageUrl}
                      alt={card.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                    <div className="card-image-placeholder" style={{ display: 'none' }}>
                      <span className="penguin-emoji">🐧</span>
                      <span>{card.name}</span>
                    </div>
                    <div className={`rarity-badge ${card.rarity}`} />
                    <div className={`color-stripe ${card.color}`} />
                    {normalPrice && (
                      <div className="card-price-badge">{formatPrice(normalPrice)}</div>
                    )}
                  </div>
                  <div className="card-info">
                    <div className="card-name" title={card.name}>{card.name}</div>
                    <div className="card-details">
                      <span>{card.type}</span>
                      <span>
                        {card.cost ? `🐟${card.cost.amount}` : ''}
                        {card.vibe !== null ? ` ✨${card.vibe}` : ''}
                      </span>
                    </div>
                    {isOwnCollection && (
                      <div className="variant-controls">
                        {VARIANTS.map(v => (
                          <div key={v} className="variant-row">
                            <span className={`variant-label ${v}`}>{VARIANT_LABELS[v]}</span>
                            <div className="variant-counter">
                              <button className="variant-btn" onClick={() => adjustVariant(card.id, v, -1)}>−</button>
                              <input
                                type="number"
                                className={`variant-input ${variants[v] > 0 ? 'has-cards' : ''}`}
                                value={variants[v]}
                                min="0"
                                max="99"
                                onChange={(e) => setVariantCount(card.id, v, parseInt(e.target.value) || 0)}
                                onClick={(e) => e.target.select()}
                              />
                              <button className="variant-btn" onClick={() => adjustVariant(card.id, v, 1)}>+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>

      {selectedCard && (
        <CardModal
          card={selectedCard}
          variants={getCardVariants(selectedCard.id)}
          onClose={() => setSelectedCard(null)}
          onAdjustVariant={isOwnCollection ? adjustVariant : null}
        />
      )}
    </>
  );
}
