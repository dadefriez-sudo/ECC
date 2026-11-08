import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_STYLES, MAP_STYLE_OPTIONS, resolveMapStyle } from '../src/data/mapStyles.js';

test('Hybrid is the satellite photo with road and place layers on top, and is not cached', () => {
  const h = MAP_STYLES.hybrid;
  assert.equal(h.url, MAP_STYLES.satellite.url);
  assert.equal(h.overlays.length, 2);
  assert.ok(h.overlays.every((u) => u.includes('/Reference/')));
  assert.ok(!h.cache && !MAP_STYLES.satellite.cache);
});

test('the plain map styles are the ones kept for offline use', () => {
  assert.deepEqual(Object.entries(MAP_STYLES).filter(([, s]) => s.cache).map(([k]) => k), ['standard', 'positron', 'dark']);
});

test('Hybrid is in the picker, and picking it resolves to it', () => {
  assert.ok(MAP_STYLE_OPTIONS.some((o) => o.value === 'hybrid' && o.label === 'Hybrid'));
  assert.equal(resolveMapStyle('hybrid', true), MAP_STYLES.hybrid);
  assert.equal(resolveMapStyle('auto', true), MAP_STYLES.dark);
});
