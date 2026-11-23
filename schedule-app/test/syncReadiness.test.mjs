import test from 'node:test';
import assert from 'node:assert/strict';
import { syncReadiness, onSyncRequest, requestSync, describeSyncedAt } from '../src/data/syncStatus.js';

const ok = { isSignedIn: true, email: 'a@b.co', isPro: true, serverConfigured: true, cloudSyncOn: true };
const NOW = 1_000_000_000_000;

test('everything in place: ready, and the line says when it last synced', () => {
  const r = syncReadiness(ok, { phase: 'idle', at: NOW - 5 * 60 * 1000 }, NOW);
  assert.equal(r.ready, true);
  assert.equal(r.items[0].text, 'Signed in as a@b.co');
  assert.equal(r.line, 'Last synced 5 min ago');
});

test('each missing piece is named, and nothing claims a sync', () => {
  const r = syncReadiness({ ...ok, isSignedIn: false, isPro: false }, { phase: 'off', at: null }, NOW);
  assert.equal(r.ready, false);
  assert.deepEqual(r.items.filter((i) => !i.ok).map((i) => i.key), ['account', 'pro']);
  assert.match(r.line, /Not syncing yet/);
  assert.equal(syncReadiness({ ...ok, serverConfigured: false }, {}, NOW).items[2].text, "This build isn't linked to a server");
  assert.equal(syncReadiness({ ...ok, cloudSyncOn: false }, {}, NOW).items[3].ok, false);
});

test('a failed round shows the actual error; syncing shows progress', () => {
  assert.match(syncReadiness(ok, { phase: 'error', error: 'HTTP 502' }, NOW).line, /last attempt failed: HTTP 502/);
  assert.equal(syncReadiness(ok, { phase: 'syncing' }, NOW).line, 'Syncing…');
  assert.equal(describeSyncedAt(null, NOW), 'not yet');
});

test('Sync now reaches whoever runs the sync, and does nothing when nobody does', () => {
  assert.equal(requestSync(), false);
  let calls = 0;
  const stop = onSyncRequest(() => calls++);
  assert.equal(requestSync(), true);
  assert.equal(calls, 1);
  stop();
  assert.equal(requestSync(), false);
});

import { describeCloudCopy } from '../src/data/syncStatus.js';

test('the cloud copy line shows counts and when it was saved, or that none exists', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  assert.equal(describeCloudCopy(null, now), null);
  assert.equal(describeCloudCopy({ exists: false }, now), 'Cloud copy: none yet');
  assert.equal(
    describeCloudCopy({ exists: true, updatedAt: '2026-11-20T11:55:00Z', counts: { contacts: 12, events: 1, goals: 0, tasks: 4 } }, now),
    'Cloud copy: 12 people, 1 event, 4 tasks · saved 5 min ago'
  );
  assert.equal(describeCloudCopy({ exists: true, counts: {} }, now), 'Cloud copy: empty');
});
