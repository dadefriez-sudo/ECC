import test from 'node:test';
import assert from 'node:assert/strict';
import { computeNudges } from '../src/data/nudges.js';
import { todayISO, fromISODate, toISODate, addDays } from '../src/data/helpers.js';

// A daily goal met the last three days, not yet today.
function goalWith(repeatDays) {
  const today = fromISODate(todayISO());
  const progress = {};
  for (let i = 1; i <= 3; i++) progress[toISODate(addDays(today, -i))] = 1;
  return { id: 'g1', title: 'Talk to someone spontaneously', period: 'daily', target: 1, progress, repeatDays, createdAt: '2020-01-01' };
}
const streakNudge = (goals) => computeNudges({ goals, contacts: [], settings: {} }).find((n) => n.id.startsWith('streak:'));

test('streak nudge appears for a daily goal that is due today', () => {
  assert.ok(streakNudge([goalWith(undefined)]));
});

test('no streak nudge when today is not one of the goal\'s repeat days', () => {
  const notToday = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== fromISODate(todayISO()).getDay());
  assert.equal(streakNudge([goalWith(notToday)]), undefined);
});
