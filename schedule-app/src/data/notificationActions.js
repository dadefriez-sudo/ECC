// Buttons on reminder notifications: Mark done, Log +1, Snooze. Native only;
// the action itself runs here, in the app, when the button is tapped.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { todayISO, nextTaskDueDate, goalKey } from './helpers.js';

export const ACTION_TYPE = { task: 'KS_TASK', event: 'KS_EVENT', goal: 'KS_GOAL', followUp: 'KS_FOLLOWUP' };
import { closeFollowUp } from './eventFollowUp.js';

const SNOOZE_MIN = { task: 60, goal: 60, event: 10 };

export async function registerNotificationActions() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: ACTION_TYPE.task,
          actions: [
            { id: 'done', title: 'Mark done' },
            { id: 'snooze', title: 'Snooze 1 hr' },
          ],
        },
        { id: ACTION_TYPE.event, actions: [{ id: 'snooze', title: 'Snooze 10 min' }] },
        {
          id: ACTION_TYPE.followUp,
          actions: [
            { id: 'done', title: 'Mark done' },
            { id: 'note', title: 'Add a note' },
          ],
        },
        {
          id: ACTION_TYPE.goal,
          actions: [
            { id: 'log', title: 'Log +1' },
            { id: 'snooze', title: 'Snooze 1 hr' },
          ],
        },
      ],
    });
  } catch {
    /* buttons are an enhancement; the notification still works without them */
  }
}

function idFromKey(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

// Re-posts the same notification a little later.
async function snooze(notification, kind) {
  const minutes = SNOOZE_MIN[kind] || 30;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: idFromKey(`snooze:${notification.id}:${Date.now()}`),
          title: notification.title,
          body: notification.body,
          actionTypeId: ACTION_TYPE[kind],
          extra: notification.extra,
          schedule: { at: new Date(Date.now() + minutes * 60000), allowWhileIdle: true },
        },
      ],
    });
  } catch {
    /* best effort */
  }
}

// Does what a button asks. `ctx` carries the live state and the store actions
// so this module needs no React. Returns a short label of what happened, for
// tests and logging.
export function applyNotificationAction(event, ctx) {
  const { actionId, notification } = event || {};
  const extra = notification?.extra || {};
  const { state, actions, navigate } = ctx;

  if (extra.kind === 'followUp') {
    const ev = (state.events || []).find((x) => x.id === extra.id);
    if (!ev) return 'none';
    if (actionId === 'done') {
      actions.updateEvent(closeFollowUp(ev, { recDate: extra.date }, { markDone: true }));
      return 'done';
    }
    // A tap on the notification or "Add a note" opens the check-in on Home.
    if ((actionId === 'tap' || actionId === 'note') && navigate) {
      navigate('/', { state: { followUp: { id: extra.id, date: extra.date } } });
      return 'opened';
    }
    return 'none';
  }
  if (actionId === 'tap') {
    if (extra.route && navigate) navigate(extra.route);
    return extra.route ? 'opened' : 'none';
  }
  if (actionId === 'snooze') {
    snooze(notification, extra.kind);
    return 'snoozed';
  }
  if (actionId === 'done' && extra.kind === 'task') {
    const t = (state.tasks || []).find((x) => x.id === extra.id);
    if (!t || t.done) return 'none';
    const completedDates = [...(t.completedDates || []), todayISO()];
    if (t.repeat && t.repeat !== 'none' && t.dueDate) {
      // Same rule as ticking it off in the app: roll forward, stay open.
      actions.updateTask({ ...t, done: false, dueDate: nextTaskDueDate(t.dueDate, t.repeat), completedDates });
    } else {
      actions.updateTask({ ...t, done: true, completedDates });
    }
    return 'done';
  }
  if (actionId === 'log' && extra.kind === 'goal') {
    const g = (state.goals || []).find((x) => x.id === extra.id);
    if (!g) return 'none';
    const key = goalKey(g.period || 'weekly', new Date());
    actions.setGoalProgress(g.id, key, (g.progress?.[key] || 0) + 1);
    return 'logged';
  }
  return 'none';
}

// Subscribes to taps and buttons. Returns a cleanup function.
export function listenForNotificationActions(getCtx) {
  if (!Capacitor.isNativePlatform()) return () => {};
  let handle = null;
  let cancelled = false;
  LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    applyNotificationAction(event, getCtx());
  })
    .then((h) => {
      if (cancelled) h.remove();
      else handle = h;
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    handle?.remove();
  };
}
