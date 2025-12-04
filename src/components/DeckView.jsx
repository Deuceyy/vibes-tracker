import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDecks } from '../hooks/useDecks';
import { cardData } from '../hooks/useCollection';
import Header from './Header';
import CardModal from './CardModal';

export default function DeckView() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getDeck, toggleUpvote, saveDeck } = useDecks();
  
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    getDeck(deckId).then(d => {
      setDeck(d);
      setLoading(false);
    });
  }, [deckId, getDeck]);

  const deckByColor = useMemo(() => {
    if (!deck?.cards) return {};
    const grouped = {};
    deck.cards.forEach(({ cardId, quantity }) => {
      const card = cardData.find(c => c.id === cardId);
      if (!card) return;
      const color = card.color?.split(', ')[0] || 'Colorless';
      if (!grouped[color]) grouped[color] = [];
      grouped[color].push({ card, quantity });
    });
    return grouped;
  }, [deck]);

  const handleCopy = async () => {
    if (!user) {
      alert('Please sign in to copy decks');
      return;
    }
    const newId = await saveDeck({
      name: deck.name + ' (Copy)',
      description: deck.description,
      cards: deck.cards,
      isPublic: false
    });
    navigate(`/builder/${newId}`);
  };

  const exportDeckCode = () => {
    const counts = {};
    deck.cards.forEach(({ cardId, quantity }) => {
      counts[cardId] = quantity;
    });
    const deckCode = JSON.stringify({
      deckName: deck.name,
      counts
    });
    navigator.clipboard.writeText(deckCode);
    alert('Deck code copied to clipboard!');
  };

  const handleUpvote = async () => {
    await toggleUpvote(deckId);
    setDeck(await getDeck(deckId));
  };

  if (loading) return <div className="app"><Header /><div className="loading">Loading deck...</div></div>;
  if (!deck) return <div className="app"><Header /><div className="not-found">Deck not found</div></div>;

  const isOwner = user?.uid === deck.userId;
  const hasUpvoted = deck.upvotedBy?.includes(user?.uid);
  const totalCards = deck.cards?.reduce((s, c) => s + c.quantity, 0) || 0;

  return (
    <div className="app">
      <Header />
      <div className="deck-view">
        <div className="deck-view-header">
          <div className="deck-view-info">
            <h1>{deck.name}</h1>
            <div className="deck-view-meta">
              <span>by <Link to={`/u/${deck.username}`}>{deck.username}</Link></span>
              <span>{totalCards} cards</span>
              <span className="deck-colors">
                {deck.colors?.map(c => (
                  <span key={c} className={`color-badge color-${c.toLowerCase()}`}>{c}</span>
                ))}
              </span>
            </div>
            {deck.description && <p className="deck-description">{deck.description}</p>}
          </div>
          <div className="deck-view-actions">
            <button 
              className={`upvote-btn big ${hasUpvoted ? 'upvoted' : ''}`}
              onClick={handleUpvote}
              disabled={!user}
            >
              ▲ {deck.upvotes || 0}
            </button>
            <button onClick={exportDeckCode}>Export Code</button>
            {isOwner && (
              <button onClick={() => navigate(`/builder/${deckId}`)}>Edit</button>
            )}
            {user && !isOwner && (
              <button onClick={handleCopy}>Copy to My Decks</button>
            )}
          </div>
        </div>

        <div className="deck-view-cards">
          {Object.entries(deckByColor).map(([color, cards]) => (
            <div key={color} className="deck-view-section">
              <h3 className={`color-${color.toLowerCase()}`}>
                {color} ({cards.reduce((s, c) => s + c.quantity, 0)})
              </h3>
              <div className="deck-view-card-list">
                {cards.sort((a, b) => a.card.name.localeCompare(b.card.name)).map(({ card, quantity }) => (
                  <div 
                    key={card.id} 
                    className="deck-view-card"
                    onClick={() => setSelectedCard(card)}
                  >
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt={card.name} className="deck-card-thumb" loading="lazy" />
                    ) : (
                      <div className="deck-card-placeholder">{card.name}</div>
                    )}
                    <div className="deck-card-qty">{quantity}x</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Link to="/decks" className="back-link">← Back to Decks</Link>
      </div>

      {selectedCard && (
        <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} viewOnly />
      )}
    </div>
  );
}
