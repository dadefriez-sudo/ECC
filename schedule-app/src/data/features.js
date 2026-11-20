// Features that are built but intentionally not shown yet. Flip a flag to bring
// one back; nothing else needs to change.
//
// Shared calendars: hidden while the app is being tested with a small group.
// Google Calendar already does this well, and it added the most server and
// security surface for the least benefit to the core planner. The pages and the
// backend routes are still in place.
export const SHARED_CALENDARS_ENABLED = false;

// Cloud sync: the settings card (and its search entry). It can be switched off again if sync ever
// needs to be hidden while something is fixed.
export const CLOUD_SYNC_ENABLED = true;

// The "Sign in with Google" tile (connecting Google Calendar and Contacts). Off for good unless
// it is wanted again; separate from cloud sync so bringing that card back never brings this back.
export const GOOGLE_CONNECT_ENABLED = false;
