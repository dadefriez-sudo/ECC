import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToHsl, hslToHex, normalizeHex, isHex } from '../src/data/colorUtils.js';

test('hex and HSL round trip for the picker colours', () => {
  for (const hex of ['#d1384a', '#2f7fd1', '#2a9d6f', '#c99a06', '#5d7389', '#ffffff', '#000000']) {
    const back = hslToHex(hexToHsl(hex));
    // HSL is stored in whole numbers, so allow a point of drift per channel.
    for (const i of [1, 3, 5]) assert.ok(Math.abs(parseInt(hex.slice(i, i + 2), 16) - parseInt(back.slice(i, i + 2), 16)) <= 3, `${hex} -> ${back}`);
  }
});

test('known values', () => {
  assert.equal(hslToHex({ h: 0, s: 100, l: 50 }), '#ff0000');
  assert.equal(hslToHex({ h: 120, s: 100, l: 50 }), '#00ff00');
  assert.deepEqual(hexToHsl('#0000ff'), { h: 240, s: 100, l: 50 });
});

test('normalizeHex accepts what people type and rejects the rest', () => {
  assert.equal(normalizeHex('D1384A'), '#d1384a');
  assert.equal(normalizeHex('#fa0'), '#ffaa00');
  assert.equal(normalizeHex('nope'), null);
  assert.equal(isHex('#12345'), false);
});
