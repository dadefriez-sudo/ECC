import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

// A thin native/web geolocation switch, so call sites read the same either
// way instead of branching on Capacitor.isNativePlatform() themselves.
// Native matters here beyond "it also works": background location for
// arrival reminders is something browsers restrict heavily (and mobile
// Safari drops a web geolocation watch entirely once the tab is
// backgrounded), while a native app can hold a real OS-level location
// permission that keeps working the way App.jsx's watch already assumes it
// does.
//
// Resolved positions have the same shape either way — `{ coords: {
// latitude, longitude, ... } }` — matching the web GeolocationPosition, so
// nothing reading `pos.coords.latitude` needs to know which path it came
// from.
const isNative = Capacitor.isNativePlatform();

export function geoAvailable() {
  return isNative || (typeof navigator !== 'undefined' && !!navigator.geolocation);
}

export function getCurrentPosition(options) {
  if (isNative) return Geolocation.getCurrentPosition(options);
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not available in this browser.'));
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

// Whether location is already granted, without prompting — for a silent
// "adopt the current location if we're already allowed to" check. The web
// path only works where the Permissions API supports the 'geolocation'
// name (not Safari); returns false rather than throwing where it doesn't,
// same as the caller's existing `.catch(() => {})` did.
export async function isLocationGranted() {
  if (isNative) {
    try {
      const status = await Geolocation.checkPermissions();
      return status.location === 'granted';
    } catch {
      return false;
    }
  }
  if (!navigator.permissions?.query) return false;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state === 'granted';
  } catch {
    return false;
  }
}

// Continuous updates, callback-style to match what a watch naturally is.
// Returns { clear() } so a caller doesn't need a separate native/web
// cleanup path — same reason getCurrentPosition returns a plain promise
// either way.
export function watchPosition(options, onPosition, onError = () => {}) {
  if (isNative) {
    let watchId = null;
    let cancelled = false;
    Geolocation.watchPosition(options, (position, err) => {
      if (err) return onError(err);
      if (position) onPosition(position);
    }).then((id) => {
      if (cancelled) Geolocation.clearWatch({ id }).catch(() => {});
      else watchId = id;
    });
    return {
      clear() {
        cancelled = true;
        if (watchId != null) Geolocation.clearWatch({ id: watchId }).catch(() => {});
      },
    };
  }
  if (!navigator.geolocation) return { clear() {} };
  const id = navigator.geolocation.watchPosition(onPosition, onError, options);
  return { clear: () => navigator.geolocation.clearWatch(id) };
}
