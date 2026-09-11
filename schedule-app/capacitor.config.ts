import type { CapacitorConfig } from '@capacitor/cli';

// appId is the bundle identifier / application ID registered with Apple and
// Google — permanent once a build is first submitted to either store. See
// appstore-assets/CAPACITOR.md.
const config: CapacitorConfig = {
  appId: 'com.keystoneplanner.app',
  appName: 'Keystone',
  webDir: 'dist',
  server: {
    // Clerk needs a top-level redirect through its own Frontend API domain
    // to sync a session inside a WebView (cookies aren't reliable there) —
    // without this, Capacitor's default WebViewClient treats that as
    // off-origin navigation and hands it to the device's system browser
    // instead of handling it in-app. The browser then can't do anything
    // with Clerk's return redirect to https://localhost/... (that's only
    // meaningful as Capacitor's own in-app origin), which is what produced
    // the "localhost refused to connect" error on sign-in. Covers a
    // development-instance publishable key (pk_test_...); a production
    // instance on a custom domain (see Clerk Dashboard once one's set up)
    // needs that domain added here too.
    allowNavigation: ['*.clerk.accounts.dev'],
  },
  // TEMPORARY, for debugging the Clerk sign-in issue via chrome://inspect:
  // Capacitor only enables WebView remote-debugging by default when the
  // app's own "debuggable" flag is set, which a properly signed release
  // build (required for Play Billing to recognize the app at all) never
  // has — so a release build never shows up in chrome://inspect without
  // this override. Remove once the sign-in issue is resolved; leaving
  // this on ships a small, real info-disclosure surface (anyone with the
  // device and a USB cable could inspect the running app) that a real
  // release doesn't want.
  android: {
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      // main.jsx hides this itself the instant the app has rendered — the
      // app has never had a splash of its own to hand off to, so there's
      // nothing worth waiting the plugin's own default ~3s timer out for.
      launchAutoHide: false,
      backgroundColor: '#111113',
    },
    LocalNotifications: {
      // Without this, the plugin falls back to Android's own generic "i"
      // info-dialog icon in the status bar (see
      // LocalNotificationManager.getDefaultSmallIcon in the plugin's
      // Android source) — this points it at the white silhouette in
      // android/app/src/main/res/drawable/ic_stat_keystone.xml instead.
      // iconColor tints the notification's icon background circle in the
      // notification shade (the status bar icon itself is always plain
      // white/monochrome per Android's own rules, regardless of this).
      smallIcon: 'ic_stat_keystone',
      iconColor: '#e0c15a',
    },
  },
};

export default config;
