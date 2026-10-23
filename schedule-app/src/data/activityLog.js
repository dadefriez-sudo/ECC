import { todayISO, toISODate, addDays, fromISODate } from './helpers.js';

// A tiny, local-only record of *whether* the app is being used — never what
// is in it. It exists so a tester can show "I used Keystone 5 of the last 7
// days" without anyone needing analytics or an account. Counts only: days
// opened, items added, things done. It lives in its own localStorage key, so
// it is not part of the saved planner data, is never synced or backed up, and
// leaves the phone only if the person taps "Send my week".
const KEY = 'keystone.activity.v1';
const KEEP_DAYS = 70;
const SESSION_GAP_MS = 30 * 60 * 1000;

let muted = false;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object' && raw.days) return raw;
  } catch {
    /* unreadable or unavailable storage: start empty */
  }
  return { first: null, last: 0, days: {} };
}

function save(log) {
  try {
    const cutoff = toISODate(addDays(new Date(), -KEEP_DAYS));
    for (const d of Object.keys(log.days)) if (d < cutoff) delete log.days[d];
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    /* never let bookkeeping break the app */
  }
}

const dayOf = (log, iso) => (log.days[iso] ||= { o: 0, a: 0, c: 0 });

// Run something that dispatches store actions without counting them (the
// first-run starter goals are the setup, not the person using the app).
export function withoutActivity(fn) {
  muted = true;
  try {
    return fn();
  } finally {
    muted = false;
  }
}

// A launch or return to the app. Returns inside 30 minutes count as one visit.
export function recordOpen() {
  const log = load();
  const today = todayISO();
  const now = Date.now();
  if (!log.first) log.first = today;
  if (now - (log.last || 0) > SESSION_GAP_MS) dayOf(log, today).o += 1;
  else dayOf(log, today);
  log.last = now;
  save(log);
}

// Adds are things created; changes are things done (progress logged, a task
// checked off, an event edited). Settings, imports, resets and deletes are not
// "using" the app and are ignored.
const IGNORED = /^(SET_SETTINGS|IMPORT_DATA|RESET_DATA|CLEAR_DATA|CLEAR_CONTACTS|ADD_STATUS|ADD_CUSTOM_EVENT_TYPE|DELETE_)/;
export function recordAction(type) {
  if (muted || typeof type !== 'string' || IGNORED.test(type)) return;
  const log = load();
  if (!log.first) log.first = todayISO();
  const day = dayOf(log, todayISO());
  if (type.startsWith('ADD_') && type !== 'ADD_INTERACTION') day.a += 1;
  else day.c += 1;
  save(log);
}

// The last seven days (today last) and how they went.
export function weekSummary(now = new Date()) {
  const log = load();
  const today = toISODate(now);
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = toISODate(addDays(now, i - 6));
    const d = log.days[iso] || { o: 0, a: 0, c: 0 };
    return { iso, opened: d.o > 0 || d.a + d.c > 0, active: d.a + d.c > 0, adds: d.a, changes: d.c };
  });
  const sinceFirst = log.first ? Math.round((fromISODate(today) - fromISODate(log.first)) / 86400000) + 1 : 0;
  return {
    days,
    daysOpened: days.filter((d) => d.opened).length,
    daysActive: days.filter((d) => d.active).length,
    adds: days.reduce((s, d) => s + d.adds, 0),
    changes: days.reduce((s, d) => s + d.changes, 0),
    sinceFirst,
  };
}

export function weekReportText(s) {
  return [
    `My Keystone week: I used it on ${s.daysActive} of the last 7 days (opened it on ${s.daysOpened}).`,
    `${s.adds} item${s.adds === 1 ? '' : 's'} added, ${s.changes} thing${s.changes === 1 ? '' : 's'} done.`,
    s.sinceFirst ? `I've had it for ${s.sinceFirst} day${s.sinceFirst === 1 ? '' : 's'}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
