import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { useStore, useActions } from '../data/store.jsx';
import { Brand } from '../components/Logo.jsx';
import { CLERK_ENABLED } from '../data/clerkConfig.js';
import { startCheckout, openBillingPortal, backendConfigured, fetchMe } from '../data/api.js';
import { iapAvailable, initIAP, purchasePro, restorePurchases } from '../data/iap.js';
import Icon from '../components/Icon.jsx';

// Pro is a one-time purchase. This is the only place the price is written
// on the client — it's display text, and Stripe's price (set by
// STRIPE_PRICE_ID_LIFETIME on the backend) is the one that actually charges.
// Change both together.
const PRO_PRICE = '$9.99';

const FEATURES = [
  { label: 'Goals, Planner, Map, People', free: true, pro: true },
  { label: 'Contact history timeline', free: false, pro: true },
  { label: 'People status groups', free: false, pro: true },
  { label: 'Day & week templates', free: false, pro: true },
  { label: 'Color themes (22, incl. pastels)', free: false, pro: true },
  { label: 'Shared / collaborative events', free: false, pro: true },
  { label: 'Google account sync', free: false, pro: true },
  { label: 'Import/export to other calendars', free: false, pro: true },
  { label: 'Cloud backup across devices', free: false, pro: true },
];

export default function PricingPage() {
  const { state } = useStore();
  const navigate = useNavigate();
  const isPro = !!state.settings?.isPro;

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-row">
          <button className="back-btn" onClick={() => navigate(-1)}>
            ‹ Back
          </button>
          <Brand>Pro</Brand>
        </div>
      </header>

      <section className="pricing-hero">
        <div className="pricing-crown"><Icon name="crown" size={40} /></div>
        <h1>Keystone Pro</h1>
        <p className="muted">Unlock contact timelines, status groups, sharing, sync, and more.</p>
      </section>

      <div className="pricing-onetime">
        <span className="pricing-amount">{PRO_PRICE}</span>
        <span className="pricing-once">one time</span>
        <p className="muted small">
          Not a subscription. Pay once and Pro is yours for good, including everything added later.
        </p>
      </div>

      <section className="detail-section">
        <span className="detail-label">What's included</span>
        <table className="pricing-table">
          <thead>
            <tr>
              <th></th>
              <th>Free</th>
              <th>Pro</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.label}>
                <td>{f.label}</td>
                <td>{f.free ? <Icon name="check" size={16} /> : '—'}</td>
                <td className="pricing-pro-col">{f.pro ? <Icon name="check" size={16} /> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {CLERK_ENABLED ? (
        iapAvailable() ? (
          <NativePricingCTA isPro={isPro} />
        ) : (
          <RealPricingCTA isPro={isPro} settings={state.settings} />
        )
      ) : (
        <DemoPricingCTA isPro={isPro} />
      )}
    </div>
  );
}

// Real Stripe Checkout flow — used once Clerk is configured.
function RealPricingCTA({ isPro, settings }) {
  const { isSignedIn, getToken } = useAuth();
  const clerk = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Only someone who subscribed before Pro became a one-time purchase has a
  // subscription to manage. Everyone else has nothing recurring, so offering
  // them a billing portal would just be confusing.
  const hasLegacySubscription =
    !!settings?.subscriptionStatus && !settings?.isLifetime;

  const handleUpgrade = async () => {
    if (!isSignedIn) return clerk.openSignIn();
    if (!backendConfigured()) return setError('Billing isn’t connected yet.');
    setError('');
    setBusy(true);
    try {
      const { url } = await startCheckout(getToken);
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const handleManage = async () => {
    setError('');
    setBusy(true);
    try {
      const { url } = await openBillingPortal(getToken);
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      {isPro ? (
        <div className="detail-section pricing-active">
          <span><Icon name="check" size={16} /> You own Keystone Pro</span>
          {hasLegacySubscription && (
            <>
              <p className="muted small">
                You're on the old monthly/annual plan. Pro is a one-time purchase now — cancel here
                and your access stays until the period you've already paid for ends.
              </p>
              <button className="btn btn-ghost full" onClick={handleManage} disabled={busy}>
                Manage billing
              </button>
            </>
          )}
        </div>
      ) : (
        <button className="btn btn-primary full pricing-cta" onClick={handleUpgrade} disabled={busy}>
          {isSignedIn ? `Unlock Pro — ${PRO_PRICE} once` : 'Sign in to unlock Pro'}
        </button>
      )}
      {error && <p className="muted small center-pad pricing-disclaimer">{error}</p>}
    </>
  );
}

// StoreKit / Play Billing flow — used instead of Stripe Checkout inside the
// native app shell (App Store guideline 3.1.1 requires digital goods bought
// in-app to go through the platform's own purchase system).
function NativePricingCTA({ isPro }) {
  const { isSignedIn, getToken } = useAuth();
  const clerk = useClerk();
  const actions = useActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // Re-pulls /api/me the same way SubscriptionSync (App.jsx) does on sign-
  // in — a purchase just verified server-side needs that same refresh to
  // actually flip isPro in local state. Returns the fetched isPro so callers
  // (handleRestore) can tell whether anything actually came back, since the
  // store's restore call itself resolves the same way whether or not it
  // found a purchase to restore.
  const refreshMe = async () => {
    try {
      const me = await fetchMe(getToken);
      actions.setSettings({
        isPro: me.isPro,
        isLifetime: !!me.isLifetime,
        isBetaTester: !!me.isBetaTester,
        subscriptionStatus: me.subscriptionStatus,
      });
      return me.isPro;
    } catch {
      /* the periodic SubscriptionSync poll will catch up regardless */
      return null;
    }
  };

  useEffect(() => {
    if (!isSignedIn) return;
    initIAP(getToken, refreshMe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  const handlePurchase = async () => {
    if (!isSignedIn) return clerk.openSignIn();
    setError('');
    setBusy(true);
    try {
      await purchasePro();
      // The store's `approved` event (wired in initIAP) does the actual
      // verify + refresh once the purchase clears — this just clears the
      // spinner once the order has been placed, not once it's finished.
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setError('');
    setStatus('');
    setBusy(true);
    try {
      await restorePurchases();
      // restorePurchases() itself resolves the same way whether or not the
      // store account had anything to restore — the only way to tell the
      // two apart, and the only feedback worth giving here, is whether the
      // backend now reports Pro.
      const found = await refreshMe();
      setStatus(found ? 'Purchase restored — you have Pro.' : 'No previous purchase found on this account.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {isPro ? (
        <div className="detail-section pricing-active">
          <span><Icon name="check" size={16} /> You own Keystone Pro</span>
        </div>
      ) : (
        <>
          <button className="btn btn-primary full pricing-cta" onClick={handlePurchase} disabled={busy}>
            {isSignedIn ? `Unlock Pro — ${PRO_PRICE} once` : 'Sign in to unlock Pro'}
          </button>
          <button className="btn btn-ghost full" onClick={handleRestore} disabled={busy}>
            Restore purchases
          </button>
        </>
      )}
      {error && <p className="muted small center-pad pricing-disclaimer">{error}</p>}
      {!error && status && <p className="muted small center-pad pricing-disclaimer">{status}</p>}
    </>
  );
}

// Local-only demo toggle — used until Clerk/Stripe env vars are configured,
// so Pro-gated UI stays reachable for local development and testing.
function DemoPricingCTA({ isPro }) {
  const actions = useActions();
  return (
    <>
      {isPro ? (
        <div className="detail-section pricing-active">
          <span><Icon name="check" size={16} /> You own Keystone Pro (demo mode)</span>
          <button className="btn btn-ghost full" onClick={() => actions.setSettings({ isPro: false })}>
            Turn off demo Pro
          </button>
        </div>
      ) : (
        <button className="btn btn-primary full pricing-cta" onClick={() => actions.setSettings({ isPro: true })}>
          Try Pro (demo) — {PRO_PRICE} once
        </button>
      )}
      <p className="muted small center-pad pricing-disclaimer">
        This build has no payment processor connected yet, so "Try Pro" just flips a local demo
        flag to preview Pro features — it doesn't charge you anything.
      </p>
    </>
  );
}
