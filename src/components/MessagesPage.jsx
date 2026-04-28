import { Link, Navigate } from 'react-router-dom';
import Header from './Header';
import { formatDate, MarketplaceNotice } from './MarketplaceCommon';
import { useAuth } from '../hooks/useAuth';
import { useConversations } from '../hooks/useMarketplace';

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const { conversations, loading: inboxLoading } = useConversations({ userId: user?.uid, enabled: Boolean(user) });

  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app">
      <Header />
      <div className="container">
        <div className="page-header marketplace-page-header">
          <div>
            <h1>Messages</h1>
            <p>Private buyer-seller conversations tied to your marketplace listings and inquiries.</p>
          </div>
        </div>

        <MarketplaceNotice compact />

        <section className="panel inbox-panel">
          {inboxLoading ? (
            <div className="loading">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="empty-state compact">
              <h3>No messages yet</h3>
              <p>Buyer inquiries and commit-to-buy threads will appear here.</p>
            </div>
          ) : (
            <div className="inbox-list">
              {conversations.map((conversation) => {
                const otherId = (conversation.participantIds || []).find((participantId) => participantId !== user.uid);
                const otherProfile = conversation.participantProfiles?.[otherId] || {};
                const unread = (conversation.unreadBy || []).includes(user.uid);
                return (
                  <Link key={conversation.id} to={`/messages/${conversation.id}`} className={`inbox-row ${unread ? 'unread' : ''}`}>
                    <div>
                      <div className="inbox-row-top">
                        <strong>{conversation.listingSnapshot?.cardName || 'Listing conversation'}</strong>
                        <div className="inbox-row-badges">
                          <span className={`status-pill ${conversation.intentType === 'commit' ? 'pending' : 'active'}`}>
                            {conversation.intentType === 'commit' ? 'Commit to buy' : 'Contact seller'}
                          </span>
                          {unread && <span className="status-pill unread">Unread</span>}
                        </div>
                      </div>
                      <div className="listing-card-meta">
                        <span>{otherProfile.displayName || otherProfile.username || 'Marketplace user'}</span>
                        <span>{formatDate(conversation.lastMessageAt)}</span>
                      </div>
                      <p className="thread-preview">{conversation.lastMessagePreview || 'Open the thread to reply.'}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
