import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDecks } from '../hooks/useDecks';
import { usePrices } from '../hooks/usePrices';
import Header from './Header';

const COLOR_CLASSES = {
  Red: 'color-red',
  Yellow: 'color-yellow', 
  Green: 'color-green',
  Blue: 'color-blue',
  Purple: 'color-purple',
  Colorless: 'color-gray'
};

export default function DecksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { publicDecks, myDecks, loading, deleteDeck, toggleUpvote } = useDecks();
  const { calculateDeckCost, formatPrice } = usePrices();
  const [tab, setTab] = useState('popular');
  const [colorFilter, setColorFilter] = useState('All');
  const [sort, setSort] = useState('popular');
  const [search, setSearch] = useState('');

  const handleDelete = async (deckId, deckName) => {
    if (confirm(`Delete "${deckName}"?`)) {
      await deleteDeck(deckId);
    }
  };

  const filteredDecks = useMemo(() => {
    const base = tab === 'mine' ? myDecks : publicDecks;
    const q = search.trim().toLowerCase();
    const list = base.filter(deck => {
      if (colorFilter !== 'All' && !deck.colors?.includes(colorFilter)) return false;
      if (q) {
        const hay = `${deck.name || ''} ${deck.username || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const ts = (deck) => {
      const value = deck.createdAt || deck.updatedAt;
      return value ? new Date(value).getTime() : 0;
    };

    const sorted = [...list];
    if (sort === 'newest') {
      sorted.sort((a, b) => ts(b) - ts(a));
    } else if (sort === 'oldest') {
      sorted.sort((a, b) => ts(a) - ts(b));
    } else if (sort === 'views') {
      sorted.sort((a, b) => (b.views || 0) - (a.views || 0) || ts(b) - ts(a));
    } else {
      sorted.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0) || ts(b) - ts(a));
    }
    return sorted;
  }, [tab, myDecks, publicDecks, colorFilter, search, sort]);

  const DeckCard = ({ deck, showActions }) => (
    <div className="deck-card">
      <Link to={`/deck/${deck.id}`} className="deck-card-link">
        <div className="deck-card-colors">
          {deck.colors?.map(c => (
            <span key={c} className={`color-dot ${COLOR_CLASSES[c] || ''}`} title={c} />
          ))}
        </div>
        <h3 className="deck-card-name">{deck.name}</h3>
        <div className="deck-card-meta">
          <span>by {deck.username}</span>
          <span>{deck.cards?.reduce((s, c) => s + c.quantity, 0) || 0} cards</span>
          {(() => {
            const { total } = calculateDeckCost(deck);
            return total > 0 ? <span className="deck-price-tag">~{formatPrice(total)}</span> : null;
          })()}
        </div>
      </Link>
      <div className="deck-card-footer">
        <button 
          className={`upvote-btn ${deck.upvotedBy?.includes(user?.uid) ? 'upvoted' : ''}`}
          onClick={() => toggleUpvote(deck.id)}
          disabled={!user}
        >
          ▲ {deck.upvotes || 0}
        </button>
        <button className="upvote-btn" disabled title="Views">
          👁 {deck.views || 0}
        </button>
        {showActions && (
          <div className="deck-card-actions">
            <button onClick={() => navigate(`/builder/${deck.id}`)}>Edit</button>
            <button onClick={() => handleDelete(deck.id, deck.name)}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="app">
      <Header />
      <div className="decks-page">
        <div className="decks-header">
          <h1>Decks</h1>
          <button onClick={() => navigate('/builder')} className="new-deck-btn">
            + New Deck
          </button>
        </div>

        <div className="decks-toolbar">
          <div className="decks-tabs">
            <button className={tab === 'popular' ? 'active' : ''} onClick={() => setTab('popular')}>
              Browse
            </button>
            {user && (
              <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>
                My Decks ({myDecks.length})
              </button>
            )}
          </div>
          <input
            type="text"
            className="search-input decks-search"
            placeholder="Search decks by name or author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="color-filter-select"
          >
            <option value="popular">Most Popular</option>
            <option value="views">Most Viewed</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
            className="color-filter-select"
          >
            <option value="All">All Colors</option>
            <option value="Red">Red</option>
            <option value="Yellow">Yellow</option>
            <option value="Green">Green</option>
            <option value="Blue">Blue</option>
            <option value="Purple">Purple</option>
            <option value="Colorless">Colorless</option>
          </select>
          {(search || colorFilter !== 'All' || sort !== 'popular') && (
            <button
              type="button"
              className="decks-clear-btn"
              onClick={() => { setSearch(''); setColorFilter('All'); setSort('popular'); }}
            >
              Clear
            </button>
          )}
        </div>
        <div className="decks-result-count">
          {filteredDecks.length} deck{filteredDecks.length === 1 ? '' : 's'}
        </div>

        {loading ? (
          <div className="loading">Loading decks...</div>
        ) : filteredDecks.length === 0 ? (
          <div className="no-decks">
            {tab === 'mine' ? 'You haven\'t created any decks yet.' : 'No decks found.'}
          </div>
        ) : (
          <div className="decks-grid">
            {filteredDecks.map(deck => (
              <DeckCard key={deck.id} deck={deck} showActions={tab === 'mine'} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
