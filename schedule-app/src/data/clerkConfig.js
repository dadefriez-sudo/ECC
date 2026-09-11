// Whether Clerk (and therefore real accounts/billing) is configured in this
// build. Components that call Clerk hooks must only mount when this is
// true — main.jsx only renders <ClerkProvider> under the same condition, so
// unconditionally calling useAuth()/useUser() would throw otherwise.
export const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// TEMPORARY, for the stuck-post-sign-in bug on native: on-device debugging
// (chrome://inspect) confirmed the actual sign-in sequence Clerk runs
// (sign_ins -> prepare_first_factor -> attempt_first_factor -> touch) always
// succeeds — a real session gets created every time — but this running
// app's isSignedIn doesn't reliably notice, staying stuck indefinitely. A
// full app restart always picks the now-real session up cleanly, so every
// call to clerk.openSignIn() should go through here instead, marking when
// the attempt started; App.jsx's watchdog effect forces one fresh reload if
// isSignedIn still hasn't flipped a generous number of seconds later.
// Clearing the "already reloaded" guard on every new attempt lets a second
// try get its own chance at the same recovery. Remove all of this (this
// wrapper, the watchdog effect, and the two debug blocks on More/Pricing)
// once Clerk's client-side state is found to update reliably on its own.
export function openSignInWithRecovery(clerk, options) {
  try {
    sessionStorage.setItem('clerkSignInAttemptAt', String(Date.now()));
    sessionStorage.removeItem('clerkSignInReloaded');
  } catch {
    /* ignore — recovery is best-effort */
  }
  return clerk.openSignIn(options);
}
