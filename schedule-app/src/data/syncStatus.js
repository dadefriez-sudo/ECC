import { useEffect, useState } from 'react';

// A tiny broadcast channel for what the sync is doing.
//
// The sync itself lives in App.jsx (it has to, to see every state change),
// but the thing that reports on it lives in Settings. Routing that through
// the app's own data store would mean every "syncing…" tick was a state
// change, which would in turn schedule another push — a sync that syncs
// because it synced. So this is kept deliberately outside the store.
let current = { phase: 'idle', at: null, error: null };
const listeners = new Set();

export function setSyncStatus(next) {
  current = { ...current, ...next };
  for (const fn of listeners) fn(current);
}

// Settings' "Sync now" button asks for a round; whichever component runs the sync listens.
let requestHandler = null;
export function onSyncRequest(fn) {
  requestHandler = fn;
  return () => {
    if (requestHandler === fn) requestHandler = null;
  };
}
export function requestSync() {
  if (!requestHandler) return false;
  requestHandler();
  return true;
}

export function useSyncStatus() {
  const [status, setStatus] = useState(current);
  useEffect(() => {
    listeners.add(setStatus);
    setStatus(current);
    return () => listeners.delete(setStatus);
  }, []);
  return status;
}

// "3 minutes ago" — relative, because the only thing anyone wants from a
// sync timestamp is reassurance that it was recent.
export function describeSyncedAt(at, now = Date.now()) {
  if (!at) return 'not yet';
  const secs = Math.max(0, Math.round((now - at) / 1000));
  if (secs < 15) return 'just now';
  if (secs < 90) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// What cloud sync is waiting on, in the order a person would fix it, and the line to show about
// the last round. Plain data in, plain data out, so it can be tested.
export function syncReadiness({ isSignedIn, email, isPro, serverConfigured, cloudSyncOn }, status, now = Date.now()) {
  const items = [
    { key: 'account', ok: !!isSignedIn, text: isSignedIn ? `Signed in${email ? ` as ${email}` : ''}` : 'Not signed in' },
    { key: 'pro', ok: !!isPro, text: isPro ? 'Pro is active' : 'Cloud sync needs Pro' },
    { key: 'server', ok: !!serverConfigured, text: serverConfigured ? 'Server connected' : "This build isn't linked to a server" },
    { key: 'switch', ok: !!cloudSyncOn, text: cloudSyncOn ? 'Sync is on' : 'Sync is off (use the switch above)' },
  ];
  const ready = items.every((i) => i.ok);
  let line;
  if (!ready) line = 'Not syncing yet. Fix the items marked above.';
  else if (status?.phase === 'syncing') line = 'Syncing…';
  else if (status?.phase === 'error') {
    line = `The last attempt failed: ${status.error || 'could not reach the server'}. Changes are kept on this phone and will retry.`;
  } else line = `Last synced ${describeSyncedAt(status?.at, now)}`;
  return { items, ready, line };
}
