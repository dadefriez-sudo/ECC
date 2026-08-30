import LegalPage from '../components/LegalPage.jsx';

// Drafted from what the app actually does, not a generic template — see
// each section for the real behavior it describes. Worth a quick pass by
// an actual lawyer before this goes live on either store, especially the
// location and children's-privacy sections, but every claim here is
// accurate to the current codebase as of the date below.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="August 30, 2026">
      <p>
        Keystone is made by KeyStone Software and built around one idea: your calendar, your
        goals, and your people are your data, kept on your device by default. This page explains
        what that means in practice — what Keystone collects, when (if ever) it leaves your
        device, and how to delete it.
      </p>

      <h2>What stays on your device</h2>
      <p>
        Everything you enter — events, goals, tasks, notes, contacts, map pins, and app settings
        — is stored locally on your device. Keystone works fully offline, and none of this is
        sent anywhere unless you turn on one of the optional features below.
      </p>

      <h2>What can leave your device, and why</h2>
      <ul>
        <li>
          <b>An account (optional).</b> Signing in creates an account via our authentication
          provider, Clerk, which stores your email address. You don't need an account to use
          Keystone's free features.
        </li>
        <li>
          <b>Cloud sync (optional, Pro).</b> If you turn this on, your app data is stored on our
          server so it can follow you to another device. It's off by default.
        </li>
        <li>
          <b>Shared calendars (optional, Pro).</b> If you create or join a shared calendar, the
          specific events on that calendar are visible to the specific people on it — nothing
          else in your data is shared.
        </li>
        <li>
          <b>Location (optional).</b> Keystone only uses your device's location if you actively
          use a location feature — dropping a pin, geocoding a contact's address, or setting up
          an arrival reminder. It doesn't track your location in the background beyond what an
          arrival reminder you've explicitly set up needs to fire.
        </li>
        <li>
          <b>Map search and address lookup.</b> Searching the map, dropping a pin by address, or
          entering a contact's address sends that search text to OpenStreetMap's Nominatim
          service to look up coordinates, and map tiles are loaded from OpenStreetMap — both
          happen directly from your device, without going through our server. Keystone doesn't
          control what OpenStreetMap does with that traffic; see their own privacy policy.
        </li>
        <li>
          <b>Google import (optional, Pro).</b> If you choose to connect Google in Settings →
          Account & sync, Keystone requests read-only access to your Google Calendar events and
          Google Contacts and pulls a one-time copy of them into your local data — the same as
          picking a <code>.ics</code>/<code>.vcf</code> file, just sourced from Google instead.
          This is a one-time import, not an ongoing sync: nothing is automatically kept in step
          with Google afterward, and nothing is written back to your Google account. Our server
          holds a Google-issued token only so you can trigger another import later, and only until
          you tap Disconnect (which also revokes it). Keystone's use of information received from
          Google APIs adheres to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements: that data is used only to build the imported
          events/contacts shown to you, is never used for advertising, and is never sold or
          shared with anyone other than you.
        </li>
        <li>
          <b>Payment (Pro purchase).</b> Payment is handled entirely by Stripe, the App Store, or
          Google Play, depending on how you bought Pro. Keystone never sees or stores your card
          details — only whether the purchase succeeded.
        </li>
      </ul>

      <h2>Who else sees it</h2>
      <p>
        Keystone uses a small number of service providers to run: Clerk for authentication,
        Stripe for payment processing, Google (only if you choose to connect it, for the one-time
        import above), OpenStreetMap/Nominatim for map tiles and address search, and a hosting
        provider for the optional sync server. Each only sees the specific data their job requires
        (Clerk sees your email; Stripe sees your payment; Google sees only the read-only access
        you granted; OpenStreetMap sees the map area or address text you search; the sync server
        sees your data blob only if cloud sync is on). None of them are permitted to use your data
        for their own purposes. We don't sell data, and we don't run ads or third-party trackers
        in the app.
      </p>

      <h2>Your data, your control</h2>
      <ul>
        <li>Delete individual events, goals, contacts, or notes any time, right in the app.</li>
        <li>
          Disconnect Google any time from Settings → Account & sync — this revokes its access on
          Google's side and deletes the stored token; it doesn't remove events/contacts already
          imported, which is a separate, local action like anything else you've entered.
        </li>
        <li>
          Clear all local data from Settings → Your data — this resets the app on this device.
        </li>
        <li>
          Delete your account entirely from Settings → Account — this permanently removes your
          account, your Pro purchase record, and anything stored on the server for it (synced
          data, shared calendars you own). It doesn't touch data already saved on your device,
          which is a separate, local action.
        </li>
      </ul>

      <h2>Children's privacy</h2>
      <p>
        Keystone isn't directed at children under 13, and we don't knowingly collect personal
        information from them.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If this policy changes in a way that affects what we collect or how we use it, we'll
        update the date above and, for material changes, let you know in the app.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy or your data can go to{' '}
        <a href="mailto:keystone.planner@gmail.com">keystone.planner@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
