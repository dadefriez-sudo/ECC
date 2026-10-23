import Icon from './Icon.jsx';
import AnimatedNumber from './AnimatedNumber.jsx';
import {
  computeGoalStreak,
  dailyGoalsOn,
  addDays,
  toISODate,
  todayISO,
  formatDayLabel,
} from '../data/helpers.js';

// The two newer Goals layouts. Both read the same saved goal data as the
// classic one (goal.progress per day/week), so switching layouts never changes
// or loses anything — the controller (GoalsPage) owns all the state and hands
// the handlers down; these only draw.
//
//   Calm   — one quiet list: tap the circle, done. Seven dots of history.
//   Streak — a day streak, a week strip and bigger one tap cards (Pro).

const isMet = (g, key) => (g.progress?.[key] || 0) >= g.target || (g.frozenKeys || []).includes(key);

function CountChips({ g, value, k, h }) {
  if (g.target < 10 || value >= g.target) return null;
  const typing = h.typing?.id === g.id;
  return (
    <div className="quick-chips layout-chips">
      {typing ? (
        <>
          <input
            className="quick-input"
            type="number"
            inputMode="numeric"
            min="0"
            autoFocus
            value={h.typing.value}
            onChange={(e) => h.setTyping({ id: g.id, value: e.target.value, key: k })}
            onKeyDown={(e) => e.key === 'Enter' && h.commitTyping()}
            aria-label={`Set ${g.title} progress`}
          />
          <button className="quick-chip quick-chip--go" onClick={h.commitTyping}>Set</button>
          <button className="quick-chip" onClick={() => h.setTyping(null)}>Cancel</button>
        </>
      ) : (
        <>
          <button className="quick-chip" onClick={() => h.applyDelta(g.id, k, 5)}>+5</button>
          {g.target >= 20 && <button className="quick-chip" onClick={() => h.applyDelta(g.id, k, 10)}>+10</button>}
          <button className="quick-chip" onClick={() => h.setTyping({ id: g.id, value: String(value), key: k })}>Type</button>
          <button className="quick-chip quick-chip--go" onClick={() => h.setProgress(g.id, k, g.target)}>Done</button>
        </>
      )}
    </div>
  );
}

// A circle you tap to finish (or un-finish) a goal. For a counter goal it
// fills like a ring as progress builds.
function GoalCircle({ g, value, k, h }) {
  const done = value >= g.target;
  const pct = Math.min(100, Math.round((value / g.target) * 100));
  return (
    <button
      className={`gcirc${done ? ' gcirc--on' : ''}`}
      style={{ '--p': pct }}
      data-haptic={done ? 'select' : 'none'}
      onClick={() => (g.target === 1 ? h.applyDelta(g.id, k, done ? -1 : 1) : h.setProgress(g.id, k, done ? 0 : g.target))}
      aria-pressed={done}
      aria-label={done ? `Undo ${g.title}` : `Mark ${g.title} done`}
    >
      {done && <Icon name="check" size={18} />}
    </button>
  );
}

// The last seven days, oldest to today: filled when met, hollow when missed,
// faint when the goal wasn't due (or didn't exist yet).
function Pips({ g }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <span className="pips" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(today, i - 6);
        const iso = toISODate(d);
        const due = dailyGoalsOn([g], d).length > 0;
        const cls = !due ? ' pip--na' : isMet(g, iso) ? ' pip--on' : '';
        return <i key={iso} className={`pip${cls}${i === 6 ? ' pip--today' : ''}`} />;
      })}
    </span>
  );
}

function streakLine(g) {
  const n = computeGoalStreak(g, { rest: true });
  return n >= 1 ? `${n} day streak` : '';
}

function WeeklyRow({ g, h, card }) {
  const value = g.progress?.[h.weekKey] || 0;
  const done = value >= g.target;
  const left = Math.max(0, g.target - value);
  return (
    <>
      <div className={card ? `sk-card sk-card--week${done ? ' sk-card--done' : ''}` : 'calm-row'}>
        <span className={`wk-count${done ? ' wk-count--on' : ''}`}>
          {done ? <Icon name="check" size={16} /> : `${value}/${g.target}`}
        </span>
        <button className="calm-main" onClick={() => h.openEdit(g)}>
          <span className="calm-title">{g.title}</span>
          <span className="calm-sub">
            {done ? 'Done for the week' : `${left} more ${g.unit || 'to go'} by ${h.weekEndLabel}`}
          </span>
        </button>
        {!done && (
          <button className="wk-plus" onClick={() => h.applyDelta(g.id, h.weekKey, 1)} aria-label={`Add one to ${g.title}`}>
            <Icon name="plus" size={18} />
          </button>
        )}
      </div>
      {!done && <CountChips g={g} value={value} k={h.weekKey} h={h} />}
    </>
  );
}

export function CalmView({ h }) {
  const todayKey = todayISO();
  const doneCount = h.todayGoals.filter((g) => isMet(g, todayKey)).length;
  return (
    <div className="calm">
      <div className="calm-head">
        <div className="calm-date">{formatDayLabel(todayKey)}</div>
        <div className="muted calm-count">
          {h.todayGoals.length === 0
            ? 'Nothing due today'
            : doneCount === h.todayGoals.length
            ? 'All done today. Nice work.'
            : `${doneCount} of ${h.todayGoals.length} done today`}
        </div>
      </div>

      {h.todayGoals.length > 0 && <div className="calm-sec">TODAY</div>}
      {h.todayGoals.map((g) => {
        const value = g.progress?.[todayKey] || 0;
        const line = g.target > 1 ? `${value} of ${g.target} ${g.unit || ''}`.trim() : '';
        const sl = streakLine(g);
        return (
          <div key={g.id}>
            <div className="calm-row">
              <GoalCircle g={g} value={value} k={todayKey} h={h} />
              <button className="calm-main" onClick={() => h.openEdit(g)}>
                <span className="calm-title">{g.title}</span>
                <span className="calm-sub">{[line, sl].filter(Boolean).join(' · ')}</span>
              </button>
              <Pips g={g} />
            </div>
            <CountChips g={g} value={value} k={todayKey} h={h} />
          </div>
        );
      })}

      {h.weeklyGoals.length > 0 && <div className="calm-sec">THIS WEEK</div>}
      {h.weeklyGoals.map((g) => (
        <WeeklyRow key={g.id} g={g} h={h} />
      ))}

      {h.todayGoals.length > 0 && (
        <p className="muted small calm-foot">One missed day a week never breaks a streak.</p>
      )}
    </div>
  );
}

export function StreakView({ h }) {
  const todayKey = todayISO();
  const doneCount = h.todayGoals.filter((g) => isMet(g, todayKey)).length;
  const total = h.todayGoals.length;
  const safe = h.rule === 'any' ? doneCount > 0 : total > 0 && doneCount === total;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  return (
    <div className="streak-layout">
      <div className="sk-top">
        <span className="sk-flame">
          <Icon name="flame" size={26} /> <AnimatedNumber value={h.dayStreak} />
        </span>
        <span className="muted sk-top-label">day streak</span>
      </div>
      <div className="sk-week">
        {h.strip.map((d, i) => (
          <div key={d.iso} className={`sk-day${d.status === 'met' ? ' sk-day--on' : ''}${d.isToday ? ' sk-day--today' : ''}`}>
            <span className="sk-day-l">{d.label}</span>
            <b className="sk-day-c" aria-label={`${d.iso}: ${d.status}`}>
              {d.status === 'met' && <Icon name="check" size={16} />}
            </b>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className={`sk-banner${safe ? ' sk-banner--safe' : ''}`}>
          <div className="sk-banner-row">
            <strong>
              {safe
                ? 'Streak safe for today'
                : h.rule === 'any'
                ? 'Do one goal to keep your streak'
                : 'Finish today to keep your streak'}
            </strong>
            <span className="muted">{doneCount}/{total}</span>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      {h.todayGoals.map((g) => {
        const value = g.progress?.[todayKey] || 0;
        const done = value >= g.target;
        const line = g.target > 1 ? `${value} of ${g.target} ${g.unit || ''}`.trim() : done ? 'Done' : 'Tap to check off';
        const sl = streakLine(g);
        return (
          <div key={g.id} className={`sk-card${done ? ' sk-card--done' : ''}`}>
            <div className="sk-card-row">
              <GoalCircle g={g} value={value} k={todayKey} h={h} />
              <button className="calm-main" onClick={() => h.openEdit(g)}>
                <span className="calm-title">{g.title}</span>
                <span className="calm-sub">{[line, sl].filter(Boolean).join(' · ')}</span>
              </button>
            </div>
            {g.target > 1 && !done && (
              <div className="progress-track sk-bar"><div className="progress-fill" style={{ width: `${Math.round((value / g.target) * 100)}%` }} /></div>
            )}
            <CountChips g={g} value={value} k={todayKey} h={h} />
          </div>
        );
      })}

      {h.weeklyGoals.length > 0 && <div className="calm-sec">THIS WEEK</div>}
      {h.weeklyGoals.map((g) => (
        <WeeklyRow key={g.id} g={g} h={h} card />
      ))}
    </div>
  );
}
