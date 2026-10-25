import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useStore } from '../data/store.jsx';
import {
  addDays,
  computeDayStreak,
  computeGoalStreak,
  dailyGoalsOn,
  formatDayLabel,
  toISODate,
} from '../data/helpers.js';
import { buildGoalHistory } from '../data/goalHistory.js';

const DAYS = 30;

const isMet = (g, key) => (g.progress?.[key] || 0) >= g.target || (g.frozenKeys || []).includes(key);

// Every goal in one place: how the last month went day by day, and a row per
// goal that opens its own history.
export default function GoalsHistoryPage() {
  const navigate = useNavigate();
  const { state } = useStore();
  const isPro = !!state.settings?.isPro;
  const rule = state.settings?.dayStreakRule === 'any' ? 'any' : 'all';
  const [openDay, setOpenDay] = useState(null);

  // Same Pro rule as a single goal's history, enforced here too so a direct
  // link can't skip it.
  useEffect(() => {
    if (!isPro) navigate('/pricing', { replace: true });
  }, [isPro, navigate]);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out = [];
    for (let i = 0; i < DAYS; i++) {
      const d = addDays(today, -i);
      const iso = toISODate(d);
      const due = dailyGoalsOn(state.goals, d);
      const met = due.filter((g) => isMet(g, iso));
      out.push({ iso, due, met });
    }
    return out;
  }, [state.goals]);

  const scored = days.filter((d) => d.due.length > 0);
  const perfect = scored.filter((d) => d.met.length === d.due.length).length;
  const avg = scored.length
    ? Math.round((scored.reduce((s, d) => s + d.met.length / d.due.length, 0) / scored.length) * 100)
    : 0;
  const dayStreak = computeDayStreak(state.goals, rule);

  if (!isPro) return null;

  const goals = state.goals;
  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-row">
          <button className="back-btn" onClick={() => navigate('/goals')}>
            ‹ Goals
          </button>
        </div>
        <h1>History</h1>
      </header>

      {goals.length === 0 ? (
        <p className="muted center-pad">Add a goal and its history will build up here.</p>
      ) : (
        <>
          <section className="detail-section history-stats">
            <div className="history-stat">
              <strong>{dayStreak}</strong>
              <span className="muted small">Day streak</span>
            </div>
            <div className="history-stat">
              <strong>{perfect}</strong>
              <span className="muted small">Perfect days</span>
            </div>
            <div className="history-stat">
              <strong>{avg}%</strong>
              <span className="muted small">Last {DAYS} days</span>
            </div>
          </section>

          <section className="detail-section">
            <span className="detail-label">Day by day</span>
            {scored.length === 0 ? (
              <p className="muted small">No daily goals in the last {DAYS} days.</p>
            ) : (
              <ul className="gh-days">
                {scored.map((d) => {
                  const open = openDay === d.iso;
                  const pct = Math.round((d.met.length / d.due.length) * 100);
                  return (
                    <li key={d.iso} className="gh-day">
                      <button
                        className="gh-day-head"
                        onClick={() => setOpenDay(open ? null : d.iso)}
                        aria-expanded={open}
                      >
                        <span className="gh-day-date">{formatDayLabel(d.iso)}</span>
                        <span className="gh-day-bar" aria-hidden="true">
                          <i style={{ width: `${pct}%` }} className={pct === 100 ? 'gh-full' : ''} />
                        </span>
                        <span className="gh-day-count">
                          {d.met.length}/{d.due.length}
                        </span>
                      </button>
                      {open && (
                        <ul className="gh-day-goals">
                          {d.due.map((g) => {
                            const ok = isMet(g, d.iso);
                            return (
                              <li key={g.id} className={ok ? 'gh-ok' : 'gh-miss'}>
                                <Icon name={ok ? 'check' : 'close'} size={14} />
                                <span>{g.title}</span>
                                {g.target > 1 && (
                                  <span className="muted small">
                                    {g.progress?.[d.iso] || 0}/{g.target}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="detail-section">
            <span className="detail-label">Each goal</span>
            <ul className="gh-goals">
              {goals.map((g) => {
                const recent = buildGoalHistory(g, 14);
                const streak = computeGoalStreak(g);
                return (
                  <li key={g.id}>
                    <button className="gh-goal" onClick={() => navigate(`/goals/${g.id}/history`)}>
                      <span className="gh-goal-main">
                        <strong>{g.title}</strong>
                        <span className="muted small">
                          {(g.period || 'weekly') === 'daily' ? 'Daily' : 'Weekly'}
                          {streak >= 1 ? ` · ${streak} in a row` : ''}
                        </span>
                      </span>
                      <span className="gh-spark" aria-hidden="true">
                        {recent.map((h) => (
                          <i key={h.key} className={h.met ? 'gh-spark-on' : ''} />
                        ))}
                      </span>
                      <Icon name="chevronRight" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
