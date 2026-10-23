import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { CLERK_ENABLED, openSignInWithRecovery } from '../data/clerkConfig.js';
import { backendConfigured, previewAccountabilityInvite, acceptAccountabilityInvite } from '../data/api.js';
import { notifyPartnersChanged } from '../data/accountabilityState.js';
import Icon from '../components/Icon.jsx';

// Where an invite lands (pasted code, or the link on the web). Opening it never
// joins anything by itself: it shows who is inviting you, what you'd each see,
// and waits for an explicit Accept. No Pro gate here on purpose: the invited
// person may be on the free plan and can still accept.
export default function AccountabilityJoinPage() {
  if (!CLERK_ENABLED || !backendConfigured()) {
    return (
      <div className="page">
        <header className="page-head"><h1>Accountability partner</h1></header>
        <p className="muted center-pad">
          This needs Keystone's account system connected to a live server, which this build doesn't have set up yet.
        </p>
      </div>
    );
  }
  return <JoinInner />;
}

const MESSAGES = {
  used: 'This invite was already used. Ask them to send you a new one.',
  expired: 'This invite has expired. Ask them to send you a new one.',
  self: "This is your own invite. Send it to the person you want as a partner.",
};

function JoinInner() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isSignedIn, getToken } = useAuth();
  const clerk = useClerk();
  const [info, setInfo] = useState(null); // { fromEmail, status } | null
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(null); // { partnerEmail }
  const [needsUpgrade, setNeedsUpgrade] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    previewAccountabilityInvite(getToken, token)
      .then((i) => !cancelled && setInfo(i))
      .catch((err) => !cancelled && setError(err.status === 404 ? 'This invite is no longer valid. Ask them to send you a new one.' : err.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, token]);

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await acceptAccountabilityInvite(getToken, token);
      setJoined({ partnerEmail: res.partnerEmail || info?.fromEmail, already: !!res.alreadyPartners });
      notifyPartnersChanged();
    } catch (err) {
      if (err.code === 'partner_limit') setNeedsUpgrade(true);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const Head = <header className="page-head"><h1><Icon name="personCheck" size={24} /> Accountability partner</h1></header>;

  if (!isSignedIn) {
    return (
      <div className="page">
        {Head}
        <div className="empty">
          <p className="muted">Sign in to see who invited you.</p>
          <button className="btn btn-primary" onClick={() => openSignInWithRecovery(clerk)}>Sign in</button>
        </div>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="page">
        {Head}
        <div className="empty">
          <div className="empty-icon"><Icon name="check" size={48} /></div>
          <h2>{joined.already ? "You're already partners" : "You're partners"}</h2>
          <p className="muted">
            You and <b>{joined.partnerEmail}</b> can now see each other's goal progress. Their progress shows up as soon as they open Keystone.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/accountability', { replace: true })}>See their progress</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {Head}
      {error && !info ? (
        <div className="empty">
          <p className="muted">{error}</p>
          <button className="btn btn-ghost" onClick={() => navigate('/accountability', { replace: true })}>Back</button>
        </div>
      ) : !info ? (
        <p className="muted center-pad">Checking the invite…</p>
      ) : info.status === 'valid' ? (
        <div className="empty join-card">
          <div className="empty-icon"><Icon name="personCheck" size={48} /></div>
          <h2>{info.fromEmail} invited you</h2>
          <p className="muted">
            If you accept, you'll each see the other's <b>goal progress</b> and <b>how many of today's tasks are done</b>.
            Nothing else: not your events, contacts, or notes. Either of you can stop any time.
          </p>
          {error && <p className="partner-error" role="alert">{error}</p>}
          {needsUpgrade ? (
            <button className="btn btn-primary" onClick={() => navigate('/pricing')}>See Pro</button>
          ) : (
            <button className="btn btn-primary" onClick={accept} disabled={busy}>
              {busy ? 'Joining…' : 'Accept'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => navigate('/accountability', { replace: true })}>Not now</button>
        </div>
      ) : info.status === 'already_partners' ? (
        <div className="empty">
          <h2>You're already partners with {info.fromEmail}</h2>
          <button className="btn btn-primary" onClick={() => navigate('/accountability', { replace: true })}>See their progress</button>
        </div>
      ) : (
        <div className="empty">
          <p className="muted">{MESSAGES[info.status] || 'This invite is not available.'}</p>
          <button className="btn btn-ghost" onClick={() => navigate('/accountability', { replace: true })}>Back</button>
        </div>
      )}
    </div>
  );
}
