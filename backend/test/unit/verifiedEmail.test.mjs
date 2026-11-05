import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedPrimaryEmail } from '../../src/lib/validate.js';

const e = (id, address, status) => ({ id, emailAddress: address, verification: { status } });

test('uses the primary email when it is verified', () => {
  assert.equal(verifiedPrimaryEmail([e('a', 'a@x.com', 'verified'), e('b', 'b@x.com', 'verified')], 'b'), 'b@x.com');
});
test('ignores an unverified primary and falls back to a verified one', () => {
  assert.equal(verifiedPrimaryEmail([e('a', 'a@x.com', 'unverified'), e('b', 'b@x.com', 'verified')], 'a'), 'b@x.com');
});
test('no verified email means none', () => {
  assert.equal(verifiedPrimaryEmail([e('a', 'a@x.com', 'unverified')], 'a'), null);
  assert.equal(verifiedPrimaryEmail(undefined, 'a'), null);
});
test('reads the webhook field names too', () => {
  assert.equal(verifiedPrimaryEmail([{ id: 'a', email_address: 'w@x.com', verification: { status: 'verified' } }], 'a'), 'w@x.com');
});
