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
      rows.push({ sort: start, t: formatTime(occ.start), n: occ.title || 'Event', k: 'event' });
    }
  }
  for (const t of state.tasks || []) {
    if (t.done || t.dueDate !== today) continue;
    if (t.dueTime) {
      const m = timeToMinutes(t.dueTime);
      if (m + 30 < nowMin) continue;
      rows.push({ sort: m, t: formatTime(t.dueTime), n: t.title, k: 'task' });
    } else {
      rows.push({ sort: 24 * 60, t: '', n: t.title, k: 'task' });
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
      rows.push({ sort: m, t: formatTime(time), n: g.title, k: 'goal' });
    }
  }

  rows.sort((a, b) => a.sort - b.sort);
  return {
    day: today,
    items: rows.slice(0, MAX_ROWS).map(({ t, n, k }) => ({ t, n, k })),
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
  add('widgetAction', (d) => onAction(d?.action));
  return () => {
    cancelled = true;
    handles.forEach((h) => h.remove());
  };
}
