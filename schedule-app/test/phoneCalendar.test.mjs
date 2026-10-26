import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneEvents, planPhoneCalendarImport, colorFromInt, externalIdFor } from '../src/data/phoneCalendar.js';

const local = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi).getTime();

test('a timed event keeps its local date and times', () => {
  const [e] = normalizePhoneEvents([{ eventId: '7', begin: local(2026, 11, 3, 14, 30), end: local(2026, 11, 3, 15, 45), title: ' Dentist ', location: 'Main St', description: 'Bring forms' }]);
  assert.deepEqual([e.title, e.date, e.start, e.end, e.location], ['Dentist', '2026-11-03', '14:30', '15:45', 'Main St']);
  assert.equal(e.notes, 'Bring forms');
});

test('an all-day event uses its UTC date, at a morning slot, and says it is all day', () => {
  const [e] = normalizePhoneEvents([{ eventId: '8', begin: Date.UTC(2026, 10, 11), end: Date.UTC(2026, 10, 12), allDay: true, title: 'Veterans Day' }]);
  assert.equal(e.date, '2026-11-11');
  assert.equal(e.start, '09:00');
  assert.match(e.notes, /All day/);
});

test('an event that runs past midnight stops at the end of its first day', () => {
  const [e] = normalizePhoneEvents([{ eventId: '9', begin: local(2026, 11, 5, 22, 0), end: local(2026, 11, 6, 1, 0), title: 'Late' }]);
  assert.deepEqual([e.date, e.start, e.end], ['2026-11-05', '22:00', '23:59']);
});

test('each occurrence of a repeating event is its own entry with its own id', () => {
  const rows = normalizePhoneEvents([
    { eventId: '3', begin: local(2026, 11, 2, 9, 0), end: local(2026, 11, 2, 10, 0), title: 'Standup' },
    { eventId: '3', begin: local(2026, 11, 9, 9, 0), end: local(2026, 11, 9, 10, 0), title: 'Standup' },
  ]);
  assert.equal(new Set(rows.map((r) => r.externalId)).size, 2);
});

test('the calendar colour is carried over, as #rrggbb', () => {
  assert.equal(colorFromInt(0xff4285f4 | 0), '#4285f4');
  const [e] = normalizePhoneEvents([{ eventId: '1', begin: local(2026, 11, 2, 9, 0), end: local(2026, 11, 2, 10, 0), title: 'x', calendarId: 'c1' }], { c1: '#4285f4' });
  assert.equal(e.color, '#4285f4');
});

test('importing again updates changes and never duplicates or removes', () => {
  const first = normalizePhoneEvents([{ eventId: '1', begin: local(2026, 11, 2, 9, 0), end: local(2026, 11, 2, 10, 0), title: 'Meeting' }]);
  const plan1 = planPhoneCalendarImport([], first);
  assert.equal(plan1.add.length, 1);
  const stored = [{ id: 'e1', ...plan1.add[0], done: true, reminder: [10] }, { id: 'e2', source: 'phone', externalId: 'phone:gone:1', title: 'Old', date: '2026-11-01' }, { id: 'mine', title: 'Own' }];
  const again = planPhoneCalendarImport(stored, first);
  assert.deepEqual([again.add.length, again.update.length], [0, 0]);
  const changed = planPhoneCalendarImport(stored, normalizePhoneEvents([{ eventId: '1', begin: local(2026, 11, 2, 9, 0), end: local(2026, 11, 2, 10, 0), title: 'Meeting (moved room)' }]));
  assert.equal(changed.update[0].title, 'Meeting (moved room)');
  assert.equal(changed.update[0].done, true);
  assert.equal(externalIdFor({ eventId: '1', begin: 5 }), 'phone:1:5');
});

test('bad input gives nothing', () => {
  assert.deepEqual(normalizePhoneEvents(null), []);
  assert.deepEqual(normalizePhoneEvents([null, {}, { begin: 'x' }]), []);
});
