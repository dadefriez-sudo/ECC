import test from 'node:test';
import assert from 'node:assert/strict';
import { LOOKS, activeSkin, effectiveTheme, currentLookId, chromeColor, settingsForLook } from '../src/data/looks.js';

test('a Pro look only applies while Pro is active', () => {
  assert.equal(activeSkin({ skin: 'heritage', isPro: true }), 'heritage');
  assert.equal(activeSkin({ skin: 'heritage', isPro: false }), 'default');
  assert.equal(activeSkin({ skin: 'midnight' }), 'default');
  assert.equal(activeSkin({}), 'default');
});

test('a Pro look decides light or dark; otherwise the person does', () => {
  assert.equal(effectiveTheme({ skin: 'heritage', isPro: true, theme: 'dark' }), 'light');
  assert.equal(effectiveTheme({ skin: 'midnight', isPro: true, theme: 'light' }), 'dark');
  assert.equal(effectiveTheme({ theme: 'dark' }), 'dark');
  assert.equal(effectiveTheme({ theme: 'system' }, true), 'dark');
  assert.equal(effectiveTheme({ theme: 'system' }, false), 'light');
  // lapsed Pro: back to the person's own choice
  assert.equal(effectiveTheme({ skin: 'midnight', isPro: false, theme: 'light' }), 'light');
});

test('the picker selects the right card', () => {
  assert.equal(currentLookId({ skin: 'midnight', isPro: true }), 'midnight');
  assert.equal(currentLookId({ theme: 'dark' }), 'dark');
  assert.equal(currentLookId({ theme: 'light' }), 'light');
  assert.equal(currentLookId({ skin: 'heritage', isPro: false, theme: 'dark' }), 'dark');
});

test('four looks: two free, two Pro, and picking one changes the right settings', () => {
  assert.deepEqual(LOOKS.map((l) => l.pro), [false, false, true, true]);
  assert.deepEqual(settingsForLook(LOOKS[1]), { skin: 'default', theme: 'dark' });
  assert.deepEqual(settingsForLook(LOOKS[2]), { skin: 'heritage', homeStyle: 'tracker' });
  assert.equal(chromeColor({ skin: 'heritage', isPro: true }), '#7a1c24');
  assert.equal(chromeColor({ theme: 'light' }), '#eef1f4');
});
