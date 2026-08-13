// Small, dependency-free helpers for ids, dates, and time math.

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// --- Dates -----------------------------------------------------------------

// Format a Date as a local YYYY-MM-DD string (avoids UTC off-by-one).
export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

// Parse a YYYY-MM-DD string as a local Date at midnight.
export function fromISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = date instanceof Date ? new Date(date) : fromISODate(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Start of week for the given date — Monday by default, or Sunday when
// setSundayWeekStart(true) has been called (see More → Calendar settings).
export function startOfWeek(date) {
  const d = date instanceof Date ? new Date(date) : fromISODate(date);
  const day = sundayWeekStart ? d.getDay() : (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// A week is keyed by the ISO date of its Monday.
export function weekKey(date) {
  return toISODate(startOfWeek(date));
}

export function weekDays(weekStart) {
  const start = weekStart instanceof Date ? weekStart : fromISODate(weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function addMonths(date, n) {
  const d = date instanceof Date ? new Date(date) : fromISODate(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  // Clamp so e.g. Jan 31 + 1 month doesn't overflow into March.
  const daysInTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInTarget));
  return d;
}

export function startOfMonth(date) {
  const d = date instanceof Date ? new Date(date) : fromISODate(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Last calendar day of the given date's month, as an ISO string.
export function endOfMonthISO(date) {
  return toISODate(addDays(addMonths(startOfMonth(date), 1), -1));
}

// A 6x7 grid of Dates covering the given month, padded with the trailing
// days of the previous month and leading days of the next so every row is a
// full Monday-start week.
export function monthGrid(monthStart) {
  const start = monthStart instanceof Date ? monthStart : startOfMonth(monthStart);
  const gridStart = startOfWeek(start);
  const weeks = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    weeks.push(weekDays(cursor));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTH = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatDayLabel(date) {
  const d = date instanceof Date ? date : fromISODate(date);
  return `${WEEKDAY_LONG[d.getDay()]}, ${MONTH[d.getMonth()]} ${d.getDate()}`;
}

export function formatShortDate(date) {
  const d = date instanceof Date ? date : fromISODate(date);
  return `${MONTH[d.getMonth()]} ${d.getDate()}`;
}

export function formatWeekRange(weekStart) {
  const start = weekStart instanceof Date ? weekStart : fromISODate(weekStart);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const left = `${MONTH[start.getMonth()]} ${start.getDate()}`;
  const right = sameMonth
    ? `${end.getDate()}`
    : `${MONTH[end.getMonth()]} ${end.getDate()}`;
  return `${left} – ${right}`;
}

export function weekdayShort(date) {
  const d = date instanceof Date ? date : fromISODate(date);
  return WEEKDAY[d.getDay()];
}

const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatMonthLabel(date) {
  const d = date instanceof Date ? date : fromISODate(date);
  return `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function isToday(iso) {
  return iso === todayISO();
}

// Whole days between an ISO date and today (Infinity when no date).
export function daysSince(iso) {
  if (!iso) return Infinity;
  return Math.floor((fromISODate(todayISO()) - fromISODate(iso)) / 86400000);
}

// Human "time ago" for a YYYY-MM-DD contact date.
export function daysAgoLabel(iso) {
  if (!iso) return 'Never';
  const diff = Math.round(
    (fromISODate(todayISO()) - fromISODate(iso)) / 86400000
  );
  if (diff < 0) return formatShortDate(iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 14) return 'Last week';
  if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
  if (diff < 60) return 'Last month';
  return `${Math.floor(diff / 30)} months ago`;
}

// --- Time-of-day -----------------------------------------------------------

export function timeToMinutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// App-wide time/week display prefs, kept in sync from settings by App.jsx.
// Module-level rather than threaded through every formatTime/startOfWeek
// call site (there are a couple dozen across the app).
let use24hFormat = false;
export function setUse24hFormat(v) {
  use24hFormat = !!v;
}
let sundayWeekStart = false;
export function setSundayWeekStart(v) {
  sundayWeekStart = !!v;
}

export function formatTime(hhmm) {
  const mins = timeToMinutes(hhmm);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  if (use24hFormat) {
    return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  let h = h24 % 12;
  if (h === 0) h = 12;
  return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Up to two initials from a display name, for avatar chips.
export function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

// --- Geo --------------------------------------------------------------------

// Great-circle distance between two lat/lng points, in meters (haversine).
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// --- Goals -----------------------------------------------------------------

// The progress key for a goal in a given date context: daily goals track by
// day, weekly goals by the week's Monday.
export function goalKey(period, date) {
  return period === 'daily' ? toISODate(date) : weekKey(date);
}

// How many consecutive days (daily goals) or weeks (weekly goals) this goal
// has been met, counting back from now. Today/this week doesn't have to be
// met yet for the streak to still count — an unfinished-but-not-over period
// shouldn't zero out an otherwise-alive streak, so counting starts from
// yesterday/last week instead when the current one isn't done yet. A period
// listed in goal.frozenKeys counts as met even if its target wasn't hit —
// that's a manually-spent streak freeze protecting a missed day.
//
// A daily goal can be restricted to specific weekdays (the "Repeat on"
// picker in the editor). Those calendar days it *isn't* scheduled on aren't
// missed — the goal was never due — so they must not count as a broken
// streak. Walking every calendar day regardless used to do exactly that:
// for a goal scheduled on two adjacent weekdays (Mon/Tue is a common one —
// "gym", say), the very next calendar day is always unscheduled, so the
// streak could never read higher than 1 or 2 no matter how many weeks in a
// row every scheduled day was actually completed. `isScheduled` is a no-op
// (always true) for weekly goals and for daily goals with no restriction,
// so their behavior is unchanged — this only changes anything for a
// restricted daily goal.
export function computeGoalStreak(goal) {
  const target = goal.target || 0;
  if (target <= 0) return 0;
  const progress = goal.progress || {};
  const frozen = goal.frozenKeys || [];
  const period = goal.period || 'weekly';
  const step = period === 'daily' ? 1 : 7;
  const repeatDays = period === 'daily' ? goal.repeatDays || [] : [];
  const isScheduled = (d) => repeatDays.length === 0 || repeatDays.includes(d.getDay());
  const met = (d) => {
    const key = goalKey(period, d);
    return (progress[key] || 0) >= target || frozen.includes(key);
  };
  // Steps back to the previous *scheduled* period: `step` days/weeks when
  // every period is scheduled (weekly, or an unrestricted daily goal —
  // identical to the walk this always did), or day-by-day skipping any
  // unscheduled day when the goal is restricted to specific weekdays.
  const back = (d) => {
    if (repeatDays.length === 0) return addDays(d, -step);
    let next = addDays(d, -1);
    while (!isScheduled(next)) next = addDays(next, -1);
    return next;
  };

  let cursor = new Date();
  while (!isScheduled(cursor)) cursor = addDays(cursor, -1);
  if (!met(cursor)) cursor = back(cursor);
  let count = 0;
  while (met(cursor)) {
    count++;
    cursor = back(cursor);
  }
  return count;
}

// Splits a weekly target into a per-day pace — "read 10 chapters this week"
// is far more actionable as "1 or 2 a day" than as one number you look at on
// Sunday and panic about.
//
// The remainder is spread across the earliest days rather than dumped on the
// last one: a target of 10 becomes 2,2,2,1,1,1,1 (front-loaded), not
// 1,1,1,1,1,1,4. Being slightly ahead early is the useful failure mode.
export function weeklyPace(target) {
  const t = Math.max(0, Math.round(target || 0));
  const base = Math.floor(t / 7);
  const extra = t % 7;
  return Array.from({ length: 7 }, (_, i) => base + (i < extra ? 1 : 0));
}

// Running total after each day, so day i is "done" once weekly progress
// reaches cumulative[i].
export function paceCumulative(target) {
  let run = 0;
  return weeklyPace(target).map((n) => (run += n));
}

// Streak freezes reset monthly rather than being a lifetime pool — Pro gets
// a bigger monthly allowance ("streak insurance") as one of the perks of the
// subscription. Usage is derived from the dates already recorded in
// goal.frozenKeys rather than a separate decrementing counter, so it just
// naturally rolls over into a fresh quota each month.
export const FREE_MONTHLY_FREEZES = 2;
export const PRO_MONTHLY_FREEZES = 5;
export function goalFreezesLeft(goal, isPro) {
  const quota = isPro ? PRO_MONTHLY_FREEZES : FREE_MONTHLY_FREEZES;
  const thisMonth = todayISO().slice(0, 7); // 'YYYY-MM'
  const used = (goal.frozenKeys || []).filter((k) => k.slice(0, 7) === thisMonth).length;
  return Math.max(0, quota - used);
}

// The event's "type" is really just its interaction medium — what kind of
// contact touchpoint it is. An event carries one of these fixed `kind`
// values directly, which is also how the event detail view knows to surface
// a linked contact's phone (call/text) or email (email). The label and id
// are fixed; only the colour is user-customizable (Settings → Calendar →
// Event colors), stored as `settings.eventKindColors` and layered over
// these defaults everywhere a kind's colour is resolved.
//
// A user can also add their own custom types (Settings → Calendar → Custom
// event types, `state.customEventTypes`) — those are purely a label + a
// colour, offered as extra options alongside these fixed ones in the event
// editor's Type dropdown. They deliberately don't get an interaction-medium
// meaning: a custom "Gym" type won't surface a contact's phone number the
// way Call does, because there's no medium to infer one from. See
// resolveKindColors() below for where the two lists get merged into one
// colour map.
export const EVENT_TYPE_KINDS = [
  { value: 'call', label: 'Call', color: '#2e9e6b' },
  { value: 'text', label: 'Text', color: '#1f5f8b' },
  { value: 'inPerson', label: 'In Person', color: '#8a5cd1' },
  { value: 'travel', label: 'Travel', color: '#3a9188' },
  { value: 'email', label: 'Email', color: '#e08a1e' },
  { value: 'other', label: 'Other', color: '#6b7280' },
];
export const DEFAULT_KIND_COLORS = Object.fromEntries(EVENT_TYPE_KINDS.map((k) => [k.value, k.color]));

// Settings → Calendar → Event types lets someone reorder this whole list
// (fixed kinds and their own custom types together) and toggle any of them
// off the event editor's Type dropdown, stored as `settings.eventTypeOrder`
// — [{id, enabled}], id being a fixed kind's `value` or a custom type's id.
// Toggling a fixed kind off only hides it as a future choice; it doesn't
// touch eventColor() or events that already carry it, so nothing already on
// the calendar changes color or loses its label just because the option was
// hidden. Mirrors normalizeTabOrder()/normalizeHomeBlocks() — merges a
// stored (possibly stale, e.g. missing the newly-added Travel kind, or
// carrying a since-deleted custom type's id) order with the current known
// set, preserving order/enabled where a stored entry still matches, and
// appending anything new.
export function normalizeEventTypeOrder(list, customEventTypes) {
  const known = new Set([...EVENT_TYPE_KINDS.map((k) => k.value), ...(customEventTypes || []).map((t) => t.id)]);
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    if (!item || !known.has(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({ id: item.id, enabled: item.enabled !== false });
  }
  for (const k of EVENT_TYPE_KINDS) {
    if (!seen.has(k.value)) {
      seen.add(k.value);
      out.push({ id: k.value, enabled: true });
    }
  }
  for (const t of customEventTypes || []) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      out.push({ id: t.id, enabled: true });
    }
  }
  return out;
}

// Merges the fixed kinds' colours (defaults, then any Settings overrides)
// with custom event types' own colours into the one map eventColor() below
// expects — custom types have no default to override, they just carry
// whatever colour they were created with. Centralized here rather than
// spelled out at each of the half-dozen call sites, the same reasoning as
// eventColor() itself.
export function resolveKindColors(settings, customEventTypes) {
  return {
    ...DEFAULT_KIND_COLORS,
    ...(settings?.eventKindColors || {}),
    ...Object.fromEntries((customEventTypes || []).map((t) => [t.id, t.color])),
  };
}

// Same idea as resolveKindColors() above, for the label instead — the id →
// display-name half of a kind, merging the fixed kinds with anyone's custom
// types. Fixed kinds' labels aren't user-renamable, so unlike colors there's
// no settings override to merge in.
export function resolveKindLabels(customEventTypes) {
  return {
    ...Object.fromEntries(EVENT_TYPE_KINDS.map((k) => [k.value, k.label])),
    ...Object.fromEntries((customEventTypes || []).map((t) => [t.id, t.label])),
  };
}

// The colour an event should be drawn in, in priority order: a colour set
// on the event itself, then its kind's colour (user-customized if set, else
// the default above), then the status colour of the person it's with, then
// the theme accent.
//
// One function because the four views used to each spell this out inline and
// had already drifted — Month view checked only `event.color`, so an event
// coloured by its *kind* rendered a plain gold dot there while showing its
// real colour everywhere else.
// `contactColor` is an optional (id) => color|undefined lookup — pages that
// have the contact and status lists build it once with makeContactColor().
// `kindColors` is an optional { call, text, ... } override map — pages
// build it with resolveKindColors(settings, customEventTypes); omitted, the
// fixed defaults above apply (with no custom types resolved).
// An event can be linked to more than one person (contactIds, the canonical
// field going forward) — this reads that array, falling back to the older
// single contactId field for events stored before multi-linking existed, so
// nothing needs a one-time migration pass over already-saved data.
export function eventContactIds(event) {
  if (Array.isArray(event?.contactIds)) return event.contactIds.filter(Boolean);
  return event?.contactId ? [event.contactId] : [];
}

// Every write path that sets contactIds should run the result through this
// so `contactId` — kept only for any reader that hasn't been updated to the
// plural field — stays truthfully "the first linked person" rather than
// silently going stale.
export function withContactIds(fields, contactIds) {
  const ids = (contactIds || []).filter(Boolean);
  return { ...fields, contactIds: ids, contactId: ids[0] || '' };
}

// Comma-joined display names for eventContactIds()'s result — the plural
// counterpart to the several one-off `contactName(id)` lookups that used to
// be redefined per-file; centralized here so "how do multiple linked people
// read on screen" only has one answer to change.
export function contactNames(ids, contacts) {
  return (ids || [])
    .map((id) => contacts.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join(', ');
}

export function eventColor(event, contactColor, fallback = 'var(--accent)', kindColors) {
  if (event?.color) return event.color;
  const colors = kindColors || DEFAULT_KIND_COLORS;
  if (event?.kind && colors[event.kind]) return colors[event.kind];
  // A block can only carry one accent — the first linked person (also
  // what `contactId` mirrors, see withContactIds()) stands in for the rest.
  const primaryContactId = eventContactIds(event)[0];
  if (primaryContactId && contactColor) {
    const c = contactColor(primaryContactId);
    if (c) return c;
  }
  return fallback;
}

// A contact's colour is its status's colour — statuses are where colour is
// actually assigned to people (see People → statuses).
export function makeContactColor(contacts, statuses) {
  const statusColor = Object.fromEntries((statuses || []).map((s) => [s.id, s.color]));
  const byId = Object.fromEntries((contacts || []).map((c) => [c.id, statusColor[c.statusId]]));
  return (id) => byId[id];
}

// --- Recurring events ------------------------------------------------------

export const REPEAT_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Every month' },
  { value: 'custom', label: 'Custom days' },
];

export const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function repeatLabel(value, repeatDays) {
  if (value === 'custom' && repeatDays?.length) {
    return repeatDays
      .slice()
      .sort()
      .map((d) => WEEKDAY_ABBR[d])
      .join(', ');
  }
  return REPEAT_OPTIONS.find((o) => o.value === value)?.label || 'Does not repeat';
}

// Does an event occur on the given ISO date, honoring its repeat rule,
// end date, and per-occurrence skips?
export function occursOn(event, iso) {
  const repeat = event.repeat || 'none';
  if (repeat === 'none') return event.date === iso;
  if (iso < event.date) return false;
  if (event.repeatUntil && iso > event.repeatUntil) return false;
  if ((event.skipDates || []).includes(iso)) return false;
  const start = fromISODate(event.date);
  const day = fromISODate(iso);
  const diff = Math.round((day - start) / 86400000);
  switch (repeat) {
    case 'daily':
      return true;
    case 'weekly':
      return diff % 7 === 0;
    case 'biweekly':
      return diff % 14 === 0;
    case 'monthly':
      return start.getDate() === day.getDate();
    case 'custom':
      return (event.repeatDays || []).includes(day.getDay());
    default:
      return false;
  }
}

// Does the event occur on any day within [fromISO, toISO] (inclusive)? Used
// by search's date-phrase filtering ("next week", "this month") where the
// query names a range rather than one specific day. A bounded day-by-day
// scan rather than solving the recurrence rule algebraically — the ranges
// search deals in are at most a few dozen days (a month, at most), so the
// cost is trivial next to the clarity of reusing occursOn as-is.
export function eventOccursInRange(event, fromISO, toISO) {
  let iso = fromISO;
  while (iso <= toISO) {
    if (occursOn(event, iso)) return true;
    iso = toISODate(addDays(iso, 1));
  }
  return false;
}

// Is a specific occurrence marked done? Single events use the `done` flag;
// recurring events track completed dates in `doneDates`.
export function isOccurrenceDone(event, iso) {
  if ((event.repeat || 'none') === 'none') return !!event.done;
  return (event.doneDates || []).includes(iso);
}

// Pure recurrence-rule test (anchor / end date / frequency), ignoring skips
// and per-occurrence overrides.
export function matchesRule(event, iso) {
  const repeat = event.repeat || 'none';
  if (repeat === 'none') return event.date === iso;
  if (iso < event.date) return false;
  if (event.repeatUntil && iso > event.repeatUntil) return false;
  const start = fromISODate(event.date);
  const day = fromISODate(iso);
  const diff = Math.round((day - start) / 86400000);
  switch (repeat) {
    case 'daily':
      return true;
    case 'weekly':
      return diff % 7 === 0;
    case 'biweekly':
      return diff % 14 === 0;
    case 'monthly':
      return start.getDate() === day.getDate();
    case 'custom':
      return (event.repeatDays || []).includes(day.getDay());
    default:
      return false;
  }
}

// Build a display occurrence, merging any per-occurrence override on top of
// the master event. `recDate` is the recurrence id (original rule date);
// `occDate` is where it actually shows (an override may relocate it).
function makeOccurrence(event, recDate, occDate, ov) {
  const repeat = event.repeat || 'none';
  const contactIds = ov?.contactIds !== undefined ? ov.contactIds : eventContactIds(event);
  return {
    ...event,
    recDate,
    occDate,
    // Pristine master fields, kept so an "edit all" can reset to the series base.
    base: {
      title: event.title,
      start: event.start,
      end: event.end,
      contactIds: eventContactIds(event),
      contactId: eventContactIds(event)[0] || '',
      location: event.location || '',
      notes: event.notes || '',
      date: event.date,
    },
    title: ov?.title ?? event.title,
    start: ov?.start ?? event.start,
    end: ov?.end ?? event.end,
    contactIds,
    contactId: contactIds[0] || '',
    location: ov?.location ?? event.location ?? '',
    notes: ov?.notes ?? event.notes ?? '',
    done: repeat === 'none' ? !!event.done : (event.doneDates || []).includes(recDate),
    isException: !!ov,
  };
}

// All occurrences of an event that DISPLAY on the given day. Usually 0 or 1,
// but an override can relocate an occurrence from another day onto this one.
export function expandEventOnDay(event, iso) {
  const repeat = event.repeat || 'none';
  if (repeat === 'none') {
    return event.date === iso ? [makeOccurrence(event, iso, iso, null)] : [];
  }
  const overrides = event.overrides || {};
  const skip = event.skipDates || [];
  const out = [];
  // In-place occurrence on its own rule date (unless moved elsewhere).
  if (matchesRule(event, iso) && !skip.includes(iso)) {
    const ov = overrides[iso];
    if (!ov || !ov.date || ov.date === iso) out.push(makeOccurrence(event, iso, iso, ov || null));
  }
  // Occurrences relocated onto this day from a different rule date.
  for (const rec of Object.keys(overrides)) {
    const ov = overrides[rec];
    if (ov && ov.date === iso && rec !== iso && matchesRule(event, rec) && !skip.includes(rec)) {
      out.push(makeOccurrence(event, rec, iso, ov));
    }
  }
  return out;
}
