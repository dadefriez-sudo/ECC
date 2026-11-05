import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKGROUNDS, activeBackground, effectiveTheme, chromeColor } from '../src/data/backgrounds.js';

test('six Pro backgrounds plus the standard one', () => {
  assert.equal(BACKGROUNDS.length, 7);
  assert.equal(BACKGROUNDS[0].value, 'default');
  for (const v of ['navy', 'maroon', 'plum', 'forest', 'graphite', 'espresso']) {
    assert.ok(BACKGROUNDS.some((b) => b.value === v), v);
  }
});

test('a background only applies while Pro is active and only if known', () => {
  assert.equal(activeBackground({ background: 'navy', isPro: true }), 'navy');
  assert.equal(activeBackground({ background: 'navy', isPro: false }), 'default');
  assert.equal(activeBackground({ background: 'nope', isPro: true }), 'default');
  assert.equal(activeBackground({}), 'default');
});

test('a background forces dark mode; without one the person chooses', () => {
  assert.equal(effectiveTheme({ background: 'maroon', isPro: true, theme: 'light' }), 'dark');
  assert.equal(effectiveTheme({ background: 'maroon', isPro: false, theme: 'light' }), 'light');
  assert.equal(effectiveTheme({ theme: 'system' }, true), 'dark');
  assert.equal(effectiveTheme({ theme: 'system' }, false), 'light');
});

test('the status bar color follows the background', () => {
  assert.equal(chromeColor({ background: 'navy', isPro: true }), '#0b1526');
  assert.equal(chromeColor({ theme: 'light' }), '#eef1f4');
  assert.equal(chromeColor({ theme: 'dark' }), '#0f141a');
});
