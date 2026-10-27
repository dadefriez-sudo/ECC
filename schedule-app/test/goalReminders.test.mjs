import test from 'node:test';
import assert from 'node:assert/strict';
import { goalRemindsOn } from '../src/data/helpers.js';

// 2026-10-27 is a Tuesday (getDay() === 2).
const TUE = '2026-10-27';

test('a daily goal that skips Tuesday does not remind on Tuesday', () => {
  const g = { period: 'daily', target: 1, repeatDays: [1, 3, 5], progress: {} };
  assert.equal(goalRemindsOn(g, TUE), false);
  assert.equal(goalRemindsOn(g, '2026-10-28'), true);
});

test('a daily goal reminds every day without a weekday restriction, until met', () => {
  const g = { period: 'daily', target: 2, progress: {} };
  assert.equal(goalRemindsOn(g, TUE), true);
  assert.equal(goalRemindsOn({ ...g, progress: { [TUE]: 2 } }, TUE), false);
  assert.equal(goalRemindsOn({ ...g, frozenKeys: [TUE] }, TUE), false);
});

test('a daily goal does not remind before it was created', () => {
  const g = { period: 'daily', target: 1, createdAt: '2026-10-30', progress: {} };
  assert.equal(goalRemindsOn(g, TUE), false);
});

test('a weekly goal stops reminding once the week is met', () => {
  const g = { period: 'weekly', target: 3, progress: {} };
  assert.equal(goalRemindsOn(g, TUE), true);
  assert.equal(goalRemindsOn({ ...g, progress: { '2026-10-26': 3 } }, TUE), false);
});

test('a goal with no target never reminds', () => {
  assert.equal(goalRemindsOn({ period: 'daily', target: 0 }, TUE), false);
});
