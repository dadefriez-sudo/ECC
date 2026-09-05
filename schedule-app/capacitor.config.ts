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
  plugins: {
    SplashScreen: {
      // main.jsx hides this itself the instant the app has rendered — the
      // app has never had a splash of its own to hand off to, so there's
      // nothing worth waiting the plugin's own default ~3s timer out for.
      launchAutoHide: false,
      backgroundColor: '#111113',
    },
  },
};

export default config;
