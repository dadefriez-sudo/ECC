import test from 'node:test';
import assert from 'node:assert/strict';
import { ungroupedContacts } from '../src/data/ungrouped.js';

const statuses = [{ id: 's1' }, { id: 's2' }];

test('lists people with no group, A to Z, including ones whose group is gone', () => {
  const state = {
    statuses,
    contacts: [
      { id: 'a', name: 'Zed', statusId: '' },
      { id: 'b', name: 'Amy', statusId: 's1' },
      { id: 'c', name: 'Bo' },
      { id: 'd', name: 'Cy', statusId: 'deleted-group' },
    ],
  };
  assert.deepEqual(ungroupedContacts(state).map((c) => c.id), ['c', 'd', 'a']);
});

test('nobody is listed when everyone has a group, or there is no data', () => {
  assert.deepEqual(ungroupedContacts({ statuses, contacts: [{ id: 'a', name: 'A', statusId: 's2' }] }), []);
  assert.deepEqual(ungroupedContacts({}), []);
  assert.deepEqual(ungroupedContacts(undefined), []);
});
