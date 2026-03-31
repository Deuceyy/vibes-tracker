import Header from './Header.jsx';

const spoilerCards = [
  {
    name: 'Victorious Penguin',
    image: '/set3-spoilers/victorious-penguin.png',
    color: 'Green',
    type: 'Character - Penguin',
    cost: 4,
    vibe: 4,
    collectorNumber: '3172 / 79/195',
    effect: 'At the end of Action Time, if you have the Baron, put a vibe counter on each Character in your huddle.'
  },
  {
    name: 'Vibe Scan',
    image: '/set3-spoilers/vibe-scan.png',
    color: 'Red',
    type: 'Action',
    cost: 1,
    collectorNumber: 'Birb - 23/195',
    effect: 'Choose a Character with vibe 2 or less and ice it.'
  },
  {
    name: 'True Form',
    image: '/set3-spoilers/true-form.png',
    color: 'Yellow',
    type: 'Action',
    cost: 2,
    collectorNumber: 'Birb, Moonbird 1899 - 59/195',
    effect: "Choose a Character and ice it. At the start of the next Cycle, return it from ice to its owner's huddle."
  },
  {
    name: 'Prized Birb',
    image: '/set3-spoilers/prized-birb.png',
    color: 'Purple',
    type: 'Character - Birb',
    cost: 3,
    vibe: 2,
    collectorNumber: 'Moonbird 9142 - 138/195',
    effect: 'When this Character is iced, the player that iced it draws a card.'
  },
  {
    name: 'Pengu',
    image: '/set3-spoilers/pengu.png',
    color: 'Blue',
    type: 'Character - Penguin',
    cost: 3,
    vibe: 2,
    collectorNumber: 'Pengu - 104/195',
    effect: 'Playable during Action Time as if it were an Action.'
  },
  {
    name: 'Birb',
    image: '/set3-spoilers/birb.png',
    color: 'Red',
    type: 'Character - Birb',
    cost: 2,
    vibe: 1,
    collectorNumber: 'Birb - 3/195',
    effect: 'When this Character enters the huddle, reveal the top two cards of your deck. Pick up to one Action card with Fudge cost 2 or less and draw it. Put the rest on the bottom of your deck.'
  }
];

export default function Set3SpoilersPage() {
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
              <span className="set3-meta-label">Spoilers Live</span>
              <strong>6 cards</strong>
            </div>
            <div className="set3-meta-card">
              <span className="set3-meta-label">Colors Shown</span>
              <strong>5 colors</strong>
            </div>
          </div>
        </section>

        <section className="set3-grid" aria-label="Set 3 spoiler cards">
          {spoilerCards.map((card) => (
            <article key={card.name} className="spoiler-card">
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
                    <strong>{card.cost}</strong>
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
      </main>
    </>
  );
}
