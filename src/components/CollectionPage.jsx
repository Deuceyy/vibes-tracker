import { useMemo, useState } from 'react';
import { useCollection, cardData } from '../hooks/useCollection';
import { usePrices } from '../hooks/usePrices';
import {
  CHARACTER_SUBTYPES,
  ENABLE_SET3,
  TRACKER_CARD_TYPES,
  getCanonicalCardType,
  getCharacterSubtypes,
  getSupportedVariants
} from '../lib/cardMetadata.js';
import Header from './Header';
import CardModal from './CardModal';

const RARITY_ORDER = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4 };
const SET_ORDER = { Eth: 1, Lotl: 2, S3: 3 };
const VARIANT_LABELS = { normal: 'N', foil: 'F', arctic: 'A', sketch: 'S' };
const VARIANT_FILTERS = {
  normal: { variant: 'normal', mode: 'has' },
  arctic: { variant: 'arctic', mode: 'has' },
  sketch: { variant: 'sketch', mode: 'has' },
  'missing-normal': { variant: 'normal', mode: 'missing' },
  'missing-arctic': { variant: 'arctic', mode: 'missing' },
  'missing-sketch': { variant: 'sketch', mode: 'missing' }
};

function getCardTypeLine(card) {
  const baseType = getCanonicalCardType(card);
  const subtypes = getCharacterSubtypes(card);
  return subtypes.length > 0 ? `${baseType} - ${subtypes.join(', ')}` : baseType;
}

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
    subtypes: [],
    rarity: 'All',
    set: 'All',
    cost: 'All',
    owned: 'All',
    variant: 'All',
    sort: 'set-asc'
  });
  const [selectedCard, setSelectedCard] = useState(null);
  const [highlightMissingPrices, setHighlightMissingPrices] = useState(false);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSubtype = (subtype) => {
    setFilters((prev) => ({
      ...prev,
      subtypes: prev.subtypes.includes(subtype)
        ? prev.subtypes.filter((entry) => entry !== subtype)
        : [...prev.subtypes, subtype]
    }));
  };

  const collectionValue = useMemo(() => {
    if (pricesLoading) return null;

    let total = 0;
    const breakdown = { normal: 0, foil: 0, arctic: 0, sketch: 0 };
    let cardCount = 0;
    let pricedCount = 0;

    cardData.forEach((card) => {
      const variants = getCardVariants(card.id);
      getSupportedVariants(card).forEach((variant) => {
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

  const missingPriceCount = useMemo(() => {
    if (pricesLoading) return 0;
    return cardData.filter((card) => getPrice(card.id, 'normal') === null).length;
  }, [pricesLoading, getPrice]);

  const filteredCards = useMemo(() => {
    const cards = cardData.filter((card) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const haystack = `${card.name || ''} ${card.cardText || ''} ${card.illustrator || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.color !== 'All' && card.color !== filters.color) return false;
      if (filters.type !== 'All' && getCanonicalCardType(card) !== filters.type) return false;
      if (filters.rarity !== 'All' && card.rarity !== filters.rarity) return false;
      if (filters.set !== 'All' && card.set !== filters.set) return false;
      if (filters.cost !== 'All') {
        const amount = card.cost?.amount;
        if (filters.cost === 'none') {
          if (amount != null) return false;
        } else if (filters.cost === '8+') {
          if (amount == null || amount < 8) return false;
        } else {
          if (amount !== Number(filters.cost)) return false;
        }
      }

      const cardSubtypes = getCharacterSubtypes(card);
      if (filters.subtypes.length > 0) {
        if (getCanonicalCardType(card) !== 'Character') return false;
        if (!filters.subtypes.some((subtype) => cardSubtypes.includes(subtype))) return false;
      }

      const variants = getCardVariants(card.id);
      const supportedVariants = getSupportedVariants(card);
      const total = getTotalOwned(card.id);
      const isPlaysetComplete = hasPlayset(card.id);
      const isMasterComplete = hasMasterSet(card.id);

      switch (filters.owned) {
        case 'owned':
          if (total === 0) return false;
          break;
        case 'missing':
          if (total > 0) return false;
          break;
        case 'playset-incomplete':
          if (isPlaysetComplete) return false;
          break;
        case 'playset-complete':
          if (!isPlaysetComplete) return false;
          break;
        case 'master-incomplete':
          if (isMasterComplete) return false;
          break;
        case 'master-complete':
          if (!isMasterComplete) return false;
          break;
        default:
          break;
      }

      const variantFilter = VARIANT_FILTERS[filters.variant];
      if (variantFilter) {
        const { variant, mode } = variantFilter;
        if (!supportedVariants.includes(variant)) return false;
        const count = variants[variant] || 0;
        if (mode === 'has' && count === 0) return false;
        if (mode === 'missing' && count > 0) return false;
      }

      return true;
    });

    const [field, dir] = filters.sort.split('-');
    const mult = dir === 'asc' ? 1 : -1;

    cards.sort((a, b) => {
      switch (field) {
        case 'name':
          return mult * a.name.localeCompare(b.name);
        case 'set': {
          const setDiff = (SET_ORDER[a.set] || 99) - (SET_ORDER[b.set] || 99);
          if (setDiff !== 0) return mult * setDiff;
          return mult * ((a.setNumber ?? 999) - (b.setNumber ?? 999));
        }
        case 'id':
          return mult * ((a.setNumber ?? 999) - (b.setNumber ?? 999));
        case 'owned':
          return mult * (getTotalOwned(a.id) - getTotalOwned(b.id));
        case 'cost':
          return mult * ((a.cost?.amount ?? 999) - (b.cost?.amount ?? 999));
        case 'vibe':
          return mult * ((a.vibe ?? 999) - (b.vibe ?? 999));
        case 'rarity':
          return mult * ((RARITY_ORDER[a.rarity] || 0) - (RARITY_ORDER[b.rarity] || 0));
        default:
          return 0;
      }
    });

    return cards;
  }, [filters, getCardVariants, getTotalOwned, hasPlayset, hasMasterSet]);

  const colorProgress = useMemo(() => {
    const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Colorless'];
    return colors.map((color) => {
      const colorCards = cardData.filter((card) => {
        if (card.color !== color) return false;
        if (filters.set !== 'All' && card.set !== filters.set) return false;
        return true;
      });
      const ownedCount = colorCards.filter((card) => getTotalOwned(card.id) > 0).length;
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
        {isOwnCollection && collectionValue && collectionValue.total > 0 && (
          <section className="collection-value">
            <div className="collection-value-header">
              <h3>Collection Value</h3>
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
              {Object.entries(collectionValue.breakdown).map(([variant, value]) => (
                value > 0 ? (
                  <div key={variant} className="breakdown-item">
                    <span className={`variant-label ${variant}`}>{VARIANT_LABELS[variant]}</span>
                    <span>{formatPrice(value)}</span>
                  </div>
                ) : null
              ))}
            </div>
            {collectionValue.missingPrices > 0 && (
              <div className="missing-prices-note">
                {collectionValue.missingPrices} card{collectionValue.missingPrices !== 1 ? 's' : ''} missing price data
              </div>
            )}
          </section>
        )}

        <section className="filters-section">
          <div className="filters-row">
            <div className="filter-group">
              <label className="filter-label">Search</label>
              <input
                type="text"
                className="search-input"
                placeholder="Search name, card text, or artist..."
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
              />
            </div>
            <div className="filter-group small">
              <label className="filter-label">Type</label>
              <select className="search-input" value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
                <option value="All">All Types</option>
                {TRACKER_CARD_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="filter-group small">
              <label className="filter-label">Rarity</label>
              <select className="search-input" value={filters.rarity} onChange={(event) => updateFilter('rarity', event.target.value)}>
                <option value="All">All Rarities</option>
                <option value="Common">Common</option>
                <option value="Uncommon">Uncommon</option>
                <option value="Rare">Rare</option>
                <option value="Epic">Epic</option>
              </select>
            </div>
            <div className="filter-group small">
              <label className="filter-label">Set</label>
              <select className="search-input" value={filters.set} onChange={(event) => updateFilter('set', event.target.value)}>
                <option value="All">All Sets</option>
                <option value="Eth">Enter the Huddle</option>
                <option value="Lotl">Legend of the Lils</option>
                {ENABLE_SET3 && <option value="S3">Birb and Pengu</option>}
              </select>
            </div>
            <div className="filter-group small">
              <label className="filter-label">Cost</label>
              <select className="search-input" value={filters.cost} onChange={(event) => updateFilter('cost', event.target.value)}>
                <option value="All">Any Cost</option>
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8+">8+</option>
                <option value="none">No cost</option>
              </select>
            </div>
          </div>

          <div className="filters-row">
            <div className="filter-group">
              <label className="filter-label">Character Subtypes</label>
              <div className="set3-filter-chips">
                {CHARACTER_SUBTYPES.map((subtype) => (
                  <button
                    key={subtype}
                    type="button"
                    className={`set3-filter-chip ${filters.subtypes.includes(subtype) ? 'active' : ''}`}
                    onClick={() => toggleSubtype(subtype)}
                  >
                    {subtype}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="filters-row">
            <div className="filter-group small">
              <label className="filter-label">Collection</label>
              <select className="search-input" value={filters.owned} onChange={(event) => updateFilter('owned', event.target.value)}>
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
              <select className="search-input" value={filters.variant} onChange={(event) => updateFilter('variant', event.target.value)}>
                <option value="All">All Variants</option>
                <option value="normal">Has Normal</option>
                <option value="arctic">Has Arctic (Set 2 only)</option>
                <option value="sketch">Has Sketch (Sets 1 & 2)</option>
                <option value="missing-normal">Missing Normal</option>
                <option value="missing-arctic">Missing Arctic (Set 2 only)</option>
                <option value="missing-sketch">Missing Sketch (Sets 1 & 2)</option>
              </select>
            </div>
            <div className="filter-group small">
              <label className="filter-label">Sort By</label>
              <select className="search-input" value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)}>
                <option value="set-asc">Set Order (ETH -&gt; LOTL)</option>
                <option value="set-desc">Set Order (LOTL -&gt; ETH)</option>
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
                <option value="rarity-asc">Rarity (C-&gt;E)</option>
                <option value="rarity-desc">Rarity (E-&gt;C)</option>
              </select>
            </div>
            <div className="filter-group" style={{ flex: 'none' }}>
              <label className="filter-label">Color</label>
              <div className="color-filters">
                {['All', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Colorless'].map((color) => (
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

          {missingPriceCount > 0 && (
            <div className="filters-row">
              <label className="filter-toggle">
                <input
                  type="checkbox"
                  checked={highlightMissingPrices}
                  onChange={(event) => setHighlightMissingPrices(event.target.checked)}
                />
                <span>Highlight Missing Prices ({missingPriceCount} cards)</span>
              </label>
            </div>
          )}
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
            <div className="penguin-emoji">Penguin</div>
            <h3>No cards found</h3>
            <p>Try adjusting your filters.</p>
          </div>
        ) : (
          <section className="card-grid">
            {filteredCards.map((card) => {
              const variants = getCardVariants(card.id);
              const supportedVariants = getSupportedVariants(card);
              const total = getTotalOwned(card.id);
              const isPlaysetComplete = hasPlayset(card.id);
              const isMasterComplete = hasMasterSet(card.id);
              const normalPrice = getPrice(card.id, 'normal');
              const hasMissingPrice = normalPrice === null;

              let statusClass = '';
              if (isMasterComplete) statusClass = 'master-complete';
              else if (isPlaysetComplete) statusClass = 'playset-complete';
              else if (total > 0) statusClass = 'owned';

              const missingPriceClass = highlightMissingPrices && hasMissingPrice ? 'missing-price' : '';

              return (
                <div key={card.id} className={`card-item ${statusClass} ${missingPriceClass}`}>
                  <div className="card-image-container" onClick={() => setSelectedCard(card)}>
                    <img
                      className="card-image"
                      src={card.imageUrl}
                      alt={card.name}
                      onError={(event) => {
                        event.target.style.display = 'none';
                        event.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                    <div className="card-image-placeholder" style={{ display: 'none' }}>
                      <span className="penguin-emoji">Penguin</span>
                      <span>{card.name}</span>
                    </div>
                    <div className={`rarity-badge ${card.rarity}`} />
                    <div className={`color-stripe ${card.color}`} />
                    {normalPrice && <div className="card-price-badge">{formatPrice(normalPrice)}</div>}
                  </div>
                  <div className="card-info">
                    <div className="card-name" title={card.name}>{card.name}</div>
                    <div className="card-details">
                      <span>{getCardTypeLine(card)}</span>
                      <span>
                        {card.cost ? `${card.cost.amount} cost` : ''}
                        {card.vibe !== null ? `${card.cost ? ' ' : ''}${card.vibe} vibe` : ''}
                      </span>
                    </div>
                    {isOwnCollection && (
                      <div className="variant-controls">
                        {supportedVariants.map((variant) => (
                          <div key={variant} className="variant-row">
                            <span className={`variant-label ${variant}`}>{VARIANT_LABELS[variant]}</span>
                            <div className="variant-counter">
                              <button className="variant-btn" onClick={() => adjustVariant(card.id, variant, -1)}>-</button>
                              <input
                                type="number"
                                className={`variant-input ${variants[variant] > 0 ? 'has-cards' : ''}`}
                                value={variants[variant]}
                                min="0"
                                max="99"
                                onChange={(event) => setVariantCount(card.id, variant, parseInt(event.target.value, 10) || 0)}
                                onClick={(event) => event.target.select()}
                              />
                              <button className="variant-btn" onClick={() => adjustVariant(card.id, variant, 1)}>+</button>
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
