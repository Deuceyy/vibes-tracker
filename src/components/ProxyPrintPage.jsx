import { useEffect, useMemo, useState } from 'react';
import { track } from '@vercel/analytics';
import Header from './Header.jsx';
import spoilerData from '../data/set3Spoilers.json';
import { TRACKER_CARD_TYPES, getCanonicalCardType, getCharacterSubtypes } from '../lib/cardMetadata.js';

const CARDS_PER_SHEET = 9; // 3x3
const TOTAL_SET_CARDS = 195;

// Slug must match render_individual.py's slugify(): lowercase, strip
// apostrophes, replace anything else non-alphanumeric with hyphens.
function proxySlug(name) {
  return (name || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function proxyImageUrl(card) {
  return `/proxies/${proxySlug(card.name)}.png`;
}

function getSpoilerCardType(card) {
  return getCanonicalCardType({ ...card, rawType: card.type, set: 'S3' });
}

function getSpoilerTypeLine(card) {
  const baseType = getSpoilerCardType(card);
  const subtypes = getCharacterSubtypes({ ...card, rawType: card.type, set: 'S3', id: card.name });
  return baseType === 'Character' && subtypes.length > 0
    ? `${baseType} - ${subtypes.join(', ')}`
    : baseType;
}

function getPudgeForSpoiler(card) {
  const t = getSpoilerCardType(card);
  if (t === 'Action' || t === 'Saucy Action' || t === 'Fit') return null;
  if (t === 'Character') return { amount: 1, color: card.color || 'Colorless' };
  // Rod / Relic / Location Relic — produce 1 colorless pudge by default
  return { amount: 1, color: 'Colorless' };
}

// Render a proxy card from data — no card art, banner-and-stats layout
function ProxyCardArt({ card }) {
  const type = getSpoilerCardType(card);
  const isCharacter = type === 'Character';
  const typeLine = getSpoilerTypeLine(card);
  const pudge = getPudgeForSpoiler(card);
  const colorKey = (card.color || 'Colorless').toLowerCase();
  const costShown = card.cost != null;

  return (
    <div className={`px-card px-color-${colorKey}`}>
      <div className="px-card-inner">
        <div className="px-top">
          <div className="px-cost-block">
            <div className="px-cost-icon" />
            {costShown && <div className="px-cost-num">{card.cost}</div>}
          </div>
          <div className="px-name-stack">
            <div className="px-name-banner">{card.name}</div>
            <div className="px-subtype-banner">{typeLine}</div>
          </div>
        </div>

        <div className="px-art-area" />

        <div className="px-text">{card.effect || ''}</div>

        <div className="px-footer">
          <div className="px-pudge-slot">
            {pudge && (
              <>
                <div className={`px-pudge-dot px-color-${pudge.color.toLowerCase()}`} />
                <span className="px-pudge-amt">{pudge.amount}</span>
              </>
            )}
          </div>
          <div className="px-attribution">
            <div className="px-attribution-line">
              {(card.featuringPudgy || '').slice(0, 28)}
              {card.featuringPudgy && card.collectorNumber ? '  ' : ''}
              {card.collectorNumber ? `${card.collectorNumber}/${TOTAL_SET_CARDS}` : ''}
            </div>
            <div className="px-attribution-line">
              {card.illustrator ? `Illus ${card.illustrator}` : ''}
            </div>
            <div className="px-attribution-line">{card.rarity || ''}</div>
          </div>
          <div className="px-vibe-slot">
            {isCharacter && card.vibe != null && (
              <>
                <div className="px-vibe-num">{card.vibe}</div>
                <div className="px-vibe-label">Vibe</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProxyPrintPage() {
  const [quantities, setQuantities] = useState({}); // { [cardName]: number }
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('All');
  const [activeColor, setActiveColor] = useState('All');
  const [printing, setPrinting] = useState(false);

  const allColors = useMemo(
    () => Array.from(new Set(spoilerData.cards.map((c) => c.color))).sort(),
    []
  );

  const availableTypes = useMemo(
    () => TRACKER_CARD_TYPES.filter((t) => spoilerData.cards.some((c) => getSpoilerCardType(c) === t)),
    []
  );

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return spoilerData.cards.filter((card) => {
      if (activeType !== 'All' && getSpoilerCardType(card) !== activeType) return false;
      if (activeColor !== 'All' && card.color !== activeColor) return false;
      if (q) {
        const hay = `${card.name || ''} ${card.effect || ''} ${card.illustrator || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, activeType, activeColor]);

  const setQty = (cardName, newQty) => {
    setQuantities((prev) => {
      const next = { ...prev };
      const clamped = Math.max(0, Math.min(99, Math.round(newQty)));
      if (clamped === 0) delete next[cardName];
      else next[cardName] = clamped;
      return next;
    });
  };

  const adjust = (cardName, delta) => {
    setQty(cardName, (quantities[cardName] || 0) + delta);
  };

  // Build the expanded print list (each card repeated `quantity` times)
  const printList = useMemo(() => {
    const out = [];
    for (const card of spoilerData.cards) {
      const qty = quantities[card.name] || 0;
      for (let i = 0; i < qty; i++) out.push(card);
    }
    return out;
  }, [quantities]);

  const totalSelected = printList.length;
  const totalSheets = Math.ceil(totalSelected / CARDS_PER_SHEET);

  // Chunk into sheets of 9
  const sheets = useMemo(() => {
    const out = [];
    for (let i = 0; i < printList.length; i += CARDS_PER_SHEET) {
      out.push(printList.slice(i, i + CARDS_PER_SHEET));
    }
    return out;
  }, [printList]);

  // Auto-print when entering print mode (browser triggers Save-as-PDF dialog)
  useEffect(() => {
    if (printing && totalSelected > 0) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [printing, totalSelected]);

  const clearAll = () => setQuantities({});

  // Quick-add: set every filtered card to 1 (or +1 each)
  const addOneOfEachFiltered = () => {
    setQuantities((prev) => {
      const next = { ...prev };
      for (const c of filteredCards) {
        next[c.name] = (next[c.name] || 0) + 1;
      }
      return next;
    });
  };

  if (printing) {
    return (
      <div className="proxy-print-root">
        <div className="proxy-print-controls" data-noprint>
          <button onClick={() => setPrinting(false)} className="">
            ← Back to picker
          </button>
          <button onClick={() => window.print()} className="proxy-print-btn">
            Open print dialog
          </button>
          <span className="proxy-print-hint">
            In the print dialog choose <strong>"Save as PDF"</strong> as destination, paper size <strong>Letter</strong>, margins <strong>None</strong> or <strong>Default</strong>, scale <strong>100%</strong>.
          </span>
        </div>

        {sheets.map((sheet, sheetIdx) => (
          <section key={sheetIdx} className="proxy-sheet">
            <div className="proxy-grid">
              {Array.from({ length: CARDS_PER_SHEET }).map((_, cellIdx) => {
                const card = sheet[cellIdx];
                return (
                  <div key={cellIdx} className={`proxy-cell ${card ? '' : 'proxy-cell--empty'}`}>
                    {card && (
                      <img
                        src={proxyImageUrl(card)}
                        alt={card.name}
                        className="proxy-cell-img"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <>
      <Header isOwnCollection={false} />
      <main className="set3-spoilers-page">
        <section className="set3-hero">
          <div className="set3-hero-copy">
            <span className="set3-eyebrow">Proxy Print Sheet</span>
            <h1>Pick cards, print proxies.</h1>
            <p>
              Choose Birb &amp; Pengu spoiler cards and quantities, then generate a print-ready
              sheet (3×3 poker size on US Letter). Save as PDF or send straight to your printer.
            </p>
            <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
              Only currently-revealed Set 3 cards are available. As new ones spoil they appear here automatically.
            </p>
          </div>
          <div className="set3-hero-meta">
            <div className="set3-meta-card">
              <span className="set3-meta-label">Selected</span>
              <strong>{totalSelected} card{totalSelected === 1 ? '' : 's'}</strong>
              <span className="set3-progress-label">
                {totalSheets} sheet{totalSheets === 1 ? '' : 's'} at 9 per page
              </span>
            </div>
            <div className="set3-meta-card">
              <span className="set3-meta-label">Available</span>
              <strong>{spoilerData.cards.length} cards</strong>
            </div>
          </div>
        </section>

        <section className="set3-toolbar" aria-label="Filters">
          <input
            type="text"
            className="search-input"
            placeholder="Search name, card text, or artist..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: '1 1 240px', minWidth: 220 }}
          />

          <div className="set3-filter-group">
            <span className="set3-filter-label">Type</span>
            <div className="set3-filter-chips">
              {['All', ...availableTypes].map((type) => (
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
        </section>

        <section className="proxy-action-bar">
          <button className="" onClick={addOneOfEachFiltered}>
            +1 of each filtered ({filteredCards.length})
          </button>
          <button className="" onClick={clearAll} disabled={totalSelected === 0}>
            Clear all
          </button>
          <div className="proxy-action-spacer" />
          <button
            className="proxy-print-btn"
            disabled={totalSelected === 0}
            onClick={() => {
              track('proxy_print', {
                card_count: totalSelected,
                sheet_count: totalSheets,
                unique_cards: Object.keys(quantities).length,
              });
              setPrinting(true);
            }}
          >
            Print {totalSelected || ''} proxies →
          </button>
        </section>

        <section className="proxy-picker-grid">
          {filteredCards.map((card) => {
            const qty = quantities[card.name] || 0;
            return (
              <article key={card.name} className={`proxy-picker-card ${qty > 0 ? 'has-qty' : ''}`}>
                <div className="proxy-picker-image">
                  <img src={card.image} alt={card.name} loading="lazy" />
                  {qty > 0 && <span className="proxy-picker-badge">×{qty}</span>}
                </div>
                <div className="proxy-picker-info">
                  <div className="proxy-picker-name" title={card.name}>{card.name}</div>
                  <div className="proxy-picker-meta">
                    <span className={`spoiler-color spoiler-color-${card.color.toLowerCase()}`}>
                      {card.color}
                    </span>
                    <span>{card.collectorNumber ? `#${card.collectorNumber}` : ''}</span>
                  </div>
                  <div className="proxy-picker-controls">
                    <button onClick={() => adjust(card.name, -1)} disabled={qty === 0}>−</button>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={qty}
                      onChange={(e) => setQty(card.name, Number(e.target.value) || 0)}
                      onClick={(e) => e.target.select()}
                    />
                    <button onClick={() => adjust(card.name, 1)}>+</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {filteredCards.length === 0 && (
          <div className="set3-empty-state">No cards match those filters.</div>
        )}
      </main>
    </>
  );
}
