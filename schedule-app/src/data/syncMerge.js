// Cloud sync merging.
//
// Sync used to send the whole app as one blob, last write wins, so editing on
// two devices could silently throw one device's changes away. This merges the
// two copies instead, item by item and field by field, using a third copy: the
// last version both sides were known to agree on (the "base").
//
//   base    the state at the last successful sync
//   local   what is on this device now
//   remote  what the server holds now
//
// For anything that only one side changed, that side wins. For a field both
// sides changed, the item's `_u` stamp (set by the store whenever an item is
// edited) decides, with a fixed tie-break so every device reaches the same
// answer. Lists of plain values (completed dates, tags) are combined rather
// than overwritten. An item deleted on one side but edited on the other is
// kept: losing an edit is worse than a delete that has to be repeated.
//
// Pure functions only, so they can be tested without a browser or a server.

// Settings that describe this device or this account, never taken from the
// cloud (see DEVICE_SETTINGS in store.jsx), plus a few that are per device.
export const LOCAL_ONLY_SETTINGS = [
  'phoneCalendarIds',
  'phoneCalendarDays',
  'canvasFeedUrl',
  'canvasLastSync',
  'canvasLastError',
  'backupPassphrase',
  'whatsNewSeen',
  'legalAccepted',
  'legalAcceptedAt',
  'tutorialSeen',
  'isPro',
  'isLifetime',
  'isBetaTester',
  'subscriptionStatus',
  'googleConnected',
  'mapLastView',
  'hapticsEnabled',
  'hapticsLevel',
  'emptyHomeMsgIndex',
  'timelineZoom',
];

const BIG_STRING = 2000;

// A small stable hash, for recognising a large string (a contact photo) in the
// stored base without keeping a second copy of it.
function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
const MARK = '\u0000big:';
const marker = (s) => `${MARK}${s.length}:${hashString(s)}`;
const isMarker = (s) => typeof s === 'string' && s.startsWith(MARK);

// A copy of `value` with large strings replaced by markers. This is what gets
// stored as the base, so the base stays small even with photos in contacts.
export function slim(value) {
  if (typeof value === 'string') return value.length > BIG_STRING ? marker(value) : value;
  if (Array.isArray(value)) return value.map(slim);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = slim(value[k]);
    return out;
  }
  return value;
}

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isPrim = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
const isPrimArray = (v) => Array.isArray(v) && v.every(isPrim);

// Deep equality that also treats a marker as equal to the string it stands for.
export function same(a, b) {
  if (a === b) return true;
  if (typeof a === 'string' && typeof b === 'string') {
    if (isMarker(a) && !isMarker(b)) return b.length > BIG_STRING && a === marker(b);
    if (isMarker(b) && !isMarker(a)) return a.length > BIG_STRING && b === marker(a);
    return false;
  }
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  }
  if (isPlain(a) && isPlain(b)) {
    // A key holding undefined is the same as no key: JSON drops it, so a state
    // read back from storage or the server would otherwise never match.
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => b[k] !== undefined && same(a[k], b[k]));
  }
  return false;
}

// Which side wins a field both changed. Newer `_u` wins; on a tie the larger
// JSON wins, which is arbitrary but the same on every device.
function preferFor(local, remote) {
  const lu = (isPlain(local) && local._u) || '';
  const ru = (isPlain(remote) && remote._u) || '';
  if (lu !== ru) return lu > ru ? 'local' : 'remote';
  return JSON.stringify(local) >= JSON.stringify(remote) ? 'local' : 'remote';
}

function mergeValue(base, local, remote, pref) {
  if (same(local, remote)) return local;
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;

  if (isPlain(local) && isPlain(remote)) {
    const b = isPlain(base) ? base : {};
    const out = {};
    for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const inL = k in local;
      const inR = k in remote;
      if (inL && inR) out[k] = mergeValue(b[k], local[k], remote[k], pref);
      else if (inL) {
        // The other side lacks it: it either deleted it or never had it.
        if (!(k in b) || !same(b[k], local[k])) out[k] = local[k];
      } else if (!(k in b) || !same(b[k], remote[k])) out[k] = remote[k];
    }
    return out;
  }

  if (isPrimArray(local) && isPrimArray(remote)) {
    const inBase = new Set(isPrimArray(base) ? base : []);
    const inLocal = new Set(local);
    const inRemote = new Set(remote);
    const out = [];
    for (const x of local) if (inRemote.has(x) || !inBase.has(x)) out.push(x);
    for (const x of remote) if (!inLocal.has(x) && !inBase.has(x)) out.push(x);
    return out;
  }

  return pref === 'local' ? local : remote;
}

const hasIds = (list) => Array.isArray(list) && list.every((x) => isPlain(x) && x.id !== undefined);

function mergeItem(base, local, remote) {
  const merged = mergeValue(base, local, remote, preferFor(local, remote));
  if (isPlain(merged)) {
    const lu = local._u || '';
    const ru = remote._u || '';
    const newest = lu > ru ? lu : ru;
    if (newest) merged._u = newest;
  }
  return merged;
}

function mergeCollection(base, local, remote) {
  const baseById = new Map((Array.isArray(base) ? base : []).map((x) => [x.id, x]));
  const localById = new Map(local.map((x) => [x.id, x]));
  const remoteById = new Map(remote.map((x) => [x.id, x]));
  const out = [];
  const seen = new Set();

  const take = (item) => {
    const l = localById.get(item.id);
    const r = remoteById.get(item.id);
    const b = baseById.get(item.id);
    if (l && r) return mergeItem(b, l, r);
    if (l) {
      // Gone from the server: deleted there, unless it was edited here.
      return b && same(b, l) ? null : l;
    }
    if (b && same(b, r)) return null; // deleted here, untouched there
    return r;
  };

  for (const item of [...local, ...remote]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const merged = take(item);
    if (merged) out.push(merged);
  }
  return out;
}

// Merges two whole app states. `base` may be null (a device that has never
// synced), in which case everything on either side is kept.
export function mergeStates(base, local, remote) {
  const b = base || {};
  const out = {};
  for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const l = local[key];
    const r = remote[key];
    if (l === undefined) out[key] = r;
    else if (r === undefined) out[key] = l;
    else if (hasIds(l) && hasIds(r)) out[key] = mergeCollection(b[key], l, r);
    else out[key] = mergeValue(b[key], l, r, 'remote');
  }
  // This device keeps its own values for anything that is not shared.
  if (isPlain(local.settings)) {
    const settings = { ...(out.settings || {}) };
    for (const k of LOCAL_ONLY_SETTINGS) {
      if (k in local.settings) settings[k] = local.settings[k];
      else delete settings[k];
    }
    out.settings = settings;
  }
  return out;
}

// Do two states hold the same data? Ignores the per-item stamps, so an edit
// that was only restamped does not count as a change.
export function sameState(a, b) {
  const strip = (v) => {
    if (Array.isArray(v)) return v.map(strip);
    if (isPlain(v)) {
      const o = {};
      for (const k of Object.keys(v)) if (k !== '_u') o[k] = strip(v[k]);
      return o;
    }
    return v;
  };
  return same(strip(a), strip(b));
}
