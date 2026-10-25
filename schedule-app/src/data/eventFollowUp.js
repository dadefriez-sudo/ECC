// "How did it go?" after an event. Opt-in: a setting turns it on for every
// event, and an event can override that either way. A follow-up stays open
// (on Home) for a day after the event ends, so a missed notification isn't a
// lost chance, and is closed by marking the event done or saving a note.
import { expandEventOnDay, timeToMinutes, todayISO, addDays, toISODate } from './helpers.js';

export function followUpEnabled(event, settings) {
  if (typeof event?.followUp === 'boolean') return event.followUp;
  return settings?.eventFollowUp === true;
}

export function followUpKey(occ) {
  return `${occ.id}:${occ.recDate}`;
}

const endMinutes = (occ) => {
  const e = timeToMinutes(occ.end || occ.start);
  return Math.max(e, timeToMinutes(occ.start));
};

// Occurrences that have finished (today or yesterday), want a check-in, and
// haven't had one. Newest first.
export function pendingFollowUps(state, now = new Date()) {
  const today = todayISO();
  const yesterday = toISODate(addDays(today, -1));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out = [];
  for (const e of state.events || []) {
    if (!followUpEnabled(e, state.settings)) continue;
    for (const day of [yesterday, today]) {
      for (const occ of expandEventOnDay(e, day)) {
        const date = occ.occDate || day;
        if (date === today && endMinutes(occ) > nowMin) continue; // not over yet
        if (occ.done) continue;
        if ((e.followedUp || []).includes(occ.recDate)) continue;
        out.push({ occ, date, key: followUpKey(occ), endAt: `${date}T${String(endMinutes(occ)).padStart(4, '0')}` });
      }
    }
  }
  return out.sort((a, b) => (a.date + a.occ.end < b.date + b.occ.end ? 1 : -1));
}

// Closes the follow-up for one occurrence, optionally marking it done.
export function closeFollowUp(event, occ, { markDone } = {}) {
  const next = { ...event, followedUp: [...new Set([...(event.followedUp || []), occ.recDate])] };
  if (markDone) {
    if ((event.repeat || 'none') === 'none') next.done = true;
    else next.doneDates = [...new Set([...(event.doneDates || []), occ.recDate])];
  }
  return next;
}
