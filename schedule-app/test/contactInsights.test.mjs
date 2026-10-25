import test from 'node:test';
import assert from 'node:assert/strict';
import { hasHappened, contactInsights } from '../src/data/contactInsights.js';

const at = (h, m = 0) => new Date(2026, 9, 25, h, m); // Oct 25, 2026 local
const ev = (date, start, end) => ({ type: 'event', date, occ: { start, end } });

test('an event later today has not happened yet', () => {
  assert.equal(hasHappened(ev('2026-10-25', '16:00', '17:00'), at(15, 33)), false);
});
test('an event in progress has not happened yet, one that just ended has', () => {
  assert.equal(hasHappened(ev('2026-10-25', '15:00', '16:00'), at(15, 33)), false);
  assert.equal(hasHappened(ev('2026-10-25', '14:00', '15:00'), at(15, 33)), true);
  assert.equal(hasHappened(ev('2026-10-25', '14:00', '15:33'), at(15, 33)), true);
});
test('earlier days happened, later days have not', () => {
  assert.equal(hasHappened(ev('2026-10-24', '23:00', '23:30'), at(0, 5)), true);
  assert.equal(hasHappened(ev('2026-10-26', '00:00', '00:30'), at(23, 59)), false);
});
test('a contact logged today counts as having happened', () => {
  assert.equal(hasHappened({ type: 'interaction', date: '2026-10-25' }, at(9)), true);
});
test('"Last connected" ignores an event that is still to come today', () => {
  const entries = [ev('2026-10-25', '16:00', '17:00'), ev('2026-10-20', '10:00', '11:00')];
  const last = contactInsights(entries, { now: at(15, 33) }).find((i) => i.id === 'last');
  assert.match(last.text, /5 days ago/);
});
