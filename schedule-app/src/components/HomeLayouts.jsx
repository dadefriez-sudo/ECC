import { useState } from 'react';
import Icon from './Icon.jsx';
import AnimatedNumber from './AnimatedNumber.jsx';
import { Avatar } from './Avatar.jsx';
import { formatTime, daysAgoLabel, formatShortDate } from '../data/helpers.js';
import { useCountUp } from '../data/useCountUp.js';

// The three non-classic Home layouts (Settings -> Home screen layout).
// They only rearrange and restyle what Home already has: every block still
// comes from HomePage's own renderBlock (so tasks, notes, nudges, the
// challenge and the recap behave exactly the same in every layout), and the
// timeline is just the old "Important reminders" data with done items kept
// in so the day reads as a story.

export function MiniRing({ pct, label }) {
  const shown = useCountUp(pct);
  // Same two-stop sweep as the big ring on the Goals page (see ringStyle
  // there) — this is the smaller version of the identical widget, and a
  // flat single-color arc here while the other one has depth would read as
  // an oversight rather than a deliberate smaller variant.
  return (
    <div className="mini-ring-wrap">
      <div
        className="mini-ring"
        style={{
          background: `conic-gradient(from -90deg, var(--ring-hi) 0deg, var(--accent) ${shown * 3.6}deg, var(--track) ${shown * 3.6}deg)`,
        }}
      >
        <span>{shown}%</span>
      </div>
      <span className="mini-ring-label">{label}</span>
    </div>
  );
}

// Each layout has its own fixed order (hide/show from Customize still applies;
// drag-to-reorder belongs to the Classic layout).
// Used until the person reorders blocks themselves (Pro); after that their
// own order from the Home editor wins in every layout.
const TODAY_DEFAULT = ['upnext', 'reminders', 'nudges', 'goals', 'tasks', 'notes', 'recap', 'challenge'];
const BENTO_DEFAULT = ['nudges', 'reminders', 'challenge', 'tasks', 'notes', 'recap'];
const CALM_DEFAULT = ['upnext', 'reminders', 'nudges', 'goals', 'tasks', 'notes', 'recap', 'challenge'];

// The ids to draw, in order, limited to blocks that are switched on.
function orderFor(h, fallback) {
  const base = h.customOrder ? h.order : fallback;
  return base.filter((id) => h.enabled(id));
}

function whenLabel(mins) {
  if (mins <= 1) return 'now';
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.round(mins / 60);
  return `in ${hrs} hr`;
}

export function UpNext({ h }) {
  const n = h.upNext;
  if (!n) {
    return (
      <section className="detail-section home-next home-next--clear">
        <span className="detail-label">Up next</span>
        <p className="home-next-title">You're clear for the rest of today</p>
        <p className="muted small">Nothing else scheduled. A good moment to check a goal off.</p>
      </section>
    );
  }
  return (
    <section className="detail-section home-next">
      <span className="detail-label">Up next{n.inMins != null ? ` · ${whenLabel(n.inMins)}` : ''}</span>
      <p className="home-next-title">{n.item.label}</p>
      <p className="muted small">
        {n.item.time ? formatTime(n.item.time) : 'Anytime today'}
        {n.item.location ? ` · ${n.item.location}` : ''}
      </p>
      <div className="home-next-actions">
        <button className="btn btn-primary btn-sm" onClick={() => h.openItem(n.item)}>
          Open
        </button>
      </div>
    </section>
  );
}

// A. Today First — the day as a timeline, led by the one thing that's next.
export function TodayView({ h }) {
  return (
    <>
      {orderFor(h, TODAY_DEFAULT).map((id) =>
        id === 'upnext' ? (
          <UpNext key="upnext" h={h} />
        ) : (
          h.block(id)
        )
      )}
    </>
  );
}

// B. Bento (Pro) — a tile grid so progress is visible without scrolling.
export function BentoView({ h }) {
  const showGoals = h.enabled('goals');
  const showUpNext = h.enabled('upnext');
  const showTiles = showGoals || showUpNext || h.enabled('reminders');
  const r = h.recap;
  const nothingYet = r.goalsCompleted === 0 && r.contactsReconnected === 0 && r.tasksCompleted === 0;
  return (
    <>
      {showTiles && (
        <div className={`bento${showGoals ? '' : ' bento--no-goals'}`}>
          {showGoals && (
            <button className="bento-tile bento-goals" onClick={() => h.navigate('/goals')}>
              <span className="detail-label"><Icon name="target" /> Goals</span>
              <div className="bento-rings">
                <MiniRing pct={h.dailyPct} label="Today" />
                <MiniRing pct={h.weeklyPct} label="Week" />
              </div>
              {h.bestStreak >= 1 && (
                <span className="streak-badge">
                  <Icon name="flame" size={16} /> <AnimatedNumber value={h.bestStreak} />
                </span>
              )}
            </button>
          )}
          {showUpNext && (
            <button
              className="bento-tile bento-next"
              onClick={() => (h.upNext ? h.openItem(h.upNext.item) : h.navigate('/planner'))}
            >
              <span className="detail-label">Up next</span>
              <strong className="bento-next-title">{h.upNext ? h.upNext.item.label : 'All clear'}</strong>
              <span className="muted small">
                {h.upNext
                  ? `${h.upNext.item.time ? formatTime(h.upNext.item.time) : 'Anytime'}${
                      h.upNext.item.location ? ` · ${h.upNext.item.location}` : ''
                    }`
                  : 'Nothing else today'}
              </span>
            </button>
          )}
          {h.enabled('reminders') && (
            <button className="bento-tile bento-count" onClick={() => h.navigate('/planner')}>
              <span className="detail-label">Today</span>
              <strong className="bento-big">
                <AnimatedNumber value={h.leftToday} />
              </strong>
              <span className="muted small">{h.leftToday === 1 ? 'thing left today' : 'things left today'}</span>
            </button>
          )}
        </div>
      )}
      {orderFor(h, BENTO_DEFAULT).map((id) => {
        // Goals and Today live in the tiles above; the weekly recap is drawn as
        // three numbers rather than the full block.
        if (id === 'goals' || id === 'upnext') return null;
        if (id === 'recap') {
          return nothingYet ? null : (
            <section className="detail-section" key="recap">
              <span className="detail-label"><Icon name="chart" /> This week</span>
              <div className="bento-stats">
                <div className="recap-stat">
                  <strong>
                    <AnimatedNumber value={r.goalsCompleted} />
                    {r.goalsPossible > 0 && <span className="recap-of">/{r.goalsPossible}</span>}
                  </strong>
                  <span className="muted small">Goals hit</span>
                </div>
                <div className="recap-stat">
                  <strong>
                    <AnimatedNumber value={r.tasksCompleted} />
                  </strong>
                  <span className="muted small">Tasks done</span>
                </div>
                <div className="recap-stat">
                  <strong>
                    <AnimatedNumber value={r.contactsReconnected} />
                  </strong>
                  <span className="muted small">People reconnected</span>
                </div>
              </div>
            </section>
          );
        }
        return h.block(id);
      })}
    </>
  );
}

function Fold({ icon, title, summary, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`calm-fold${open ? ' calm-fold--open' : ''}`}>
      <button className="calm-fold-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="detail-label"><Icon name={icon} /> {title}</span>
        <span className="muted small calm-fold-sum">{summary}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && <div className="calm-fold-body">{children}</div>}
    </div>
  );
}

// C. Calm Focus — a quiet summary, one list for today, the rest tucked away.
export function CalmView({ h }) {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const s = h.counts;
  const parts = [
    `${s.events} ${s.events === 1 ? 'event' : 'events'}`,
    `${s.tasks} ${s.tasks === 1 ? 'task' : 'tasks'}`,
    `${s.goals} ${s.goals === 1 ? 'goal' : 'goals'} left`,
  ];
  const folds = [
    { id: 'goals', icon: 'target', title: 'Goals', summary: `${h.dailyPct}% today` },
    { id: 'tasks', icon: 'check', title: 'Tasks', summary: `${h.openTaskCount} open` },
    { id: 'notes', icon: 'note', title: 'Notes', summary: `${h.noteCount}` },
    { id: 'recap', icon: 'chart', title: 'This week', summary: '' },
    { id: 'challenge', icon: 'compass', title: "Today's challenge", summary: '' },
  ];
  return (
    <div className="calm-home">
      <h2 className="calm-date">{date}</h2>
      <p className="muted calm-summary">{parts.join(' · ')}</p>
      {h.enabled('goals') && (
        <div className="calm-chips">
          {h.bestStreak >= 1 && (
            <span className="chip calm-chip">
              <Icon name="flame" size={14} /> {h.bestStreak} {h.bestStreak === 1 ? 'day' : 'days'}
            </span>
          )}
          <span className="chip calm-chip">{h.dailyPct}% today</span>
          <span className="chip calm-chip">{h.weeklyPct}% week</span>
        </div>
      )}
      {(() => {
        // Consecutive folds share one ruled list; anything else breaks it.
        const out = [];
        let group = [];
        const flush = () => {
          if (group.length) out.push(<div className="calm-folds" key={`g${out.length}`}>{group}</div>);
          group = [];
        };
        for (const id of orderFor(h, CALM_DEFAULT)) {
          if (id === 'reminders') {
            flush();
            out.push(h.block('reminders'));
          } else if (id === 'upnext') {
            flush();
            out.push(<UpNext key="upnext" h={h} />);
          } else if (id === 'nudges') {
            flush();
            out.push(h.block('nudges'));
          } else {
            const f = folds.find((x) => x.id === id);
            const body = f && h.block(id);
            if (body) {
              group.push(
                <Fold key={id} icon={f.icon} title={f.title} summary={f.summary}>
                  {body}
                </Fold>
              );
            }
          }
        }
        flush();
        return out;
      })()}
    </div>
  );
}

// D. Tracker — a counts-first Home. A grid of goal tiles (count out of target,
// with + and − on each), then the people most worth a message, then the rest of
// the day. It is the same data as the other layouts, laid out as a dashboard.
const TILE_ICONS = { Health: 'heart', Growth: 'trending', Work: 'check', Relationships: 'users', Spiritual: 'compass', Faith: 'compass' };
const TRACKER_REST = ['upnext', 'reminders', 'nudges', 'tasks', 'notes', 'recap'];

export function TrackerView({ h }) {
  const tiles = h.trackerGoals;
  const people = h.trackerPeople;
  return (
    <>
      {h.enabled('goals') && (
        <section className="detail-section tracker-card">
          <div className="tracker-head">
            <span className="detail-label">Key goals</span>
            <button className="tracker-viewall" onClick={() => h.navigate('/goals')}>View all</button>
          </div>
          {tiles.length === 0 ? (
            <p className="muted small">No goals in play. Tap View all to add one.</p>
          ) : (
            <div className="tracker-grid">
              {tiles.map(({ goal, value, done }) => (
                <div key={goal.id} className={`tracker-tile${done ? ' tracker-tile--done' : ''}`}>
                  <button className="tracker-tile-main" onClick={() => h.openItem({ kind: 'goal', goalId: goal.id })}>
                    <span className="tracker-tile-icon">
                      <Icon name={done ? 'check' : TILE_ICONS[goal.category] || 'target'} size={18} />
                    </span>
                    <span className="tracker-tile-label">{goal.title}</span>
                    <strong className="tracker-tile-count">
                      {value}
                      <span>/{goal.target}</span>
                    </strong>
                  </button>
                  <div className="tracker-tile-step">
                    <button aria-label={`Remove one from ${goal.title}`} onClick={() => h.stepGoal(goal, -1)} disabled={value <= 0}>
                      <Icon name="minus" size={14} />
                    </button>
                    <button aria-label={`Add one to ${goal.title}`} onClick={() => h.stepGoal(goal, 1)} disabled={done}>
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="detail-section tracker-card">
        <div className="tracker-head">
          <span className="detail-label">People to follow up</span>
          <button className="tracker-viewall" onClick={() => h.navigate('/contacts')}>View all</button>
        </div>
        {people.length === 0 ? (
          <p className="muted small">Nobody is waiting on you right now.</p>
        ) : (
          <ul className="tracker-people">
            {people.map((c) => (
              <li key={c.id}>
                <button className="tracker-person" onClick={() => h.navigate(`/contacts/${c.id}`)}>
                  <Avatar name={c.name} photo={c.photo} color={c.color} size="sm" />
                  <span className="tracker-person-body">
                    <strong>{c.name}</strong>
                    <span className="muted small">
                      {c.followUp?.date ? `Follow up ${formatShortDate(c.followUp.date)}` : c.lastContacted ? `Last contact ${daysAgoLabel(c.lastContacted)}` : 'Not contacted yet'}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {orderFor(h, TRACKER_REST).filter((id) => TRACKER_REST.includes(id)).map((id) => (id === 'upnext' ? <UpNext key="upnext" h={h} /> : h.block(id)))}
    </>
  );
}
