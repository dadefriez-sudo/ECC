import type { CapacitorConfig } from '@capacitor/cli';

// appId is the bundle identifier / application ID registered with Apple and
// Google — permanent once a build is first submitted to either store. See
// appstore-assets/CAPACITOR.md.
const config: CapacitorConfig = {
  appId: 'com.keystoneplanner.app',
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
