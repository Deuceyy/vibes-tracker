import { useState, useEffect, useMemo } from 'react';
import { track } from '@vercel/analytics';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDecks, validateDeck } from '../hooks/useDecks';
import { useCollection, cardData } from '../hooks/useCollection';
import { usePrices } from '../hooks/usePrices';
import { TRACKER_CARD_TYPES, CHARACTER_SUBTYPES, ENABLE_SET3, getCanonicalCardType, getCharacterSubtypes } from '../lib/cardMetadata.js';
import Header from './Header';
import CardModal from './CardModal';

const COLORS = ['Red', 'Yellow', 'Green', 'Blue', 'Purple', 'Colorless'];
const TYPES = TRACKER_CARD_TYPES;
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic'];
const SETS = ENABLE_SET3
  ? [{ code: 'Eth', label: 'Enter the Huddle' }, { code: 'Lotl', label: 'Legend of the Lils' }, { code: 'S3', label: 'Birb and Pengu' }]
  : [{ code: 'Eth', label: 'Enter the Huddle' }, { code: 'Lotl', label: 'Legend of the Lils' }];

export default function DeckBuilder() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { saveDeck, getDeck } = useDecks();
  const { collection } = useCollection();
  const { getPrice, formatPrice } = usePrices();
  
  const [deckName, setDeckName] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [deckCards, setDeckCards] = useState([]);
  const [isPublic, setIsPublic] = useState(true);
  const [search, setSearch] = useState('');
  const [colorFilter, setColorFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [rarityFilter, setRarityFilter] = useState('All');
  const [setFilter, setSetFilter] = useState('All');
  const [costFilter, setCostFilter] = useState('All');
  const [vibeFilter, setVibeFilter] = useState([]); // multi-select; '?' = null
  const [subtypeFilter, setSubtypeFilter] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState('');

  const handleImportCode = () => {
    try {
      const data = JSON.parse(importCode);
      if (data.deckName) setDeckName(data.deckName);
      if (data.counts) {
        const cards = Object.entries(data.counts).map(([cardId, quantity]) => ({
          cardId,
          quantity
        }));
        setDeckCards(cards);
      }
      setShowImportModal(false);
      setImportCode('');
    } catch (err) {
      alert('Invalid deck code');
    }
  };

  // Load existing deck if editing
  useEffect(() => {
    if (deckId) {
      getDeck(deckId).then(deck => {
        if (deck) {
          setDeckName(deck.name);
          setDeckDescription(deck.description || '');
          setDeckCards(deck.cards || []);
          setIsPublic(deck.isPublic);
        }
      });
    }
  }, [deckId, getDeck]);

  const filteredCards = useMemo(() => {
    return cardData.filter(card => {
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${card.name || ''} ${card.cardText || ''} ${card.illustrator || ''} ${card.featuringPudgy || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (colorFilter !== 'All' && !card.color?.includes(colorFilter)) return false;
      if (typeFilter !== 'All' && getCanonicalCardType(card) !== typeFilter) return false;
      if (rarityFilter !== 'All' && card.rarity !== rarityFilter) return false;
      if (setFilter !== 'All' && card.set !== setFilter) return false;
      if (costFilter !== 'All') {
        const amount = card.cost?.amount;
        if (costFilter === 'none') {
          if (amount != null) return false;
        } else if (costFilter === '8+') {
          if (amount == null || amount < 8) return false;
        } else {
          if (amount !== Number(costFilter)) return false;
        }
      }
      if (vibeFilter.length > 0) {
        // Vibe only applies to Characters; non-characters never match.
        if (getCanonicalCardType(card) !== 'Character') return false;
        const v = card.vibe;
        const matches = vibeFilter.some((choice) => {
          if (choice === '?') return v == null;
          if (choice === '7+') return typeof v === 'number' && v >= 7;
          return v === Number(choice);
        });
        if (!matches) return false;
      }
      if (subtypeFilter.length > 0) {
        if (getCanonicalCardType(card) !== 'Character') return false;
        const cardSubs = getCharacterSubtypes(card);
        if (!subtypeFilter.some(s => cardSubs.includes(s))) return false;
      }
      return true;
    });
  }, [search, colorFilter, typeFilter, rarityFilter, setFilter, costFilter, vibeFilter, subtypeFilter]);

  const toggleSubtype = (subtype) => {
    setSubtypeFilter(prev =>
      prev.includes(subtype) ? prev.filter(s => s !== subtype) : [...prev, subtype]
    );
  };

  const toggleVibe = (choice) => {
    setVibeFilter(prev =>
      prev.includes(choice) ? prev.filter(v => v !== choice) : [...prev, choice]
    );
  };

  const validation = useMemo(() => validateDeck(deckCards), [deckCards]);

  // Calculate deck cost (normal prices)
  const deckCost = useMemo(() => {
    let total = 0;
    let missing = 0;
    deckCards.forEach(({ cardId, quantity }) => {
      const price = getPrice(cardId, 'normal');
      if (price !== null) {
        total += price * quantity;
      } else {
        missing += quantity;
      }
    });
    return { total, missing };
  }, [deckCards, getPrice]);

  const getCardQuantity = (cardId) => {
    const entry = deckCards.find(c => c.cardId === cardId);
    return entry?.quantity || 0;
  };

  const adjustCard = (cardId, delta) => {
    setDeckCards(prev => {
      const existing = prev.find(c => c.cardId === cardId);
      if (existing) {
        const newQty = Math.max(0, Math.min(4, existing.quantity + delta));
        if (newQty === 0) {
          return prev.filter(c => c.cardId !== cardId);
        }
        return prev.map(c => c.cardId === cardId ? { ...c, quantity: newQty } : c);
      } else if (delta > 0) {
        return [...prev, { cardId, quantity: 1 }];
      }
      return prev;
    });
  };

  const handleSave = async () => {
    if (!user) {
      alert('Please sign in to save decks');
      return;
    }
    if (!deckName.trim()) {
      alert('Please enter a deck name');
      return;
    }
    setSaving(true);
    try {
      const id = await saveDeck({
        name: deckName.trim(),
        description: deckDescription.trim(),
        cards: deckCards,
        isPublic
      }, deckId);
      track('deck_saved', {
        is_new: !deckId,
        is_public: !!isPublic,
        card_count: deckCards.reduce((s, c) => s + c.quantity, 0),
        unique_cards: deckCards.length,
      });
      navigate(`/deck/${id}`);
    } catch (err) {
      alert('Error saving deck: ' + err.message);
    }
    setSaving(false);
  };

  const deckByColor = useMemo(() => {
    const grouped = {};
    deckCards.forEach(({ cardId, quantity }) => {
      const card = cardData.find(c => c.id === cardId);
      if (!card) return;
      const color = card.color?.split(', ')[0] || 'Colorless';
      if (!grouped[color]) grouped[color] = [];
      grouped[color].push({ card, quantity });
    });
    return grouped;
  }, [deckCards]);

  return (
    <div className="app">
      <Header />
      <div className="deck-builder">
        <div className="deck-builder-cards">
          <div className="filters-bar">
            <input
              type="text"
              placeholder="Search name, card text, artist, or featured NFT #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
              style={{ flex: '1 1 240px', minWidth: 200 }}
            />
            <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)}>
              <option value="All">All Colors</option>
              {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="All">All Types</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}>
              <option value="All">All Rarities</option>
              {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={setFilter} onChange={(e) => setSetFilter(e.target.value)}>
              <option value="All">All Sets</option>
              {SETS.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
            </select>
            <select value={costFilter} onChange={(e) => setCostFilter(e.target.value)}>
              <option value="All">Any Cost</option>
              {[0,1,2,3,4,5,6,7].map(n => <option key={n} value={String(n)}>Cost {n}</option>)}
              <option value="8+">Cost 8+</option>
              <option value="none">No cost</option>
            </select>
            {(typeFilter === 'All' || typeFilter === 'Character') && (
              <div className="set3-filter-chips" style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {CHARACTER_SUBTYPES.map(subtype => (
                  <button
                    key={subtype}
                    type="button"
                    className={`set3-filter-chip ${subtypeFilter.includes(subtype) ? 'active' : ''}`}
                    onClick={() => toggleSubtype(subtype)}
                  >
                    {subtype}
                  </button>
                ))}
              </div>
            )}
            {(typeFilter === 'All' || typeFilter === 'Character') && (
              <div
                className="set3-filter-chips"
                style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}
                title="Filter by character vibe — multi-select"
              >
                <span style={{ alignSelf: 'center', fontSize: '0.75rem', opacity: 0.7, marginRight: 4 }}>
                  Vibe:
                </span>
                {['0','1','2','3','4','5','6','7+','?'].map(choice => (
                  <button
                    key={choice}
                    type="button"
                    className={`set3-filter-chip ${vibeFilter.includes(choice) ? 'active' : ''}`}
                    onClick={() => toggleVibe(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            )}
            {(search || colorFilter !== 'All' || typeFilter !== 'All' || rarityFilter !== 'All' || setFilter !== 'All' || costFilter !== 'All' || vibeFilter.length > 0 || subtypeFilter.length > 0) && (
              <button
                type="button"
                className="import-code-btn"
                onClick={() => {
                  setSearch('');
                  setColorFilter('All');
                  setTypeFilter('All');
                  setRarityFilter('All');
                  setSetFilter('All');
                  setCostFilter('All');
                  setVibeFilter([]);
                  setSubtypeFilter([]);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="card-grid deck-builder-grid">
            {filteredCards.map(card => {
              const qty = getCardQuantity(card.id);
              return (
                <div key={card.id} className={`card-item ${qty > 0 ? 'in-deck' : ''}`}>
                  <div className="card-image-container" onClick={() => setSelectedCard(card)}>
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt={card.name} className="card-image" loading="lazy" />
                    ) : (
                      <div className="card-placeholder">{card.name}</div>
                    )}
                    {qty > 0 && <div className="deck-qty-badge">{qty}</div>}
                  </div>
                  <div className="card-name">{card.name}</div>
                  <div className="deck-card-controls">
                    <button onClick={() => adjustCard(card.id, -1)} disabled={qty === 0}>−</button>
                    <span>{qty}</span>
                    <button onClick={() => adjustCard(card.id, 1)} disabled={qty >= 4}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="deck-builder-sidebar">
          <div className="deck-meta">
            <input
              type="text"
              placeholder="Deck Name"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              className="deck-name-input"
            />
            <textarea
              placeholder="Description (optional)"
              value={deckDescription}
              onChange={(e) => setDeckDescription(e.target.value)}
              className="deck-desc-input"
            />
            <div className="deck-meta-row">
              <label className="public-toggle">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                Public deck
              </label>
              <button className="import-code-btn" onClick={() => setShowImportModal(true)}>
                Import Code
              </button>
            </div>
          </div>

          <div className={`deck-count ${validation.valid ? 'valid' : 'invalid'}`}>
            {validation.totalCards}/52 cards
          </div>
          
          {/* Deck Cost */}
          {deckCards.length > 0 && (
            <div className="deck-cost">
              <span className="deck-cost-label">💰 Deck Cost:</span>
              <span className="deck-cost-amount">{formatPrice(deckCost.total)}</span>
              {deckCost.missing > 0 && <span className="deck-cost-missing">({deckCost.missing} unpriced)</span>}
            </div>
          )}

          {validation.errors.length > 0 && (
            <div className="deck-errors">
              {validation.errors.map((err, i) => <div key={i}>{err}</div>)}
            </div>
          )}

          <div className="deck-list">
            {Object.entries(deckByColor).map(([color, cards]) => (
              <div key={color} className="deck-color-group">
                <div className="deck-color-header">{color} ({cards.reduce((s, c) => s + c.quantity, 0)})</div>
                {cards.sort((a, b) => a.card.name.localeCompare(b.card.name)).map(({ card, quantity }) => (
                  <div key={card.id} className="deck-list-item">
                    <span className="deck-list-qty">{quantity}x</span>
                    <span className="deck-list-name" onClick={() => setSelectedCard(card)}>{card.name}</span>
                    <button className="deck-list-remove" onClick={() => adjustCard(card.id, -1)}>×</button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="deck-actions">
            <button onClick={handleSave} disabled={saving || !validation.valid} className="save-deck-btn">
              {saving ? 'Saving...' : (deckId ? 'Update Deck' : 'Save Deck')}
            </button>
            <button onClick={() => navigate('/decks')} className="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>

      {selectedCard && (
        <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} viewOnly />
      )}

      {showImportModal && (
        <div className="modal-overlay active" onClick={(e) => {
          if (e.target.classList.contains('modal-overlay')) setShowImportModal(false);
        }}>
          <div className="modal import-modal">
            <div className="modal-header">
              <h2 className="modal-title">Import Deck Code</h2>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <textarea
                placeholder='Paste deck code here...'
                value={importCode}
                onChange={(e) => setImportCode(e.target.value)}
                className="import-textarea"
              />
              <div className="import-actions">
                <button onClick={handleImportCode} className="save-deck-btn">Import</button>
                <button onClick={() => setShowImportModal(false)} className="cancel-btn">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
