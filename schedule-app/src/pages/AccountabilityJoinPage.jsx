import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { CLERK_ENABLED, openSignInWithRecovery } from '../data/clerkConfig.js';
import { backendConfigured, acceptAccountabilityInvite } from '../data/api.js';

// Where an invite link (see AccountabilityPartnersPage's "+ Invite") lands.
// No Pro gate here deliberately — the invited person may be on a free
// account, and free accounts get one partner, same as the sender does.
export default function AccountabilityJoinPage() {
  if (!CLERK_ENABLED || !backendConfigured()) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Join as a partner</h1>
        </header>
        <p className="muted center-pad">
          This link needs Keystone's account system connected to a live server, which this build
          doesn't have set up yet.
        </p>
      </div>
    );
  }
  return <AccountabilityJoinInner />;
}

function AccountabilityJoinInner() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isSignedIn, getToken } = useAuth();
  const clerk = useClerk();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSignedIn) return;
    acceptAccountabilityInvite(getToken, token)
      .then(() => navigate('/accountability', { replace: true }))
      .catch((err) => {
        if (err.code === 'partner_limit') {
          navigate('/pricing', { replace: true });
          return;
        }
        setError(err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Join as a partner</h1>
      </header>
      {!isSignedIn ? (
        <div className="empty">
          <p className="muted">Sign in to accept this invite.</p>
          <button className="btn btn-primary" onClick={() => openSignInWithRecovery(clerk)}>
            Sign in
          </button>
        </div>
      ) : error ? (
        <p className="muted center-pad">{error}</p>
      ) : (
        <p className="muted center-pad">Joining…</p>
      )}
    </div>
  );
}
