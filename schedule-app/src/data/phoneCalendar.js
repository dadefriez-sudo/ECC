// Events from the phone's own calendar app (Google, Samsung, Outlook... whatever
// is set up on the phone), read once when the person asks. Recurring events
// arrive already expanded, one entry per occurrence, and each becomes an
// ordinary single event in Keystone. Importing again updates what is already
// there instead of adding it twice.
const pad = (n) => String(n).padStart(2, '0');
const DEFAULT_MINUTES = 60;
const FIELDS = ['title', 'date', 'start', 'end', 'location', 'notes'];

export const externalIdFor = (e) => `phone:${e.eventId}:${e.begin}`;

// A Calendars.CALENDAR_COLOR integer (ARGB) as #rrggbb.
export function colorFromInt(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  return `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
}

const ymd = (d, utc) =>
  utc
    ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMins = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

export function normalizePhoneEvents(raw, colorByCalendar = {}) {
  const out = [];
  for (const e of Array.isArray(raw) ? raw : []) {
    if (!e || typeof e.begin !== 'number') continue;
    const begin = new Date(e.begin);
    const endMs = typeof e.end === 'number' && e.end > e.begin ? e.end : e.begin + DEFAULT_MINUTES * 60000;
    let date;
    let start;
    let end;
    if (e.allDay) {
      // All-day events are stored as UTC midnights, so the date is read in UTC. Keystone
      // events have a time, so they sit at a morning slot and say so in the notes.
      date = ymd(begin, true);
      start = '09:00';
      end = '09:30';
    } else {
      date = ymd(begin, false);
      start = hm(begin);
      const endDate = new Date(endMs);
      // One that runs past midnight is cut off at the end of its first day.
      end = ymd(endDate, false) === date ? hm(endDate) : '23:59';
      if (mins(end) <= mins(start)) end = fromMins(Math.min(mins(start) + 30, 23 * 60 + 59));
      if (mins(end) <= mins(start)) start = fromMins(23 * 60 + 29);
    }
    const description = String(e.description || '').trim();
    out.push({
      externalId: externalIdFor(e),
      title: String(e.title || '').trim() || 'Untitled',
      date,
      start,
      end,
      location: String(e.location || '').trim(),
      notes: [e.allDay ? 'All day' : '', description].filter(Boolean).join('\n\n'),
      color: colorByCalendar[e.calendarId] || '',
    });
  }
  return out;
}

// What to add and what to refresh. Nothing is ever removed, and the person's own
// marks (done, reminders) are kept on events that already exist.
export function planPhoneCalendarImport(existingEvents, incoming) {
  const byExt = new Map(existingEvents.filter((e) => e.source === 'phone').map((e) => [e.externalId, e]));
  const add = [];
  const update = [];
  for (const p of incoming) {
    const cur = byExt.get(p.externalId);
    const fields = Object.fromEntries(FIELDS.map((k) => [k, p[k] || '']));
    if (!cur) add.push({ ...fields, source: 'phone', externalId: p.externalId, ...(p.color ? { color: p.color } : {}) });
    else if (FIELDS.some((k) => (cur[k] || '') !== (p[k] || ''))) update.push({ ...cur, ...fields });
  }
  return { add, update };
}
