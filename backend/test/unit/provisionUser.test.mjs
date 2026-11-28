import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionUser } from '../../src/lib/provisionUser.js';

// A tiny in-memory stand-in for the parts of Prisma this uses, including the unique email rule.
function fakeDb(rows = []) {
  const users = [...rows];
  return {
    users,
    user: {
      findUnique: async ({ where }) => users.find((u) => (where.clerkId ? u.clerkId === where.clerkId : u.email === where.email)) || null,
      update: async ({ where, data }) => {
        const u = users.find((x) => x.id === where.id);
        Object.assign(u, data);
        return u;
      },
      create: async ({ data }) => {
        if (users.some((u) => u.email === data.email)) throw Object.assign(new Error('unique'), { code: 'P2002' });
        const u = { id: `u${users.length + 1}`, ...data };
        users.push(u);
        return u;
      },
    },
  };
}

test('a brand new person gets a new row', async () => {
  const db = fakeDb();
  const u = await provisionUser({ clerkId: 'prod_1', email: 'a@b.co' }, db);
  assert.equal(db.users.length, 1);
  assert.equal(u.clerkId, 'prod_1');
});

test('the same person arriving again is found, not duplicated', async () => {
  const db = fakeDb([{ id: 'u1', clerkId: 'prod_1', email: 'a@b.co' }]);
  const u = await provisionUser({ clerkId: 'prod_1', email: 'a@b.co' }, db);
  assert.equal(u.id, 'u1');
  assert.equal(db.users.length, 1);
});

test('a new Clerk id with an email already on file re-links the old row and keeps its purchase', async () => {
  const db = fakeDb([{ id: 'u1', clerkId: 'dev_1', email: 'a@b.co', lifetimePurchasedAt: new Date('2026-11-01'), iapTransactionId: 'order-1' }]);
  const u = await provisionUser({ clerkId: 'prod_9', email: 'a@b.co' }, db);
  assert.equal(db.users.length, 1);
  assert.equal(u.id, 'u1');
  assert.equal(u.clerkId, 'prod_9');
  assert.equal(u.iapTransactionId, 'order-1'); // the Play purchase stays attached to this person
});

test('two different emails stay two different accounts', async () => {
  const db = fakeDb([{ id: 'u1', clerkId: 'dev_1', email: 'a@b.co' }]);
  await provisionUser({ clerkId: 'prod_2', email: 'other@b.co' }, db);
  assert.equal(db.users.length, 2);
});
