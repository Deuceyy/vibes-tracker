import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDecks, validateDeck } from '../hooks/useDecks';
import { useCollection, cardData } from '../hooks/useCollection';
import Header from './Header';
import CardModal from './CardModal';

const COLORS = ['Red', 'Yellow', 'Green', 'Blue', 'Purple', 'Colorless'];
const TYPES = ['Penguin', 'Action', 'Relic', 'Rod'];

export default function DeckBuilder() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { saveDeck, getDeck } = useDecks();
  const { collection } = useCollection();
  
  const [deckName, setDeckName] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [deckCards, setDeckCards] = useState([]);
  const [isPublic, setIsPublic] = useState(true);
  const [search, setSearch] = useState('');
  const [colorFilter, setColorFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
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
      if (search && !card.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (colorFilter !== 'All' && !card.color?.includes(colorFilter)) return false;
      if (typeFilter !== 'All' && card.type !== typeFilter) return false;
      return true;
    });
  }, [search, colorFilter, typeFilter]);

  const validation = useMemo(() => validateDeck(deckCards), [deckCards]);

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
              placeholder="Search cards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)}>
              <option value="All">All Colors</option>
              {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="All">All Types</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
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
