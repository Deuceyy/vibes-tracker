import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Header from './Header';
import { MarketplaceNotice, SellerTrustCard } from './MarketplaceCommon';
import { useAuth } from '../hooks/useAuth';
import { getSellerAccessStatus, useMarketplace, useVerificationRequest } from '../hooks/useMarketplace';

export default function SellerProfileSettingsPage() {
  const { user, userProfile, loading } = useAuth();
  const { saveSellerProfile, submitVerificationRequest, busy, sellerCanList } = useMarketplace();
  const { request: verificationRequest } = useVerificationRequest(user?.uid, Boolean(user));
  const sellerAccessStatus = getSellerAccessStatus(userProfile || {}, verificationRequest);

  const initialForm = useMemo(() => {
    const seller = userProfile?.sellerProfile || {};
    return {
      displayName: seller.displayName || userProfile?.displayName || '',
      bio: seller.bio || '',
      location: seller.location || '',
      shippingRegion: seller.shippingRegion || '',
      contactMethods: seller.contactMethods || '',
      externalLinks: (seller.externalLinks || []).join('\n'),
      socialLinks: (seller.socialLinks || []).join('\n'),
      avatarUrl: seller.avatarUrl || userProfile?.photoURL || ''
    };
  }, [userProfile]);

  const [form, setForm] = useState(initialForm);
  const [saved, setSaved] = useState(false);
  const [verificationNote, setVerificationNote] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (key, value) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await saveSellerProfile(form);
    setSaved(true);
  };

  const handleVerificationRequest = async () => {
    await submitVerificationRequest({ note: verificationNote });
    setVerificationMessage('Seller application submitted.');
  };

  return (
    <div className="app">
      <Header />
      <div className="container">
        <div className="page-header marketplace-page-header">
          <div>
            <h1>Seller Profile</h1>
            <p>Set up the public profile buyers will see before they contact you and request approval to list cards.</p>
          </div>
          {userProfile?.username && (
            <Link to={`/u/${userProfile.username}`} className="action-btn secondary">
              View public profile
            </Link>
          )}
        </div>

        <MarketplaceNotice />

        <div className="seller-settings-grid">
          <form className="panel seller-settings-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <label className="form-group">
                <span>Seller name</span>
                <input
                  className="search-input"
                  value={form.displayName}
                  onChange={(event) => handleChange('displayName', event.target.value)}
                  required
                />
              </label>

              <label className="form-group">
                <span>Avatar URL</span>
                <input
                  className="search-input"
                  value={form.avatarUrl}
                  onChange={(event) => handleChange('avatarUrl', event.target.value)}
                  placeholder="Optional image URL"
                />
              </label>

              <label className="form-group full">
                <span>Bio</span>
                <textarea
                  className="search-input textarea-input"
                  value={form.bio}
                  onChange={(event) => handleChange('bio', event.target.value)}
                  rows="4"
                  placeholder="What do you collect, where do you ship, what kinds of trades or sales do you like?"
                />
              </label>

              <label className="form-group">
                <span>Location</span>
                <input
                  className="search-input"
                  value={form.location}
                  onChange={(event) => handleChange('location', event.target.value)}
                  placeholder="City, state, or country"
                />
              </label>

              <label className="form-group">
                <span>Shipping region</span>
                <input
                  className="search-input"
                  value={form.shippingRegion}
                  onChange={(event) => handleChange('shippingRegion', event.target.value)}
                  placeholder="US only, North America, worldwide..."
                />
              </label>

              <label className="form-group full">
                <span>Contact methods</span>
                <textarea
                  className="search-input textarea-input"
                  value={form.contactMethods}
                  onChange={(event) => handleChange('contactMethods', event.target.value)}
                  rows="3"
                  placeholder="Discord, email expectations, reply window, preferred payment method notes..."
                />
              </label>

              <label className="form-group full">
                <span>External store links</span>
                <textarea
                  className="search-input textarea-input"
                  value={form.externalLinks}
                  onChange={(event) => handleChange('externalLinks', event.target.value)}
                  rows="3"
                  placeholder="One URL per line"
                />
              </label>

              <label className="form-group full">
                <span>Social references</span>
                <textarea
                  className="search-input textarea-input"
                  value={form.socialLinks}
                  onChange={(event) => handleChange('socialLinks', event.target.value)}
                  rows="3"
                  placeholder="One URL per line"
                />
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="action-btn primary" disabled={busy}>
                {busy ? 'Saving...' : 'Save seller profile'}
              </button>
              {saved && <span className="form-status">Saved.</span>}
            </div>
          </form>

          <div className="seller-settings-side">
            <SellerTrustCard profile={userProfile || {}} />
            <div className="panel">
              <div className="section-header compact">
                <h2>Seller access</h2>
                {sellerCanList && <span className="verified-badge">Approved seller</span>}
              </div>
              {sellerCanList ? (
                <p className="muted-copy">Your account is approved to list cards and appears with a verified seller badge across the marketplace.</p>
              ) : (
                <>
                  <p className="muted-copy">
                    Complete your profile, add any references you want buyers to see, and submit your seller application for manual approval.
                  </p>
                  <div className="verification-status-block">
                    <span className={`status-pill ${sellerAccessStatus}`}>{sellerAccessStatus}</span>
                    {verificationRequest?.requestedAt && (
                      <span className="muted-copy">Requested {new Date(verificationRequest.requestedAt).toLocaleString()}</span>
                    )}
                    {!verificationRequest?.requestedAt && (
                      <span className="muted-copy">You can save your seller profile first, then apply to sell.</span>
                    )}
                    {verificationRequest?.reviewNote && (
                      <p className="muted-copy">Admin note: {verificationRequest.reviewNote}</p>
                    )}
                  </div>
                  <textarea
                    className="search-input textarea-input"
                    rows="4"
                    value={verificationNote}
                    onChange={(event) => setVerificationNote(event.target.value)}
                    placeholder="Optional note for the admin team: community history, references, store profile, shipping reputation, etc."
                  />
                  <div className="form-actions">
                    <button
                      type="button"
                      className="action-btn secondary"
                      onClick={handleVerificationRequest}
                      disabled={busy || verificationRequest?.status === 'pending'}
                    >
                      {verificationRequest?.status === 'pending'
                        ? 'Application pending'
                        : sellerAccessStatus === 'rejected'
                          ? 'Reapply to sell'
                          : 'Apply to sell'}
                    </button>
                    <Link to="/marketplace" className="action-btn secondary">
                      View marketplace
                    </Link>
                  </div>
                  {verificationMessage && <p className="success-text">{verificationMessage}</p>}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
