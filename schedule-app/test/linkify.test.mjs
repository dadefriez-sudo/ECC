import test from 'node:test';
import assert from 'node:assert/strict';
import { splitLinks } from '../src/data/linkify.js';

test('markdown link becomes a labelled link', () => {
  const p = splitLinks('See [Weld.pdf](https://x.instructure.com/files/1?wrap=1) now');
  assert.deepEqual(p, [{ text: 'See ' }, { text: 'Weld.pdf', href: 'https://x.instructure.com/files/1?wrap=1' }, { text: ' now' }]);
});

test('bare link is linked and trailing punctuation stays outside', () => {
  const p = splitLinks('Go to https://a.com/b?c=1&d=2.');
  assert.equal(p[1].href, 'https://a.com/b?c=1&d=2');
  assert.equal(p[2].text, '.');
});

test('plain text and non-http links are left alone', () => {
  assert.deepEqual(splitLinks('call me javascript:alert(1)'), [{ text: 'call me javascript:alert(1)' }]);
  assert.deepEqual(splitLinks('[x](javascript:alert(1))'), [{ text: '[x](javascript:alert(1))' }]);
  assert.deepEqual(splitLinks(''), []);
});

import { isCanvasLink } from '../src/data/linkify.js';

test('Canvas links are recognised, including a school with its own domain', () => {
  assert.equal(isCanvasLink('https://byui.instructure.com/courses/1/assignments/2'), true);
  assert.equal(isCanvasLink('https://example.com/a'), false);
  assert.equal(isCanvasLink('https://evilinstructure.com/a'), false);
  assert.equal(isCanvasLink('https://canvas.school.edu/courses/1', 'https://canvas.school.edu/feeds/calendars/user_x.ics'), true);
  assert.equal(isCanvasLink('https://canvas.school.edu/courses/1'), false);
  assert.equal(isCanvasLink('not a link'), false);
});
