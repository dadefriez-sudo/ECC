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

// 12a. cloud sync is Pro on the server too
const S = 'syncpro'; // listed in BETA_TESTER_EMAILS by run.sh, so it counts as Pro
r = await call(u('freesync'), 'GET', '/data');
ok('data: a free account is refused (402)', r.s === 402 && r.j?.code === 'upgrade_required', JSON.stringify(r));
r = await call(u('freesync'), 'PUT', '/data', { data: { a: 1 } });
ok('data: a free account cannot write either', r.s === 402, JSON.stringify(r));

// 12b. body size is limited before sign-in, except on the sync route after it
{
  const big = JSON.stringify({ pad: 'x'.repeat(2 * 1024 * 1024) });
  const anon = await fetch(B + '/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: big });
  ok('an anonymous 2MB body to the sync route is refused before it is read (401)', anon.status === 401, String(anon.status));
  const other = await fetch(B + '/accountability/snapshot', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer test:${u('bigger')}@t.dev` }, body: big });
  ok('a 2MB body elsewhere is refused with 413', other.status === 413, String(other.status));
  const synced = await call('bigpro', 'PUT', '/data', { data: { photo: 'p'.repeat(2 * 1024 * 1024) } });
  ok('the sync route still takes a 2MB blob from a signed-in Pro account', synced.s === 200, JSON.stringify(synced).slice(0, 120));
}

// 12c. Google connect: single-use state, confirm page, no replay
{
  const g = await call(u('gina'), 'GET', '/google/auth');
  const url = g.j?.url || '';
  ok('google/auth returns our own start page, not Google directly', g.s === 200 && /\/api\/google\/start\?s=/.test(url), JSON.stringify(g));
  const state = decodeURIComponent((url.match(/[?&]s=([^&]+)/) || [])[1] || '');
  const page = await fetch(B + `/google/start?s=${encodeURIComponent(state)}`);
  const html = await page.text();
  ok('the start page names the Keystone account (masked) and offers to continue', page.status === 200 && /g\*\*\*@t\.dev/.test(html) && /Continue to Google/.test(html), html.slice(0, 200));
  ok('the continue link carries the same state and the narrower calendar scope', html.includes(`state=${encodeURIComponent(state)}`) && /calendar\.events/.test(html), html.slice(0, 400));
  const first = await (await fetch(B + `/google/callback?state=${encodeURIComponent(state)}&error=access_denied`)).text();
  ok('the callback accepts the state once (reaches the error it was sent)', /access_denied/.test(first) && !/bad_state/.test(first), first.slice(0, 300));
  const replay = await (await fetch(B + `/google/callback?state=${encodeURIComponent(state)}&error=access_denied`)).text();
  ok('the same state cannot be used again', /bad_state/.test(replay), replay.slice(0, 300));
  const gone = await fetch(B + `/google/start?s=${encodeURIComponent(state)}`);
  ok('a used state no longer opens the start page', gone.status === 400);
  const forged = await (await fetch(B + '/google/callback?state=gina.deadbeef&error=x')).text();
  ok('the old userId.signature style of state is rejected', /bad_state/.test(forged), forged.slice(0, 200));
}

// 12. cloud sync: optimistic concurrency on /data
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
r = await call('newsyncpro', 'PUT', '/data', { data: { tasks: [] }, baseUpdatedAt: new Date().toISOString() });
ok('data: a first write that names a base still creates the row', r.s === 200, JSON.stringify(r));

await pg.end();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
