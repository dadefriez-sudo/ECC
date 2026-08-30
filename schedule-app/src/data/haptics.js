import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Best-effort haptic feedback, native first, Vibration API as the web
// fallback. iOS Safari doesn't expose navigator.vibrate at all (Apple only
// allows haptics through native app frameworks), so on the web this has
// always silently no-opped on iPhones — running inside the Capacitor shell
// is what actually fixes that, since Haptics.impact()/.notification() there
// go through UIFeedbackGenerator rather than a web API iOS never shipped.
const isNative = Capacitor.isNativePlatform();
const webSupported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

let enabled = true;
export function setHapticsEnabled(v) {
  enabled = !!v;
}

function fireWeb(pattern) {
  if (!webSupported) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore — haptics are a nice-to-have */
  }
}

// Fire-and-forget: haptics are enhancement, never something a caller should
// have to await or handle a rejection for.
function fireNative(call) {
  call().catch(() => {});
}

// Shared across every tick below, not per-function: Android's vibrator
// cancels and restarts on every new vibrate() call rather than queuing
// them, so any two haptic calls closer together than the motor's own
// physical settle time leave it perpetually interrupted mid-pulse — nothing
// gets felt for either, confirmed against a real device (no error, no
// missing promise resolution, the API calls succeed and resolve cleanly,
// the motor just never completes a pulse). This bites hardest on
// selectTick's continuous-feedback use (drag snapping can cross several
// increments within a fraction of a second) but a discrete tick landing
// right after one of those inherits the same interrupted state, so the
// gate has to cover all of them against one shared clock, not just
// selectTick against its own history. 60ms is comfortably past a typical
// short haptic click's own duration.
const MIN_INTERVAL_MS = 60;
let lastTickAt = 0;

function throttled() {
  const now = performance.now();
  if (now - lastTickAt < MIN_INTERVAL_MS) return false;
  lastTickAt = now;
  return true;
}

// Light tick for routine taps: buttons, tabs, chips, dropdown choices.
export function tapTick() {
  if (!enabled || !throttled()) return;
  if (isNative) return fireNative(() => Haptics.impact({ style: ImpactStyle.Light }));
  fireWeb(8);
}

// Slightly firmer pulse for a committed action: save, add, toggle on.
export function confirmTick() {
  if (!enabled || !throttled()) return;
  if (isNative) return fireNative(() => Haptics.impact({ style: ImpactStyle.Medium }));
  fireWeb(14);
}

// Two-pulse pattern for a destructive action: delete, discard.
export function warnTick() {
  if (!enabled || !throttled()) return;
  if (isNative) return fireNative(() => Haptics.notification({ type: NotificationType.Warning }));
  fireWeb([12, 40, 12]);
}

// Very light tick for continuous feedback: stepper +/-, drag snapping to a
// new slot, typing (used sparingly — see input helpers). Maps to the
// plugin's selectionChanged(), built for exactly this continuous-feedback
// case (the same call a native picker wheel would use per tick) rather than
// the one-shot impact() used above.
export function selectTick() {
  if (!enabled || !throttled()) return;
  if (isNative) return fireNative(() => Haptics.selectionChanged());
  fireWeb(5);
}

// A brighter double-pulse for the moment something gets genuinely completed
// (a task checked off, a goal target reached) — distinct from confirmTick's
// single pulse so a real accomplishment reads differently from a routine
// save/toggle, pairing with the checkmark bounce + spark animation.
export function successTick() {
  if (!enabled || !throttled()) return;
  if (isNative) return fireNative(() => Haptics.notification({ type: NotificationType.Success }));
  fireWeb([10, 30, 18]);
}
