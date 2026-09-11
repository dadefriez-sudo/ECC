import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import App from './App.jsx';
import { StoreProvider } from './data/store.jsx';
import { ToastProvider } from './data/toast.jsx';
import { CLERK_ENABLED } from './data/clerkConfig.js';
import './styles.css';

// Accounts are optional for local use — the planner itself works fully
// offline without signing in. Only render ClerkProvider when a key is
// actually configured, so the app keeps working before/without that setup.
const Root = ({ children }) =>
  CLERK_ENABLED ? (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>{children}</ClerkProvider>
  ) : (
    children
  );

// Clerk's session-sync handshake (needed because cookies aren't reliable in
// a WebView) lands back here as a real top-level navigation to
// /?__clerk_handshake=... — but on native, Clerk's client-side SDK
// consistently gets stuck mid-initialization on that exact load (isLoaded
// never resolves), even though the handshake itself succeeded server-side
// (confirmed via Clerk's own API: a retried sign-in correctly comes back
// "Session already exists" / "You're already signed in" — the session is
// real, the running app just never finds out). A manual app restart always
// picks the already-valid session up cleanly, so this forces that same
// "fresh load" once, automatically, instead of making testers close and
// reopen the app by hand. Guarded by sessionStorage so it only fires once
// per handshake, not in a loop if the second load still carries the param.
// Temporary: records what the page's full URL looked like on every boot of
// this script (a real cold start, or one of the reloads below), so it can
// be inspected later from the debug line on More -> Account — checking
// location.href live in the console only shows whatever it's changed to
// *since*, which by the time anyone gets to a console is already well past
// the moment right after Clerk's redirect, after the app has navigated
// around further. Keeps the last 5 boots. Remove once the stuck-isLoaded
// issue is resolved.
// localStorage, not sessionStorage — a force-closed app clears
// sessionStorage along with it, which would erase the very entry (the boot
// right after Clerk's redirect) checking the log later is meant to show.
try {
  const log = JSON.parse(localStorage.getItem('bootUrlLog') || '[]');
  log.push(`${new Date().toISOString().slice(11, 19)} ${window.location.href}`);
  localStorage.setItem('bootUrlLog', JSON.stringify(log.slice(-5)));
} catch {
  /* ignore — debug aid only */
}

const justHandshaked = window.location.search.includes('__clerk_handshake');
if (Capacitor.isNativePlatform() && justHandshaked && !sessionStorage.getItem('clerkHandshakeReloaded')) {
  sessionStorage.setItem('clerkHandshakeReloaded', '1');
  window.location.reload();
} else {
  if (!justHandshaked) sessionStorage.removeItem('clerkHandshakeReloaded');

  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Root>
        <HashRouter>
          <StoreProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </StoreProvider>
        </HashRouter>
      </Root>
    </React.StrictMode>
  );
}

// The app has deliberately never had a launch splash of its own (see the
// comment in App.jsx) — the native shell's splash screen (shown instantly by
// the OS before any web content can paint) should hand off the moment
// there's something to show, not linger for its own default duration.
// autoHide is off in capacitor.config.ts so this is the only thing hiding it.
if (Capacitor.isNativePlatform()) {
  SplashScreen.hide().catch(() => {});
}

// Register the service worker for offline support (production only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is a progressive enhancement — ignore failures */
    });
  });
}
