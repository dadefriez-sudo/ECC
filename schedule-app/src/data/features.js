// Features that are built but intentionally not shown yet. Flip a flag to bring
// one back; nothing else needs to change.
//
// Shared calendars: hidden while the app is being tested with a small group.
// Google Calendar already does this well, and it added the most server and
// security surface for the least benefit to the core planner. The pages and the
// backend routes are still in place.
export const SHARED_CALENDARS_ENABLED = false;

// Cloud sync and Google sign-in: hidden until syncing across devices actually works end to
// end, so nothing in the app promises it. The settings card and its search entry come back
// when this is true.
export const CLOUD_SYNC_ENABLED = false;
