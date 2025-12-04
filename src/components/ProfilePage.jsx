import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useCollection, cardData, VARIANTS } from '../hooks/useCollection';
import CardModal from './CardModal';

const RARITY_ORDER = { 'Common': 1, 'Uncommon': 2, 'Rare': 3, 'Mythic': 4 };

export default function ProfilePage() {
  const { username } = useParams();
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    async function findUser() {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', username.toLowerCase()));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          setNotFound(true);
        } else {
          const userDoc = snapshot.docs[0];
          setUserId(userDoc.id);
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error('Error finding user:', error);
        setNotFound(true);
      }
      setLoadingProfile(false);
    }
    
    findUser();
  }, [username]);

  const {
    loading: loadingCollection,
    getCardVariants,
    getTotalOwned,
    hasPlayset,
    hasMasterSet,
    stats
  } = useCollection(userId);

  const [filters, setFilters] = useState({
    search: '',
    color: 'All',
    type: 'All',
    rarity: 'All',
    set: 'All',
    owned: 'All',
    sort: 'name-asc'
  });

  const [selectedCard, setSelectedCard] = useState(null);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const filteredCards = useMemo(() => {
    let cards = cardData.filter(card => {
      if (filters.search && !card.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.color !== 'All' && card.color !== filters.color) return false;
      if (filters.type !== 'All' && !card.type.includes(filters.type)) return false;
      if (filters.rarity !== 'All' && card.rarity !== filters.rarity) return false;
      if (filters.set !== 'All' && card.set !== filters.set) return false;

      const total = getTotalOwned(card.id);
      if (filters.owned === 'owned' && total === 0) return false;
      if (filters.owned === 'missing' && total > 0) return false;

      return true;
    });

    const [field, dir] = filters.sort.split('-');
    const mult = dir === 'asc' ? 1 : -1;

    cards.sort((a, b) => {
      switch (field) {
        case 'name': return mult * a.name.localeCompare(b.name);
        case 'owned': return mult * (getTotalOwned(a.id) - getTotalOwned(b.id));
        case 'rarity': return mult * ((RARITY_ORDER[a.rarity] || 0) - (RARITY_ORDER[b.rarity] || 0));
        default: return 0;
      }
    });

    return cards;
  }, [filters, getTotalOwned]);

  if (loadingProfile) {
    return <div className="loading">Loading profile...</div>;
  }

  if (notFound) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="penguin-emoji">🐧❓</div>
          <h3>User not found</h3>
          <p>No user with username "{username}" exists.</p>
          <Link to="/" className="action-btn primary" style={{ marginTop: '1rem', display: 'inline-block', textDecoration: 'none' }}>
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (loadingCollection) {
    return <div className="loading">Loading collection...</div>;
  }

  return (
    <>
      <header className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            <span className="logo-icon">🐧</span>
            <div>
              <div className="logo-text">VibesTracker</div>
              <div className="logo-subtitle">Pudgy Penguins TCG</div>
            </div>
          </Link>

          <div className="profile-info">
            {userProfile?.photoURL && (
              <img src={userProfile.photoURL} alt="" className="profile-avatar" />
            )}
            <div>
              <div className="profile-name">{userProfile?.displayName || username}</div>
              <div className="profile-username">@{username}</div>
            </div>
          </div>

          <div className="stats-bar">
            <div className="stat-item">
              <div className="stat-value">{stats.uniqueCards}</div>
              <div className="stat-label">Unique</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.totalCards}</div>
              <div className="stat-label">Total</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{Math.round((stats.playsetComplete / stats.totalInSet) * 100)}%</div>
              <div className="stat-label">Playset</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{Math.round((stats.masterComplete / stats.totalInSet) * 100)}%</div>
              <div className="stat-label">Master</div>
            </div>
          </div>
        </div>
      </header>

      <div className="container">
        <section className="filters-section">
          <div className="filters-row">
            <div className="filter-group" style={{ flex: 2 }}>
              <label className="filter-label">Search</label>
              <input
                type="text"
                className="search-input"
                placeholder="Search cards..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
              />
            </div>
            <div className="filter-group small">
              <label className="filter-label">Show</label>
              <select className="search-input" value={filters.owned} onChange={(e) => updateFilter('owned', e.target.value)}>
                <option value="All">All Cards</option>
                <option value="owned">Owned Only</option>
                <option value="missing">Missing Only</option>
              </select>
            </div>
            <div className="filter-group small">
              <label className="filter-label">Sort</label>
              <select className="search-input" value={filters.sort} onChange={(e) => updateFilter('sort', e.target.value)}>
                <option value="name-asc">Name (A-Z)</option>
                <option value="owned-desc">Most Owned</option>
                <option value="rarity-desc">Rarity (M→C)</option>
              </select>
            </div>
            <div className="filter-group" style={{ flex: 'none' }}>
              <label className="filter-label">Color</label>
              <div className="color-filters">
                {['All', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Colorless'].map(color => (
                  <button
                    key={color}
                    className={`color-pill ${filters.color === color ? 'active' : ''}`}
                    onClick={() => updateFilter('color', color)}
                  >
                    {color === 'All' ? 'All' : 
                     color === 'Red' ? '🔴' :
                     color === 'Blue' ? '🔵' :
                     color === 'Green' ? '🟢' :
                     color === 'Yellow' ? '🟡' :
                     color === 'Purple' ? '🟣' : '⚪'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card-grid">
          {filteredCards.map(card => {
            const variants = getCardVariants(card.id);
            const total = getTotalOwned(card.id);
            const isPlaysetComplete = hasPlayset(card.id);
            const isMasterComplete = hasMasterSet(card.id);

            let statusClass = '';
            if (isMasterComplete) statusClass = 'master-complete';
            else if (isPlaysetComplete) statusClass = 'playset-complete';
            else if (total > 0) statusClass = 'owned';

            return (
              <div key={card.id} className={`card-item ${statusClass}`} onClick={() => setSelectedCard(card)}>
                <div className="card-image-container">
                  <img 
                    className="card-image"
                    src={card.imageUrl}
                    alt={card.name}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  <div className="card-image-placeholder" style={{ display: 'none' }}>
                    <span className="penguin-emoji">🐧</span>
                    <span>{card.name}</span>
                  </div>
                  <div className={`rarity-badge ${card.rarity}`} />
                  <div className={`color-stripe ${card.color}`} />
                </div>
                <div className="card-info">
                  <div className="card-name">{card.name}</div>
                  <div className="card-details">
                    <span>{card.type}</span>
                    <span>
                      {total > 0 && (
                        <span className="owned-badge">
                          {variants.normal > 0 && `${variants.normal}N `}
                          {variants.foil > 0 && `${variants.foil}F `}
                          {variants.arctic > 0 && `${variants.arctic}A `}
                          {variants.sketch > 0 && `${variants.sketch}S`}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {selectedCard && (
        <CardModal
          card={selectedCard}
          variants={getCardVariants(selectedCard.id)}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </>
  );
}
