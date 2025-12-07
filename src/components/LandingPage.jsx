import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDecks } from '../hooks/useDecks';

export default function LandingPage() {
  const { user, signInWithGoogle } = useAuth();
  const { publicDecks, loading } = useDecks();

  const topDecks = publicDecks.slice(0, 4);

  return (
    <div className="landing">
      <header className="landing-header">
        <Link to="/" className="landing-logo">
          <span className="logo-icon">🐧</span>
          <span className="logo-text">VibesTracker</span>
        </Link>
        <nav className="landing-nav">
          <Link to="/collection">Collection</Link>
          <Link to="/decks">Decks</Link>
          {user ? (
            <Link to="/collection" className="nav-cta">My Collection</Link>
          ) : (
            <button onClick={signInWithGoogle} className="nav-cta">Sign In</button>
          )}
        </nav>
      </header>

      <section className="hero">
        <div className="hero-bg">
          <div className="ice-shape ice-1"></div>
          <div className="ice-shape ice-2"></div>
          <div className="ice-shape ice-3"></div>
          <div className="penguin-float">🐧</div>
        </div>
        <div className="hero-content">
          <h1>Track Your <span className="gradient-text">Vibes</span></h1>
          <p className="hero-subtitle">The ultimate collection tracker and deck builder for Pudgy Penguins TCG</p>
          <div className="hero-actions">
            <Link to="/collection" className="btn-primary">
              Start Tracking
              <span className="btn-arrow">→</span>
            </Link>
            <Link to="/decks" className="btn-secondary">Browse Decks</Link>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="stat-number">351</span>
              <span className="stat-label">Cards</span>
            </div>
            <div className="hero-stat">
              <span className="stat-number">2</span>
              <span className="stat-label">Sets</span>
            </div>
            <div className="hero-stat">
              <span className="stat-number">4</span>
              <span className="stat-label">Variants</span>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <h3>Collection Tracking</h3>
            <p>Track every card across Normal, Foil, Arctic, and Sketch variants. See your progress toward playset and master completion.</p>
            <Link to="/collection" className="feature-link">Start collecting →</Link>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🃏</div>
            <h3>Deck Builder</h3>
            <p>Build 52-card decks with our visual builder. Import and export deck codes compatible with the Vibes TCG client.</p>
            <Link to="/builder" className="feature-link">Build a deck →</Link>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🌐</div>
            <h3>Share & Discover</h3>
            <p>Share your decks with the community. Browse popular builds, upvote your favorites, and copy decks to customize.</p>
            <Link to="/decks" className="feature-link">Explore decks →</Link>
          </div>
        </div>
      </section>

      {topDecks.length > 0 && (
        <section className="popular-decks">
          <div className="section-header">
            <h2>Popular Decks</h2>
            <Link to="/decks" className="see-all">See all →</Link>
          </div>
          <div className="decks-preview">
            {topDecks.map(deck => (
              <Link to={`/deck/${deck.id}`} key={deck.id} className="deck-preview-card">
                <div className="deck-preview-colors">
                  {deck.colors?.map(c => (
                    <span key={c} className={`color-pip color-${c.toLowerCase()}`}></span>
                  ))}
                </div>
                <h4>{deck.name}</h4>
                <div className="deck-preview-meta">
                  <span>by {deck.username}</span>
                  <span className="upvotes">▲ {deck.upvotes || 0}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to track your collection?</h2>
          <p>Join the Vibes TCG community and start building your ultimate deck.</p>
          {user ? (
            <Link to="/collection" className="btn-primary">Go to Collection →</Link>
          ) : (
            <button onClick={signInWithGoogle} className="btn-primary">
              Sign In with Google
            </button>
          )}
        </div>
        <div className="cta-penguins">
          <span>🐧</span>
          <span>🐧</span>
          <span>🐧</span>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="logo-icon">🐧</span>
            <span>VibesTracker</span>
          </div>
          <div className="footer-links">
            <Link to="/collection">Collection</Link>
            <Link to="/decks">Decks</Link>
            <Link to="/builder">Deck Builder</Link>
          </div>
          <div className="footer-credit">
            <p>Fan-made tool for <a href="https://vibes.game" target="_blank" rel="noopener noreferrer">Pudgy Penguins TCG</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
