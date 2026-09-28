import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { useStore } from '../data/store.jsx';
import Modal from '../components/Modal.jsx';
import { CLERK_ENABLED, openSignInWithRecovery } from '../data/clerkConfig.js';
import {
  backendConfigured,
  fetchAccountabilityPartners,
  inviteAccountabilityPartner,
  removeAccountabilityPartner,
} from '../data/api.js';
import { formatShortDate } from '../data/helpers.js';
import Icon from '../components/Icon.jsx';

// Backend feature: invite someone to see each other's goal/task progress
// and help you both stay on track. Free for 1 partner, Pro for more —
// mirrors Shared calendars' free-tier shape. Needs a live backend
// (VITE_BACKEND_URL set at build time) and Clerk configured.
const FREE_PARTNER_LIMIT = 1;

export default function AccountabilityPartnersPage() {
  const navigate = useNavigate();
  if (!CLERK_ENABLED || !backendConfigured()) {
    return (
      <div className="page">
        <header className="page-head">
          <button className="back-btn" onClick={() => navigate('/more')}>
            ‹ More
          </button>
          <h1><Icon name="personCheck" size={24} /> Accountability partners</h1>
        </header>
        <p className="muted center-pad">
          Accountability partners need Keystone's account system connected to a live server, which
          this build doesn't have set up yet. The feature is ready to go once a backend is deployed.
        </p>
      </div>
    );
  }
  return <AccountabilityPartnersInner />;
}

function AccountabilityPartnersInner() {
  const navigate = useNavigate();
  const { state } = useStore();
  const isPro = !!state.settings?.isPro;
  const { isSignedIn, getToken } = useAuth();
  const clerk = useClerk();
  const [partners, setPartners] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null); // partner | null

  const load = async () => {
    setError('');
    try {
      const { partners: list } = await fetchAccountabilityPartners(getToken);
      setPartners(list);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (isSignedIn) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  const atFreeLimit = !isPro && (partners?.length || 0) >= FREE_PARTNER_LIMIT;

  const sendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    try {
      const { invite } = await inviteAccountabilityPartner(getToken, email);
      setInviteLink(`${window.location.origin}${window.location.pathname}#/accountability/join/${invite.token}`);
      setInviteEmail('');
    } catch (err) {
      if (err.code === 'partner_limit') {
        setInviteOpen(false);
        navigate('/pricing');
        return;
      }
      setError(err.message);
    }
  };

  const doRemove = async () => {
    try {
      await removeAccountabilityPartner(getToken, confirmRemove.userId);
      setConfirmRemove(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-row">
          <button className="back-btn" onClick={() => navigate('/more')}>
            ‹ More
          </button>
          {isSignedIn &&
            (atFreeLimit ? (
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/pricing')}>
                <Icon name="lock" size={14} /> Upgrade
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setInviteEmail('');
                  setInviteLink('');
                  setInviteOpen(true);
                }}
              >
                + Invite
              </button>
            ))}
        </div>
        <h1><Icon name="personCheck" size={24} /> Accountability partners</h1>
        {isSignedIn && !isPro && partners && partners.length > 0 && (
          <p className="muted small">
            {partners.length} of {FREE_PARTNER_LIMIT} free partner{FREE_PARTNER_LIMIT === 1 ? '' : 's'}
            {atFreeLimit ? ' — upgrade to Pro for more' : ''}
          </p>
        )}
      </header>

      {!isSignedIn ? (
        <div className="empty">
          <div className="empty-icon"><Icon name="personCheck" size={48} /></div>
          <h2>Sign in to get started</h2>
          <p className="muted">Invite someone to keep each other on track with your goals and plans.</p>
          <button className="btn btn-primary" onClick={() => openSignInWithRecovery(clerk)}>
            Sign in
          </button>
        </div>
      ) : (
        <>
          {error && <p className="muted small center-pad">{error}</p>}
          {partners === null ? (
            <p className="muted center-pad">Loading…</p>
          ) : partners.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><Icon name="personCheck" size={48} /></div>
              <h2>Stay accountable together</h2>
              <p className="muted">
                Invite someone to see each other's goal and task progress — free for your first
                partner.
              </p>
              <button className="btn btn-primary" onClick={() => setInviteOpen(true)}>
                + Invite a partner
              </button>
            </div>
          ) : (
            <ul className="contact-list">
              {partners.map((p) => (
                <li key={p.userId} className="detail-section">
                  <div className="section-head">
                    <span className="detail-label">
                      <Icon name="person" size={14} /> {p.email}
                    </span>
                    <button
                      className="icon-btn"
                      onClick={() => setConfirmRemove(p)}
                      aria-label={`Remove ${p.email} as an accountability partner`}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  <p className="muted small">Partners since {formatShortDate(p.since?.slice(0, 10))}</p>
                  {!p.progress ? (
                    <p className="muted small">Hasn't shared any progress yet.</p>
                  ) : (
                    <>
                      <p className="muted small">
                        Today's tasks: {p.progress.tasksToday?.done ?? 0} of {p.progress.tasksToday?.total ?? 0} done
                      </p>
                      {(p.progress.goals || []).length === 0 ? (
                        <p className="muted small">No goals set yet.</p>
                      ) : (
                        p.progress.goals.map((g) => {
                          const pct = g.target ? Math.min(100, Math.round((g.progress / g.target) * 100)) : 0;
                          return (
                            <div key={g.id} className="partner-goal-row">
                              <span className="goal-count">
                                {g.title} — {g.progress} / {g.target} {g.unit}
                              </span>
                              <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Modal
        open={inviteOpen}
        title="Invite a partner"
        onClose={() => {
          setInviteOpen(false);
          setInviteLink('');
        }}
        footer={
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={sendInvite}>
              Create invite
            </button>
          </div>
        }
      >
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="them@example.com"
          />
        </label>
        <p className="muted small">
          Keystone doesn't send the invite email itself. Copy this link and send it to them
          yourself once it's created.
        </p>
        {inviteLink && (
          <p className="muted small">
            <code>{inviteLink}</code>
          </p>
        )}
      </Modal>

      <Modal
        open={!!confirmRemove}
        title="Remove partner?"
        onClose={() => setConfirmRemove(null)}
        footer={
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirmRemove(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={doRemove}>
              Remove
            </button>
          </div>
        }
      >
        <p>You'll both stop seeing each other's progress. This can't be undone, but you can invite them again later.</p>
      </Modal>
    </div>
  );
}
