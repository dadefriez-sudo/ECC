import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { useStore } from '../data/store.jsx';
import Modal from '../components/Modal.jsx';
import { CLERK_ENABLED, openSignInWithRecovery } from '../data/clerkConfig.js';
import {
  backendConfigured,
  fetchAccountabilityPartners,
  fetchAccountabilityInvites,
  inviteAccountabilityPartner,
  revokeAccountabilityInvite,
  removeAccountabilityPartner,
} from '../data/api.js';
import { inviteMessage, extractInviteToken, timeAgo, isStale } from '../data/accountabilityInvite.js';
import { notifyPartnersChanged } from '../data/accountabilityState.js';
import { formatShortDate } from '../data/helpers.js';
import { useToast } from '../data/toast.jsx';
import Icon from '../components/Icon.jsx';

// Two people see each other's goal progress and today's task count, to help each
// other stay on track. Free for 1 partner, Pro for more. Needs the live backend
// and an account.
//
// How two people get connected: A taps Invite, which creates a code and a short
// message to send however they like. B installs Keystone and pastes that message
// (or just the code) under "Join with a code", sees who invited them, and taps
// Accept. Nothing is shared until B accepts.
const FREE_PARTNER_LIMIT = 1;
const REFRESH_MS = 30000;

export default function AccountabilityPartnersPage() {
  const navigate = useNavigate();
  if (!CLERK_ENABLED || !backendConfigured()) {
    return (
      <div className="page">
        <header className="page-head">
          <button className="back-btn" onClick={() => navigate('/more')}>‹ More</button>
          <h1><Icon name="personCheck" size={24} /> Accountability partners</h1>
        </header>
        <p className="muted center-pad">
          Accountability partners need Keystone's account system connected to a live server, which
          this build doesn't have set up yet.
        </p>
      </div>
    );
  }
  return <AccountabilityPartnersInner />;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older WebViews refuse the clipboard API; fall back to selecting a hidden field.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function AccountabilityPartnersInner() {
  const navigate = useNavigate();
  const { state } = useStore();
  const showToast = useToast();
  const isPro = !!state.settings?.isPro;
  const { isSignedIn, getToken } = useAuth();
  const clerk = useClerk();
  const [partners, setPartners] = useState(null); // null = loading
  const [invites, setInvites] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null); // the invite just made, shown in the sheet
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinText, setJoinText] = useState('');
  const [joinError, setJoinError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null);

  // Held in a ref so `load` keeps one identity for the life of the page. If it
  // depended on getToken directly, a getToken that changes between renders would
  // restart the effect below on every render and re-request in a loop.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const tok = useCallback(() => getTokenRef.current?.(), []);

  const load = useCallback(async () => {
    try {
      const [{ partners: list }, { invites: pending }] = await Promise.all([
        fetchAccountabilityPartners(tok),
        fetchAccountabilityInvites(tok),
      ]);
      setPartners(list);
      setInvites(pending);
      setError('');
      notifyPartnersChanged();
    } catch (err) {
      setError(err.message || "Couldn't load your partners. Check your connection.");
      setPartners((p) => p ?? []);
    }
  }, [tok]);

  // Load, then keep it fresh: someone may accept an invite, or push new progress,
  // while this page is open.
  useEffect(() => {
    if (!isSignedIn) return undefined;
    load();
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isSignedIn, load]);

  const atFreeLimit = !isPro && (partners?.length || 0) >= FREE_PARTNER_LIMIT;

  const createInvite = async () => {
    setBusy(true);
    setError('');
    try {
      const { invite } = await inviteAccountabilityPartner(getToken);
      setCreated(invite);
      load();
    } catch (err) {
      if (err.code === 'partner_limit') {
        navigate('/pricing');
        return;
      }
      setError(err.message || "Couldn't create the invite.");
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async (token) => {
    const ok = await copyText(inviteMessage(token));
    showToast(ok ? 'Invite copied. Paste it into a message.' : "Couldn't copy. Select the text and copy it.");
  };

  const shareInvite = async (token) => {
    try {
      await navigator.share({ title: 'Keystone accountability partner', text: inviteMessage(token) });
    } catch {
      /* cancelled, or sharing isn't available: Copy is always there */
    }
  };

  const revoke = async (inv) => {
    try {
      await revokeAccountabilityInvite(getToken, inv.id);
      load();
    } catch (err) {
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
      setConfirmRemove(null);
    }
  };

  const submitJoin = () => {
    const token = extractInviteToken(joinText);
    if (!token) {
      setJoinError("That doesn't look like an invite. Paste the whole message or just the code.");
      return;
    }
    setJoinOpen(false);
    navigate(`/accountability/join/${token}`);
  };

  const hasPartners = (partners?.length || 0) > 0;

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-row">
          <button className="back-btn" onClick={() => navigate('/more')}>‹ More</button>
          {isSignedIn &&
            (atFreeLimit ? (
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/pricing')}>
                <Icon name="lock" size={14} /> Upgrade
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={createInvite} disabled={busy}>
                + Invite
              </button>
            ))}
        </div>
        <h1><Icon name="personCheck" size={24} /> Accountability partners</h1>
        {isSignedIn && !isPro && hasPartners && (
          <p className="muted small">
            {partners.length} of {FREE_PARTNER_LIMIT} free partner{FREE_PARTNER_LIMIT === 1 ? '' : 's'}
            {atFreeLimit ? '. Upgrade to Pro for more.' : ''}
          </p>
        )}
      </header>

      {!isSignedIn ? (
        <div className="empty">
          <div className="empty-icon"><Icon name="personCheck" size={48} /></div>
          <h2>Sign in to get started</h2>
          <p className="muted">Pair up with someone to keep each other on track with your goals and plans.</p>
          <button className="btn btn-primary" onClick={() => openSignInWithRecovery(clerk)}>Sign in</button>
        </div>
      ) : (
        <>
          {error && <p className="partner-error" role="alert">{error}</p>}

          {partners === null ? (
            <p className="muted center-pad">Loading…</p>
          ) : !hasPartners ? (
            <div className="empty">
              <div className="empty-icon"><Icon name="personCheck" size={48} /></div>
              <h2>Stay accountable together</h2>
              <p className="muted">
                Pair up with one person. You each see the other's goal progress and how many of
                today's tasks are done, nothing else. Free for your first partner.
              </p>
              <div className="partner-actions">
                <button className="btn btn-primary" onClick={createInvite} disabled={busy}>+ Invite someone</button>
                <button className="btn btn-ghost" onClick={() => { setJoinText(''); setJoinError(''); setJoinOpen(true); }}>
                  I have a code
                </button>
              </div>
            </div>
          ) : (
            <ul className="contact-list">
              {partners.map((p) => {
                const stale = isStale(p.progressUpdatedAt);
                return (
                  <li key={p.userId} className="detail-section partner-card">
                    <div className="section-head">
                      <span className="partner-name"><Icon name="person" size={14} /> {p.email}</span>
                      <button
                        className="icon-btn"
                        onClick={() => setConfirmRemove(p)}
                        aria-label={`Remove ${p.email} as an accountability partner`}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                    <p className="muted small">
                      Partners since {formatShortDate(p.since?.slice(0, 10))}
                      {p.progressUpdatedAt ? ` · updated ${timeAgo(p.progressUpdatedAt)}` : ''}
                    </p>
                    {stale && (
                      <p className="partner-stale">
                        Last updated {timeAgo(p.progressUpdatedAt)}. They may not have opened Keystone since, so this may be out of date.
                      </p>
                    )}
                    {!p.progress ? (
                      <p className="muted small">Hasn't shared any progress yet. It shows up once they open Keystone.</p>
                    ) : (
                      <div className={stale ? 'partner-progress partner-progress--stale' : 'partner-progress'}>
                        <p className="partner-tasks">
                          Today's tasks: <b>{p.progress.tasksToday?.done ?? 0}</b> of {p.progress.tasksToday?.total ?? 0} done
                        </p>
                        {(p.progress.goals || []).length === 0 ? (
                          <p className="muted small">No goals set yet.</p>
                        ) : (
                          p.progress.goals.map((g) => {
                            const pct = g.target ? Math.min(100, Math.round((g.progress / g.target) * 100)) : 0;
                            const done = g.target > 0 && g.progress >= g.target;
                            return (
                              <div key={g.id} className="partner-goal-row">
                                <span className="goal-count">
                                  {done && <Icon name="check" size={14} />} {g.title}
                                  <span className="muted"> · {g.progress} / {g.target} {g.unit}</span>
                                </span>
                                <div className="progress-track">
                                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {invites.length > 0 && (
            <section className="detail-section">
              <span className="detail-label">Waiting to be accepted</span>
              <ul className="partner-invites">
                {invites.map((inv) => {
                  const days = Math.max(1, Math.ceil((new Date(inv.expiresAt) - new Date()) / 86400000));
                  return (
                    <li key={inv.id} className="partner-invite-row">
                      <span>
                        Invite sent {timeAgo(inv.createdAt)}
                        <span className="muted small"> · expires in {days} day{days === 1 ? '' : 's'}</span>
                      </span>
                      <span className="partner-invite-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => copyInvite(inv.token)}>Copy</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => revoke(inv)} aria-label="Cancel this invite">Cancel</button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {hasPartners && (
            <button
              className="btn btn-ghost full partner-join-link"
              onClick={() => { setJoinText(''); setJoinError(''); setJoinOpen(true); }}
            >
              Join someone else with a code
            </button>
          )}
        </>
      )}

      <Modal
        open={!!created}
        title="Invite sent"
        onClose={() => setCreated(null)}
        footer={
          <div className="modal-actions">
            {typeof navigator !== 'undefined' && navigator.share && (
              <button className="btn btn-ghost" onClick={() => shareInvite(created.token)}>Share…</button>
            )}
            <button className="btn btn-primary" onClick={() => copyInvite(created.token)}>Copy invite</button>
          </div>
        }
      >
        {created && (
          <>
            <p className="muted small">
              Send this to the person you want as a partner. Nothing is shared until they accept, and
              it works once, for 7 days.
            </p>
            <pre className="partner-invite-text">{inviteMessage(created.token)}</pre>
          </>
        )}
      </Modal>

      <Modal
        open={joinOpen}
        title="Join with a code"
        onClose={() => setJoinOpen(false)}
        footer={
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={submitJoin}>Continue</button>
          </div>
        }
      >
        <label className="field">
          <span>Paste the invite message or code</span>
          <textarea
            rows="4"
            value={joinText}
            onChange={(e) => { setJoinText(e.target.value); setJoinError(''); }}
            placeholder="Paste here"
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        {joinError && <p className="partner-error" role="alert">{joinError}</p>}
      </Modal>

      <Modal
        open={!!confirmRemove}
        title="Remove partner?"
        onClose={() => setConfirmRemove(null)}
        footer={
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirmRemove(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={doRemove}>Remove</button>
          </div>
        }
      >
        <p>You'll both stop seeing each other's progress. You can invite each other again later.</p>
      </Modal>
    </div>
  );
}
