import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeStates, slim, same, sameState } from '../src/data/syncMerge.js';

const t = (n) => `2026-10-2${n}T10:00:00.000Z`;
const state = (over = {}) => ({ goals: [], events: [], contacts: [], tasks: [], notes: [], settings: {}, ...over });

test('items added on each device are both kept', () => {
  const base = state({ tasks: [{ id: 't1', title: 'A', _u: t(1) }] });
  const local = state({ tasks: [...base.tasks, { id: 'tL', title: 'Local', _u: t(2) }] });
  const remote = state({ tasks: [...base.tasks, { id: 'tR', title: 'Remote', _u: t(3) }] });
  const out = mergeStates(base, local, remote);
  assert.deepEqual(out.tasks.map((x) => x.id).sort(), ['t1', 'tL', 'tR']);
});

test('different fields edited on each device are both kept', () => {
  const base = state({ contacts: [{ id: 'c1', name: 'Sam', phone: '1', notes: '', _u: t(1) }] });
  const local = state({ contacts: [{ ...base.contacts[0], phone: '2', _u: t(2) }] });
  const remote = state({ contacts: [{ ...base.contacts[0], notes: 'hi', _u: t(3) }] });
  const out = mergeStates(base, local, remote).contacts[0];
  assert.equal(out.phone, '2');
  assert.equal(out.notes, 'hi');
  assert.equal(out._u, t(3));
});

test('the same field edited on both devices: the newer edit wins, from either side', () => {
  const base = state({ tasks: [{ id: 't1', title: 'Old', _u: t(1) }] });
  const a = state({ tasks: [{ id: 't1', title: 'From A', _u: t(2) }] });
  const b = state({ tasks: [{ id: 't1', title: 'From B', _u: t(3) }] });
  assert.equal(mergeStates(base, a, b).tasks[0].title, 'From B');
  assert.equal(mergeStates(base, b, a).tasks[0].title, 'From B');
});

test('an exact tie still gives both devices the same answer', () => {
  const base = state({ tasks: [{ id: 't1', title: 'Old', _u: t(1) }] });
  const a = state({ tasks: [{ id: 't1', title: 'AAA', _u: t(2) }] });
  const b = state({ tasks: [{ id: 't1', title: 'BBB', _u: t(2) }] });
  assert.equal(mergeStates(base, a, b).tasks[0].title, mergeStates(base, b, a).tasks[0].title);
});

test('goal progress logged on different days merges', () => {
  const base = state({ goals: [{ id: 'g1', progress: { '2026-10-20': 1 }, _u: t(1) }] });
  const local = state({ goals: [{ id: 'g1', progress: { '2026-10-20': 1, '2026-10-21': 3 }, _u: t(2) }] });
  const remote = state({ goals: [{ id: 'g1', progress: { '2026-10-20': 1, '2026-10-22': 2 }, _u: t(3) }] });
  assert.deepEqual(mergeStates(base, local, remote).goals[0].progress, {
    '2026-10-20': 1,
    '2026-10-21': 3,
    '2026-10-22': 2,
  });
});

test('lists of plain values are combined, and a removal on one side sticks', () => {
  const base = state({ tasks: [{ id: 't1', completedDates: ['d1', 'd2'], _u: t(1) }] });
  const local = state({ tasks: [{ id: 't1', completedDates: ['d1', 'd2', 'dL'], _u: t(2) }] });
  const remote = state({ tasks: [{ id: 't1', completedDates: ['d1', 'dR'], _u: t(3) }] });
  const out = mergeStates(base, local, remote).tasks[0].completedDates;
  assert.deepEqual(out.sort(), ['d1', 'dL', 'dR']);
});

test('a delete on one device removes an item the other did not touch', () => {
  const item = { id: 'n1', title: 'Note', _u: t(1) };
  const base = state({ notes: [item] });
  assert.deepEqual(mergeStates(base, state(), state({ notes: [item] })).notes, []);
  assert.deepEqual(mergeStates(base, state({ notes: [item] }), state()).notes, []);
});

test('a delete loses to an edit made elsewhere', () => {
  const item = { id: 'n1', title: 'Note', _u: t(1) };
  const edited = { ...item, title: 'Edited', _u: t(2) };
  const base = state({ notes: [item] });
  assert.equal(mergeStates(base, state(), state({ notes: [edited] })).notes[0].title, 'Edited');
  assert.equal(mergeStates(base, state({ notes: [edited] }), state()).notes[0].title, 'Edited');
});

test('a device that never synced keeps everything from both sides', () => {
  const local = state({ tasks: [{ id: 'a', title: 'mine' }] });
  const remote = state({ tasks: [{ id: 'b', title: 'theirs' }] });
  assert.deepEqual(mergeStates(null, local, remote).tasks.map((x) => x.id).sort(), ['a', 'b']);
});

test('device settings stay local; shared settings merge', () => {
  const base = state({ settings: { theme: 'light', isPro: false, notifications: false } });
  const local = state({ settings: { theme: 'dark', isPro: true, notifications: false, hapticsLevel: 'full' } });
  const remote = state({ settings: { theme: 'light', isPro: false, notifications: true, hapticsLevel: 'off' } });
  const out = mergeStates(base, local, remote).settings;
  assert.equal(out.theme, 'dark');
  assert.equal(out.notifications, true);
  assert.equal(out.isPro, true);
  assert.equal(out.hapticsLevel, 'full');
});

test('a large photo is recognised from its marker', () => {
  const photo = 'x'.repeat(5000);
  const base = slim(state({ contacts: [{ id: 'c1', photo, name: 'A', _u: t(1) }] }));
  assert.ok(base.contacts[0].photo.length < 50);
  const local = state({ contacts: [{ id: 'c1', photo, name: 'B', _u: t(2) }] });
  const remote = state({ contacts: [{ id: 'c1', photo, name: 'A', _u: t(1) }] });
  const out = mergeStates(base, local, remote).contacts[0];
  assert.equal(out.name, 'B');
  assert.equal(out.photo, photo);
  assert.ok(same(base.contacts[0].photo, photo));
});

test('sameState ignores edit stamps', () => {
  assert.ok(sameState(state({ tasks: [{ id: 'a', title: 'x', _u: t(1) }] }), state({ tasks: [{ id: 'a', title: 'x', _u: t(2) }] })));
  assert.ok(!sameState(state({ tasks: [{ id: 'a', title: 'x' }] }), state({ tasks: [{ id: 'a', title: 'y' }] })));
});

test('merging twice from opposite sides converges', () => {
  const base = state({ tasks: [{ id: 't1', title: 'Old', done: false, _u: t(1) }], notes: [{ id: 'n1', title: 'N', _u: t(1) }] });
  const a = state({ tasks: [{ id: 't1', title: 'Old', done: true, _u: t(2) }], notes: [] });
  const b = state({ tasks: [{ id: 't1', title: 'New', done: false, _u: t(3) }, { id: 't2', title: 'T2', _u: t(3) }], notes: [{ id: 'n1', title: 'N', _u: t(1) }] });
  assert.ok(sameState(mergeStates(base, a, b), mergeStates(base, b, a)));
});

test('a key holding undefined matches a missing key', () => {
  assert.ok(sameState({ a: 1, b: undefined }, JSON.parse('{"a":1}')));
});
