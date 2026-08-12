import type { CapacitorConfig } from '@capacitor/cli';

// appId is the bundle identifier / application ID registered with Apple and
// Google — it's permanent once a build is first submitted to either store,
// so 'com.keystone.app' below is a placeholder to confirm or replace with
// your real reverse-DNS identifier (e.g. com.yourcompany.keystone) before
// the first submission, not after. See appstore-assets/CAPACITOR.md.
const config: CapacitorConfig = {
  appId: 'com.keystone.app',
  appName: 'Keystone',
  webDir: 'dist',
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
