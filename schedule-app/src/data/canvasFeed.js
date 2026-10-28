// Canvas calendar feed: a student's due dates and class events on the Keystone
// calendar. Canvas gives every user a private calendar link (an .ics feed). We
// read it on the phone itself: the link is a secret (whoever holds it can read
// the calendar), so it is kept on the device and never sent to our server.
//
// Assignments arrive as zero-length events at their due time, in UTC. They are
// converted to the phone's local time and shown as 30-minute blocks.
export const CANVAS_COLOR = '#d9552b';
const DEFAULT_MINUTES = 30;
const KEEP_PAST_DAYS = 30; // older items aren't imported or removed

const pad = (n) => String(n).padStart(2, '0');

// Only an https calendar-feed link from a Canvas site is accepted.
export function validateFeedUrl(raw) {
  let u;
  try {
    // Calendar apps hand these links out as webcal://, which is the same link over https.
    u = new URL(String(raw || '').trim().replace(/^webcal:\/\//i, 'https://'));
  } catch {
    return { ok: false, error: "That doesn't look like a link." };
  }
  if (u.protocol !== 'https:') return { ok: false, error: 'The link must start with https://' };
  if (!/\/feeds\/calendars\//i.test(u.pathname)) {
    return { ok: false, error: 'Use the "Calendar Feed" link from the Calendar page in Canvas.' };
  }
  return { ok: true, url: u.toString() };
}

// --- iCalendar reading ------------------------------------------------------

function unescapeText(s = '') {
  return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\;/g, ';').replace(/\\\\/g, '\\');
}

// The offset (minutes east of UTC) a time zone has at a given instant.
function zoneOffsetMinutes(instantMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return Math.round((asUtc - instantMs) / 60000);
}

// Wall-clock fields in a named zone → the instant they mean.
function zonedInstant(y, mo, d, h, mi, timeZone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let instant = guess - zoneOffsetMinutes(guess, timeZone) * 60000;
  instant = guess - zoneOffsetMinutes(instant, timeZone) * 60000; // once more, across a DST edge
  return instant;
}

// "DTSTART;TZID=America/Denver:20261026T165900" → { date, time, allDay } in local time.
function readDate(params, value) {
  const m = String(value).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (h === undefined) return { date: `${y}-${mo}-${d}`, time: '', allDay: true };
  let instant;
  if (z) {
    instant = Date.UTC(+y, +mo - 1, +d, +h, +mi);
  } else {
    const tz = (params.match(/TZID=([^;:]+)/i) || [])[1];
    if (!tz) return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}`, allDay: false }; // floating: already local
    try {
      instant = zonedInstant(+y, +mo, +d, +h, +mi, tz);
    } catch {
      return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}`, allDay: false };
    }
  }
  const local = new Date(instant);
  return {
    date: `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`,
    time: `${pad(local.getHours())}:${pad(local.getMinutes())}`,
    allDay: false,
  };
}

const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMinutes = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

export function parseCanvasFeed(text) {
  const lines = String(text).replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r\n|\n/);
  const out = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === 'BEGIN:VEVENT') {
      cur = { uid: '', title: '', description: '', url: '', location: '', start: null, end: null, cancelled: false };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur && cur.start && !cur.cancelled) out.push(finish(cur));
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const semi = head.indexOf(';');
    const key = (semi === -1 ? head : head.slice(0, semi)).toUpperCase();
    const params = semi === -1 ? '' : head.slice(semi + 1);
    if (key === 'UID') cur.uid = value.trim();
    else if (key === 'SUMMARY') cur.title = unescapeText(value).replace(/\s+/g, ' ').trim();
    else if (key === 'DESCRIPTION') cur.description = unescapeText(value).trim();
    else if (key === 'LOCATION') cur.location = unescapeText(value).trim();
    else if (key === 'URL') cur.url = value.trim();
    else if (key === 'STATUS') cur.cancelled = /CANCELLED/i.test(value);
    else if (key === 'DTSTART') cur.start = readDate(params, value);
    else if (key === 'DTEND') cur.end = readDate(params, value);
  }
  return out;
}

function finish(c) {
  const { start, end } = c;
  const startTime = start.allDay ? '09:00' : start.time;
  let endTime;
  if (end && !end.allDay && end.date === start.date && toMinutes(end.time) > toMinutes(startTime)) {
    endTime = end.time;
  } else {
    // The block starts at the due time. Near midnight it is cut short at 23:59 rather
    // than moved earlier, so a 11:59 PM deadline still shows as 11:59 PM.
    endTime = fromMinutes(Math.min(toMinutes(startTime) + DEFAULT_MINUTES, 23 * 60 + 59));
  }
  const notes = [c.description, c.url && !c.description.includes(c.url) ? c.url : ''].filter(Boolean).join('\n\n');
  const uid = c.uid || `${c.title}|${start.date}|${startTime}`;
  return { uid, title: c.title || 'Canvas item', date: start.date, start: startTime, end: endTime, location: c.location, notes };
}

// --- Merging into the calendar ----------------------------------------------

const FIELDS = ['title', 'date', 'start', 'end', 'location', 'notes'];
export const externalIdFor = (uid) => `canvas:${uid}`;

// What to add, change and remove so the Canvas-sourced events match the feed.
// Anything the person did to an event themselves (marking it done, adding a
// reminder) is kept; only the fields Canvas owns are refreshed.
export function planCanvasSync(existingEvents, parsed, todayISO) {
  const cutoff = (() => {
    const d = new Date(`${todayISO}T12:00:00`);
    d.setDate(d.getDate() - KEEP_PAST_DAYS);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const mine = existingEvents.filter((e) => e.source === 'canvas');
  const byExt = new Map(mine.map((e) => [e.externalId, e]));
  const wanted = parsed.filter((p) => p.date >= cutoff);
  const seen = new Set();
  const add = [];
  const update = [];
  for (const p of wanted) {
    const ext = externalIdFor(p.uid);
    seen.add(ext);
    const cur = byExt.get(ext);
    if (!cur) add.push({ ...Object.fromEntries(FIELDS.map((k) => [k, p[k] || ''])), source: 'canvas', externalId: ext, color: CANVAS_COLOR });
    else if (FIELDS.some((k) => (cur[k] || '') !== (p[k] || ''))) {
      update.push({ ...cur, ...Object.fromEntries(FIELDS.map((k) => [k, p[k] || ''])) });
    }
  }
  // An empty feed is far more likely a bad response than a cleared semester, so
  // nothing is removed on it.
  const remove = parsed.length === 0 ? [] : mine.filter((e) => e.date >= cutoff && !seen.has(e.externalId)).map((e) => e.id);
  return { add, update, remove };
}
