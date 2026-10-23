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
const TODAY_ORDER = ['nudges', 'goals', 'tasks', 'notes', 'recap', 'challenge'];
const BENTO_ORDER = ['nudges', 'reminders', 'challenge', 'tasks', 'notes'];

function whenLabel(mins) {
  if (mins <= 1) return 'now';
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.round(mins / 60);
  return `in ${hrs} hr`;
}

function UpNext({ h }) {
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

function Timeline({ h, items }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, TIMELINE_LIMIT);
  return (
    <>
      <ul className="tl">
        {shown.map((it) => (
          <li key={`${it.kind}:${it.id}`} className={`tl-row${it.done ? ' tl-row--done' : ''}`}>
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
              <span className={`tl-dot${it.done ? ' tl-dot--done' : ''}`} aria-hidden="true" />
            )}
            <button className="tl-main" onClick={() => h.openItem(it)}>
              <span className="tl-time">{it.time ? formatTime(it.time) : 'Anytime'}</span>
              <span className="tl-label">{it.label}</span>
            </button>
            <span className={`reminder-kind reminder-kind--${it.kind}`}>{it.kind}</span>
          </li>
        ))}
      </ul>
      {items.length > TIMELINE_LIMIT && (
        <button className="btn btn-ghost btn-sm tl-more" onClick={() => setAll((v) => !v)}>
          {all ? 'Show less' : `Show all ${items.length}`}
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
      {h.enabled('reminders') && (
        <>
          <UpNext h={h} />
          <TimelineSection h={h} />
        </>
      )}
      {TODAY_ORDER.map((id) => h.block(id))}
    </>
  );
}

// B. Bento (Pro) — a tile grid so progress is visible without scrolling.
export function BentoView({ h }) {
  const showGoals = h.enabled('goals');
  const showTiles = showGoals || h.enabled('reminders');
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
          {h.enabled('reminders') && (
            <>
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
              <button className="bento-tile bento-count" onClick={() => h.navigate('/planner')}>
                <span className="detail-label">Today</span>
                <strong className="bento-big">
                  <AnimatedNumber value={h.timeline.length} />
                </strong>
                <span className="muted small">
                  {h.timeline.length === 1 ? 'thing scheduled' : 'things scheduled'}
                </span>
              </button>
            </>
          )}
        </div>
      )}
      {BENTO_ORDER.map((id) => h.block(id))}
      {h.enabled('recap') && !nothingYet && (
        <section className="detail-section">
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
      )}
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
      {h.enabled('reminders') && <TimelineSection h={h} title="Focus today" />}
      {h.enabled('nudges') && h.block('nudges')}
      <div className="calm-folds">
        {folds
          .map((f) => {
            const id = f.id;
            const body = h.block(id);
            if (!body) return null;
            return (
              <Fold key={id} icon={f.icon} title={f.title} summary={f.summary}>
                {body}
              </Fold>
            );
          })}
      </div>
    </div>
  );
}
