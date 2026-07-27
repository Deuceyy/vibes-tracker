import { useMemo, useState, useEffect, useRef } from 'react';
import Header from './Header';
import { cardData } from '../hooks/useCollection';
import { usePrices } from '../hooks/usePrices';
import { getSupportedVariants } from '../lib/cardMetadata.js';
import { toast } from '../lib/toast';

const VARIANT_LABELS = {
  normal: 'Normal',
  foil: 'Foil',
  arctic: 'Arctic',
  sketch: 'Sketch',
  birbFoil: 'Birb Foil',
  fishFoil: 'Fish Foil'
};

const cardById = new Map(cardData.map((c) => [c.id, c]));

// Compact URL encoding: "id~variant~qty" joined by commas.
function encodeSide(items) {
  return items.map((i) => `${i.cardId}~${i.variant}~${i.qty}`).join(',');
}
function decodeSide(str) {
  if (!str) return [];
  return str
    .split(',')
    .map((chunk) => {
      const [cardId, variant, qty] = chunk.split('~');
      if (!cardById.has(cardId)) return null;
      return { cardId, variant: variant || 'normal', qty: Math.max(1, parseInt(qty, 10) || 1) };
    })
    .filter(Boolean);
}

export default function TradePage() {
  const { getPrice, formatPrice, dyliUpdated } = usePrices();

  const [sideA, setSideA] = useState(() => decodeSide(new URLSearchParams(location.search).get('a')));
  const [sideB, setSideB] = useState(() => decodeSide(new URLSearchParams(location.search).get('b')));

  // Keep the URL in sync so a trade quote is shareable / bookmarkable.
  useEffect(() => {
    const params = new URLSearchParams();
    if (sideA.length) params.set('a', encodeSide(sideA));
    if (sideB.length) params.set('b', encodeSide(sideB));
    const qs = params.toString();
    const url = qs ? `${location.pathname}?${qs}` : location.pathname;
    window.history.replaceState(null, '', url);
  }, [sideA, sideB]);

  const lineValue = (item) => {
    const p = getPrice(item.cardId, item.variant);
    return p === null ? null : p * item.qty;
  };

  const sideTotal = (side) =>
    side.reduce((sum, item) => sum + (lineValue(item) || 0), 0);

  const totalA = useMemo(() => sideTotal(sideA), [sideA, getPrice]);
  const totalB = useMemo(() => sideTotal(sideB), [sideB, getPrice]);
  const diff = totalA - totalB;

  const addCard = (setSide, card) => {
    const variant = getSupportedVariants(card)[0] || 'normal';
    setSide((prev) => {
      const existing = prev.find((i) => i.cardId === card.id && i.variant === variant);
      if (existing) {
        return prev.map((i) =>
          i === existing ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { cardId: card.id, variant, qty: 1 }];
    });
  };

  const Side = ({ label, side, setSide, total, accent }) => {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);

    const matches = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      return cardData
        .filter((c) => `${c.name} ${c.featuringPudgy || ''}`.toLowerCase().includes(q))
        .slice(0, 8);
    }, [query]);

    useEffect(() => {
      const onDoc = (e) => {
        if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
      };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    return (
      <div className="trade-side" style={{ '--trade-accent': accent }}>
        <div className="trade-side-head">
          <h2>{label}</h2>
          <div className="trade-side-total">{formatPrice(total)}</div>
        </div>

        <div className="trade-search" ref={boxRef}>
          <input
            type="text"
            className="search-input"
            placeholder="Add a card…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {open && matches.length > 0 && (
            <div className="trade-suggest">
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="trade-suggest-item"
                  onClick={() => { addCard(setSide, c); setQuery(''); setOpen(false); }}
                >
                  <img src={c.imageUrl} alt="" loading="lazy" />
                  <span className="trade-suggest-name">{c.name}</span>
                  <span className="trade-suggest-price">{formatPrice(getPrice(c.id, getSupportedVariants(c)[0] || 'normal'))}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="trade-list">
          {side.length === 0 && <div className="trade-empty">No cards yet — search above.</div>}
          {side.map((item, idx) => {
            const card = cardById.get(item.cardId);
            if (!card) return null;
            const supported = getSupportedVariants(card);
            const val = lineValue(item);
            return (
              <div key={`${item.cardId}-${item.variant}-${idx}`} className="trade-row">
                <img className="trade-row-img" src={card.imageUrl} alt="" loading="lazy" />
                <div className="trade-row-main">
                  <div className="trade-row-name">{card.name}</div>
                  <select
                    className="trade-row-variant"
                    value={item.variant}
                    onChange={(e) =>
                      setSide((prev) => prev.map((i, k) => (k === idx ? { ...i, variant: e.target.value } : i)))
                    }
                  >
                    {supported.map((v) => (
                      <option key={v} value={v}>{VARIANT_LABELS[v] || v}</option>
                    ))}
                  </select>
                </div>
                <div className="trade-row-qty">
                  <button onClick={() => setSide((prev) => prev.map((i, k) => (k === idx ? { ...i, qty: Math.max(1, i.qty - 1) } : i)))}>−</button>
                  <span>{item.qty}</span>
                  <button onClick={() => setSide((prev) => prev.map((i, k) => (k === idx ? { ...i, qty: Math.min(99, i.qty + 1) } : i)))}>+</button>
                </div>
                <div className="trade-row-value">
                  {val === null ? <span className="trade-unpriced">—</span> : formatPrice(val)}
                </div>
                <button
                  className="trade-row-remove"
                  onClick={() => setSide((prev) => prev.filter((_, k) => k !== idx))}
                  aria-label="Remove"
                >×</button>
              </div>
            );
          })}
        </div>

        <div className="trade-side-foot">
          <span>{side.reduce((s, i) => s + i.qty, 0)} cards</span>
          {side.length > 0 && (
            <button className="trade-clear" onClick={() => setSide([])}>Clear</button>
          )}
        </div>
      </div>
    );
  };

  const copyQuote = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Trade quote link copied');
  };

  const fairness = Math.abs(diff) < 0.01
    ? 'Even trade'
    : diff > 0
      ? `Your side is ${formatPrice(diff)} higher`
      : `Their side is ${formatPrice(-diff)} higher`;

  return (
    <>
      <Header isOwnCollection={false} />
      <main className="trade-page">
        <div className="trade-page-head">
          <div>
            <h1>Trade Calculator</h1>
            <p>Compare two sides of a trade at live DYLI market floors.</p>
          </div>
          <button className="trade-copy-btn" onClick={copyQuote}>Copy shareable link</button>
        </div>

        <div className="trade-columns">
          <Side label="Your side" side={sideA} setSide={setSideA} total={totalA} accent="#4ade80" />
          <Side label="Their side" side={sideB} setSide={setSideB} total={totalB} accent="#60a5fa" />
        </div>

        <div className={`trade-verdict ${Math.abs(diff) < 0.01 ? 'even' : 'uneven'}`}>
          <div className="trade-verdict-nums">
            <span className="trade-verdict-a">{formatPrice(totalA)}</span>
            <span className="trade-verdict-vs">vs</span>
            <span className="trade-verdict-b">{formatPrice(totalB)}</span>
          </div>
          <div className="trade-verdict-diff">
            {fairness}
            {Math.abs(diff) >= 0.01 && (
              <small> · add ~{formatPrice(Math.abs(diff))} to the lighter side to even it out</small>
            )}
          </div>
        </div>

        {dyliUpdated && (
          <p className="trade-source">DYLI market prices from {dyliUpdated.toLocaleDateString()}</p>
        )}
      </main>
    </>
  );
}
