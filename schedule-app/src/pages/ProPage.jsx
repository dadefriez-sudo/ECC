import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store.jsx';
import { Brand } from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';

// Destinations reuse MorePage's existing settings search (see MorePage's
// `query` state) via /more?q=... — the same terms someone would type in the
// search box there, so a tile here just opens the matching card(s) instead
// of needing its own deep-link mechanism.
const FEATURES = [
  {
    icon: 'sparkle',
    title: 'Color themes',
    desc: '22 themes, including soft pastels',
    to: '/more?q=theme',
  },
  {
    icon: 'home',
    title: 'Customize Home, Quick-add & Nav',
    desc: 'Reorder or hide blocks, menu actions, and tabs',
    to: '/more?q=customize',
  },
  {
    icon: 'calendar',
    title: 'Event types',
    desc: 'Reorder, hide, or add your own beyond the built-ins',
    to: '/more?q=event types',
  },
  {
    icon: 'users',
    title: 'Shared calendars',
    desc: 'Invite someone to see or add events with you',
    to: '/shared-calendars',
  },
  {
    icon: 'users',
    title: 'People status groups',
    desc: 'Group contacts and see full history timelines',
    to: '/more?q=people groups',
  },
  {
    icon: 'calendar',
    title: 'Calendar import & export',
    desc: 'Subscribe to or download an .ics feed',
    to: '/more?q=ics',
  },
  {
    icon: 'trending',
    title: 'Goal history & trends',
    desc: 'See streaks and progress over time',
    to: '/goals',
  },
  {
    icon: 'gear',
    title: 'Billing & purchase details',
    desc: 'Manage payment, or see everything included',
    to: '/pricing',
  },
];

export default function ProPage() {
  const { state } = useStore();
  const navigate = useNavigate();
  const isPro = !!state.settings?.isPro;

  // Nothing to thank someone for if they haven't bought it — same "redirect
  // to pricing" guard RoutePlannerPage/GoalHistoryPage use for their own
  // Pro-only routes.
  useEffect(() => {
    if (!isPro) navigate('/pricing', { replace: true });
  }, [isPro, navigate]);
  if (!isPro) return null;

  const name = state.settings?.profileName || '';

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

      <section className="pro-thanks">
        <div className="pricing-crown"><Icon name="crown" size={40} /></div>
        <h1>{name ? `Thank you, ${name}!` : 'Thank you!'}</h1>
        <p className="muted">
          Your one-time purchase unlocked everything below — for good, including everything
          added later.
        </p>
      </section>

      <section className="detail-section">
        <span className="detail-label">Everything you've unlocked</span>
        <ul className="pro-feature-list">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <button className="pro-feature-row" onClick={() => navigate(f.to)}>
                <span className="pro-feature-row-icon">
                  <Icon name={f.icon} size={18} />
                </span>
                <span className="pro-feature-row-body">
                  <strong>{f.title}</strong>
                  <p className="muted small">{f.desc}</p>
                </span>
                <Icon name="chevronRight" size={18} className="pro-feature-row-arrow" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="muted small center-pad">Keystone Pro · thanks for supporting the app</p>
    </div>
  );
}
