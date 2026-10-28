import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { parseCanvasFeed, planCanvasSync, validateFeedUrl, assignCourseColors } from './canvasFeed.js';
import { todayISO } from './helpers.js';

const MIN_INTERVAL_MS = 60 * 60 * 1000; // automatic refresh at most hourly

// What to tell someone when Canvas turns the link down. Both mean Canvas itself
// answered, so the request got through and the link is the problem.
function statusMessage(status) {
  if (status === 404 || status === 403 || status === 401) {
    return `Canvas didn't accept that link (${status}). It may be cut off, out of date, or not the Calendar Feed link. In Canvas, open Calendar, choose Calendar Feed, copy the whole link again and paste it here.`;
  }
  return `Canvas answered with an error (${status}). Try again in a little while.`;
}

// On the phone the request goes out natively, so a school's server doesn't need
// to allow our page to read it. In a browser it's an ordinary fetch, which many
// Canvas sites block; the message says so rather than failing silently.
async function fetchFeed(url) {
  if (Capacitor.isNativePlatform()) {
    let res;
    try {
      // No Accept header: some Canvas sites answer an unusual one with an error page.
      res = await CapacitorHttp.get({ url, responseType: 'text' });
    } catch (err) {
      throw new Error(`Couldn't reach Canvas (${err?.message || 'network error'}). Check your connection and try again.`);
    }
    if (res.status < 200 || res.status >= 300) throw new Error(statusMessage(res.status));
    // A calendar can come back already parsed into an object; fall back to its text.
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
  }
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("A browser can't read Canvas directly. Use the Keystone app on your phone to sync.");
  }
  if (!res.ok) throw new Error(statusMessage(res.status));
  return res.text();
}

// Pulls the feed and brings the Canvas events on the calendar in line with it.
// Returns { added, updated, removed }. Throws a readable Error on failure.
export async function syncCanvas(state, actions) {
  if (!state.settings?.isPro) throw new Error('Canvas calendar is a Pro feature.');
  const checked = validateFeedUrl(state.settings?.canvasFeedUrl);
  if (!checked.ok) throw new Error(checked.error);
  const text = await fetchFeed(checked.url);
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    const peek = String(text).replace(/\s+/g, ' ').trim().slice(0, 80);
    throw new Error(`That link didn't return a calendar${peek ? ` (it returned: "${peek}")` : ''}. Copy the Calendar Feed link again, or use Import calendar (.ics) with the downloaded file.`);
  }
  const parsed = parseCanvasFeed(text);
  const known = state.settings?.canvasCourseColors || {};
  const courseColors = assignCourseColors(known, parsed.map((p) => p.course));
  if (courseColors !== known) actions.setSettings({ canvasCourseColors: courseColors });
  const plan = planCanvasSync(state.events || [], parsed, todayISO(), courseColors);
  for (const ev of plan.add) actions.addEvent(ev);
  for (const ev of plan.update) actions.updateEvent(ev);
  for (const id of plan.remove) actions.deleteEvent(id);
  return { added: plan.add.length, updated: plan.update.length, removed: plan.remove.length };
}

// Called on app start and when the app comes back to the foreground. A no-op
// without a link or Pro, or if it already ran recently. Resolves to
// { added, updated, removed, first } when it ran, so the caller can tell the
// person about new deadlines (first is true on the very first sync).
export async function maybeAutoSyncCanvas(state, actions) {
  const s = state.settings || {};
  if (!s.canvasFeedUrl || !s.isPro) return null;
  const last = s.canvasLastSync ? new Date(s.canvasLastSync).getTime() : 0;
  if (Date.now() - last < MIN_INTERVAL_MS) return null;
  try {
    const result = await syncCanvas(state, actions);
    actions.setSettings({ canvasLastSync: new Date().toISOString(), canvasLastError: '' });
    return { ...result, first: !last };
  } catch (err) {
    // Quiet by design: shown under the setting, not as an alert nobody asked for.
    actions.setSettings({ canvasLastError: err.message || 'Could not sync Canvas.' });
    return null;
  }
}

// A new colour for one class: remembered for future syncs and applied to the
// class's events already on the calendar.
export function recolorCanvasCourse(state, actions, course, color) {
  actions.setSettings({ canvasCourseColors: { ...(state.settings?.canvasCourseColors || {}), [course]: color } });
  for (const e of state.events || []) {
    if (e.source === 'canvas' && e.canvasCourse === course && e.color !== color) actions.updateEvent({ ...e, color });
  }
}
