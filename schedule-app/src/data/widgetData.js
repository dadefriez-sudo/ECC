// The extra numbers the home screen widgets draw: what is next, goals to tap, the streak
// and rings, the week, the people to follow up, and the month. The Android side (the
// KeystoneWidget* classes) only reads these back; nothing here is sent anywhere.
import {
  todayISO,
  toISODate,
  fromISODate,
  expandEventOnDay,
  weekKey,
  startOfWeek,
  weekDays,
  dailyGoalsOn,
  goalCompletion,
  computeGoalStreak,
  goalKey,
  daysAgoLabel,
  formatShortDate,
} from './helpers.js';
import { makeOverdueCheck } from './reconnect.js';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Goals worth a tap right now: ones in play today, unfinished first, at most `max`.
export function widgetGoals(state, now, max = 3) {
  const today = new Date(now);
  const dow = today.getDay();
  const inPlay = (state.goals || []).filter((g) => {
    if ((g.target || 0) <= 0) return false;
    if ((g.period || 'weekly') !== 'daily') return true;
    return !g.repeatDays?.length || g.repeatDays.includes(dow);
  });
  return inPlay
    .map((g) => {
      const v = g.progress?.[goalKey(g.period || 'weekly', today)] || 0;
      return { i: g.id, n: g.title, v, g: g.target, s: g.target >= 20 ? 5 : 1, done: v >= g.target };
    })
    .sort((a, b) => Number(a.done) - Number(b.done))
    .slice(0, max)
    .map(({ done, ...rest }) => rest);
}

export function widgetRings(state, now) {
  const dailyGoals = dailyGoalsOn(state.goals || [], now);
  const weeklyGoals = (state.goals || []).filter((g) => (g.period || 'weekly') === 'weekly');
  return {
    dp: goalCompletion(dailyGoals, goalKey('daily', now)).pct,
    wp: goalCompletion(weeklyGoals, weekKey(now)).pct,
    streak: (state.goals || []).reduce((m, g) => Math.max(m, computeGoalStreak(g)), 0),
  };
}

// The seven days of this week, with how many events each has.
export function widgetWeek(state, now) {
  const start = startOfWeek(now);
  const todayIso = toISODate(now);
  return weekDays(start).map((d) => {
    const iso = toISODate(d);
    const c = (state.events || []).reduce((n, e) => n + expandEventOnDay(e, iso).length, 0);
    return { d: LETTERS[d.getDay()], n: d.getDate(), c, t: iso === todayIso, iso };
  });
}

// People who are due a follow-up, or past their reconnect time (same idea as the
// Tracker layout on Home), most urgent first.
export function widgetPeople(state, now, max = 3) {
  const today = toISODate(now);
  const overdue = makeOverdueCheck(state);
  const colors = Object.fromEntries((state.statuses || []).map((s) => [s.id, s.color]));
  const rank = (c) => (c.followUp?.date && c.followUp.date <= today ? 0 : overdue(c) ? 1 : 2);
  return [...(state.contacts || [])]
    .filter((c) => rank(c) < 2 || c.lastContacted)
    .sort((a, b) => rank(a) - rank(b) || (a.lastContacted || '').localeCompare(b.lastContacted || ''))
    .slice(0, max)
    .map((c) => ({
      i: c.id,
      n: c.name,
      l: c.followUp?.date && c.followUp.date <= today ? `Follow up ${formatShortDate(c.followUp.date)}` : c.lastContacted ? `Last contact ${daysAgoLabel(c.lastContacted).toLowerCase()}` : 'Not contacted yet',
      p: (c.phone || '').replace(/[^\d+]/g, ''),
      c: colors[c.statusId] || '#93a0ad',
    }));
}

// The current month as a grid: which weekday the 1st falls on (given the week start),
// the day count, today, and how many events each day has.
export function widgetMonth(state, now) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const offset = Math.round((first - startOfWeek(first)) / 86400000);
  const n = new Date(y, m + 1, 0).getDate();
  const c = [];
  for (let day = 1; day <= n; day++) {
    const iso = toISODate(new Date(y, m, day));
    c.push((state.events || []).reduce((k, e) => k + expandEventOnDay(e, iso).length, 0));
  }
  const heads = weekDays(startOfWeek(now)).map((d) => LETTERS[d.getDay()]);
  return {
    t: now.toLocaleDateString(undefined, { month: 'long' }),
    o: offset,
    n,
    d: now.getDate(),
    c,
    h: heads,
  };
}

// What is next, and in how many minutes (null when it has no time).
export function widgetNext(rows, now) {
  const first = rows[0];
  if (!first) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return {
    t: first.t,
    n: first.n,
    k: first.k,
    i: first.i,
    m: first.sort < 24 * 60 ? Math.max(0, first.sort - nowMin) : null,
    loc: first.loc || '',
  };
}

export { todayISO, fromISODate };
