import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { parseCanvasFeed, planCanvasSync, validateFeedUrl } from './canvasFeed.js';
import { todayISO } from './helpers.js';

const MIN_INTERVAL_MS = 3 * 60 * 60 * 1000; // automatic refresh at most every three hours

// On the phone the request goes out natively, so a school's server doesn't need
// to allow our page to read it. In a browser it's an ordinary fetch, which many
// Canvas sites block; the message says so rather than failing silently.
async function fetchFeed(url) {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, headers: { Accept: 'text/calendar' }, responseType: 'text' });
    if (res.status < 200 || res.status >= 300) throw new Error(`Canvas answered with an error (${res.status}). Check the link is current.`);
    return typeof res.data === 'string' ? res.data : String(res.data ?? '');
  }
  let res;
  try {
    res = await fetch(url, { headers: { Accept: 'text/calendar' } });
  } catch {
    throw new Error("A browser can't read Canvas directly. Use the Keystone app on your phone to sync.");
  }
  if (!res.ok) throw new Error(`Canvas answered with an error (${res.status}). Check the link is current.`);
  return res.text();
}

// Pulls the feed and brings the Canvas events on the calendar in line with it.
// Returns { added, updated, removed }. Throws a readable Error on failure.
export async function syncCanvas(state, actions) {
  const checked = validateFeedUrl(state.settings?.canvasFeedUrl);
  if (!checked.ok) throw new Error(checked.error);
  const text = await fetchFeed(checked.url);
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("That link didn't return a Canvas calendar. Copy the Calendar Feed link again.");
  const plan = planCanvasSync(state.events || [], parseCanvasFeed(text), todayISO());
  for (const ev of plan.add) actions.addEvent(ev);
  for (const ev of plan.update) actions.updateEvent(ev);
  for (const id of plan.remove) actions.deleteEvent(id);
  return { added: plan.add.length, updated: plan.update.length, removed: plan.remove.length };
}

// Called on app start and when the app comes back to the foreground. A no-op
// without a link, or if it already ran recently.
export async function maybeAutoSyncCanvas(state, actions) {
  const s = state.settings || {};
  if (!s.canvasFeedUrl) return;
  const last = s.canvasLastSync ? new Date(s.canvasLastSync).getTime() : 0;
  if (Date.now() - last < MIN_INTERVAL_MS) return;
  try {
    await syncCanvas(state, actions);
    actions.setSettings({ canvasLastSync: new Date().toISOString(), canvasLastError: '' });
  } catch (err) {
    // Quiet by design: shown under the setting, not as an alert nobody asked for.
    actions.setSettings({ canvasLastError: err.message || 'Could not sync Canvas.' });
  }
}
