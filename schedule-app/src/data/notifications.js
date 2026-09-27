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
import { todayISO, timeToMinutes, matchesRule, formatTime, addDays, toISODate, formatShortDate } from './helpers.js';
import { contactDatesOn, contactDateLabel } from './contactDates.js';

const isNative = Capacitor.isNativePlatform();

// Birthdays/anniversaries have no per-contact reminder time (unlike goals),
// so they get one fixed time of day instead — morning, so it reads as "here's
// who to remember today" rather than an alert that could land at any hour
// depending on when the app happens to be open.
const CONTACT_DATE_REMINDER_MIN = 9 * 60; // 9:00 AM

// Milestones only have a target *date*, no time of day, so "N days before"
// fires at a fixed morning time on that earlier date — same convention as
// birthdays/anniversaries above.
const MILESTONE_REMINDER_MIN = 9 * 60; // 9:00 AM

// A task's own due date + due time, as a real Date. Building this from the
// actual calendar date (rather than doing minutes-since-midnight math scoped
// to "today") is what lets a lead time cross a day boundary correctly — a
// 30-min lead on a task due at 00:15, or a 1-day-before lead on any task,
// both used to compute a negative "minutes since midnight", which never
// matched any same-day comparison window and just silently never fired.
function taskDueAt(t) {
  return new Date(`${t.dueDate}T${t.dueTime}`);
}

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

// Android 12+ (S) gates *exact*-time alarms behind a separate permission
// from the notification permission above — without it, scheduleNativeReminders
// below still schedules reminders, but Android defers them to its own Doze
// maintenance windows instead of firing at the requested time (see
// LocalNotificationManager.setExactIfPossible's fallback in the plugin's
// Android source). That reads as "reminders don't fire when the app is
// closed" even though they technically do, just late. Not a concept on iOS
// or web, so this is Android-only; other platforms report "granted" so
// callers don't need their own platform branch on top of this one.
const isAndroid = isNative && Capacitor.getPlatform() === 'android';
let exactAlarmState = 'granted'; // 'granted' | 'denied' | 'unknown' — only meaningful when isAndroid
if (isAndroid) {
  exactAlarmState = 'unknown';
  LocalNotifications.checkExactNotificationSetting()
    .then((s) => {
      exactAlarmState = s.exact_alarm;
    })
    .catch(() => {});
}

export function exactAlarmsConfigurable() {
  return isAndroid;
}

export function exactAlarmPermission() {
  return exactAlarmState;
}

// Opens the system "Alarms & reminders" settings screen for this app (the
// plugin's own wording — there's no in-app grant dialog for this one, per
// Android's design for "special" permissions). Resolves once the user
// returns to the app with their choice.
export async function requestExactAlarmPermission() {
  if (!isAndroid) return exactAlarmState;
  try {
    const s = await LocalNotifications.changeExactNotificationSetting();
    exactAlarmState = s.exact_alarm;
    return exactAlarmState;
  } catch {
    return exactAlarmState;
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

  // Goal reminders: each selected time of day fires its own nudge, if the
  // goal isn't already met.
  for (const g of state.goals || []) {
    if (g.period === 'daily' && (g.progress?.[today] || 0) >= g.target) continue; // met
    for (const time of g.reminder?.times || []) {
      const due = timeToMinutes(time);
      if (nowMin >= due && nowMin - due <= 30) {
        fire(`goal:${g.id}:${time}:${today}`, 'Goal reminder', `Time for: ${g.title}`);
      }
    }
  }

  // Event reminders: each selected lead time fires once, counting back from
  // an occurrence's start.
  for (const e of state.events || []) {
    if (!(e.reminder || []).length) continue;
    if (!matchesRule(e, today) || (e.skipDates || []).includes(today)) continue;
    const start = timeToMinutes(e.start);
    for (const lead of e.reminder) {
      const trigger = start - lead;
      if (nowMin >= trigger && nowMin <= start) {
        fire(
          `event:${e.id}:${lead}:${today}`,
          e.title || 'Upcoming event',
          `Starts at ${formatTime(e.start)}${lead ? ` · in ${lead} min` : ''}`
        );
      }
    }
  }

  // Task reminders: each selected lead time fires once, counting back from
  // the task's own due date+time (only meaningful when both are set). Not
  // restricted to today's due date — a long lead (1 day before) on a task
  // due tomorrow can trigger today, and taskDueAt/real-Date subtraction
  // handles that crossing correctly instead of wrapping within one day.
  for (const t of state.tasks || []) {
    if (t.done || !t.dueDate || !t.dueTime) continue;
    const due = taskDueAt(t);
    for (const lead of t.reminderOffsets || []) {
      const triggerMs = due.getTime() - lead * 60000;
      const diffMin = (now.getTime() - triggerMs) / 60000;
      // A short, fixed window (not "however long the lead is") — this scan
      // runs every 30s, so a couple of minutes of slack is plenty, and a
      // window that scaled with the lead itself (the old due-minus-lead..due
      // shape) would mean a 1-day-before reminder could fire at ANY point
      // during that entire day rather than near the one moment it should.
      if (diffMin >= 0 && diffMin <= 2) {
        fire(
          `task:${t.id}:${lead}:${toISODate(due)}`,
          t.title || 'Task due',
          lead >= 1440
            ? `Due ${formatShortDate(t.dueDate)} at ${formatTime(t.dueTime)}`
            : `Due at ${formatTime(t.dueTime)} · in ${lead} min`
        );
      }
    }
  }

  // Milestone reminders: "N days before" fires at a fixed morning time on
  // that earlier date, the same way birthdays/anniversaries do — a
  // milestone only has a target *date*, no time of day to count back from.
  for (const m of state.milestones || []) {
    if (m.done || !m.targetDate || !(m.reminderDaysBefore || []).length) continue;
    if (nowMin < MILESTONE_REMINDER_MIN || nowMin - MILESTONE_REMINDER_MIN > 30) continue;
    for (const daysBefore of m.reminderDaysBefore) {
      const fireDate = toISODate(addDays(m.targetDate, -daysBefore));
      if (fireDate !== today) continue;
      fire(
        `milestone:${m.id}:${daysBefore}:${today}`,
        'Milestone reminder',
        daysBefore === 0 ? `${m.title} is due today` : `${m.title} due ${formatShortDate(m.targetDate)}`
      );
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
    if (g.period === 'daily' && (g.progress?.[today] || 0) >= g.target) continue;
    for (const time of g.reminder?.times || []) {
      const due = timeToMinutes(time);
      if (due < nowMin) continue;
      upcoming.push({ key: `goal:${g.id}:${time}:${today}`, title: 'Goal reminder', body: `Time for: ${g.title}`, at: due });
    }
  }

  for (const e of state.events || []) {
    if (!(e.reminder || []).length) continue;
    if (!matchesRule(e, today) || (e.skipDates || []).includes(today)) continue;
    const start = timeToMinutes(e.start);
    for (const lead of e.reminder) {
      const trigger = start - lead;
      if (trigger < nowMin) continue;
      upcoming.push({
        key: `event:${e.id}:${lead}:${today}`,
        title: e.title || 'Upcoming event',
        body: `Starts at ${formatTime(e.start)}${lead ? ` · in ${lead} min` : ''}`,
        at: trigger,
      });
    }
  }

  // Not limited to tasks due today — a 1-day-before lead needs tomorrow's
  // due tasks considered too, or it would never get a chance to schedule.
  // Still bounded (today/tomorrow only, not every future task) to match
  // this function's own "refreshed each time the app opens" design.
  for (const t of state.tasks || []) {
    if (t.done || !t.dueDate || !t.dueTime) continue;
    if (t.dueDate !== today && t.dueDate !== toISODate(addDays(today, 1))) continue;
    const due = taskDueAt(t);
    for (const lead of t.reminderOffsets || []) {
      const trigger = new Date(due.getTime() - lead * 60000);
      if (trigger.getTime() < now.getTime()) continue;
      upcoming.push({
        key: `task:${t.id}:${lead}:${toISODate(due)}`,
        title: t.title || 'Task due',
        body:
          lead >= 1440
            ? `Due ${formatShortDate(t.dueDate)} at ${formatTime(t.dueTime)}`
            : `Due at ${formatTime(t.dueTime)} · in ${lead} min`,
        at: trigger,
      });
    }
  }

  for (const m of state.milestones || []) {
    if (m.done || !m.targetDate || !(m.reminderDaysBefore || []).length) continue;
    for (const daysBefore of m.reminderDaysBefore) {
      const fireDate = toISODate(addDays(m.targetDate, -daysBefore));
      if (fireDate !== today) continue;
      if (MILESTONE_REMINDER_MIN < nowMin) continue;
      upcoming.push({
        key: `milestone:${m.id}:${daysBefore}:${today}`,
        title: 'Milestone reminder',
        body: daysBefore === 0 ? `${m.title} is due today` : `${m.title} due ${formatShortDate(m.targetDate)}`,
        at: MILESTONE_REMINDER_MIN,
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
          // Tasks push a real Date (their trigger may land tomorrow);
          // everything else still pushes a plain minutes-of-day number
          // meant for today, same as atMinuteToday always assumed.
          schedule: { at: u.at instanceof Date ? u.at : atMinuteToday(u.at) },
        })),
      });
    }
  } catch {
    /* best effort — scheduling failures shouldn't break the app */
  }
}
