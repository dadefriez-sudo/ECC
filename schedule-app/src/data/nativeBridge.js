// The small Android-only bridge (android/.../KeystoneBridgePlugin.java):
// feeds the home screen widget, and hears about text shared into Keystone
// and taps on the widget. Everywhere else it quietly does nothing.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { todayISO, formatTime, timeToMinutes, expandEventOnDay, weekKey } from './helpers.js';

const available = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
const Bridge = available ? registerPlugin('KeystoneBridge') : null;

const MAX_ROWS = 4;

// What the widget shows: the rest of today in time order (events, tasks with
// a due date today, goal reminders), done things left out, the first four
// listed and a count of the remainder. Untimed tasks go last.
export function buildWidgetPayload(state, now = new Date()) {
  const today = todayISO();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const rows = [];

  for (const e of state.events || []) {
    for (const occ of expandEventOnDay(e, today)) {
      if (occ.done) continue;
      const start = timeToMinutes(occ.start);
      if (start + 30 < nowMin) continue; // already well under way or over
      rows.push({ sort: start, t: formatTime(occ.start), n: occ.title || 'Event', k: 'event', i: occ.id });
    }
  }
  for (const t of state.tasks || []) {
    if (t.done || t.dueDate !== today) continue;
    if (t.dueTime) {
      const m = timeToMinutes(t.dueTime);
      if (m + 30 < nowMin) continue;
      rows.push({ sort: m, t: formatTime(t.dueTime), n: t.title, k: 'task', i: t.id });
    } else {
      rows.push({ sort: 24 * 60, t: '', n: t.title, k: 'task', i: t.id });
    }
  }
  const wk = weekKey(now);
  for (const g of state.goals || []) {
    if (!g.reminder?.times?.length) continue;
    const isDaily = (g.period || 'weekly') === 'daily';
    if (isDaily && g.repeatDays?.length && !g.repeatDays.includes(now.getDay())) continue;
    if ((g.progress?.[isDaily ? today : wk] || 0) >= (g.target || 1)) continue;
    for (const time of g.reminder.times) {
      const m = timeToMinutes(time);
      if (m + 30 < nowMin) continue;
      rows.push({ sort: m, t: formatTime(time), n: g.title, k: 'goal', i: g.id });
    }
  }

  rows.sort((a, b) => a.sort - b.sort);
  return {
    day: today,
    items: rows.slice(0, MAX_ROWS).map(({ t, n, k, i }) => ({ t, n, k, i })),
    more: Math.max(0, rows.length - MAX_ROWS),
  };
}

let lastPushed = '';
export function pushWidget(state) {
  if (!Bridge) return;
  const json = JSON.stringify(buildWidgetPayload(state));
  if (json === lastPushed) return; // nothing changed, no need to redraw
  lastPushed = json;
  Bridge.updateWidget({ json }).catch(() => {
    lastPushed = '';
  });
}

// onShare({ text, subject }) and onAction(action) can fire immediately: the
// native side holds events until a listener exists. Returns a cleanup.
export function listenForNativeEvents({ onShare, onAction }) {
  if (!Bridge) return () => {};
  const handles = [];
  let cancelled = false;
  const add = (name, fn) =>
    Bridge.addListener(name, fn)
      .then((h) => (cancelled ? h.remove() : handles.push(h)))
      .catch(() => {});
  add('shareReceived', onShare);
  add('widgetAction', (d) => onAction(d?.action, d));
  return () => {
    cancelled = true;
    handles.forEach((h) => h.remove());
  };
}

// The phone's own contacts, for "Import from phone". Android only; rejects with
// code "denied" if the person says no to the permission.
export const phoneContactsAvailable = () => !!Bridge || typeof window.__KS_PHONE_CONTACTS__ === 'function';
export async function readPhoneContacts() {
  // The seam lets tests (and nothing else) supply a list where there's no phone.
  if (!Bridge && typeof window.__KS_PHONE_CONTACTS__ === 'function') return window.__KS_PHONE_CONTACTS__();
  if (!Bridge) throw new Error('Importing from the phone is only available in the Android app.');
  const { contacts } = await Bridge.readContacts();
  return contacts || [];
}

// The phone's calendar (read only). Same seam as the contacts above, for tests.
const calendarSeam = () => (typeof window !== 'undefined' ? window.__KS_PHONE_CALENDAR__ : undefined);
export const phoneCalendarAvailable = () => !!Bridge || !!calendarSeam();
export async function readPhoneCalendars() {
  if (!Bridge && calendarSeam()) return calendarSeam().calendars();
  if (!Bridge) throw new Error('Importing from the phone calendar is only available in the Android app.');
  const { calendars } = await Bridge.readCalendars();
  return calendars || [];
}
export async function readPhoneCalendarEvents({ calendarIds, startMs, endMs }) {
  if (!Bridge && calendarSeam()) return calendarSeam().events({ calendarIds, startMs, endMs });
  if (!Bridge) throw new Error('Importing from the phone calendar is only available in the Android app.');
  const { events } = await Bridge.readCalendarEvents({ calendarIds, startMs, endMs });
  return events || [];
}

// Canvas Student, the Android app for Canvas. A Canvas link goes there when it is
// installed (and handles that school's address); otherwise it opens as usual.
const CANVAS_APPS = ['com.instructure.candroid'];
const openSeam = () => (typeof window !== 'undefined' ? window.__KS_OPEN_LINK__ : undefined);

// Resolves true when this handled the link (native app or the test seam) and
// false when the caller should just let the link open normally.
export async function openCanvasLink(url) {
  if (!Bridge && openSeam()) {
    openSeam()(url, CANVAS_APPS);
    return true;
  }
  if (!Bridge) return false;
  try {
    await Bridge.openLink({ url, packages: CANVAS_APPS });
    return true;
  } catch {
    return false;
  }
}
