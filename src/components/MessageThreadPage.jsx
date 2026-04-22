import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import Header from './Header';
import { MarketplaceNotice, ThreadListingSummary, formatDate } from './MarketplaceCommon';
import { useAuth } from '../hooks/useAuth';
import { useConversationMessages, useMarketplace } from '../hooks/useMarketplace';
import { db } from '../firebase';

export default function MessageThreadPage() {
  const { conversationId } = useParams();
  const { user, userProfile, loading } = useAuth();
  const { messages, loading: messagesLoading } = useConversationMessages(conversationId);
  const { sendMessage, markConversationRead, isAdmin } = useMarketplace();
  const [conversation, setConversation] = useState(null);
  const [conversationLoading, setConversationLoading] = useState(true);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!conversationId) return undefined;
    const conversationRef = doc(db, 'conversations', conversationId);
    const unsubscribe = onSnapshot(conversationRef, (snapshot) => {
      if (snapshot.exists()) {
        setConversation({ id: snapshot.id, ...snapshot.data() });
      } else {
        setConversation(null);
      }
      setConversationLoading(false);
    }, () => setConversationLoading(false));

    return () => unsubscribe();
  }, [conversationId]);

  useEffect(() => {
    if (conversationId && user) {
      markConversationRead(conversationId);
    }
  }, [conversationId, markConversationRead, user]);

  const hasAccess = useMemo(() => {
    if (!conversation || !user) return false;
    return isAdmin || (conversation.participantIds || []).includes(user.uid);
  }, [conversation, isAdmin, user]);

  const canReply = Boolean(conversation && user && (conversation.participantIds || []).includes(user.uid));

  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  if (!conversationLoading && !conversation) {
    return <Navigate to="/messages" replace />;
  }

  if (!conversationLoading && conversation && !hasAccess) {
    return <Navigate to="/messages" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await sendMessage(conversationId, body);
      setBody('');
    } catch (submitError) {
      setError(submitError.message || 'Unable to send message.');
    }
  };

  const participantTitle = conversation && user
    ? (conversation.participantIds || [])
      .filter((participantId) => participantId !== user.uid)
      .map((participantId) => conversation.participantProfiles?.[participantId]?.displayName || conversation.participantProfiles?.[participantId]?.username)
      .filter(Boolean)
      .join(', ')
    : '';

  return (
    <div className="app">
      <Header />
      <div className="container">
        <div className="page-header marketplace-page-header">
          <div>
            <div className="detail-breadcrumbs">
              <Link to="/messages">Messages</Link>
              <span>/</span>
              <span>Thread</span>
            </div>
            <h1>{participantTitle || 'Marketplace conversation'}</h1>
            <p>Private thread visible only to the buyer, seller, and admins for moderation and support.</p>
          </div>
        </div>

        <MarketplaceNotice compact />

        {conversation && <ThreadListingSummary conversation={conversation} />}

        <section className="panel message-thread-panel">
          {messagesLoading ? (
            <div className="loading">Loading messages...</div>
          ) : (
            <div className="message-list">
              {messages.map((message) => {
                const mine = message.authorId === user.uid;
                return (
                  <div key={message.id} className={`message-bubble ${mine ? 'mine' : ''}`}>
                    <div className="message-meta">
                      <strong>{message.authorDisplayName}</strong>
                      <span>{formatDate(message.createdAt)}</span>
                    </div>
                    <p>{message.body}</p>
                  </div>
                );
              })}
            </div>
          )}

          {canReply ? (
            <form className="message-composer" onSubmit={handleSubmit}>
              <textarea
                className="search-input textarea-input"
                rows="4"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write a reply..."
              />
              <div className="form-actions">
                <button type="submit" className="action-btn primary" disabled={!body.trim()}>
                  Send message
                </button>
                {error && <span className="error-text">{error}</span>}
              </div>
            </form>
          ) : (
            <div className="admin-thread-note">
              Admin view only. Moderators can inspect messages here, but only the buyer and seller can reply in Phase 1.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
