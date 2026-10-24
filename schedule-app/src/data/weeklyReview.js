import { startOfWeek, addDays, toISODate, goalKey, daysSince, formatShortDate, todayISO } from './helpers.js';
import { computeWeeklyRecap } from './weeklyRecap.js';
import { makeOverdueCheck } from './reconnect.js';
import { occurrencesForReview } from './weeklyReviewEvents.js';

// The weekly review looks at the calendar week that just finished (or is
// about to). From 4 PM on the last day of the week it covers that week, and
// on the first day of the next one it still looks back at the week before.
// Any other day it is the week so far, reachable from More.
export const REVIEW_FROM_HOUR = 16;

// The date whose week is being reviewed.
export function reviewAnchor(now = new Date()) {
  const first = toISODate(startOfWeek(now));
  return toISODate(now) === first ? addDays(now, -1) : new Date(now);
}

// Should Home offer the review card right now?
export function reviewCardDue(now = new Date()) {
  const ws = startOfWeek(now);
  const isFirstDay = toISODate(now) === toISODate(ws);
  const isLastDay = toISODate(now) === toISODate(addDays(ws, 6));
  return isFirstDay || (isLastDay && now.getHours() >= REVIEW_FROM_HOUR);
}

// The week's identity, used to remember that a card was dismissed.
export function reviewWeekId(now = new Date()) {
  return toISODate(startOfWeek(reviewAnchor(now)));
}

export function computeWeeklyReview(state, now = new Date()) {
  const anchor = reviewAnchor(now);
  const recap = computeWeeklyRecap(state, anchor);
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)));
  const today = todayISO();

  // Goals that did not land: weekly ones below target, and daily ones met on
  // fewer than half of the days they were due.
  const missedGoals = [];
  for (const g of state.goals || []) {
    const target = g.target || 0;
    if (target <= 0) continue;
    const frozen = g.frozenKeys || [];
    if ((g.period || 'weekly') === 'daily') {
      let due = 0;
      let met = 0;
      for (const d of days) {
        if (d > today) continue;
        if (g.repeatDays?.length && !g.repeatDays.includes(new Date(`${d}T12:00:00`).getDay())) continue;
        due++;
        if ((g.progress?.[d] || 0) >= target || frozen.includes(d)) met++;
      }
      if (due >= 3 && met / due < 0.5) missedGoals.push({ id: g.id, title: g.title, detail: `${met} of ${due} days` });
    } else {
      const key = goalKey('weekly', weekStart);
      const value = g.progress?.[key] || 0;
      if (value < target && !frozen.includes(key)) {
        missedGoals.push({ id: g.id, title: g.title, detail: `${value} of ${target}${g.unit ? ` ${g.unit}` : ''}` });
      }
    }
  }

  const isOverdue = makeOverdueCheck(state);
  const overdueContacts = (state.contacts || [])
    .filter(isOverdue)
    .sort((a, b) => daysSince(b.lastContacted) - daysSince(a.lastContacted))
    .slice(0, 3)
    .map((c) => ({ id: c.id, name: c.name, days: daysSince(c.lastContacted) }));

  const overdueTasks = (state.tasks || []).filter((t) => !t.done && t.dueDate && t.dueDate < today).length;

  // What is coming in the week after the one being reviewed.
  const nextStart = addDays(weekStart, 7);
  const nextDays = Array.from({ length: 7 }, (_, i) => toISODate(addDays(nextStart, i)));
  const nextEvents = nextDays.reduce((n, d) => n + occurrencesForReview(state.events || [], d), 0);
  const nextTasks = (state.tasks || []).filter((t) => !t.done && t.dueDate && nextDays.includes(t.dueDate)).length;

  const wins = [];
  if (recap.goalsCompleted > 0) {
    wins.push(`${recap.goalsCompleted} goal${recap.goalsCompleted === 1 ? '' : 's'} hit`);
  }
  if (recap.tasksCompleted > 0) {
    wins.push(`${recap.tasksCompleted} task${recap.tasksCompleted === 1 ? '' : 's'} done`);
  }
  if (recap.contactsReconnected > 0) {
    wins.push(
      `${recap.contactsReconnected} ${recap.contactsReconnected === 1 ? 'person' : 'people'} reconnected`
    );
  }

  // One suggestion, the most useful thing first.
  let suggestion;
  if (overdueContacts.length > 0) {
    const c = overdueContacts[0];
    suggestion = {
      text: `Reach out to ${c.name.split(' ')[0]}. It has been ${c.days} days.`,
      label: 'Open contact',
      to: `/contacts/${c.id}`,
    };
  } else if (missedGoals.length > 0) {
    suggestion = {
      text: `"${missedGoals[0].title}" slipped this week. Give it a time on the calendar, or lower the target.`,
      label: 'Open goals',
      to: '/goals',
    };
  } else if (overdueTasks > 0) {
    suggestion = {
      text: `${overdueTasks} overdue task${overdueTasks === 1 ? '' : 's'}. Clear them or move them to a new day.`,
      label: 'Open tasks',
      to: '/tasks',
    };
  } else {
    suggestion = {
      text: 'A clear week. Add one thing to look forward to.',
      label: 'Open planner',
      to: '/planner',
    };
  }

  return {
    recap,
    label: `${formatShortDate(days[0])} to ${formatShortDate(days[6])}`,
    weekId: days[0],
    wins,
    missedGoals,
    overdueContacts,
    overdueTasks,
    next: { events: nextEvents, tasks: nextTasks },
    suggestion,
  };
}
