import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneContacts } from '../src/data/phoneContacts.js';

const raw = [
  { id: '2', name: 'Zed  Adams', phones: ['', '555 0102'], emails: [], addresses: ['12 Oak St\nProvo, UT 84601'] },
  { id: '1', name: 'Ann Lee', phones: ['(801) 555-0142'], emails: ['ann@example.com'], addresses: [] },
  { id: '3', name: '', phones: ['555'], emails: [], addresses: [] },
  { id: '1', name: 'Ann Lee', phones: ['(801) 555-0142'], emails: [], addresses: [] },
  { id: '4', name: 'Bob Roe', phones: [], emails: [], addresses: [] },
];

test('names are tidied, nameless entries and repeats are dropped, and the list is sorted', () => {
  const out = normalizePhoneContacts(raw, []);
  assert.deepEqual(out.map((c) => c.name), ['Ann Lee', 'Bob Roe', 'Zed Adams']);
});

test('the first real phone number, email and a one-line address are used', () => {
  const zed = normalizePhoneContacts(raw, []).find((c) => c.name === 'Zed Adams');
  assert.equal(zed.phone, '555 0102');
  assert.equal(zed.address, '12 Oak St, Provo, UT 84601');
});

test('people already in Keystone are flagged, by email or phone number or name', () => {
  const existing = [{ id: 'k1', name: 'Anne L', phone: '801-555-0142', email: '' }, { id: 'k2', name: 'bob roe', phone: '', email: '' }];
  const out = normalizePhoneContacts(raw, existing);
  assert.equal(out.find((c) => c.name === 'Ann Lee').existing, true);
  assert.equal(out.find((c) => c.name === 'Bob Roe').existing, true);
  assert.equal(out.find((c) => c.name === 'Zed Adams').existing, false);
});

test('garbage input gives an empty list', () => {
  assert.deepEqual(normalizePhoneContacts(null, []), []);
  assert.deepEqual(normalizePhoneContacts([null, 5, {}], []), []);
});

import { contactAccounts, inAccount } from '../src/data/phoneContacts.js';

test('accounts are listed with Google ones first, and filtering by account works', () => {
  const list = normalizePhoneContacts(
    [
      { id: '1', name: 'Ann', phones: ['1'], accounts: ['me@gmail.com'], google: true },
      { id: '2', name: 'Bob', phones: ['2'], accounts: ['me@gmail.com', 'Phone'], google: true },
      { id: '3', name: 'Cy', phones: ['3'], accounts: [], google: false },
    ],
    []
  );
  const accounts = contactAccounts(list);
  assert.equal(accounts[0].name, 'me@gmail.com');
  assert.equal(accounts[0].google, true);
  assert.equal(accounts[0].count, 2);
  assert.deepEqual(list.filter((c) => inAccount(c, 'On this phone')).map((c) => c.name), ['Cy']);
});
