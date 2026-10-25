import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptBackup, decryptBackup, isEncryptedBackup, MIN_PASSWORD_LENGTH } from '../src/data/backupCrypto.js';

const sample = JSON.stringify({ contacts: [{ name: 'Ann Lee', phone: '555-0142' }], notes: ['x'.repeat(200000)] });

test('a backup round-trips with the right password', async () => {
  const file = await encryptBackup(sample, 'correct horse battery');
  const env = JSON.parse(file);
  assert.equal(isEncryptedBackup(env), true);
  assert.equal(await decryptBackup(env, 'correct horse battery'), sample);
});

test('the file does not contain the data in the clear', async () => {
  const file = await encryptBackup(sample, 'correct horse battery');
  assert.equal(file.includes('Ann Lee'), false);
  assert.equal(file.includes('555-0142'), false);
});

test('a wrong password is refused, and so is a tampered file', async () => {
  const env = JSON.parse(await encryptBackup(sample, 'correct horse battery'));
  await assert.rejects(decryptBackup(env, 'wrong password!'), /wrong-password/);
  const flipped = { ...env, data: env.data.slice(0, -4) + (env.data.endsWith('AAAA') ? 'BBBB' : 'AAAA') };
  await assert.rejects(decryptBackup(flipped, 'correct horse battery'), /wrong-password/);
});

test('every file gets its own salt and nonce', async () => {
  const a = JSON.parse(await encryptBackup('same', 'same password'));
  const b = JSON.parse(await encryptBackup('same', 'same password'));
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.data, b.data);
});

test('short passwords are refused', async () => {
  await assert.rejects(encryptBackup('x', 'a'.repeat(MIN_PASSWORD_LENGTH - 1)), /at least/);
});

test('an ordinary backup is not mistaken for an encrypted one', () => {
  assert.equal(isEncryptedBackup({ goals: [], events: [] }), false);
  assert.equal(isEncryptedBackup(null), false);
});
