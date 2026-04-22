import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDecks } from '../hooks/useDecks';
import SiteDisclaimer from './SiteDisclaimer';

export default function LandingPage() {
  const { user, signInWithGoogle } = useAuth();
  const { publicDecks } = useDecks();

  const topDecks = publicDecks.slice(0, 4);

  return (
    <div className="landing">
      <header className="landing-header">
        <Link to="/" className="landing-logo">
          <span className="logo-icon" aria-hidden="true">🐧</span>
          <span className="logo-text">VibesTracker</span>
        </Link>
        <nav className="landing-nav">
          <Link to="/collection">Collection</Link>
          <Link to="/decks">Decks</Link>
          <Link to="/marketplace">Marketplace</Link>
          <Link to="/set3-spoilers">Set 3 Spoilers</Link>
          {user ? (
            <Link to="/marketplace/my-listings" className="nav-cta">My Listings</Link>
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
          <div className="penguin-float" aria-hidden="true">🐧</div>
        </div>
        <div className="hero-content">
          <h1>Track, Build, and <span className="gradient-text">Trade Vibes</span></h1>
          <p className="hero-subtitle">Everything you need to track cards, explore decks, and trade with the Vibes community.</p>
          <div className="hero-actions">
            <Link to="/marketplace" className="btn-primary">
              Browse Marketplace
              <span className="btn-arrow">→</span>
            </Link>
            <Link to="/collection" className="btn-secondary">Open Collection</Link>
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
            <div className="feature-icon">COL</div>
            <h3>Collection Tracking</h3>
            <p>Track every card across Normal, Foil, Arctic, and Sketch variants while measuring playset and master-set progress.</p>
            <Link to="/collection" className="feature-link">Start collecting →</Link>
          </div>
          <div className="feature-card">
            <div className="feature-icon">DECK</div>
            <h3>Deck Builder</h3>
            <p>Build 52-card decks visually, publish them to the community, and iterate without leaving the tracker.</p>
            <Link to="/builder" className="feature-link">Build a deck →</Link>
          </div>
          <div className="feature-card">
            <div className="feature-icon">P2P</div>
            <h3>Marketplace Discovery</h3>
            <p>Compare live card listings, browse seller profiles, and start private buyer-seller threads inside the site.</p>
            <Link to="/marketplace" className="feature-link">Browse listings →</Link>
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
            {topDecks.map((deck) => (
              <Link to={`/deck/${deck.id}`} key={deck.id} className="deck-preview-card">
                <div className="deck-preview-colors">
                  {deck.colors?.map((color) => (
                    <span key={color} className={`color-pip color-${color.toLowerCase()}`}></span>
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
          <h2>Ready to sell or discover cards?</h2>
          <p>Set up your seller profile, post your first listing, and keep buyer conversations on-platform.</p>
          {user ? (
            <Link to="/marketplace/my-listings" className="btn-primary">Go to My Listings →</Link>
          ) : (
            <button onClick={signInWithGoogle} className="btn-primary">
              Sign In with Google
            </button>
          )}
        </div>
        <div className="cta-penguins">
          <span aria-hidden="true">🐧</span>
          <span aria-hidden="true">🐧</span>
          <span aria-hidden="true">🐧</span>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="logo-icon" aria-hidden="true">🐧</span>
            <span>VibesTracker</span>
          </div>
          <div className="footer-links">
            <Link to="/collection">Collection</Link>
            <Link to="/decks">Decks</Link>
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/set3-spoilers">Set 3 Spoilers</Link>
            <Link to="/builder">Deck Builder</Link>
          </div>
          <div className="footer-credit">
            <p>Fan-made tool for <a href="https://vibes.game" target="_blank" rel="noopener noreferrer">Pudgy Penguins TCG</a></p>
          </div>
        </div>
      </footer>
      <SiteDisclaimer />
    </div>
  );
}
