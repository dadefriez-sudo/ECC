import crypto from 'node:crypto';
import { Router } from 'express';
import { google } from 'googleapis';
import { requireUser } from '../middleware/requireUser.js';
import { prisma } from '../db.js';

const router = Router();

// Calendar needs write access for the two-way sync in /calendar-sync
// (creating/updating/deleting events on the user's behalf) — Contacts stays
// read-only since only the one-time import touches it. Both the read-write
// Calendar scope and the read-only Contacts scope are still "sensitive"
// rather than "restricted" in Google's tiering, so this doesn't push the
// app into the heavier annual security-assessment review; it still needs
// the lighter consent-screen verification (or listed test users) either
// way. Note: anyone who connected Google under the old calendar.readonly
// scope needs to disconnect and reconnect to pick up write access — a
// stored refresh token keeps whatever scope it was issued with.
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/contacts.readonly',
];

// Lazy and memoized, same reasoning as billing.js's getStripe(): building
// this at import time would throw immediately if the env vars aren't set
// yet, taking the whole server down rather than leaving just these routes
// unavailable.
let oauthConfig; // { clientId, clientSecret, redirectUri } | null, undefined until first use
function getOAuthConfig() {
  if (oauthConfig !== undefined) return oauthConfig;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  oauthConfig =
    GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI
      ? { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, redirectUri: GOOGLE_REDIRECT_URI }
      : null;
  return oauthConfig;
}

function newOAuthClient() {
  const cfg = getOAuthConfig();
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

// The callback is a top-level browser redirect from Google, not a fetch
// from our own frontend — it can't carry the Clerk session's Authorization
// header. `state` carries the user id instead, HMAC-signed (reusing
// CLERK_SECRET_KEY, already required, rather than adding another secret)
// so the callback can't be pointed at an arbitrary account.
function signState(userId) {
  const sig = crypto.createHmac('sha256', process.env.CLERK_SECRET_KEY).update(userId).digest('hex');
  return `${userId}.${sig}`;
}
function verifyState(state) {
  const [userId, sig] = String(state || '').split('.');
  if (!userId || !sig) return null;
  const expected = crypto.createHmac('sha256', process.env.CLERK_SECRET_KEY).update(userId).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}

// Kicks off the consent flow — the frontend redirects the browser to the
// returned URL, same pattern as Stripe Checkout.
router.get('/auth', requireUser, (req, res) => {
  if (!getOAuthConfig()) {
    return res.status(400).json({ error: 'Google sync is not configured on the server.' });
  }
  const client = newOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline', // required to get a refresh_token back
    prompt: 'consent', // forces a refresh_token even on a repeat connect
    scope: SCOPES,
    state: signState(req.dbUser.id),
  });
  res.json({ url });
});

// Google redirects here after consent. Stores the refresh token and sends
// the browser back into the app — the frontend picks up from the
// `?google=connected` query param (see MorePage.jsx).
router.get('/callback', async (req, res) => {
  const frontend = process.env.FRONTEND_URL || '';
  const fail = (reason) => res.redirect(`${frontend}/#/more?google=error&reason=${encodeURIComponent(reason)}`);

  if (!getOAuthConfig()) return fail('not_configured');
  const userId = verifyState(req.query.state);
  if (!userId) return fail('bad_state');
  if (req.query.error) return fail(String(req.query.error));
  if (!req.query.code) return fail('missing_code');

  try {
    const client = newOAuthClient();
    const { tokens } = await client.getToken(String(req.query.code));
    if (!tokens.refresh_token) {
      // Happens if this account already granted consent before and Google
      // decided not to issue a fresh refresh token despite `prompt: consent`
      // — rare, but possible if the user revoked access outside our flow.
      // Asking them to disconnect+reconnect (or revoke at
      // myaccount.google.com/permissions first) is the standard recovery.
      return fail('no_refresh_token');
    }
    await prisma.user.update({
      where: { id: userId },
      data: { googleRefreshToken: tokens.refresh_token, googleConnectedAt: new Date() },
    });
    res.redirect(`${frontend}/#/more?google=connected`);
  } catch (err) {
    console.error('Google OAuth callback failed:', err);
    fail('exchange_failed');
  }
});

async function clientForUser(user) {
  const client = newOAuthClient();
  client.setCredentials({ refresh_token: user.googleRefreshToken });
  return client;
}

// Maps Google Calendar's event shape onto the plain fields Keystone's own
// .ics importer already produces (data/ics.js's parseICS) — the frontend
// merges these in exactly the way it merges a parsed .ics file today.
function mapCalendarEvent(ev) {
  const startRaw = ev.start?.dateTime || ev.start?.date;
  const endRaw = ev.end?.dateTime || ev.end?.date;
  if (!startRaw) return null;
  const allDay = !ev.start?.dateTime;
  const toDateTime = (raw) => {
    const d = new Date(raw);
    const date = d.toISOString().slice(0, 10);
    const time = allDay ? '00:00' : d.toTimeString().slice(0, 5);
    return { date, time };
  };
  const start = toDateTime(startRaw);
  const end = endRaw ? toDateTime(endRaw) : start;
  return {
    title: ev.summary || 'Untitled',
    date: start.date,
    start: start.time,
    end: end.time,
    location: ev.location || '',
    notes: ev.description || '',
  };
}

// Maps a People API person onto the plain fields Keystone's .vcf importer
// already produces (data/vcard.js's parseVCard).
function mapContact(person) {
  const name = person.names?.[0]?.displayName;
  if (!name) return null; // unnamed entries aren't useful as contacts here
  return {
    name,
    phone: person.phoneNumbers?.[0]?.value || '',
    email: person.emailAddresses?.[0]?.value || '',
    address: person.addresses?.[0]?.formattedValue || '',
    notes: '',
  };
}

// One-shot pull, not a background sync — returns Keystone-shaped events and
// contacts for the frontend to merge into the local data blob, same as
// picking a .ics/.vcf file today. Call again any time for a fresh import;
// nothing is deduped server-side (the frontend's existing import handlers
// don't dedupe either, so this matches that behavior).
router.post('/import', requireUser, async (req, res, next) => {
  try {
    if (!getOAuthConfig()) {
      return res.status(400).json({ error: 'Google sync is not configured on the server.' });
    }
    if (!req.dbUser.googleRefreshToken) {
      return res.status(400).json({ error: 'Google isn’t connected yet.' });
    }

    const auth = await clientForUser(req.dbUser);
    const calendar = google.calendar({ version: 'v3', auth });
    const people = google.people({ version: 'v1', auth });

    // Recent-ish window rather than "everything ever" — a full history pull
    // isn't what "import my calendar" usually means, and it keeps this one
    // request well clear of the API's page-size limits for most accounts.
    const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [eventsRes, peopleRes] = await Promise.all([
      calendar.events.list({
        calendarId: 'primary',
        timeMin,
        maxResults: 250,
        singleEvents: true, // expand recurring events into instances — Keystone's own RRULE
        orderBy: 'startTime', // model doesn't need to round-trip Google's recurrence rules for a one-time import
      }),
      people.people.connections.list({
        resourceName: 'people/me',
        pageSize: 250,
        personFields: 'names,phoneNumbers,emailAddresses,addresses',
      }),
    ]);

    // googleEventId travels alongside the mapped fields (not merged into
    // mapCalendarEvent's own return shape, which calendar-sync also reuses
    // and tracks the id for separately) — the frontend attaches it to the
    // imported event so a later calendar-sync run recognizes it as already
    // linked instead of pushing it back to Google as a duplicate create.
    const events = (eventsRes.data.items || [])
      .map((item) => {
        const mapped = mapCalendarEvent(item);
        return mapped ? { ...mapped, googleEventId: item.id } : null;
      })
      .filter(Boolean);
    const contacts = (peopleRes.data.connections || []).map(mapContact).filter(Boolean);
    res.json({ events, contacts });
  } catch (err) {
    // An expired/revoked refresh token surfaces here as a 401 from Google —
    // worth telling the user to reconnect rather than a generic 500.
    if (err.response?.status === 401 || err.code === 401) {
      return res.status(400).json({ error: 'Google access expired — reconnect Google and try again.' });
    }
    next(err);
  }
});

// Builds the request body Google's events.insert/update expect from a
// Keystone event — the inverse of mapCalendarEvent. `timeZone` comes from
// the client (Intl.DateTimeFormat().resolvedOptions().timeZone) since
// Keystone stores naive local date/time strings with no timezone of their
// own; Google requires one alongside a dateTime.
function toGoogleEvent(ev, timeZone) {
  return {
    summary: ev.title || 'Untitled',
    location: ev.location || undefined,
    description: ev.notes || undefined,
    start: { dateTime: `${ev.date}T${ev.start}:00`, timeZone },
    end: { dateTime: `${ev.date}T${ev.end}:00`, timeZone },
  };
}

// Walks every page of an incremental (or, on first run / an expired token,
// full) events.list call to collect the final nextSyncToken — Google only
// hands that back on the last page, so a single-page list() can't be used
// for anything that needs to sync again later.
async function listAllCalendarChanges(calendar, { syncToken, timeMin }) {
  const items = [];
  let pageToken;
  let nextSyncToken;
  for (;;) {
    let res;
    try {
      res = await calendar.events.list({
        calendarId: 'primary',
        syncToken: syncToken || undefined,
        timeMin: syncToken ? undefined : timeMin, // timeMin isn't valid alongside a syncToken
        singleEvents: true,
        showDeleted: true, // needed to see cancellations as part of an incremental sync
        maxResults: 250,
        pageToken,
      });
    } catch (err) {
      // 410 Gone: the syncToken is too old/invalid — the only recovery is a
      // full resync from a fresh timeMin, same starting point /import uses.
      if (err.response?.status === 410 && syncToken) {
        return listAllCalendarChanges(calendar, { syncToken: null, timeMin });
      }
      throw err;
    }
    items.push(...(res.data.items || []));
    pageToken = res.data.nextPageToken;
    if (res.data.nextSyncToken) nextSyncToken = res.data.nextSyncToken;
    if (!pageToken) break;
  }
  return { items, nextSyncToken };
}

// Combined push-then-pull sync cycle, run whenever the app is open (see
// data/googleCalendarSync.js) — not a background/webhook sync, so nothing
// here runs unless a client actually calls it.
//
// Push: applies the caller's local create/update/delete changes to Google
// first, so they're reflected in the pull that follows in the same cycle.
// Pull: incremental via syncToken when we have one from a previous cycle;
// otherwise a full sync from a 90-day window (matching /import), same
// recovery path an expired/invalid syncToken falls back to.
//
// Deliberately single (non-recurring) events only, same limitation already
// accepted for shared calendars (see prisma/schema.prisma's SharedEvent
// comment) — reconciling Google's RRULE model against Keystone's own
// custom recurrence rules two-way isn't attempted here.
router.post('/calendar-sync', requireUser, async (req, res, next) => {
  try {
    if (!getOAuthConfig()) {
      return res.status(400).json({ error: 'Google sync is not configured on the server.' });
    }
    if (!req.dbUser.googleRefreshToken) {
      return res.status(400).json({ error: 'Google isn’t connected yet.' });
    }
    const { syncToken, changes, timeZone } = req.body || {};
    if (!timeZone) return res.status(400).json({ error: 'Missing timeZone.' });

    const auth = await clientForUser(req.dbUser);
    const calendar = google.calendar({ version: 'v3', auth });

    const results = [];
    for (const change of Array.isArray(changes) ? changes : []) {
      try {
        if (change.action === 'create') {
          const { data } = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: toGoogleEvent(change.event, timeZone),
          });
          results.push({ localId: change.localId, googleEventId: data.id });
        } else if (change.action === 'update' && change.googleEventId) {
          await calendar.events.update({
            calendarId: 'primary',
            eventId: change.googleEventId,
            requestBody: toGoogleEvent(change.event, timeZone),
          });
          results.push({ localId: change.localId, googleEventId: change.googleEventId });
        } else if (change.action === 'delete' && change.googleEventId) {
          await calendar.events
            .delete({ calendarId: 'primary', eventId: change.googleEventId })
            .catch((err) => {
              // Already gone on Google's side — fine, that's the state we wanted.
              if (err.response?.status !== 404 && err.response?.status !== 410) throw err;
            });
          results.push({ localId: change.localId, deleted: true });
        }
      } catch (err) {
        // One bad change (e.g. a stale googleEventId) shouldn't fail the
        // whole sync cycle — reported back so the client can decide how to
        // handle that one event instead of losing every other change too.
        results.push({ localId: change.localId, error: err.message });
      }
    }

    const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { items, nextSyncToken } = await listAllCalendarChanges(calendar, { syncToken, timeMin });
    const serverChanges = items
      .map((item) => {
        if (item.status === 'cancelled') return { googleEventId: item.id, deleted: true };
        const mapped = mapCalendarEvent(item);
        return mapped ? { googleEventId: item.id, event: mapped } : null;
      })
      .filter(Boolean);

    res.json({ syncToken: nextSyncToken || syncToken || null, results, serverChanges });
  } catch (err) {
    if (err.response?.status === 401 || err.code === 401) {
      return res.status(400).json({ error: 'Google access expired — reconnect Google and try again.' });
    }
    next(err);
  }
});

router.post('/disconnect', requireUser, async (req, res, next) => {
  try {
    const token = req.dbUser.googleRefreshToken;
    if (token) {
      // Best-effort — if Google's revoke endpoint is unreachable or already
      // sees it as revoked, we still want to forget it locally either way.
      await newOAuthClient()
        .revokeToken(token)
        .catch(() => {});
    }
    await prisma.user.update({
      where: { id: req.dbUser.id },
      data: { googleRefreshToken: null, googleConnectedAt: null },
    });
    res.json({ disconnected: true });
  } catch (err) {
    next(err);
  }
});

export default router;
