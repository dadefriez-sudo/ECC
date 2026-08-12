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
};

export default config;
