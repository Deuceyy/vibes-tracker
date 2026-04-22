import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import Header from './Header';
import { ListingCard, MarketplaceNotice, formatDate } from './MarketplaceCommon';
import { useAuth } from '../hooks/useAuth';
import {
  VERIFICATION_REQUEST_STATUSES,
  getSellerAccessStatus,
  useAdminAlerts,
  useAdminCollections,
  useAdminDecks,
  useAdminVerificationRequests,
  useAdminReviews,
  useAdminUsers,
  useConversations,
  useListings,
  useMarketplace
} from '../hooks/useMarketplace';

function totalOwnedCards(cards = {}) {
  return Object.values(cards).reduce((sum, variants) => (
    sum + Object.values(variants || {}).reduce((variantSum, count) => variantSum + (Number(count) || 0), 0)
  ), 0);
}

function AdminStatCard({ label, value, helper }) {
  return (
    <div className="deck-metric-card admin-stat-card">
      <span className="deck-metric-label">{label}</span>
      <strong>{value}</strong>
      {helper && <span className="admin-helper">{helper}</span>}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button type="button" className={`admin-tab ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

export default function AdminPanelPage({ initialTab = 'overview' }) {
  const { user, userProfile, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isAdmin,
    adminDeleteDeck,
    adminDeleteListing,
    adminDeleteReview,
    adminDeleteDemoReviews,
    adminSeedDemoReviews,
    adminSetSellerVerified,
    adminSetUserAdmin,
    adminToggleDeckVisibility,
    adminUpdateListingStatus,
    adminUpdateVerificationRequest
  } = useMarketplace();

  const urlTab = searchParams.get('tab');
  const [tab, setTab] = useState(urlTab || initialTab);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [requestNotes, setRequestNotes] = useState({});

  const { users, loading: usersLoading } = useAdminUsers(Boolean(user && isAdmin));
  const { collections, loading: collectionsLoading } = useAdminCollections(Boolean(user && isAdmin));
  const { decks, loading: decksLoading } = useAdminDecks(Boolean(user && isAdmin));
  const { requests, loading: requestsLoading } = useAdminVerificationRequests(Boolean(user && isAdmin));
  const { reviews, loading: reviewsLoading } = useAdminReviews(Boolean(user && isAdmin));
  const { pendingVerificationRequests } = useAdminAlerts(Boolean(user && isAdmin));
  const { listings, loading: listingsLoading } = useListings({});
  const { conversations, loading: conversationsLoading } = useConversations({ scope: 'admin', enabled: Boolean(user && isAdmin) });

  const collectionByUser = useMemo(
    () => new Map(collections.map((entry) => [entry.id, totalOwnedCards(entry.cards)])),
    [collections]
  );

  const userById = useMemo(
    () => new Map(users.map((entry) => [entry.id, entry])),
    [users]
  );

  const listingCountBySeller = useMemo(() => {
    const counts = new Map();
    listings.forEach((listing) => {
      counts.set(listing.sellerUserId, (counts.get(listing.sellerUserId) || 0) + 1);
    });
    return counts;
  }, [listings]);

  const convoCountByUser = useMemo(() => {
    const counts = new Map();
    conversations.forEach((conversation) => {
      (conversation.participantIds || []).forEach((participantId) => {
        counts.set(participantId, (counts.get(participantId) || 0) + 1);
      });
    });
    return counts;
  }, [conversations]);

  const overview = useMemo(() => {
    const activeListings = listings.filter((listing) => listing.status === 'active').length;
    const publicDecks = decks.filter((deck) => deck.isPublic).length;
    const sellerProfiles = users.filter((entry) => entry.sellerProfile).length;
    return {
      users: users.length,
      sellerProfiles,
      listings: listings.length,
      activeListings,
      conversations: conversations.length,
      verificationRequests: requests.length,
      pendingVerificationRequests,
      decks: decks.length,
      publicDecks,
      totalCollectionCards: collections.reduce((sum, entry) => sum + totalOwnedCards(entry.cards), 0)
    };
  }, [collections, conversations, decks, listings, pendingVerificationRequests, requests.length, users]);

  useEffect(() => {
    const nextTab = urlTab || initialTab;
    setTab(nextTab);
  }, [initialTab, urlTab]);

  const switchTab = (nextTab) => {
    setTab(nextTab);
    setSearchParams(nextTab === 'overview' ? {} : { tab: nextTab });
  };

  if (!loading && (!user || !isAdmin)) {
    return <Navigate to="/" replace />;
  }

  const runAdminAction = async (action, successMessage) => {
    setError('');
    setFeedback('');
    try {
      await action();
      setFeedback(successMessage);
    } catch (actionError) {
      setError(actionError.message || 'Admin action failed.');
    }
  };

  return (
    <div className="app">
      <Header />
      <div className="container">
        <div className="page-header marketplace-page-header">
          <div>
            <div className="detail-breadcrumbs">
              <span>Hidden route</span>
              <span>/</span>
              <span>Admin</span>
            </div>
            <h1>Admin Control Panel</h1>
            <p>Protected operator view for users, listings, decks, and private marketplace conversations.</p>
          </div>
        </div>

        <MarketplaceNotice compact />

        <section className="panel admin-panel">
          <div className="admin-tabs">
            <TabButton active={tab === 'overview'} onClick={() => switchTab('overview')}>Overview</TabButton>
            <TabButton active={tab === 'requests'} onClick={() => switchTab('requests')}>
              Requests{pendingVerificationRequests > 0 ? ` (${pendingVerificationRequests})` : ''}
            </TabButton>
            <TabButton active={tab === 'users'} onClick={() => switchTab('users')}>Users</TabButton>
            <TabButton active={tab === 'reviews'} onClick={() => switchTab('reviews')}>Reviews</TabButton>
            <TabButton active={tab === 'listings'} onClick={() => switchTab('listings')}>Listings</TabButton>
            <TabButton active={tab === 'conversations'} onClick={() => switchTab('conversations')}>Conversations</TabButton>
            <TabButton active={tab === 'decks'} onClick={() => switchTab('decks')}>Decks</TabButton>
          </div>

          {feedback && <p className="success-text">{feedback}</p>}
          {error && <p className="error-text">{error}</p>}

          {tab === 'overview' && (
            <div className="admin-section">
              <div className="deck-metric-grid admin-metric-grid">
                <AdminStatCard label="Users" value={overview.users} helper={`${overview.sellerProfiles} seller profiles`} />
                <AdminStatCard label="Listings" value={overview.listings} helper={`${overview.activeListings} active`} />
                <AdminStatCard label="Requests" value={overview.verificationRequests} helper={`${overview.pendingVerificationRequests} pending`} />
                <AdminStatCard label="Conversations" value={overview.conversations} />
                <AdminStatCard label="Decks" value={overview.decks} helper={`${overview.publicDecks} public`} />
                <AdminStatCard label="Collection Cards" value={overview.totalCollectionCards} />
              </div>

              <div className="seller-settings-grid">
                <section className="panel">
                  <div className="section-header compact">
                    <h2>Most active sellers</h2>
                  </div>
                  <div className="admin-simple-list">
                    {users
                      .filter((entry) => (listingCountBySeller.get(entry.id) || 0) > 0)
                      .sort((left, right) => (listingCountBySeller.get(right.id) || 0) - (listingCountBySeller.get(left.id) || 0))
                      .slice(0, 8)
                      .map((entry) => (
                        <div key={entry.id} className="admin-simple-row">
                          <div>
                            <strong>{entry.sellerProfile?.displayName || entry.displayName || entry.username || entry.id}</strong>
                            <div className="listing-card-meta">
                              <span>@{entry.username || 'no-username'}</span>
                              <span>{listingCountBySeller.get(entry.id) || 0} listings</span>
                            </div>
                          </div>
                          <Link to={`/u/${entry.username}`} className="text-link">Profile</Link>
                        </div>
                      ))}
                  </div>
                </section>

                <section className="panel">
                  <div className="section-header compact">
                    <h2>Recent conversations</h2>
                  </div>
                  <div className="admin-simple-list">
                    {conversations.slice(0, 8).map((conversation) => (
                      <Link key={conversation.id} to={`/messages/${conversation.id}`} className="admin-simple-row linked">
                        <div>
                          <strong>{conversation.listingSnapshot?.cardName || 'Listing conversation'}</strong>
                          <div className="listing-card-meta">
                            <span>{conversation.messageCount || 0} messages</span>
                            <span>{formatDate(conversation.lastMessageAt)}</span>
                          </div>
                        </div>
                        <span className="text-link">Open</span>
                      </Link>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {tab === 'requests' && (
            <div className="admin-section">
              {requestsLoading ? (
                <div className="loading">Loading requests...</div>
              ) : requests.length === 0 ? (
                <div className="empty-state compact">
                  <h3>No verification requests yet</h3>
                  <p>Seller verification requests will appear here for review.</p>
                </div>
              ) : (
                <div className="admin-user-grid">
                  {requests.map((request) => (
                    <article key={request.id} className="admin-user-card">
                      <div className="admin-user-top">
                        <div>
                          <strong>{request.displayName || request.username || request.userId}</strong>
                          <div className="listing-card-meta">
                            <span>@{request.username || 'no-username'}</span>
                            <span>{formatDate(request.requestedAt)}</span>
                          </div>
                        </div>
                        <span className={`status-pill ${request.status}`}>{request.status}</span>
                      </div>

                      {request.note && <p className="listing-notes">{request.note}</p>}

                      <textarea
                        className="search-input textarea-input"
                        rows="3"
                        value={requestNotes[request.id] ?? request.reviewNote ?? ''}
                        onChange={(event) => setRequestNotes((prev) => ({ ...prev, [request.id]: event.target.value }))}
                        placeholder="Optional admin note"
                      />

                      <div className="listing-card-actions">
                        <button
                          className="action-btn secondary"
                          onClick={() => runAdminAction(
                            () => adminUpdateVerificationRequest(request.id, 'approved', requestNotes[request.id] ?? request.reviewNote ?? ''),
                            'Verification request approved.'
                          )}
                          disabled={request.status === 'approved'}
                        >
                          Approve
                        </button>
                        <button
                          className="action-btn secondary"
                          onClick={() => runAdminAction(
                            () => adminUpdateVerificationRequest(request.id, 'rejected', requestNotes[request.id] ?? request.reviewNote ?? ''),
                            'Verification request rejected.'
                          )}
                          disabled={request.status === 'rejected'}
                        >
                          Reject
                        </button>
                        <button
                          className="action-btn secondary"
                          onClick={() => runAdminAction(
                            () => adminUpdateVerificationRequest(request.id, 'pending', requestNotes[request.id] ?? request.reviewNote ?? ''),
                            'Verification request left pending.'
                          )}
                          disabled={request.status === 'pending'}
                        >
                          Mark pending
                        </button>
                        {request.username && (
                          <Link className="action-btn secondary" to={`/u/${request.username}`}>
                            View profile
                          </Link>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'users' && (
            <div className="admin-section">
              {usersLoading || collectionsLoading || conversationsLoading ? (
                <div className="loading">Loading users...</div>
              ) : (
                <div className="admin-user-grid">
                  {users.map((entry) => (
                    <article key={entry.id} className="admin-user-card">
                      <div className="admin-user-top">
                        <div>
                          <strong>{entry.sellerProfile?.displayName || entry.displayName || entry.username || entry.id}</strong>
                          <div className="listing-card-meta">
                            <span>@{entry.username || 'no-username'}</span>
                            <span>{entry.email || entry.uid || entry.id}</span>
                          </div>
                        </div>
                        <div className="listing-card-details">
                          {entry.isAdmin && <span className="verified-badge">Admin</span>}
                          {entry.sellerProfile?.verified && <span className="verified-badge">Verified seller</span>}
                          <span className={`status-pill ${getSellerAccessStatus(entry)}`}>seller {getSellerAccessStatus(entry)}</span>
                        </div>
                      </div>

                      <div className="listing-card-meta">
                        <span>{collectionByUser.get(entry.id) || 0} collection cards</span>
                        <span>{listingCountBySeller.get(entry.id) || 0} listings</span>
                        <span>{convoCountByUser.get(entry.id) || 0} conversations</span>
                        <span>Created {formatDate(entry.createdAt)}</span>
                      </div>

                      <div className="listing-card-actions">
                        <button
                          className="action-btn secondary"
                          onClick={() => runAdminAction(() => adminSetUserAdmin(entry.id, !entry.isAdmin), `${entry.username || entry.id} admin access updated.`)}
                        >
                          {entry.isAdmin ? 'Remove admin' : 'Make admin'}
                        </button>
                        <button
                          className="action-btn secondary"
                          onClick={() => runAdminAction(() => adminSetSellerVerified(entry.id, !entry.sellerProfile?.verified), `${entry.username || entry.id} seller verification updated.`)}
                        >
                          {entry.sellerProfile?.verified ? 'Remove seller access' : 'Approve seller'}
                        </button>
                        <button
                          className="action-btn secondary"
                          onClick={() => runAdminAction(() => adminSeedDemoReviews(entry.id), `${entry.username || entry.id} demo reviews seeded.`)}
                        >
                          Seed demo reviews
                        </button>
                        <button
                          className="action-btn secondary"
                          onClick={() => runAdminAction(() => adminDeleteDemoReviews(entry.id), `${entry.username || entry.id} demo reviews removed.`)}
                        >
                          Remove demo reviews
                        </button>
                        {entry.username && (
                          <Link className="action-btn secondary" to={`/u/${entry.username}`}>
                            View profile
                          </Link>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'reviews' && (
            <div className="admin-section">
              {reviewsLoading ? (
                <div className="loading">Loading reviews...</div>
              ) : reviews.length === 0 ? (
                <div className="empty-state compact">
                  <h3>No seller reviews yet</h3>
                  <p>Buyer feedback will appear here once reviews are submitted.</p>
                </div>
              ) : (
                <div className="admin-user-grid">
                  {reviews.map((review) => {
                    const seller = userById.get(review.sellerUserId);
                    const sellerLabel = seller?.username
                      ? `@${seller.username}`
                      : seller?.sellerProfile?.displayName || seller?.displayName || review.sellerUserId;
                    const sellerName = seller?.sellerProfile?.displayName || seller?.displayName || null;

                    return (
                      <article key={review.id} className="admin-user-card">
                        <div className="admin-user-top">
                          <div>
                            <strong>{review.reviewerDisplayName || review.reviewerUsername || review.reviewerUserId}</strong>
                            <div className="listing-card-meta">
                              <span>
                                Seller: {sellerName && seller?.username ? `${sellerName} (${sellerLabel})` : sellerLabel}
                              </span>
                              <span>{review.rating}/5</span>
                              <span>{formatDate(review.createdAt)}</span>
                              {String(review.reviewerUserId || '').startsWith('demo-reviewer-') && <span className="status-pill pending">Demo</span>}
                            </div>
                          </div>
                        </div>

                        {review.comment && <p className="listing-notes">{review.comment}</p>}

                        <div className="listing-card-actions">
                          <button
                            className="action-btn secondary danger"
                            onClick={() => {
                              if (confirm('Delete this review?')) {
                                runAdminAction(() => adminDeleteReview(review.id), 'Review deleted.');
                              }
                            }}
                          >
                            Delete review
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'listings' && (
            <div className="admin-section">
              {listingsLoading ? (
                <div className="loading">Loading listings...</div>
              ) : (
                <div className="listing-stack">
                  {listings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      showStatus
                      actions={(
                        <>
                          <button className="action-btn secondary" onClick={() => runAdminAction(() => adminUpdateListingStatus(listing.id, 'active'), 'Listing set to active.')}>Set active</button>
                          <button className="action-btn secondary" onClick={() => runAdminAction(() => adminUpdateListingStatus(listing.id, 'inactive'), 'Listing set to inactive.')}>Set inactive</button>
                          <button className="action-btn secondary" onClick={() => runAdminAction(() => adminUpdateListingStatus(listing.id, 'sold'), 'Listing set to sold.')}>Set sold</button>
                          <button className="action-btn secondary danger" onClick={() => {
                            if (confirm(`Delete listing for ${listing.cardName}?`)) {
                              runAdminAction(() => adminDeleteListing(listing.id), 'Listing deleted.');
                            }
                          }}>Delete</button>
                        </>
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'conversations' && (
            <div className="admin-section">
              {conversationsLoading ? (
                <div className="loading">Loading conversations...</div>
              ) : (
                <div className="admin-conversation-table">
                  {conversations.map((conversation) => (
                    <Link key={conversation.id} to={`/messages/${conversation.id}`} className="admin-conversation-row">
                      <div>
                        <strong>{conversation.listingSnapshot?.cardName || 'Listing conversation'}</strong>
                        <div className="listing-card-meta">
                          <span>Buyer: {conversation.participantProfiles?.[conversation.buyerUserId]?.displayName || conversation.buyerUserId}</span>
                          <span>Seller: {conversation.participantProfiles?.[conversation.sellerUserId]?.displayName || conversation.sellerUserId}</span>
                          <span>{conversation.intentType === 'commit' ? 'Commit flow' : 'Contact flow'}</span>
                        </div>
                        <p className="thread-preview">{conversation.lastMessagePreview}</p>
                      </div>
                      <div className="admin-conversation-stats">
                        <span>{conversation.messageCount || 0} messages</span>
                        <span>{formatDate(conversation.createdAt)}</span>
                        <span>{formatDate(conversation.lastMessageAt)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'decks' && (
            <div className="admin-section">
              {decksLoading ? (
                <div className="loading">Loading decks...</div>
              ) : (
                <div className="admin-user-grid">
                  {decks.map((deck) => (
                    <article key={deck.id} className="admin-user-card">
                      <div className="admin-user-top">
                        <div>
                          <strong>{deck.name}</strong>
                          <div className="listing-card-meta">
                            <span>by {deck.username || deck.userId}</span>
                            <span>{deck.cards?.reduce((sum, card) => sum + (card.quantity || 0), 0) || 0} cards</span>
                          </div>
                        </div>
                        <span className={`status-pill ${deck.isPublic ? 'active' : 'inactive'}`}>
                          {deck.isPublic ? 'Public' : 'Private'}
                        </span>
                      </div>

                      <div className="listing-card-meta">
                        <span>{deck.upvotes || 0} upvotes</span>
                        <span>Updated {formatDate(deck.updatedAt)}</span>
                      </div>

                      <div className="listing-card-actions">
                        <Link className="action-btn secondary" to={`/deck/${deck.id}`}>Open deck</Link>
                        <button
                          className="action-btn secondary"
                          onClick={() => runAdminAction(() => adminToggleDeckVisibility(deck.id, !deck.isPublic), 'Deck visibility updated.')}
                        >
                          {deck.isPublic ? 'Hide deck' : 'Publish deck'}
                        </button>
                        <button
                          className="action-btn secondary danger"
                          onClick={() => {
                            if (confirm(`Delete deck "${deck.name}"?`)) {
                              runAdminAction(() => adminDeleteDeck(deck.id), 'Deck deleted.');
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
