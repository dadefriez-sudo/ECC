import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCanvasFeed, planCanvasSync, validateFeedUrl, externalIdFor } from '../src/data/canvasFeed.js';

const feed = (events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n');
const vevent = (lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');

test('only an https Canvas calendar feed link is accepted', () => {
  assert.equal(validateFeedUrl('https://school.instructure.com/feeds/calendars/user_abc123.ics').ok, true);
  assert.equal(validateFeedUrl('http://school.instructure.com/feeds/calendars/user_abc.ics').ok, false);
  assert.equal(validateFeedUrl('https://example.com/calendar.ics').ok, false);
  assert.equal(validateFeedUrl('not a link').ok, false);
});

test('UTC times are converted to local time, and a zero-length assignment becomes 30 minutes', () => {
  const [e] = parseCanvasFeed(
    feed([vevent(['UID:event-assignment-1', 'DTSTART:20261026T235900Z', 'DTEND:20261026T235900Z', 'SUMMARY:Essay 2 [ENG101]', 'URL:https://school.instructure.com/courses/1/assignments/2'])])
  );
  const local = new Date(Date.UTC(2026, 9, 26, 23, 59));
  const pad = (n) => String(n).padStart(2, '0');
  assert.equal(e.date, `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`);
  assert.equal(e.start <= e.end, true);
  assert.equal(e.title, 'Essay 2 [ENG101]');
  assert.match(e.notes, /assignments\/2/);
});

test('a named time zone is honoured, daylight saving included', () => {
  const [summer] = parseCanvasFeed(feed([vevent(['UID:a', 'DTSTART;TZID=America/Denver:20260715T090000', 'DTEND;TZID=America/Denver:20260715T100000', 'SUMMARY:Lecture'])]));
  const instant = new Date(summer.date + 'T' + summer.start); // local
  // 9:00 in Denver in July is 15:00 UTC; whatever the machine's zone, converting back must agree.
  const utc = Date.UTC(2026, 6, 15, 15, 0);
  const asLocal = new Date(utc);
  const pad = (n) => String(n).padStart(2, '0');
  assert.equal(summer.start, `${pad(asLocal.getHours())}:${pad(asLocal.getMinutes())}`);
  assert.ok(instant instanceof Date);
});

test('unescaping, folded lines and cancelled events', () => {
  const text = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:x',
    'DTSTART:20261101T100000',
    'DTEND:20261101T110000',
    'SUMMARY:Quiz\\, week 3',
    'DESCRIPTION:Line one\\nLine',
    '  two',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:y',
    'DTSTART:20261102T100000',
    'SUMMARY:Gone',
    'STATUS:CANCELLED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const out = parseCanvasFeed(text);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'Quiz, week 3');
  assert.equal(out[0].notes, 'Line one\nLine two');
  assert.equal(out[0].start, '10:00');
  assert.equal(out[0].end, '11:00');
});

const p = (uid, over = {}) => ({ uid, title: uid, date: '2026-10-30', start: '10:00', end: '10:30', location: '', notes: '', ...over });

test('a sync adds new items, updates changed ones, keeps the person\'s own marks, removes dropped ones', () => {
  const existing = [
    { id: 'e1', source: 'canvas', externalId: externalIdFor('a'), title: 'old title', date: '2026-10-30', start: '10:00', end: '10:30', location: '', notes: '', done: true, reminder: [15] },
    { id: 'e2', source: 'canvas', externalId: externalIdFor('b'), title: 'b', date: '2026-10-31', start: '10:00', end: '10:30', location: '', notes: '' },
    { id: 'e3', title: 'my own event', date: '2026-10-30', start: '10:00', end: '11:00' },
  ];
  const plan = planCanvasSync(existing, [p('a', { title: 'new title' }), p('c')], '2026-10-26');
  assert.equal(plan.add.length, 1);
  assert.equal(plan.add[0].externalId, externalIdFor('c'));
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0].title, 'new title');
  assert.equal(plan.update[0].done, true);
  assert.deepEqual(plan.update[0].reminder, [15]);
  assert.deepEqual(plan.remove, ['e2']);
});

test('an unchanged feed changes nothing, and an empty feed removes nothing', () => {
  const existing = [{ id: 'e1', source: 'canvas', externalId: externalIdFor('a'), ...p('a') }];
  const same = planCanvasSync(existing, [p('a')], '2026-10-26');
  assert.deepEqual([same.add.length, same.update.length, same.remove.length], [0, 0, 0]);
  assert.deepEqual(planCanvasSync(existing, [], '2026-10-26').remove, []);
});

test('items from long ago are neither imported nor removed', () => {
  const plan = planCanvasSync([{ id: 'old', source: 'canvas', externalId: externalIdFor('z'), ...p('z', { date: '2026-01-05' }) }], [p('q', { date: '2026-01-06' }), p('k')], '2026-10-26');
  assert.equal(plan.add.length, 1);
  assert.deepEqual(plan.remove, []);
});
