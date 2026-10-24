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

// Three levels:
//   off        nothing.
//   essential  (the default, shown as "Subtle") a small vocabulary used with
//              restraint, one feel per kind of moment:
//                pick     the lightest tick, for a deliberate choice: a tab,
//                         a segmented control, a switch
//                confirm  a soft tap when something is saved or checked off
//                success  the one fuller pulse, for finishing a task or goal
//                warn     a double pulse for deleting or discarding
//              Nothing fires for routine taps, scrolling, or drag steps.
//   full       the original behavior: a tick for nearly every tap and drag
//              step, with firmer confirms.
let level = 'essential';
export function setHapticsLevel(v) {
  level = v === 'off' || v === 'full' ? v : 'essential';
}
export function getHapticsLevel() {
  return level;
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
// In essential mode a plain confirm also waits this long after any other
// tick, so one action never buzzes twice (a check-off plus its toast, say).
const ESSENTIAL_CONFIRM_GAP_MS = 400;
let lastTickAt = 0;

function throttled(gap = MIN_INTERVAL_MS) {
  const now = performance.now();
  if (now - lastTickAt < gap) return false;
  lastTickAt = now;
  return true;
}

// Light tick for routine taps: buttons, tabs, chips, dropdown choices.
export function tapTick() {
  if (level !== 'full' || !throttled()) return;
  if (isNative) return fireNative(() => Haptics.impact({ style: ImpactStyle.Light }));
  fireWeb(8);
}

// Slightly firmer pulse for a committed action: save, add, toggle on.
export function confirmTick() {
  if (level === 'off' || !throttled(level === 'full' ? MIN_INTERVAL_MS : ESSENTIAL_CONFIRM_GAP_MS)) return;
  // Subtle uses a light impact, so a save or check-off is a soft tap rather
  // than a thump; only Full keeps the firmer medium one.
  if (isNative) {
    return fireNative(() => Haptics.impact({ style: level === 'full' ? ImpactStyle.Medium : ImpactStyle.Light }));
  }
  fireWeb(level === 'full' ? 14 : 10);
}

// Two-pulse pattern for a destructive action: delete, discard.
export function warnTick() {
  if (level === 'off' || !throttled()) return;
  if (isNative) return fireNative(() => Haptics.notification({ type: NotificationType.Warning }));
  fireWeb([12, 40, 12]);
}

// Very light tick for continuous feedback: stepper +/-, drag snapping to a
// new slot, typing (used sparingly — see input helpers). Maps to the
// plugin's selectionChanged(), built for exactly this continuous-feedback
// case (the same call a native picker wheel would use per tick) rather than
// the one-shot impact() used above.
export function selectTick() {
  if (level !== 'full' || !throttled()) return;
  if (isNative) return fireNative(() => Haptics.selectionChanged());
  fireWeb(5);
}

// The lightest tick, for a deliberate choice that changes what you see: a
// tab, a segmented control, a switch. Unlike selectTick (continuous drag
// stepping, Full only) this is allowed in Subtle, and only ever once per tap.
export function pickTick() {
  if (level === 'off' || !throttled(level === 'full' ? MIN_INTERVAL_MS : 120)) return;
  if (isNative) return fireNative(() => Haptics.selectionChanged());
  fireWeb(5);
}

// A brighter double-pulse for the moment something gets genuinely completed
// (a task checked off, a goal target reached) — distinct from confirmTick's
// single pulse so a real accomplishment reads differently from a routine
// save/toggle, pairing with the checkmark bounce + spark animation.
export function successTick() {
  if (level === 'off' || !throttled()) return;
  if (isNative) return fireNative(() => Haptics.notification({ type: NotificationType.Success }));
  fireWeb([10, 30, 18]);
}
