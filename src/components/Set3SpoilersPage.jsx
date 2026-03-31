import { useState } from 'react';
import Header from './Header.jsx';
import spoilerData from '../data/set3Spoilers.json';

const totalSetCards = 195;
const allColors = Array.from(new Set(spoilerData.cards.map((card) => card.color))).sort();
const allTypes = Array.from(new Set(spoilerData.cards.map((card) => getCardType(card.type)))).sort();
const revealedPercentage = Math.round((spoilerData.cards.length / totalSetCards) * 100);

function getCardType(type) {
  return type.startsWith('Action') ? 'Action' : 'Character';
}

export default function Set3SpoilersPage() {
  const [activeType, setActiveType] = useState('All');
  const [activeColor, setActiveColor] = useState('All');
  const [selectedCard, setSelectedCard] = useState(null);

  const filteredCards = spoilerData.cards.filter((card) => {
    const matchesType = activeType === 'All' || getCardType(card.type) === activeType;
    const matchesColor = activeColor === 'All' || card.color === activeColor;
    return matchesType && matchesColor;
  });

  return (
    <>
      <Header isOwnCollection={false} />
      <main className="set3-spoilers-page">
        <section className="set3-hero">
          <div className="set3-hero-copy">
            <span className="set3-eyebrow">Set 3 Spoilers</span>
            <h1>Fresh reveals from the next wave of Vibes cards.</h1>
            <p>
              a quick gallery for the latest set 3 previews
            </p>
          </div>
          <div className="set3-hero-meta">
            <div className="set3-meta-card">
              <span className="set3-meta-label">Known Set 3 Cards</span>
              <strong>{spoilerData.cards.length} / {totalSetCards}</strong>
              <div className="set3-progress">
                <div
                  className="set3-progress-fill"
                  style={{ width: `${revealedPercentage}%` }}
                />
              </div>
              <span className="set3-progress-label">{revealedPercentage}% revealed</span>
            </div>
            <div className="set3-meta-card">
              <span className="set3-meta-label">Colors Shown</span>
              <strong>{spoilerData.colorCount} colors</strong>
            </div>
          </div>
        </section>

        <section className="set3-toolbar" aria-label="Spoiler filters">
          <div className="set3-filter-group">
            <span className="set3-filter-label">Type</span>
            <div className="set3-filter-chips">
              {['All', ...allTypes].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`set3-filter-chip ${activeType === type ? 'active' : ''}`}
                  onClick={() => setActiveType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="set3-filter-group">
            <span className="set3-filter-label">Color</span>
            <div className="set3-filter-chips">
              {['All', ...allColors].map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`set3-filter-chip ${activeColor === color ? 'active' : ''}`}
                  onClick={() => setActiveColor(color)}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          <div className="set3-results-count">
            Showing <strong>{filteredCards.length}</strong> of <strong>{spoilerData.cards.length}</strong>
          </div>
        </section>

        <section className="set3-grid" aria-label="Set 3 spoiler cards">
          {filteredCards.map((card) => (
            <article
              key={card.name}
              className="spoiler-card"
              onClick={() => setSelectedCard(card)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedCard(card);
                }
              }}
            >
              <div className="spoiler-card-image-wrap">
                <img src={card.image} alt={card.name} className="spoiler-card-image" />
              </div>
              <div className="spoiler-card-body">
                <div className="spoiler-card-topline">
                  <span className={`spoiler-color spoiler-color-${card.color.toLowerCase()}`}>
                    {card.color}
                  </span>
                  <span className="spoiler-collector">{card.collectorNumber}</span>
                </div>
                <h2>{card.name}</h2>
                <p className="spoiler-type">{card.type}</p>
                <div className="spoiler-stats">
                  <div>
                    <span className="spoiler-stat-label">Cost</span>
                    <strong>{card.cost ?? '-'}</strong>
                  </div>
                  <div>
                    <span className="spoiler-stat-label">Vibe</span>
                    <strong>{card.vibe ?? '-'}</strong>
                  </div>
                </div>
                <p className="spoiler-effect">{card.effect}</p>
              </div>
            </article>
          ))}
        </section>

        {filteredCards.length === 0 && (
          <div className="set3-empty-state">
            No spoilers match those filters yet.
          </div>
        )}

        {selectedCard && (
          <div
            className="modal-overlay active"
            onClick={(event) => {
              if (event.target.classList.contains('modal-overlay')) {
                setSelectedCard(null);
              }
            }}
          >
            <div className="modal spoiler-modal">
              <div className="modal-header">
                <h2 className="modal-title">{selectedCard.name}</h2>
                <button className="modal-close" onClick={() => setSelectedCard(null)}>&times;</button>
              </div>
              <div className="modal-body">
                <div className="modal-card-content">
                  <div className="modal-card-image">
                    <img src={selectedCard.image} alt={selectedCard.name} />
                  </div>
                  <div className="modal-card-details">
                    <p><strong>Type:</strong> {selectedCard.type}</p>
                    <p><strong>Color:</strong> {selectedCard.color}</p>
                    <p><strong>Cost:</strong> {selectedCard.cost ?? '-'}</p>
                    <p><strong>Vibe:</strong> {selectedCard.vibe ?? '-'}</p>
                    {selectedCard.rarity && <p><strong>Rarity:</strong> {selectedCard.rarity}</p>}
                    {selectedCard.collectorNumber && (
                      <p><strong>Set Number:</strong> #{selectedCard.collectorNumber}</p>
                    )}
                    {selectedCard.featuringPudgy && (
                      <p><strong>Featuring:</strong> {selectedCard.featuringPudgy}</p>
                    )}
                    {selectedCard.illustrator && (
                      <p><strong>Illustrator:</strong> {selectedCard.illustrator}</p>
                    )}
                    <div className="card-text-box">
                      {selectedCard.effect || 'No rules text yet.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
