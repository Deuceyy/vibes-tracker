import { useMemo, useState } from 'react';
import Header from './Header';
import sketchCards from '../data/sketchCards.js';
import { getSetLabel } from '../lib/cardMetadata.js';

const SET_ORDER = { Eth: 1, Lotl: 2, S3: 3 };

function fmt(price) {
  if (price === null || price === undefined) return '—';
  return `$${Number(price).toFixed(2)}`;
}

export default function SketchGalleryPage() {
  const [search, setSearch] = useState('');
  const [setFilter, setSetFilter] = useState('All');
  const [sort, setSort] = useState('name');
  const [zoom, setZoom] = useState(null);

  const cards = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = sketchCards.filter((c) => {
      if (setFilter !== 'All' && c.setOfOrigin !== setFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list];
    if (sort === 'price-desc') list.sort((a, b) => (b.floor ?? -1) - (a.floor ?? -1));
    else if (sort === 'price-asc') list.sort((a, b) => (a.floor ?? Infinity) - (b.floor ?? Infinity));
    else if (sort === 'set') list.sort((a, b) => (SET_ORDER[a.setOfOrigin] || 9) - (SET_ORDER[b.setOfOrigin] || 9) || a.name.localeCompare(b.name));
    else list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [search, setFilter, sort]);

  const totalFloor = useMemo(
    () => sketchCards.reduce((s, c) => s + (c.floor || 0), 0),
    []
  );

  return (
    <>
      <Header isOwnCollection={false} />
      <main className="sketch-page">
        <section className="sketch-hero">
          <div>
            <h1>Sketch Gallery</h1>
            <p>
              The hand-drawn, serialized sketch cards across every set — the rarest chases in Vibes.
              Prices are live DYLI market floors.
            </p>
          </div>
          <div className="sketch-hero-meta">
            <div className="sketch-meta-card">
              <span>Sketch cards</span>
              <strong>{sketchCards.length}</strong>
            </div>
            <div className="sketch-meta-card">
              <span>Full-set floor</span>
              <strong>{fmt(totalFloor)}</strong>
            </div>
          </div>
        </section>

        <section className="sketch-toolbar">
          <input
            type="text"
            className="search-input"
            placeholder="Search sketches…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: '1 1 220px', minWidth: 200 }}
          />
          <select className="search-input" value={setFilter} onChange={(e) => setSetFilter(e.target.value)}>
            <option value="All">All Sets</option>
            <option value="Eth">Enter the Huddle</option>
            <option value="Lotl">Legend of the Lils</option>
            <option value="S3">Birb and Pengu</option>
          </select>
          <select className="search-input" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Name (A–Z)</option>
            <option value="price-desc">Price (High–Low)</option>
            <option value="price-asc">Price (Low–High)</option>
            <option value="set">Set order</option>
          </select>
          <span className="sketch-count">{cards.length} shown</span>
        </section>

        <section className="sketch-grid">
          {cards.map((c) => (
            <article key={c.id} className="sketch-card">
              <button className="sketch-card-img" onClick={() => setZoom(c)} aria-label={`Zoom ${c.name}`}>
                {c.image ? <img src={c.image} alt={c.name} loading="lazy" /> : <div className="sketch-noimg">No image</div>}
              </button>
              <div className="sketch-card-info">
                <div className="sketch-card-name" title={c.name}>{c.name.replace(/ Sketch$/, '')}</div>
                <div className="sketch-card-meta">
                  <span>{c.setOfOrigin ? getSetLabel(c.setOfOrigin) : ''}</span>
                  <span className="sketch-card-price">{fmt(c.floor)}</span>
                </div>
                <a className="sketch-card-buy" href={c.url} target="_blank" rel="noopener noreferrer">
                  View on DYLI →
                </a>
              </div>
            </article>
          ))}
        </section>

        {cards.length === 0 && <div className="sketch-empty">No sketches match those filters.</div>}
      </main>

      {zoom && (
        <div className="sketch-zoom-overlay" onClick={() => setZoom(null)}>
          <div className="sketch-zoom" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.image} alt={zoom.name} />
            <div className="sketch-zoom-info">
              <strong>{zoom.name}</strong>
              <span>{zoom.setOfOrigin ? getSetLabel(zoom.setOfOrigin) : ''} · floor {fmt(zoom.floor)}</span>
              <a href={zoom.url} target="_blank" rel="noopener noreferrer">View on DYLI →</a>
            </div>
            <button className="sketch-zoom-close" onClick={() => setZoom(null)}>×</button>
          </div>
        </div>
      )}
    </>
  );
}
