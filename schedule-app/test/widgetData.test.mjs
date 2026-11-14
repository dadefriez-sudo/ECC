import test from 'node:test';
import assert from 'node:assert/strict';
import { widgetGoals, widgetRings, widgetWeek, widgetMonth, widgetNext, widgetPeople } from '../src/data/widgetData.js';
import { toISODate } from '../src/data/helpers.js';

const NOW = new Date('2026-11-11T10:15:00'); // a Wednesday
const goal = (id, title, target, v, extra = {}) => ({ id, title, target, period: 'daily', progress: { '2026-11-11': v }, createdAt: '2026-01-01', ...extra });

test('widget goals: unfinished first, at most three, with the amount a tap adds', () => {
  const state = { goals: [goal('a', 'Done one', 1, 1), goal('b', 'Water', 8, 3), goal('c', 'Read', 30, 10), goal('d', 'Walk', 2, 0)] };
  const g = widgetGoals(state, NOW);
  assert.deepEqual(g.map((x) => x.i), ['b', 'c', 'd']);
  assert.equal(g[0].s, 1);
  assert.equal(g[1].s, 5); // a 30-minute goal moves in fives
});

test('a daily goal that is not scheduled today is left out', () => {
  const state = { goals: [goal('a', 'Gym', 1, 0, { repeatDays: [1, 3] }), goal('b', 'Run', 1, 0, { repeatDays: [2] })] };
  assert.deepEqual(widgetGoals(state, NOW).map((x) => x.i), ['a']);
});

test('rings and streak', () => {
  const state = { goals: [goal('a', 'A', 2, 1), goal('b', 'B', 2, 2)] };
  const r = widgetRings(state, NOW);
  assert.equal(r.dp, 75);
  assert.ok(r.streak >= 0);
});

test('the week has seven days, today marked, with event counts', () => {
  const ev = { id: 'e1', title: 'X', date: '2026-11-11', start: '10:00', end: '11:00', repeat: 'none' };
  const w = widgetWeek({ events: [ev] }, NOW);
  assert.equal(w.length, 7);
  assert.equal(w.filter((d) => d.t).length, 1);
  assert.equal(w.find((d) => d.iso === '2026-11-11').c, 1);
  assert.equal(w.find((d) => d.t).n, 11);
});

test('the month grid: size, start offset and today', () => {
  const m = widgetMonth({ events: [] }, NOW);
  assert.equal(m.n, 30);
  assert.equal(m.c.length, 30);
  assert.equal(m.d, 11);
  assert.equal(m.h.length, 7);
  assert.ok(m.o >= 0 && m.o <= 6);
});

test('next: minutes until, or null for an untimed item', () => {
  assert.equal(widgetNext([{ sort: 11 * 60, t: '11:00 AM', n: 'Dentist', k: 'event', i: 'x' }], NOW).m, 45);
  assert.equal(widgetNext([{ sort: 24 * 60, t: '', n: 'Chore', k: 'task', i: 'y' }], NOW).m, null);
  assert.equal(widgetNext([], NOW), null);
});

test('people: a due follow-up comes first, with a phone number for the row', () => {
  const state = {
    contacts: [
      { id: 'c1', name: 'Old Friend', lastContacted: '2026-01-01', phone: '(555) 010-2000' },
      { id: 'c2', name: 'Promised', lastContacted: '2026-11-01', followUp: { date: toISODate(NOW) }, phone: '555-0199' },
    ],
    statuses: [],
    settings: { reconnectRemindersEnabled: true, reconnectDays: 30 },
    interactions: [],
  };
  const p = widgetPeople(state, NOW);
  assert.equal(p[0].i, 'c2');
  assert.equal(p[1].p, '5550102000');
});

import { widgetProductivity } from '../src/data/widgetData.js';
import { completeTask } from '../src/data/taskActions.js';

test('Productivity: counts done today, open tasks due, week bars and the streak', () => {
  const now = new Date('2026-11-12T10:00:00'); // a Thursday
  const state = {
    tasks: [
      { id: 'a', title: 'Renew car registration', dueDate: '2026-11-12', done: false },
      { id: 'b', title: 'Pick up dry cleaning', dueDate: '2026-11-12', dueTime: '17:00', done: false },
      { id: 'c', title: 'Overdue thing', dueDate: '2026-11-10', done: false },
      { id: 'd', title: 'Later', dueDate: '2026-11-20', done: false },
      { id: 'e', title: 'Email the proposal', dueDate: '2026-11-12', done: true, completedDates: ['2026-11-12'] },
      { id: 'f', title: 'Water plants', repeat: 'daily', dueDate: '2026-11-13', done: false, completedDates: ['2026-11-11', '2026-11-12'] },
    ],
  };
  const p = widgetProductivity(state, now);
  assert.equal(p.n, 2); // e, and f (a repeating task that rolled forward today)
  assert.equal(p.l, 3); // a, b and the overdue one; not the one due later
  assert.equal(p.p, 40);
  assert.deepEqual(p.top.map((t) => t.i), ['c', 'b', 'a']); // overdue first, then timed, then untimed
  assert.equal(p.top[0].t, 'Overdue');
  assert.equal(p.d, 3); // Thursday, with the week starting Monday
  assert.equal(p.w.reduce((x, y) => x + y, 0), 3);
  assert.equal(p.w[3], 2);
  assert.equal(p.s, 2); // finished something on the 11th and the 12th
});

test('Productivity: no tasks means an empty ring, and a streak can carry from yesterday', () => {
  const now = new Date('2026-11-12T10:00:00');
  const p = widgetProductivity({ tasks: [{ id: 'x', title: 'x', dueDate: '2026-11-11', done: true, completedDates: ['2026-11-10', '2026-11-11'] }] }, now);
  assert.equal(p.p, 0);
  assert.equal(p.s, 2);
  assert.equal(widgetProductivity({}, now).top.length, 0);
});

test('completeTask logs today and rolls a repeating task forward', () => {
  const once = completeTask({ id: 'a', title: 'a', dueDate: '2026-11-12' }, '2026-11-12');
  assert.equal(once.done, true);
  assert.deepEqual(once.completedDates, ['2026-11-12']);
  const daily = completeTask({ id: 'b', title: 'b', repeat: 'daily', dueDate: '2026-11-12' }, '2026-11-12');
  assert.equal(daily.done, false);
  assert.equal(daily.dueDate, '2026-11-13');
  assert.deepEqual(daily.completedDates, ['2026-11-12']);
});
