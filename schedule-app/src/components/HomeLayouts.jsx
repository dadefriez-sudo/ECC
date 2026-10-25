import { useState } from 'react';
import Icon from './Icon.jsx';
import AnimatedNumber from './AnimatedNumber.jsx';
import { formatTime } from '../data/helpers.js';
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

const TIMELINE_LIMIT = 8;
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

function TimelineRow({ it, h, next, past }) {
  return (
    <li
      className={`tl-row${it.done ? ' tl-row--done' : ''}${past ? ' tl-row--past' : ''}${next ? ' tl-row--next' : ''}`}
    >
      {it.kind === 'task' ? (
        <button
          className={`task-check task-check--sm${it.done ? ' task-check--on' : ''}`}
          data-haptic={it.done ? 'tap' : 'confirm'}
          onClick={() => h.toggleTaskDone(it.task)}
          aria-label={it.done ? 'Mark not done' : 'Mark done'}
        >
          {it.done && <Icon name="check" size={12} />}
        </button>
      ) : (
        <span className={`tl-dot${past ? ' tl-dot--past' : ''}${next ? ' tl-dot--next' : ''}`} aria-hidden="true" />
      )}
      <button className="tl-main" onClick={() => h.openItem(it)}>
        <span className="tl-time">{it.time ? formatTime(it.time) : 'Anytime'}</span>
        <span className="tl-label">{it.label}</span>
      </button>
      {next && <span className="tl-next-tag">Next</span>}
      <span className={`reminder-kind reminder-kind--${it.kind}`}>{it.kind}</span>
    </li>
  );
}

// Earlier events are tucked behind one line, a "Now" marker sits where the
// clock is, and everything after it is what's still to come.
function Timeline({ h, items }) {
  const [all, setAll] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const n = new Date();
  const nowKey = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  const past = items.filter((i) => i.time && i.time < nowKey);
  const ahead = items.filter((i) => !i.time || i.time >= nowKey);
  const shown = all ? ahead : ahead.slice(0, TIMELINE_LIMIT);
  const nextId = ahead.find((i) => !i.done)?.id;
  return (
    <>
      {past.length > 0 && (
        <button className="tl-earlier" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>
          Earlier today · {past.length}
          <Icon name="chevronDown" size={14} />
        </button>
      )}
      {showPast && (
        <ul className="tl tl--past">
          {past.map((it) => (
            <TimelineRow key={`${it.kind}:${it.id}`} it={it} h={h} past />
          ))}
        </ul>
      )}
      <div className="tl-now" role="separator" aria-label={`Now, ${formatTime(nowKey)}`}>
        <span>Now · {formatTime(nowKey)}</span>
      </div>
      {ahead.length === 0 ? (
        <p className="muted small tl-clear">Nothing else today.</p>
      ) : (
        <ul className="tl">
          {shown.map((it) => (
            <TimelineRow key={`${it.kind}:${it.id}`} it={it} h={h} next={it.id === nextId} />
          ))}
        </ul>
      )}
      {ahead.length > TIMELINE_LIMIT && (
        <button className="btn btn-ghost btn-sm tl-more" onClick={() => setAll((v) => !v)}>
          {all ? 'Show less' : `Show all ${ahead.length}`}
        </button>
      )}
    </>
  );
}

function TimelineSection({ h, title = 'Today' }) {
  if (h.timeline.length === 0) {
    return (
      <section className="detail-section">
        <span className="detail-label"><Icon name="bell" /> {title}</span>
        <p className="muted small">Nothing scheduled today.</p>
      </section>
    );
  }
  return (
    <section className="detail-section">
      <div className="section-head">
        <span className="detail-label"><Icon name="bell" /> {title}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => h.navigate('/planner')}>
          See planner
        </button>
      </div>
      <Timeline h={h} items={h.timeline} />
    </section>
  );
}

// A. Today First — the day as a timeline, led by the one thing that's next.
export function TodayView({ h }) {
  return (
    <>
      {orderFor(h, TODAY_DEFAULT).map((id) =>
        id === 'reminders' ? (
          <TimelineSection key="reminders" h={h} />
        ) : id === 'upnext' ? (
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
            out.push(<TimelineSection key="reminders" h={h} title="Focus today" />);
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
