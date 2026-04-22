import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import Header from './Header';
import { MarketplaceNotice, ListingCard } from './MarketplaceCommon';
import { getCardRecord, useListings, useMarketplace } from '../hooks/useMarketplace';
import { useAuth } from '../hooks/useAuth';

function cardTextToHtml(cardText = '') {
  return cardText.replace(/\|/g, '<br>').replace(/_([A-Z])_/g, '[$1]');
}

export default function CardDetailPage() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useAuth();
  const { createOrOpenConversation, busy } = useMarketplace();
  const { listings, loading } = useListings({ status: 'active', cardId });
  const [actionError, setActionError] = useState('');

  const card = getCardRecord(cardId);
  const cardListings = useMemo(
    () => listings
      .filter((listing) => listing.cardId === cardId && listing.status === 'active')
      .sort((left, right) => (left.price ?? 0) - (right.price ?? 0)),
    [cardId, listings]
  );

  if (!card) {
    return <Navigate to="/marketplace" replace />;
  }

  const handleContact = async (listing, intentType) => {
    setActionError('');
    try {
      if (!user) {
        await signInWithGoogle();
        return;
      }
      const conversationId = await createOrOpenConversation({ listing, intentType });
      if (conversationId) {
        navigate(`/messages/${conversationId}`);
      }
    } catch (error) {
      setActionError(error.message || 'Unable to open conversation.');
    }
  };

  return (
    <div className="app">
      <Header />
      <div className="container">
        <div className="page-header marketplace-page-header">
          <div>
            <div className="detail-breadcrumbs">
              <Link to="/marketplace">Marketplace</Link>
              <span>/</span>
              <span>{card.name}</span>
            </div>
            <h1>{card.name}</h1>
            <p>{card.set === 'Eth' ? 'Enter the Huddle' : 'Legend of the Lils'} #{card.setNumber} - {card.rarity} - {card.type}</p>
          </div>
        </div>

        <div className="card-detail-grid">
          <section className="panel card-detail-panel">
            <div className="card-detail-visual">
              <img src={card.imageUrl} alt={card.name} className="card-detail-image" />
            </div>
            <div className="card-detail-copy">
              <div className="listing-card-details">
                <span>{card.color}</span>
                {card.cost?.amount !== undefined && <span>Cost {card.cost.amount}</span>}
                {card.vibe !== null && <span>Vibe {card.vibe}</span>}
              </div>
              <div className="card-text-box" dangerouslySetInnerHTML={{ __html: cardTextToHtml(card.cardText) }} />
            </div>
          </section>

          <aside className="panel">
            <div className="section-header compact">
              <h2>Community listings</h2>
              <span>{cardListings.length} active</span>
            </div>
            <MarketplaceNotice compact />
            {loading ? (
              <div className="loading">Loading listings...</div>
            ) : cardListings.length === 0 ? (
              <div className="empty-state compact">
                <h3>No active listings yet</h3>
                <p>Be the first seller to list this card in the community marketplace.</p>
                <Link to="/marketplace/my-listings" className="action-btn primary">Create a listing</Link>
              </div>
            ) : (
              <div className="listing-stack">
                {cardListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    actions={(
                      <>
                        <button className="action-btn secondary" onClick={() => handleContact(listing, 'contact')} disabled={busy}>
                          Contact seller
                        </button>
                        <button className="action-btn primary" onClick={() => handleContact(listing, 'commit')} disabled={busy}>
                          Commit to buy
                        </button>
                      </>
                    )}
                  />
                ))}
              </div>
            )}
            {actionError && <p className="error-text">{actionError}</p>}
          </aside>
        </div>
      </div>
    </div>
  );
}
