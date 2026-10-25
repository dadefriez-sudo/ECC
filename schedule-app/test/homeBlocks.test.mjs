import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHomeBlocks, HOME_BLOCK_TYPES } from '../src/data/homeBlocks.js';

const ids = (l) => l.map((b) => b.id);
const OLD_DEFAULT = ['challenge', 'goals', 'nudges', 'reminders', 'recap', 'tasks', 'notes'];

test('a layout saved before Up next existed gains it, on, beside reminders', () => {
  const out = normalizeHomeBlocks(OLD_DEFAULT.map((id) => ({ id, enabled: true })));
  assert.deepEqual(ids(out), ids(HOME_BLOCK_TYPES));
  assert.equal(out.find((b) => b.id === 'upnext').enabled, true);
});

test('a customised order keeps its order and still gets Up next before reminders', () => {
  const saved = ['tasks', 'notes', 'reminders', 'goals'].map((id) => ({ id, enabled: true }));
  const out = ids(normalizeHomeBlocks(saved));
  assert.ok(out.indexOf('upnext') === out.indexOf('reminders') - 1);
  assert.ok(out.indexOf('tasks') < out.indexOf('notes'));
});

test('switched-off blocks stay off and unknown ones are dropped', () => {
  const out = normalizeHomeBlocks([{ id: 'goals', enabled: false }, { id: 'bogus', enabled: true }, { id: 'goals', enabled: true }]);
  assert.equal(out.find((b) => b.id === 'goals').enabled, false);
  assert.equal(out.some((b) => b.id === 'bogus'), false);
  assert.equal(out.filter((b) => b.id === 'goals').length, 1);
});

test('nothing saved gives the default order', () => {
  assert.deepEqual(ids(normalizeHomeBlocks(undefined)), ids(HOME_BLOCK_TYPES));
});
