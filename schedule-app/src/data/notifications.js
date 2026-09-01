// Reminders, native-first with a web fallback.
//
// A plain web app can only raise notifications while it's running (open or
// briefly backgrounded) — it can't wake a fully-closed tab, since that needs
// a push server. Running inside the Capacitor shell removes that ceiling
// without needing one: @capacitor/local-notifications schedules real
// OS-level notifications ahead of time, so a reminder still fires even if
// Keystone is closed. That's genuinely different from push — nothing here
// needs a server, an FCM/APNs key, or a network request; the device already
// knows when the reminder is due.
//
// scheduleNativeReminders() only looks at *today's* remaining reminders, and
// it's re-run every time the app opens or comes back to the foreground (see
// App.jsx) — so the schedule stays current as long as Keystone gets opened
// at least once a day. Go a day or more without opening it and the native
// schedule goes stale; runReminderScan()'s foreground scan below has no
// such limit, since it just checks "is anything due right now" every time
// it runs.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { todayISO, timeToMinutes, matchesRule, formatTime } from './helpers.js';
import { contactDatesOn, contactDateLabel } from './contactDates.js';

const isNative = Capacitor.isNativePlatform();

// Birthdays/anniversaries have no per-contact reminder time (unlike goals),
// so they get one fixed time of day instead — morning, so it reads as "here's
// who to remember today" rather than an alert that could land at any hour
// depending on when the app happens to be open.
const CONTACT_DATE_REMINDER_MIN = 9 * 60; // 9:00 AM

export function notificationsSupported() {
  return isNative || (typeof window !== 'undefined' && 'Notification' in window);
}

// The web Notification API exposes permission state synchronously
// (Notification.permission); Capacitor's plugin only offers it async
// (checkPermissions()). Every existing call site reads this synchronously,
// so on native it reads from a cache primed below rather than becoming
// async everywhere just for this one platform.
let nativePermissionState = 'default'; // 'granted' | 'denied' | 'default'
function toPermissionString(status) {
  return status?.display === 'granted' ? 'granted' : status?.display === 'denied' ? 'denied' : 'default';
}
if (isNative) {
  LocalNotifications.checkPermissions()
    .then((s) => {
      nativePermissionState = toPermissionString(s);
    })
    .catch(() => {});
}

export function notificationPermission() {
  if (isNative) return nativePermissionState;
  return notificationsSupported() ? Notification.permission : 'denied';
}

export async function requestNotificationPermission() {
  if (isNative) {
    try {
      const s = await LocalNotifications.requestPermissions();
      nativePermissionState = toPermissionString(s);
      return nativePermissionState;
    } catch {
      return 'denied';
    }
  }
  if (!notificationsSupported()) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

// Fires right now — used by runReminderScan() below and by the arrival-
// reminder watch in App.jsx. On native, "right now" is a local notification
// scheduled a few hundred ms out, since the plugin has no separate
// show-immediately call.
export function notify(title, body) {
  if (notificationPermission() !== 'granted') return;
  if (isNative) {
    LocalNotifications.schedule({
      notifications: [
        {
          id: idFromKey(`now:${title}:${Date.now()}`),
          title,
          body,
          schedule: { at: new Date(Date.now() + 200) },
        },
      ],
    }).catch(() => {
      /* ignore — notifications are a best-effort enhancement */
    });
    return;
  }
  try {
    // Prefer the service worker registration so notifications survive when the
    // page is backgrounded; fall back to a page-level Notification.
    if (navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready
        .then((reg) => reg.showNotification(title, { body, icon: `${import.meta.env.BASE_URL}icon.svg`, badge: `${import.meta.env.BASE_URL}icon.svg` }))
        .catch(() => new Notification(title, { body }));
    } else {
      new Notification(title, { body });
    }
  } catch {
    /* ignore — notifications are a best-effort enhancement */
  }
}

// De-dupe fired reminders per day so we never buzz twice for the same thing.
const FIRED_KEY = 'compass.firedReminders';
function loadFired() {
  try {
    const raw = JSON.parse(localStorage.getItem(FIRED_KEY) || '{}');
    return raw.day === todayISO() ? new Set(raw.keys) : new Set();
  } catch {
    return new Set();
  }
}
function saveFired(set) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify({ day: todayISO(), keys: [...set] }));
  } catch {
    /* ignore */
  }
}

// Scan goals and events for reminders that are due right now (within the last
// few minutes) and haven't fired yet today.
export function runReminderScan(state) {
  if (notificationPermission() !== 'granted') return;
  if (!state.settings?.notifications) return;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = todayISO();
  const fired = loadFired();
  let changed = false;

  const fire = (key, title, body) => {
    if (fired.has(key)) return;
    notify(title, body);
    fired.add(key);
    changed = true;
  };

  // Goal reminders: a fixed time-of-day nudge, if the goal isn't already met.
  for (const g of state.goals || []) {
    const time = g.reminder?.time;
    if (!time) continue;
    const due = timeToMinutes(time);
    if (nowMin >= due && nowMin - due <= 30) {
      if (g.period === 'daily' && (g.progress?.[today] || 0) >= g.target) continue; // met
      fire(`goal:${g.id}:${today}`, 'Goal reminder', `Time for: ${g.title}`);
    }
  }

  // Event reminders: fire `reminder` minutes before an occurrence's start.
  for (const e of state.events || []) {
    const lead = Number(e.reminder) || 0;
    if (!lead) continue;
    if (!matchesRule(e, today) || (e.skipDates || []).includes(today)) continue;
    const start = timeToMinutes(e.start);
    const trigger = start - lead;
    if (nowMin >= trigger && nowMin <= start) {
      fire(
        `event:${e.id}:${today}`,
        e.title || 'Upcoming event',
        `Starts at ${formatTime(e.start)}${lead ? ` · in ${lead} min` : ''}`
      );
    }
  }

  // Task reminders: each selected lead time fires once, counting back from
  // the task's own due date+time (only meaningful when both are set).
  for (const t of state.tasks || []) {
    if (t.done || t.dueDate !== today || !t.dueTime) continue;
    const due = timeToMinutes(t.dueTime);
    for (const lead of t.reminderOffsets || []) {
      const trigger = due - lead;
      if (nowMin >= trigger && nowMin <= due) {
        fire(`task:${t.id}:${lead}:${today}`, t.title || 'Task due', `Due at ${formatTime(t.dueTime)} · in ${lead} min`);
      }
    }
  }

  // Birthdays/anniversaries: one per contact date landing today, from 9am
  // onward — no upper cutoff like the others above, since missing the
  // morning window on a once-a-year reminder because you opened the app at
  // noon would be worse than a slightly-late nudge.
  if (state.settings?.contactBirthdaysEnabled !== false && nowMin >= CONTACT_DATE_REMINDER_MIN) {
    for (const entry of contactDatesOn(state.contacts, today)) {
      const { text, detail } = contactDateLabel(entry);
      fire(`contactdate:${entry.id}:${today}`, `${entry.kind === 'birthday' ? '🎂' : '💍'} ${text}`, detail);
    }
  }

  if (changed) saveFired(fired);
}

// A stable, deterministic 31-bit id from a reminder's own key (the same
// "kind:entityId:date[:extra]" strings runReminderScan already uses to
// de-dupe) — Capacitor's plugin needs a numeric id per notification, and
// reusing the same key means re-scheduling the same reminder overwrites
// its old copy instead of stacking a duplicate.
function idFromKey(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

function atMinuteToday(minutesOfDay) {
  const d = new Date();
  d.setHours(Math.floor(minutesOfDay / 60), minutesOfDay % 60, 0, 0);
  return d;
}

// Native only. Replaces the full set of scheduled local notifications with
// today's remaining goal/event/task reminders — "replace the whole set"
// rather than diffing in individual adds/removes, so an edited or deleted
// reminder is simply absent from the next schedule instead of needing its
// own explicit cancellation path.
export async function scheduleNativeReminders(state) {
  if (!isNative) return;
  if (notificationPermission() !== 'granted') return;
  if (!state.settings?.notifications) return;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = todayISO();
  const upcoming = [];

  for (const g of state.goals || []) {
    const time = g.reminder?.time;
    if (!time) continue;
    const due = timeToMinutes(time);
    if (due < nowMin) continue;
    if (g.period === 'daily' && (g.progress?.[today] || 0) >= g.target) continue;
    upcoming.push({ key: `goal:${g.id}:${today}`, title: 'Goal reminder', body: `Time for: ${g.title}`, at: due });
  }

  for (const e of state.events || []) {
    const lead = Number(e.reminder) || 0;
    if (!lead) continue;
    if (!matchesRule(e, today) || (e.skipDates || []).includes(today)) continue;
    const start = timeToMinutes(e.start);
    const trigger = start - lead;
    if (trigger < nowMin) continue;
    upcoming.push({
      key: `event:${e.id}:${today}`,
      title: e.title || 'Upcoming event',
      body: `Starts at ${formatTime(e.start)}${lead ? ` · in ${lead} min` : ''}`,
      at: trigger,
    });
  }

  for (const t of state.tasks || []) {
    if (t.done || t.dueDate !== today || !t.dueTime) continue;
    const due = timeToMinutes(t.dueTime);
    for (const lead of t.reminderOffsets || []) {
      const trigger = due - lead;
      if (trigger < nowMin) continue;
      upcoming.push({
        key: `task:${t.id}:${lead}:${today}`,
        title: t.title || 'Task due',
        body: `Due at ${formatTime(t.dueTime)} · in ${lead} min`,
        at: trigger,
      });
    }
  }

  // Only scheduled here if 9am hasn't passed yet today — once it has, the
  // foreground scan above is what catches it (no upper cutoff there, so it
  // still fires whenever the app is next opened that day).
  if (state.settings?.contactBirthdaysEnabled !== false && CONTACT_DATE_REMINDER_MIN >= nowMin) {
    for (const entry of contactDatesOn(state.contacts, today)) {
      const { text, detail } = contactDateLabel(entry);
      upcoming.push({
        key: `contactdate:${entry.id}:${today}`,
        title: `${entry.kind === 'birthday' ? '🎂' : '💍'} ${text}`,
        body: detail,
        at: CONTACT_DATE_REMINDER_MIN,
      });
    }
  }

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    if (upcoming.length) {
      await LocalNotifications.schedule({
        notifications: upcoming.map((u) => ({
          id: idFromKey(u.key),
          title: u.title,
          body: u.body,
          schedule: { at: atMinuteToday(u.at) },
        })),
      });
    }
  } catch {
    /* best effort — scheduling failures shouldn't break the app */
  }
}
