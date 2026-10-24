import { useEffect } from 'react';
import Icon from './Icon.jsx';
import { useStore, useActions } from '../data/store.jsx';
import { WHATS_NEW_ID, WHATS_NEW_ITEMS } from '../data/whatsNew.js';

// One-time note on Home after an update. Fresh installs are marked as seen
// straight away so the first thing they get is the tour, not a changelog.
export default function WhatsNewCard() {
  const { state } = useStore();
  const actions = useActions();
  const s = state.settings || {};
  const fresh = !s.tutorialSeen && s.whatsNewSeen === undefined;
  useEffect(() => {
    if (fresh) actions.setSettings({ whatsNewSeen: WHATS_NEW_ID });
  }, [fresh]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s.tutorialSeen || s.whatsNewSeen === WHATS_NEW_ID) return null;
  return (
    <section className="detail-section review-card whats-new">
      <div className="review-card-head">
        <span className="detail-label"><Icon name="sparkle" /> What's new</span>
        <button
          className="icon-btn"
          onClick={() => actions.setSettings({ whatsNewSeen: WHATS_NEW_ID })}
          aria-label="Dismiss what's new"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <ul className="whats-new-list">
        {WHATS_NEW_ITEMS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <button
        className="btn btn-primary btn-sm"
        onClick={() => actions.setSettings({ whatsNewSeen: WHATS_NEW_ID })}
      >
        Got it
      </button>
    </section>
  );
}
