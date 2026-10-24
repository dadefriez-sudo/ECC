const B = 'http://localhost:4100/api';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : extra); };
const call = async (who, method, path, body) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer test:${who}@t.dev` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const uniq = Math.random().toString(36).slice(2, 7);
const u = (n) => `${n}${uniq}`;           // unique users per run
const A = u('alice'), Bo = u('bob'), C = u('carol'), D = u('dan');
const mk = async (who) => (await call(who, 'GET', '/me')).j;

// 0. auth
ok('unauthenticated -> 401', (await call(null, 'GET', '/accountability/partners')).s === 401);

// 1. invite without typing an email
let r = await call(A, 'POST', '/accountability/invites', {});
ok('invite with no email is allowed', r.s === 201, JSON.stringify(r));
const inv = r.j?.invite;

// 2. preview (who invited me?)
r = await call(Bo, 'GET', `/accountability/invites/${inv?.token}`);
ok('preview shows inviter + valid', r.s === 200 && r.j?.fromEmail === `${A}@t.dev` && r.j?.status === 'valid', JSON.stringify(r));
r = await call(Bo, 'GET', '/accountability/invites/nope-not-a-token');
ok('preview of unknown token -> 404', r.s === 404, JSON.stringify(r));

// 3. accept: parallel double tap must not 500
const [a1, a2] = await Promise.all([call(Bo, 'POST', `/accountability/invites/${inv?.token}/accept`), call(Bo, 'POST', `/accountability/invites/${inv?.token}/accept`)]);
ok('double accept: no 5xx', a1.s < 500 && a2.s < 500, JSON.stringify([a1, a2]));
ok('double accept: one joins, other is told already partners/used', [a1, a2].some((x) => x.s === 200 && x.j?.partnerId));
r = await call(A, 'GET', '/accountability/partners');
ok('alice sees exactly one partner (bob)', r.j?.partners?.length === 1 && r.j.partners[0].email === `${Bo}@t.dev`, JSON.stringify(r.j));
r = await call(Bo, 'GET', '/accountability/partners');
ok('bob sees exactly one partner (alice)', r.j?.partners?.length === 1 && r.j.partners[0].email === `${A}@t.dev`, JSON.stringify(r.j));

// 4. progress both ways
await call(A, 'PUT', '/accountability/snapshot', { data: { goals: [{ id: 'g1', title: 'Study', period: 'daily', target: 15, unit: 'min', progress: 15 }], tasksToday: { total: 3, done: 2 }, updatedAt: new Date().toISOString() } });
await call(Bo, 'PUT', '/accountability/snapshot', { data: { goals: [], tasksToday: { total: 0, done: 0 }, updatedAt: new Date().toISOString() } });
r = await call(Bo, 'GET', '/accountability/partners');
ok('bob sees alice progress', r.j?.partners?.[0]?.progress?.goals?.[0]?.title === 'Study' && r.j.partners[0].progressUpdatedAt);
ok('snapshot > 64KB rejected', (await call(A, 'PUT', '/accountability/snapshot', { data: { x: 'y'.repeat(70000) } })).s === 413);
ok('snapshot non-object rejected', (await call(A, 'PUT', '/accountability/snapshot', { data: [1] })).s === 400);

// 5. invite states
r = await call(Bo, 'POST', `/accountability/invites/${inv.token}/accept`);
ok('re-accepting a used invite by the same partner is harmless', r.s === 200 || r.s === 400, JSON.stringify(r));
r = await call(C, 'POST', `/accountability/invites/${inv.token}/accept`);
ok('used invite cannot be taken by a third person', r.s === 400 || r.s === 404, JSON.stringify(r));
const own = (await call(C, 'POST', '/accountability/invites', {})).j?.invite;
r = await call(C, 'POST', `/accountability/invites/${own.token}/accept`);
ok('cannot accept your own invite', r.s === 400, JSON.stringify(r));

// 6. free limit, both sides
r = await call(A, 'POST', '/accountability/invites', {});
ok('free user at the limit cannot invite a second partner', r.s === 402 && r.j?.code === 'partner_limit', JSON.stringify(r));
r = await call(C, 'POST', `/accountability/invites/${own.token}/accept`); // still her own
const cInv = (await call(C, 'POST', '/accountability/invites', {})).j?.invite;
r = await call(A, 'POST', `/accountability/invites/${cInv.token}/accept`);
ok('free user at the limit cannot accept a second partner', r.s === 402, JSON.stringify(r));
r = await call(D, 'POST', `/accountability/invites/${cInv.token}/accept`);
ok('a free person can still join someone who has room', r.s === 200, JSON.stringify(r));

// 7. expiry (set it in the past straight in the database)
const exp = (await call(Bo, 'POST', '/accountability/invites', {}));
ok('bob (already has alice) hits the limit before creating another', exp.s === 402);
const dInv = (await call(D, 'POST', '/accountability/invites', {})); // dan has carol -> limit
ok('dan (has carol) also at limit', dInv.s === 402);

// 8. revoke + removal + re-invite
const e1 = (await call(u('erin'), 'POST', '/accountability/invites', {})).j?.invite;
r = await call(u('erin'), 'GET', '/accountability/invites');
ok('pending invites are listed for the inviter', r.j?.invites?.some((i) => i.token === e1.token), JSON.stringify(r.j));
r = await call(u('erin'), 'DELETE', `/accountability/invites/${e1.id}`);
ok('inviter can revoke', r.s === 200);
r = await call(u('frank'), 'POST', `/accountability/invites/${e1.token}/accept`);
ok('revoked invite cannot be accepted', r.s === 404, JSON.stringify(r));
r = await call(A, 'DELETE', `/accountability/partners/${(await call(A, 'GET', '/accountability/partners')).j.partners[0].userId}`);
ok('remove partner works', r.s === 200);
ok('removal clears both sides', (await call(Bo, 'GET', '/accountability/partners')).j.partners.length === 0 && (await call(A, 'GET', '/accountability/partners')).j.partners.length === 0);
const again = (await call(A, 'POST', '/accountability/invites', {}));
ok('after removal alice can invite again', again.s === 201, JSON.stringify(again));
r = await call(Bo, 'POST', `/accountability/invites/${again.j.invite.token}/accept`);
ok('and the same two can re-pair', r.s === 200, JSON.stringify(r));

// 9. inviter deletes their account -> invite is dead, no 5xx
const gone = u('gone');
const gInv = (await call(gone, 'POST', '/accountability/invites', {})).j?.invite;
await call(gone, 'DELETE', '/me');
r = await call(u('heidi'), 'POST', `/accountability/invites/${gInv.token}/accept`);
ok('invite from a deleted account is refused cleanly (no 5xx)', r.s >= 400 && r.s < 500, JSON.stringify(r));
r = await call(u('heidi'), 'GET', `/accountability/invites/${gInv.token}`);
ok('and its preview says so', r.s === 404 || r.s === 410, JSON.stringify(r));

// 10. bad input
r = await call(A, 'POST', '/accountability/invites', { email: 'not an email' });
ok('malformed optional email rejected', r.s === 400, JSON.stringify(r));

// 11. expiry, by moving the date back in the database
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { Client } = require('pg');
const pg = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5544/postgres' });
await pg.connect();
const xi = (await call(u('xena'), 'POST', '/accountability/invites', {})).j.invite;
await pg.query(`UPDATE "AccountabilityInvite" SET "expiresAt" = now() - interval '1 day' WHERE token = $1`, [xi.token]);
r = await call(u('yuri'), 'POST', `/accountability/invites/${xi.token}/accept`);
ok('expired invite is refused with a clear message', r.s === 400 && /expired/i.test(r.j?.error || ''), JSON.stringify(r));
r = await call(u('yuri'), 'GET', `/accountability/invites/${xi.token}`);
ok('expired invite previews as expired', r.s === 200 && r.j?.status === 'expired', JSON.stringify(r));
r = await call(u('xena'), 'GET', '/accountability/invites');
ok('expired invites drop out of the inviter list', !r.j?.invites?.some((i) => i.token === xi.token));

// 12. cloud sync: optimistic concurrency on /data
const S = u('sync');
r = await call(S, 'GET', '/data');
ok('data: empty account has no data yet', r.s === 200 && r.j?.data === null, JSON.stringify(r));
r = await call(S, 'PUT', '/data', { data: { tasks: [{ id: 't1' }] } });
const v1 = r.j?.updatedAt;
ok('data: first write needs no base', r.s === 200 && !!v1, JSON.stringify(r));
r = await call(S, 'GET', `/data?since=${encodeURIComponent(v1)}`);
ok('data: poll with the current version says unchanged, without the blob', r.s === 200 && r.j?.unchanged === true && r.j?.data === undefined, JSON.stringify(r));
r = await call(S, 'GET', '/data?since=2000-01-01T00:00:00.000Z');
ok('data: poll with an old version returns the data', r.s === 200 && r.j?.data?.tasks?.length === 1, JSON.stringify(r));
r = await call(S, 'PUT', '/data', { data: { tasks: [{ id: 't1' }, { id: 't2' }] }, baseUpdatedAt: v1 });
const v2 = r.j?.updatedAt;
ok('data: a write built on the current version succeeds', r.s === 200 && !!v2 && v2 !== v1, JSON.stringify(r));
r = await call(S, 'PUT', '/data', { data: { tasks: [] }, baseUpdatedAt: v1 });
ok('data: a write built on an old version is refused with 409 and the current copy', r.s === 409 && r.j?.data?.tasks?.length === 2 && r.j?.updatedAt === v2, JSON.stringify(r));
r = await call(S, 'GET', '/data');
ok('data: the refused write changed nothing', r.j?.data?.tasks?.length === 2, JSON.stringify(r));
r = await call(S, 'PUT', '/data', { data: { tasks: [{ id: 'old-client' }] } });
ok('data: a write with no base still overwrites (older app versions)', r.s === 200, JSON.stringify(r));
r = await call(S, 'PUT', '/data', { data: {}, baseUpdatedAt: 'not a date' });
ok('data: a malformed base is rejected', r.s === 400, JSON.stringify(r));
const cur = (await call(S, 'GET', '/data')).j.updatedAt;
const [p1, p2] = await Promise.all([
  call(S, 'PUT', '/data', { data: { tasks: [{ id: 'racer-1' }] }, baseUpdatedAt: cur }),
  call(S, 'PUT', '/data', { data: { tasks: [{ id: 'racer-2' }] }, baseUpdatedAt: cur }),
]);
ok('data: two writes from the same version: exactly one wins', [p1, p2].filter((x) => x.s === 200).length === 1 && [p1, p2].filter((x) => x.s === 409).length === 1, JSON.stringify([p1.s, p2.s]));
r = await call(u('newsync'), 'PUT', '/data', { data: { tasks: [] }, baseUpdatedAt: new Date().toISOString() });
ok('data: a first write that names a base still creates the row', r.s === 200, JSON.stringify(r));

await pg.end();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
