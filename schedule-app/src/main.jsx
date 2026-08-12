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
