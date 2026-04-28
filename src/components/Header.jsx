import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getSellerAccessStatus, useAdminAlerts, useConversations, useSellerReviews } from '../hooks/useMarketplace';

export default function Header({ stats, onExport, onImport, onReset, isOwnCollection = false }) {
  const { user, userProfile, loading, signInWithGoogle, signOut, updateUsername } = useAuth();
  const isAdmin = Boolean(userProfile?.isAdmin || userProfile?.role === 'admin');
  const sellerAccessStatus = getSellerAccessStatus(userProfile || {});
  const { totalPending } = useAdminAlerts(Boolean(user && isAdmin));
  const { conversations } = useConversations({ userId: user?.uid, enabled: Boolean(user) });
  const { reviews } = useSellerReviews(user?.uid, Boolean(user));
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const unreadMessages = conversations.filter((conversation) => (conversation.unreadBy || []).includes(user?.uid)).length;
  const unreadReviews = reviews.filter((review) => (review.createdAt || '') > (userProfile?.sellerReviewLastSeenAt || '')).length;
  const totalNotifications = unreadMessages + unreadReviews;

  const handleUsernameSubmit = async (event) => {
    event.preventDefault();
    if (newUsername.trim()) {
      await updateUsername(newUsername.trim());
      setEditingUsername(false);
    }
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        try {
          const data = JSON.parse(loadEvent.target.result);
          onImport?.(data);
        } catch (error) {
          alert('Error importing collection');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExportClick = () => {
    if (!onExport) return;
    const data = onExport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vibes-collection-${new Date().toISOString().split('T')[0]}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const shareUrl = userProfile ? `${window.location.origin}/u/${userProfile.username}` : null;

  const copyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    alert('Profile link copied.');
  };

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <span className="logo-icon" aria-hidden="true">🐧</span>
          <div>
            <div className="logo-text">VibesTracker</div>
            <div className="logo-subtitle">Pudgy Penguins TCG</div>
          </div>
        </Link>

        <nav className="header-nav">
          <Link to="/collection" className="nav-link">Collection</Link>
          <Link to="/decks" className="nav-link">Decks</Link>
          <Link to="/marketplace" className="nav-link">Marketplace</Link>
          <Link to="/set3-spoilers" className="nav-link">Set 3 Spoilers</Link>
        </nav>

        {stats && (
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
        )}

        <div className="header-actions">
          {isAdmin && (
            <Link to="/admin?tab=requests" className="admin-alert-link">
              Admin
              {totalPending > 0 && <span className="admin-alert-badge">{totalPending}</span>}
            </Link>
          )}

          {user && (
            <Link to="/messages" className="admin-alert-link">
              Messages
              {unreadMessages > 0 && <span className="admin-alert-badge">{unreadMessages}</span>}
            </Link>
          )}

          {isOwnCollection && (
            <div className="action-buttons">
              <button className="action-btn secondary" onClick={handleExportClick}>Export</button>
              <button className="action-btn secondary" onClick={handleImportClick}>Import</button>
              <button
                className="action-btn secondary"
                onClick={() => {
                  if (confirm('Reset your entire collection?')) onReset?.();
                }}
              >
                Reset
              </button>
            </div>
          )}

          {loading ? (
            <div className="auth-loading">...</div>
          ) : user ? (
            <div className="user-menu-container">
              <button className="user-avatar-btn" onClick={() => setShowUserMenu((prev) => !prev)}>
                <img src={user.photoURL} alt="" className="user-avatar" />
                {totalNotifications > 0 && <span className="avatar-badge">{totalNotifications}</span>}
              </button>

              {showUserMenu && (
                <div className="user-menu">
                  <div className="user-menu-header">
                    <img src={user.photoURL} alt="" className="user-avatar-large" />
                    <div>
                      <div className="user-name">{user.displayName}</div>
                      {editingUsername ? (
                        <form onSubmit={handleUsernameSubmit} className="username-form">
                          <input
                            type="text"
                            value={newUsername}
                            onChange={(event) => setNewUsername(event.target.value)}
                            placeholder="username"
                            className="username-input"
                            autoFocus
                          />
                          <button type="submit" className="username-save">Save</button>
                        </form>
                      ) : (
                        <div
                          className="user-username"
                          onClick={() => {
                            setNewUsername(userProfile?.username || '');
                            setEditingUsername(true);
                          }}
                        >
                          @{userProfile?.username} edit
                        </div>
                      )}
                    </div>
                  </div>

                  <Link className="menu-item" to={sellerAccessStatus === 'approved' ? '/marketplace/my-listings' : '/settings/seller'} onClick={() => setShowUserMenu(false)}>
                    {sellerAccessStatus === 'approved' ? 'Manage Listings' : 'Apply to Sell'}
                  </Link>

                  <Link className="menu-item" to="/messages" onClick={() => setShowUserMenu(false)}>
                    Messages
                    {unreadMessages > 0 && <span className="menu-item-badge">{unreadMessages}</span>}
                  </Link>

                  <Link className="menu-item" to="/settings/seller" onClick={() => setShowUserMenu(false)}>
                    Seller Profile
                    {unreadReviews > 0 && <span className="menu-item-badge">{unreadReviews}</span>}
                  </Link>

                  {shareUrl && (
                    <button className="menu-item" onClick={copyShareLink}>
                      Copy Profile Link
                    </button>
                  )}

                  <button className="menu-item" onClick={signOut}>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="action-btn primary" onClick={signInWithGoogle}>
              Sign In with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
