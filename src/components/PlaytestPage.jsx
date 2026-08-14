import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from './Header';
import { useDecks } from '../hooks/useDecks';
import { allTrackerCards } from '../hooks/useCollection';
import { getCanonicalCardType } from '../lib/cardMetadata.js';
import { toast } from '../lib/toast';

const cardById = new Map(allTrackerCards.map((c) => [c.id, c]));

// Fisher–Yates shuffle (returns a new array).
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let INSTANCE = 1;
const makeInstance = (card) => ({ uid: INSTANCE++, card, flopped: false });

const ZONES = ['huddle', 'rods', 'ice', 'hand', 'deckTop', 'deckBottom'];
const ZONE_LABEL = {
  huddle: 'Huddle',
  rods: 'Rods',
  ice: 'Ice',
  hand: 'Hand',
  deckTop: 'Top of Deck',
  deckBottom: 'Bottom of Deck',
};

export default function PlaytestPage() {
  const { deckId: routeDeckId } = useParams();
  const navigate = useNavigate();
  const { myDecks, getDeck } = useDecks();

  const [deckMeta, setDeckMeta] = useState(null);
  const [deck, setDeck] = useState([]);       // instances, index 0 = top
  const [hand, setHand] = useState([]);
  const [huddle, setHuddle] = useState([]);
  const [rods, setRods] = useState([]);
  const [ice, setIce] = useState([]);
  const [turn, setTurn] = useState(0);
  const [counters, setCounters] = useState({ pudge: 0, fish: 0, vibe: 0 });
  const [menu, setMenu] = useState(null); // { uid, zone }
  const [preview, setPreview] = useState(null); // card

  const zones = { deck, hand, huddle, rods, ice };
  const setters = { deck: setDeck, hand: setHand, huddle: setHuddle, rods: setRods, ice: setIce };

  const deckOptions = useMemo(() => myDecks || [], [myDecks]);

  const startWithDeck = (deckDoc) => {
    const instances = [];
    (deckDoc.cards || []).forEach(({ cardId, quantity }) => {
      const card = cardById.get(cardId);
      if (!card) return;
      for (let i = 0; i < quantity; i += 1) instances.push(makeInstance(card));
    });
    const shuffled = shuffle(instances);
    setDeckMeta(deckDoc);
    setDeck(shuffled.slice(5));
    setHand(shuffled.slice(0, 5));
    setHuddle([]); setRods([]); setIce([]);
    setTurn(1);
    setCounters({ pudge: 0, fish: 0, vibe: 0 });
    setMenu(null);
  };

  // Load a deck passed by URL.
  useEffect(() => {
    if (!routeDeckId) return;
    getDeck(routeDeckId).then((d) => { if (d) startWithDeck(d); });
  }, [routeDeckId, getDeck]);

  // --- card movement ---------------------------------------------------
  const findZone = (uid) => {
    for (const z of ['hand', 'huddle', 'rods', 'ice', 'deck']) {
      if (zones[z].some((x) => x.uid === uid)) return z;
    }
    return null;
  };

  const move = (uid, target) => {
    const from = findZone(uid);
    if (!from) return;
    const inst = zones[from].find((x) => x.uid === uid);
    // remove from source
    setters[from]((prev) => prev.filter((x) => x.uid !== uid));
    const dropInst = { ...inst };
    if (target === 'deckTop') setDeck((prev) => [dropInst, ...prev]);
    else if (target === 'deckBottom') setDeck((prev) => [...prev, dropInst]);
    else if (target === 'huddle') setHuddle((prev) => [...prev, dropInst]);
    else if (target === 'rods') setRods((prev) => [...prev, { ...dropInst, flopped: false }]);
    else if (target === 'ice') setIce((prev) => [...prev, { ...dropInst, flopped: false }]);
    else if (target === 'hand') setHand((prev) => [...prev, { ...dropInst, flopped: false }]);
    setMenu(null);
  };

  const toggleFlop = (uid) => {
    const from = findZone(uid);
    if (!from) return;
    setters[from]((prev) => prev.map((x) => (x.uid === uid ? { ...x, flopped: !x.flopped } : x)));
    setMenu(null);
  };

  // --- table actions ---------------------------------------------------
  const draw = (n = 1) => {
    setDeck((prevDeck) => {
      const drawn = prevDeck.slice(0, n);
      if (drawn.length < n) toast.error('Deck is empty');
      setHand((prevHand) => [...prevHand, ...drawn]);
      return prevDeck.slice(drawn.length);
    });
  };

  const mulligan = () => {
    // Shuffle hand back in and draw a fresh 5.
    const combined = shuffle([...deck, ...hand]);
    setDeck(combined.slice(5));
    setHand(combined.slice(0, 5));
    toast.success('Mulligan — new hand of 5');
  };

  const shuffleDeck = () => { setDeck((p) => shuffle(p)); toast.success('Deck shuffled'); };

  const nextTurn = () => {
    setTurn((t) => t + 1);
    // Unflop everything (new cycle), draw for the turn.
    setHuddle((p) => p.map((x) => ({ ...x, flopped: false })));
    setRods((p) => p.map((x) => ({ ...x, flopped: false })));
    draw(1);
  };

  const bump = (key, delta) =>
    setCounters((c) => ({ ...c, [key]: Math.max(0, c[key] + delta) }));

  const menuActions = (uid, zone) => {
    const targets = ZONES.filter((z) => {
      if (zone === 'hand' && z === 'hand') return false;
      if (zone === 'huddle' && z === 'huddle') return false;
      if (zone === 'rods' && z === 'rods') return false;
      if (zone === 'ice' && z === 'ice') return false;
      return true;
    });
    return targets;
  };

  // ---------------------------------------------------------------------
  if (!deckMeta) {
    return (
      <>
        <Header isOwnCollection={false} />
        <main className="playtest-picker">
          <h1>Goldfish Playtest</h1>
          <p>Solo-test a deck: draw hands, play cards out across your zones, and see how it flows — no opponent, no rules enforcement.</p>
          {deckOptions.length === 0 ? (
            <div className="playtest-empty">
              <p>Sign in and build a deck, then come back here to test it.</p>
              <button className="btn-primary" onClick={() => navigate('/builder')}>Build a Deck</button>
            </div>
          ) : (
            <div className="playtest-deck-list">
              {deckOptions.map((d) => (
                <button key={d.id} className="playtest-deck-choice" onClick={() => startWithDeck(d)}>
                  <span className="playtest-deck-name">{d.name}</span>
                  <span className="playtest-deck-count">{(d.cards || []).reduce((s, c) => s + c.quantity, 0)} cards</span>
                </button>
              ))}
            </div>
          )}
        </main>
      </>
    );
  }

  const CardTile = ({ inst, zone, small }) => (
    <div
      className={`pt-card ${inst.flopped ? 'flopped' : ''} ${small ? 'small' : ''}`}
      onMouseEnter={() => setPreview(inst.card)}
      onClick={() => setMenu(menu?.uid === inst.uid ? null : { uid: inst.uid, zone })}
    >
      <img src={inst.card.imageUrl} alt={inst.card.name} loading="lazy" />
      {menu?.uid === inst.uid && (
        <div className="pt-menu" onClick={(e) => e.stopPropagation()}>
          {(zone === 'huddle' || zone === 'rods') && (
            <button onClick={() => toggleFlop(inst.uid)}>{inst.flopped ? 'Unflop' : 'Flop'}</button>
          )}
          {menuActions(inst.uid, zone).map((z) => (
            <button key={z} onClick={() => move(inst.uid, z)}>{ZONE_LABEL[z]}</button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Header isOwnCollection={false} />
      <main className="playtest">
        <div className="pt-topbar">
          <div className="pt-topbar-left">
            <button className="pt-exit" onClick={() => setDeckMeta(null)}>← Decks</button>
            <span className="pt-deckname">{deckMeta.name}</span>
            <span className="pt-turn">Turn {turn}</span>
          </div>
          <div className="pt-topbar-actions">
            <button onClick={() => draw(1)}>Draw</button>
            <button onClick={mulligan}>Mulligan</button>
            <button onClick={shuffleDeck}>Shuffle</button>
            <button className="pt-next" onClick={nextTurn}>Next Turn →</button>
            <button onClick={() => startWithDeck(deckMeta)}>Reset</button>
          </div>
        </div>

        <div className="pt-layout">
          <aside className="pt-side">
            <div className="pt-counts">
              <div><span>Deck</span><strong>{deck.length}</strong></div>
              <div><span>Hand</span><strong>{hand.length}</strong></div>
              <div><span>Ice</span><strong>{ice.length}</strong></div>
            </div>
            {['pudge', 'fish', 'vibe'].map((k) => (
              <div key={k} className="pt-counter">
                <span>{k[0].toUpperCase() + k.slice(1)}</span>
                <div className="pt-counter-ctl">
                  <button onClick={() => bump(k, -1)}>−</button>
                  <strong>{counters[k]}</strong>
                  <button onClick={() => bump(k, 1)}>+</button>
                </div>
              </div>
            ))}
            <div className="pt-preview">
              {preview ? <img src={preview.imageUrl} alt={preview.name} /> : <span>Hover a card to preview</span>}
            </div>
          </aside>

          <section className="pt-board">
            <div className="pt-zone">
              <div className="pt-zone-head">Huddle <span>{huddle.length}</span></div>
              <div className="pt-zone-cards">
                {huddle.map((inst) => <CardTile key={inst.uid} inst={inst} zone="huddle" />)}
                {huddle.length === 0 && <div className="pt-zone-empty">Play characters here (click a hand card → Huddle)</div>}
              </div>
            </div>

            <div className="pt-zone">
              <div className="pt-zone-head">Rods / Relics / Fits <span>{rods.length}</span></div>
              <div className="pt-zone-cards">
                {rods.map((inst) => <CardTile key={inst.uid} inst={inst} zone="rods" />)}
                {rods.length === 0 && <div className="pt-zone-empty">Face-down Rods and support cards</div>}
              </div>
            </div>

            <div className="pt-zone pt-zone-ice">
              <div className="pt-zone-head">Ice <span>{ice.length}</span></div>
              <div className="pt-zone-cards">
                {ice.map((inst) => <CardTile key={inst.uid} inst={inst} zone="ice" small />)}
                {ice.length === 0 && <div className="pt-zone-empty">Iced cards go here</div>}
              </div>
            </div>
          </section>
        </div>

        <div className="pt-hand-bar">
          <button className="pt-deckpile" onClick={() => draw(1)}>
            <span className="pt-deckpile-count">{deck.length}</span>
            <span className="pt-deckpile-label">Deck · click to draw</span>
          </button>
          <div className="pt-hand">
            {hand.map((inst) => <CardTile key={inst.uid} inst={inst} zone="hand" />)}
            {hand.length === 0 && <div className="pt-hand-empty">Empty hand — draw or mulligan</div>}
          </div>
        </div>
      </main>
    </>
  );
}
