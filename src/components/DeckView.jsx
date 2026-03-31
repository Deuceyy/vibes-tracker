import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { useAuth } from '../hooks/useAuth';
import { useDecks } from '../hooks/useDecks';
import { cardData } from '../hooks/useCollection';
import { usePrices } from '../hooks/usePrices';
import Header from './Header';
import CardModal from './CardModal';
import SiteDisclaimer from './SiteDisclaimer';

function shuffleCards(cards) {
  const next = [...cards];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function createHandEntries(cards) {
  return cards.map((card, index) => ({
    handId: `${card.id}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    card
  }));
}

function getRegistrationText(deckName, deckImageCards) {
  const lines = [`Deck Name: ${deckName}`, ''];
  deckImageCards.forEach(({ card, quantity }) => {
    lines.push(`${quantity} ${card.name}`);
  });
  return lines.join('\n');
}

function PieChart({ title, data, total, getColor }) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="pie-chart-card">
      <h3>{title}</h3>
      <div className="pie-chart-wrap">
        <svg viewBox="0 0 180 180" className="pie-chart-svg" aria-hidden="true">
          <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="36" />
          {data.map(([label, value]) => {
            const portion = total > 0 ? value / total : 0;
            const dash = portion * circumference;
            const offset = -cumulative * circumference;
            cumulative += portion;
            return (
              <circle
                key={label}
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke={getColor(label)}
                strokeWidth="36"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
                transform="rotate(-90 90 90)"
              />
            );
          })}
        </svg>
        <div className="pie-chart-total">{total}</div>
      </div>
      <div className="pie-chart-legend">
        {data.map(([label, value]) => (
          <div key={label} className="pie-chart-legend-row">
            <span className="pie-chart-dot" style={{ background: getColor(label) }} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DeckView() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getDeck, toggleUpvote, saveDeck } = useDecks();
  const { getPrice, formatPrice } = usePrices();

  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [showSimulator, setShowSimulator] = useState(false);
  const [simHand, setSimHand] = useState([]);
  const [simMulligans, setSimMulligans] = useState(0);
  const [simSelected, setSimSelected] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const sharePosterRef = useRef(null);

  useEffect(() => {
    getDeck(deckId).then((result) => {
      setDeck(result);
      setLoading(false);
    });
  }, [deckId, getDeck]);

  const deckByColor = useMemo(() => {
    if (!deck?.cards) return {};
    const grouped = {};
    deck.cards.forEach(({ cardId, quantity }) => {
      const card = cardData.find((entry) => entry.id === cardId);
      if (!card) return;
      const color = card.color?.split(', ')[0] || 'Colorless';
      if (!grouped[color]) grouped[color] = [];
      grouped[color].push({ card, quantity });
    });
    return grouped;
  }, [deck]);

  const deckCardsDetailed = useMemo(() => {
    if (!deck?.cards) return [];
    return deck.cards
      .map(({ cardId, quantity }) => {
        const card = cardData.find((entry) => entry.id === cardId);
        return card ? { card, quantity } : null;
      })
      .filter(Boolean);
  }, [deck]);

  const deckImageCards = useMemo(() => {
    return [...deckCardsDetailed].sort((left, right) => {
      if (right.quantity !== left.quantity) return right.quantity - left.quantity;
      return (left.card.setNumber ?? 999) - (right.card.setNumber ?? 999) ||
        left.card.name.localeCompare(right.card.name);
    });
  }, [deckCardsDetailed]);

  const deckPool = useMemo(() => {
    return deckCardsDetailed.flatMap(({ card, quantity }) =>
      Array.from({ length: quantity }, () => card)
    );
  }, [deckCardsDetailed]);

  const deckCost = useMemo(() => {
    if (!deck?.cards) return { total: 0, missing: 0 };
    let total = 0;
    let missing = 0;
    deck.cards.forEach(({ cardId, quantity }) => {
      const price = getPrice(cardId, 'normal');
      if (price !== null) {
        total += price * quantity;
      } else {
        missing += quantity;
      }
    });
    return { total, missing };
  }, [deck, getPrice]);

  const deckMetrics = useMemo(() => {
    const colorCounts = {};
    const typeCounts = {};
    const costCurve = {};

    deckImageCards.forEach(({ card, quantity }) => {
      const baseColor = card.color?.split(', ')[0] || 'Colorless';
      colorCounts[baseColor] = (colorCounts[baseColor] || 0) + quantity;

      const type = card.type || 'Unknown';
      typeCounts[type] = (typeCounts[type] || 0) + quantity;

      const cost = card.cost?.amount ?? 0;
      const bucket = cost >= 9 ? '9+' : String(cost);
      costCurve[bucket] = (costCurve[bucket] || 0) + quantity;
    });

    return { colorCounts, typeCounts, costCurve };
  }, [deckImageCards]);

  const colorChartData = useMemo(
    () => Object.entries(deckMetrics.colorCounts).sort((left, right) => right[1] - left[1]),
    [deckMetrics.colorCounts]
  );

  const typeChartData = useMemo(
    () => Object.entries(deckMetrics.typeCounts).sort((left, right) => right[1] - left[1]),
    [deckMetrics.typeCounts]
  );

  const colorChartPalette = {
    Red: '#ef4444',
    Blue: '#3b82f6',
    Green: '#22c55e',
    Yellow: '#eab308',
    Purple: '#a855f7',
    Colorless: '#94a3b8'
  };

  const typeChartPalette = {
    Penguin: '#38bdf8',
    Character: '#38bdf8',
    Action: '#fb7185',
    Relic: '#f59e0b',
    Rod: '#34d399',
    Item: '#f59e0b',
    Stadium: '#c084fc'
  };

  useEffect(() => {
    setSimHand([]);
    setSimMulligans(0);
    setSimSelected([]);
  }, [deckId, deckPool.length]);

  const drawFreshHand = () => {
    const nextHand = createHandEntries(shuffleCards(deckPool).slice(0, Math.min(5, deckPool.length)));
    setSimHand(nextHand);
    setSimMulligans(0);
    setSimSelected([]);
  };

  const toggleHandSelection = (handId) => {
    setSimSelected((previous) =>
      previous.includes(handId)
        ? previous.filter((entry) => entry !== handId)
        : [...previous, handId]
    );
  };

  const handleMulligan = () => {
    if (simHand.length === 0) {
      drawFreshHand();
      return;
    }

    if (simMulligans >= 1 || simSelected.length === 0) {
      return;
    }

    const selectedIds = simSelected;
    const keptEntries = simHand.filter((entry) => !selectedIds.includes(entry.handId));

    const remainingPool = [...deckPool];
    keptEntries.forEach(({ card }) => {
      const matchIndex = remainingPool.findIndex((entry) => entry.id === card.id);
      if (matchIndex >= 0) {
        remainingPool.splice(matchIndex, 1);
      }
    });

    const replacementCount = simHand.length - keptEntries.length;
    const replacements = createHandEntries(
      shuffleCards(remainingPool).slice(0, replacementCount)
    );

    setSimHand([...keptEntries, ...replacements]);
    setSimMulligans((previous) => previous + 1);
    setSimSelected([]);
  };

  const handleCopy = async () => {
    if (!user) {
      alert('Please sign in to copy decks');
      return;
    }
    const newId = await saveDeck({
      name: `${deck.name} (Copy)`,
      description: deck.description,
      cards: deck.cards,
      isPublic: false
    });
    navigate(`/builder/${newId}`);
  };

  const exportClientCode = async () => {
    const counts = {};
    deck.cards.forEach(({ cardId, quantity }) => {
      counts[cardId] = quantity;
    });
    const deckCode = JSON.stringify({ deckName: deck.name, counts });
    await navigator.clipboard.writeText(deckCode);
    alert('Vibes client deck code copied to clipboard!');
    setExportOpen(false);
  };

  const exportRegistrationText = async () => {
    const text = getRegistrationText(deck.name, deckImageCards);
    await navigator.clipboard.writeText(text);
    alert('Registration sheet text copied to clipboard!');
    setExportOpen(false);
  };

  const handleUpvote = async () => {
    await toggleUpvote(deckId);
    setDeck(await getDeck(deckId));
  };

  const deckUrl = typeof window !== 'undefined' ? window.location.href : '';

  const downloadShareImage = async () => {
    if (!sharePosterRef.current) return;
    try {
      setShareBusy(true);
      const dataUrl = await toPng(sharePosterRef.current, {
        cacheBust: true,
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${deck.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-deck-image.png`;
      link.click();
    } catch (error) {
      alert('Could not download deck image.');
    } finally {
      setShareBusy(false);
    }
  };

  const copyDeckLink = async () => {
    await navigator.clipboard.writeText(deckUrl);
    alert('Deck link copied!');
  };

  if (loading) return <div className="app"><Header /><div className="loading">Loading deck...</div></div>;
  if (!deck) return <div className="app"><Header /><div className="not-found">Deck not found</div></div>;

  const isOwner = user?.uid === deck.userId;
  const hasUpvoted = deck.upvotedBy?.includes(user?.uid);
  const totalCards = deck.cards?.reduce((sum, card) => sum + card.quantity, 0) || 0;

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
              <span className="deck-cost-display">
                ${formatPrice(deckCost.total)}
                {deckCost.missing > 0 && <small> ({deckCost.missing} unpriced)</small>}
              </span>
              <span className="deck-colors">
                {deck.colors?.map((color) => (
                  <span key={color} className={`color-badge color-${color.toLowerCase()}`}>{color}</span>
                ))}
              </span>
            </div>
            {deck.description && <p className="deck-description">{deck.description}</p>}
          </div>
          <div className="deck-view-actions">
            <button onClick={() => setViewMode(viewMode === 'list' ? 'image' : 'list')}>
              {viewMode === 'list' ? 'Deck Image' : 'List View'}
            </button>
            <button onClick={() => setShowSimulator((previous) => !previous)}>
              {showSimulator ? 'Hide Mulligan Trainer' : 'Mulligan Trainer'}
            </button>
            <button onClick={() => setShareOpen(true)}>Share</button>
            <button onClick={() => setExportOpen(true)}>Export</button>
            <button
              className={`upvote-btn big ${hasUpvoted ? 'upvoted' : ''}`}
              onClick={handleUpvote}
              disabled={!user}
            >
              Upvote {deck.upvotes || 0}
            </button>
            {isOwner && (
              <button onClick={() => navigate(`/builder/${deckId}`)}>Edit</button>
            )}
            {user && !isOwner && (
              <button onClick={handleCopy}>Copy to My Decks</button>
            )}
          </div>
        </div>

        {showSimulator && (
          <section className="mulligan-sim">
            <div className="mulligan-sim-header">
              <div>
                <h2>Opening Hand Simulator</h2>
                <p>Draw 5, click the cards you want to send back, then hit mulligan to replace only those cards.</p>
              </div>
              <div className="mulligan-sim-actions">
                <button onClick={drawFreshHand} disabled={deckPool.length < 5}>Draw 5</button>
                <button onClick={handleMulligan} disabled={deckPool.length < 5 || simHand.length === 0 || simSelected.length === 0 || simMulligans >= 1}>
                  {simMulligans >= 1 ? 'Mulligan Used' : 'Mulligan'}
                </button>
                <button
                  onClick={() => {
                    setSimHand([]);
                    setSimMulligans(0);
                    setSimSelected([]);
                  }}
                  disabled={simHand.length === 0}
                >
                  Reset
                </button>
              </div>
            </div>

            {simHand.length > 0 ? (
              <>
                <div className="mulligan-sim-meta">
                  <span><strong>{simMulligans}</strong> mulligan{simMulligans === 1 ? '' : 's'}</span>
                  <span><strong>{simSelected.length}</strong> card{simSelected.length === 1 ? '' : 's'} marked to replace</span>
                  <span><strong>{simHand.filter((entry) => entry.card.type === 'Action').length}</strong> actions</span>
                </div>
                <div className="mulligan-hand">
                  {simHand.map((entry) => (
                    <button
                      key={entry.handId}
                      type="button"
                      className={`mulligan-card ${simSelected.includes(entry.handId) ? 'selected' : ''}`}
                      onClick={() => toggleHandSelection(entry.handId)}
                    >
                      {entry.card.imageUrl ? (
                        <img src={entry.card.imageUrl} alt={entry.card.name} className="mulligan-card-image" loading="lazy" />
                      ) : (
                        <div className="deck-card-placeholder">{entry.card.name}</div>
                      )}
                      {simSelected.includes(entry.handId) && (
                        <span className="mulligan-checkmark" aria-hidden="true">✓</span>
                      )}
                      <span className="mulligan-card-name">{entry.card.name}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="mulligan-empty">No hand drawn yet. Use `Draw 5` to see an opening hand.</div>
            )}
          </section>
        )}

        <section className="deck-page-insights">
          <div className="deck-metric-grid deck-page-metrics">
            <div className="deck-metric-card">
              <span className="deck-metric-label">Total Cards</span>
              <strong>{totalCards}</strong>
            </div>
            <div className="deck-metric-card">
              <span className="deck-metric-label">Unique Cards</span>
              <strong>{deckImageCards.length}</strong>
            </div>
            <div className="deck-metric-card">
              <span className="deck-metric-label">Colors</span>
              <strong>{Object.keys(deckMetrics.colorCounts).length}</strong>
            </div>
            <div className="deck-metric-card">
              <span className="deck-metric-label">Types</span>
              <strong>{Object.keys(deckMetrics.typeCounts).length}</strong>
            </div>
          </div>

          <div className="deck-analytics-grid">
            <div className="deck-analytics-card">
              <h3>Cost Curve</h3>
              {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9+'].map((bucket) => (
                <div key={bucket} className="deck-summary-row">
                  <span>{bucket}</span>
                  <div className="deck-summary-bar">
                    <div
                      className="deck-summary-fill"
                      style={{
                        width: `${Math.min(100, ((deckMetrics.costCurve[bucket] || 0) / Math.max(1, totalCards)) * 220)}%`
                      }}
                    />
                  </div>
                  <strong>{deckMetrics.costCurve[bucket] || 0}</strong>
                </div>
              ))}
            </div>
            <PieChart
              title="Colors"
              data={colorChartData}
              total={totalCards}
              getColor={(label) => colorChartPalette[label] || '#94a3b8'}
            />
            <PieChart
              title="Card Types"
              data={typeChartData}
              total={totalCards}
              getColor={(label) => typeChartPalette[label] || '#94a3b8'}
            />
          </div>
        </section>

        {viewMode === 'list' ? (
          <div className="deck-view-cards">
            {Object.entries(deckByColor).map(([color, cards]) => (
              <div key={color} className="deck-view-section">
                <h3 className={`color-${color.toLowerCase()}`}>
                  {color} ({cards.reduce((sum, entry) => sum + entry.quantity, 0)})
                </h3>
                <div className="deck-view-card-list">
                  {cards.sort((left, right) => left.card.name.localeCompare(right.card.name)).map(({ card, quantity }) => (
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
        ) : (
          <section className="deck-image-view">
            <div className="deck-image-toolbar">
              <button onClick={() => setShareOpen(true)} className="deck-share-btn">Share Deck Image</button>
            </div>

            <div className="deck-image-poster deck-image-live">
              <div className="deck-image-title">{deck.name}</div>
              <div className="deck-image-grid">
                {deckImageCards.map(({ card, quantity }) => (
                  <button
                    key={card.id}
                    type="button"
                    className="deck-image-card"
                    onClick={() => setSelectedCard(card)}
                  >
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt={card.name} className="deck-image-thumb" loading="lazy" />
                    ) : (
                      <div className="deck-card-placeholder">{card.name}</div>
                    )}
                    <span className="deck-image-qty">x{quantity}</span>
                  </button>
                ))}
              </div>
              <aside className="deck-image-sidebar">
                {deckImageCards.map(({ card, quantity }) => (
                  <button
                    key={`${card.id}-summary`}
                    type="button"
                    className="deck-image-row"
                    onClick={() => setSelectedCard(card)}
                  >
                    <span className="deck-image-row-qty">{quantity}</span>
                    <span className="deck-image-row-name">{card.name}</span>
                    <span className="deck-image-row-meta">{card.cost?.amount ?? '-'}</span>
                  </button>
                ))}
              </aside>
              <div className="deck-image-watermark">vibes-tracker.com</div>
            </div>
          </section>
        )}

        <Link to="/decks" className="back-link">Back to Decks</Link>
      </div>

      {selectedCard && (
        <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} viewOnly />
      )}

      {exportOpen && (
        <div className="modal-overlay active" onClick={(event) => {
          if (event.target.classList.contains('modal-overlay')) setExportOpen(false);
        }}>
          <div className="modal deck-tools-modal">
            <div className="modal-header">
              <h2 className="modal-title">Export Deck</h2>
              <button className="modal-close" onClick={() => setExportOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="deck-tools-grid">
                <button className="deck-tool-card" onClick={exportClientCode}>
                  <strong>Vibes Client Code</strong>
                  <span>Copies the JSON format used by the Vibes client.</span>
                </button>
                <button className="deck-tool-card" onClick={exportRegistrationText}>
                  <strong>Registration TXT</strong>
                  <span>Copies a clean `qty + card name` list for Melee registration.</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {shareOpen && (
        <div className="modal-overlay active" onClick={(event) => {
          if (event.target.classList.contains('modal-overlay')) setShareOpen(false);
        }}>
          <div className="modal deck-share-modal">
            <div className="modal-header">
              <h2 className="modal-title">Share Deck</h2>
              <button className="modal-close" onClick={() => setShareOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="deck-share-preview" ref={sharePosterRef}>
                <div className="deck-share-title">{deck.name}</div>
                <div className="deck-share-grid">
                  {deckImageCards.map(({ card, quantity }) => (
                    <div key={card.id} className="deck-share-card">
                      {card.imageUrl ? (
                        <img src={card.imageUrl} alt={card.name} className="deck-share-thumb" />
                      ) : (
                        <div className="deck-card-placeholder">{card.name}</div>
                      )}
                      <span className="deck-share-qty">x{quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="deck-share-list">
                  {deckImageCards.map(({ card, quantity }) => (
                    <div key={`${card.id}-share-row`} className="deck-share-list-row">
                      <span>{quantity}x</span>
                      <span>{card.name}</span>
                    </div>
                  ))}
                </div>
                <div className="deck-share-footer">
                  <span>{deck.username}</span>
                  <span>vibes-tracker.com</span>
                </div>
              </div>
              <div className="deck-share-url-row">
                <input type="text" readOnly value={deckUrl} className="search-input" />
                <button onClick={copyDeckLink}>Copy Link</button>
              </div>
              <div className="deck-share-actions">
                <button onClick={downloadShareImage} disabled={shareBusy}>
                  {shareBusy ? 'Preparing...' : 'Download Image'}
                </button>
                <button onClick={() => setShareOpen(false)}>Done</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <SiteDisclaimer />
    </div>
  );
}
