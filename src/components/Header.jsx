import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Header({ stats, onExport, onImport, onReset, isOwnCollection = true }) {
  const { user, userProfile, loading, signInWithGoogle, signOut, updateUsername } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    if (newUsername.trim()) {
      await updateUsername(newUsername.trim());
      setEditingUsername(false);
    }
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result);
            onImport?.(data);
          } catch (err) {
            alert('Error importing collection');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleExportClick = () => {
    if (!onExport) return;
    const data = onExport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibes-collection-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareUrl = userProfile ? `${window.location.origin}/u/${userProfile.username}` : null;

  const copyShareLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      alert('Profile link copied!');
    }
  };

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <span className="logo-icon">🐧</span>
          <div>
            <div className="logo-text">VibesTracker</div>
            <div className="logo-subtitle">Pudgy Penguins TCG</div>
          </div>
        </Link>

        <nav className="header-nav">
          <Link to="/collection" className="nav-link">Collection</Link>
          <Link to="/decks" className="nav-link">Decks</Link>
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
          {isOwnCollection && (
            <div className="action-buttons">
              <button className="action-btn secondary" onClick={handleExportClick}>Export</button>
              <button className="action-btn secondary" onClick={handleImportClick}>Import</button>
              <button className="action-btn secondary" onClick={() => {
                if (confirm('Reset your entire collection?')) onReset?.();
              }}>Reset</button>
            </div>
          )}

          {loading ? (
            <div className="auth-loading">...</div>
          ) : user ? (
            <div className="user-menu-container">
              <button 
                className="user-avatar-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <img src={user.photoURL} alt="" className="user-avatar" />
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
                            onChange={(e) => setNewUsername(e.target.value)}
                            placeholder="username"
                            className="username-input"
                            autoFocus
                          />
                          <button type="submit" className="username-save">✓</button>
                        </form>
                      ) : (
                        <div 
                          className="user-username"
                          onClick={() => {
                            setNewUsername(userProfile?.username || '');
                            setEditingUsername(true);
                          }}
                        >
                          @{userProfile?.username} ✏️
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {shareUrl && (
                    <button className="menu-item" onClick={copyShareLink}>
                      📋 Copy Profile Link
                    </button>
                  )}
                  
                  <button className="menu-item" onClick={signOut}>
                    🚪 Sign Out
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
