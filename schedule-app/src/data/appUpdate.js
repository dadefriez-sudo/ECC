import { Capacitor } from '@capacitor/core';
import { AppUpdate, AppUpdateAvailability, FlexibleUpdateInstallStatus } from '@capawesome/capacitor-app-update';

// Play Store's own in-app update API — Android only (iOS has no equivalent
// "force an update" mechanism, see openPlayStoreListing() below for the
// fallback that works everywhere).
const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export function updateCheckSupported() {
  return isAndroidNative;
}

// Starts a "flexible" update (downloads in the background, app stays fully
// usable) if one's available, then calls onReady() once it's actually
// finished downloading so the caller can prompt a restart via
// completeUpdate(). Safe to call on every launch — a no-op if nothing's
// available or Play services/network aren't reachable right now.
//
// Also covers the case where a download from a previous session finished
// but was never applied (the app got killed before the user restarted it):
// getAppUpdateInfo() still reports DOWNLOADED then, so onReady() fires
// immediately instead of that finished download going unnoticed.
export async function checkForUpdate(onReady) {
  if (!isAndroidNative) return;
  try {
    const info = await AppUpdate.getAppUpdateInfo();
    if (info.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
      onReady?.();
      return;
    }
    if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE || !info.flexibleUpdateAllowed) return;
    await AppUpdate.startFlexibleUpdate();
    // Left attached for the rest of the app session rather than torn down —
    // a flexible download can take a while, and this is the one thing
    // listening for it to finish.
    AppUpdate.addListener('onFlexibleUpdateStateChange', (state) => {
      if (state.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) onReady?.();
    });
  } catch {
    /* no network, update check failed, etc. — just skip silently */
  }
}

export function completeUpdate() {
  if (!isAndroidNative) return;
  AppUpdate.completeFlexibleUpdate().catch(() => {});
}

// Manual fallback for a "Check for updates" button and for anywhere the
// automatic flow above doesn't apply — opens this app's own Play Store
// listing directly (not a search result), same destination as tapping it in
// Play Store's own Updates tab.
export function openPlayStoreListing() {
  if (Capacitor.isNativePlatform()) {
    AppUpdate.openAppStore().catch(() => {
      window.open('https://play.google.com/store/apps/details?id=com.keystoneplanner.app', '_blank');
    });
  } else {
    window.open('https://play.google.com/store/apps/details?id=com.keystoneplanner.app', '_blank');
  }
}
