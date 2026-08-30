// Ongoing two-way Google Calendar sync — runs whenever the app is open
// (see the GoogleCalendarSync component in App.jsx), not a background/
// webhook sync. Single (non-repeating) events only; a Keystone event with a
// `repeat` other than 'none' has no clean Google equivalent and is left
// alone (same limitation already accepted for shared calendars — see
// backend/prisma/schema.prisma's SharedEvent comment).
//
// Change detection is a diff against a snapshot taken at the end of the
// previous sync (state.settings.googleCalendarSyncSnapshot), rather than
// tracking a dirty flag on every store mutation — much less invasive to the
// reducer, and the diff only has to run once per sync cycle anyway.
import { syncGoogleCalendar } from './api.js';
import { uid } from './helpers.js';

const SYNCED_FIELDS = ['title', 'date', 'start', 'end', 'location', 'notes'];

function hashEvent(ev) {
  return SYNCED_FIELDS.map((k) => ev[k] || '').join('');
}

function pickSyncedFields(ev) {
  const out = {};
  for (const k of SYNCED_FIELDS) out[k] = ev[k] || '';
  return out;
}

const NEW_EVENT_DEFAULTS = {
  repeatUntil: '',
  repeatDays: [],
  doneDates: [],
  skipDates: [],
  kind: '',
  color: '',
  reminder: 0,
  contactIds: [],
  contactId: '',
  repeat: 'none',
};

export async function runGoogleCalendarSync(getToken, state, actions) {
  const snapshot = state.settings?.googleCalendarSyncSnapshot || {};
  const changes = [];
  // Every event that still exists locally, regardless of repeat status —
  // used only to tell "actually deleted" from "still here but no longer
  // sync-eligible" below. A synced single event that got turned into a
  // recurring series afterward should just stop syncing, not read as
  // deleted and get a delete pushed to Google.
  const allLocalIds = new Set(state.events.map((e) => e.id));

  for (const ev of state.events) {
    if ((ev.repeat || 'none') !== 'none') continue; // no Google equivalent — left alone
    const prev = snapshot[ev.id];
    const hash = hashEvent(ev);
    if (!prev) {
      changes.push({ localId: ev.id, action: 'create', event: pickSyncedFields(ev) });
    } else if (prev.hash !== hash) {
      changes.push({ localId: ev.id, action: 'update', googleEventId: prev.googleEventId, event: pickSyncedFields(ev) });
    }
  }
  for (const [localId, prev] of Object.entries(snapshot)) {
    if (!allLocalIds.has(localId) && prev.googleEventId) {
      changes.push({ localId, action: 'delete', googleEventId: prev.googleEventId });
    }
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { syncToken, results, serverChanges } = await syncGoogleCalendar(getToken, {
    syncToken: state.settings?.googleCalendarSyncToken || null,
    changes,
    timeZone,
  });

  // Attach the googleEventId Google just assigned to anything we created,
  // and drop anything we deleted, before applying Google's own changes —
  // so a create+immediate-remote-edit in the same cycle merges correctly.
  const nextSnapshot = { ...snapshot };
  for (const r of results || []) {
    if (r.deleted) delete nextSnapshot[r.localId];
    else if (r.googleEventId) nextSnapshot[r.localId] = { googleEventId: r.googleEventId, hash: hashEvent(pickSyncedFields(state.events.find((e) => e.id === r.localId) || {})) };
    if (r.googleEventId) {
      const local = state.events.find((e) => e.id === r.localId);
      if (local && local.googleEventId !== r.googleEventId) actions.updateEvent({ ...local, googleEventId: r.googleEventId });
    }
  }

  const googleIdToLocalId = new Map();
  for (const [localId, entry] of Object.entries(nextSnapshot)) googleIdToLocalId.set(entry.googleEventId, localId);

  for (const change of serverChanges || []) {
    const localId = googleIdToLocalId.get(change.googleEventId);
    if (change.deleted) {
      if (localId) {
        actions.deleteEvent(localId);
        delete nextSnapshot[localId];
      }
      continue;
    }
    let effectiveLocalId = localId;
    if (localId) {
      const local = state.events.find((e) => e.id === localId);
      if (local) actions.updateEvent({ ...local, ...change.event, googleEventId: change.googleEventId });
    } else {
      // addEvent's reducer only ever generates its own id when the passed
      // data has none, so supplying one here means we don't have to guess
      // it back out afterward — the snapshot needs a real localId, not the
      // googleEventId, to match how the diff loop above looks entries up
      // (by ev.id), or every Google-sourced event would look "new" again
      // on the very next cycle and get pushed back as a duplicate create.
      effectiveLocalId = uid('e');
      actions.addEvent({ id: effectiveLocalId, ...NEW_EVENT_DEFAULTS, ...change.event, googleEventId: change.googleEventId });
    }
    nextSnapshot[effectiveLocalId] = { googleEventId: change.googleEventId, hash: hashEvent(change.event) };
  }

  actions.setSettings({
    googleCalendarSyncToken: syncToken,
    googleCalendarSyncSnapshot: nextSnapshot,
    googleCalendarSyncedAt: Date.now(),
  });
}
