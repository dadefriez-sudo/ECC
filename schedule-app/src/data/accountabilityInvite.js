// Invite text and parsing for accountability partners.
//
// A real invite link can't be opened from the Android app (inside the app the
// web address is https://localhost), so the invite is *text*: a short message the
// person can send however they like, containing a code to paste into the app and
// a link as a convenience for anyone on the web.
const PUBLIC_BASE = (import.meta.env.VITE_PUBLIC_URL || 'https://keystonedailyplanner.com').replace(/\/+$/, '');

export const inviteLink = (token) => `${PUBLIC_BASE}/#/accountability/join/${token}`;

export function inviteMessage(token) {
  return [
    "Let's keep each other accountable on Keystone.",
    '',
    '1. Install Keystone (free on Android).',
    '2. Open More, then Accountability partners, then "Join with a code".',
    `3. Paste this code: ${token}`,
    '',
    `Or open: ${inviteLink(token)}`,
  ].join('\n');
}

// Pulls an invite token out of whatever got pasted: the whole message, a full
// link, or just the code.
export function extractInviteToken(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const fromLink = s.match(/accountability\/join\/([A-Za-z0-9_-]{16,64})/);
  if (fromLink) return fromLink[1];
  const fromLine = s.match(/code:\s*([A-Za-z0-9_-]{16,64})/i);
  if (fromLine) return fromLine[1];
  return /^[A-Za-z0-9_-]{16,64}$/.test(s) ? s : null;
}

// "2 hours ago", "yesterday", "Oct 21".
export function timeAgo(iso, now = new Date()) {
  if (!iso) return '';
  const t = new Date(iso);
  const mins = Math.round((now - t) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const STALE_AFTER_MS = 30 * 60 * 60 * 1000;
export const isStale = (iso, now = new Date()) => !!iso && now - new Date(iso) > STALE_AFTER_MS;
