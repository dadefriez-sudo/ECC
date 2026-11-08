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
