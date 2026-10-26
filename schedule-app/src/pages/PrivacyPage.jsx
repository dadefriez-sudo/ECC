import LegalPage from '../components/LegalPage.jsx';

// Drafted from what the app actually does, not a generic template — see
// each section for the real behavior it describes. Worth a quick pass by
// an actual lawyer before this goes live on either store, especially the
// location and children's-privacy sections, but every claim here is
// accurate to the current codebase as of the date below.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 26, 2026">
      <p>
        Keystone is made by KeyStone Software and built around one idea: your calendar, your
        goals, and your people are your data, kept on your device by default. This page explains
        what that means in practice: what Keystone collects, when (if ever) it leaves your
        device, and how to delete it.
      </p>

      <h2>What stays on your device</h2>
      <p>
        Everything you enter (events, goals, tasks, notes, contacts, map pins, and app settings)
        is stored locally on your device. Keystone works fully offline, and none of this is
        sent anywhere unless you turn on one of the optional features below.
      </p>
      <p>
        If you turn on automatic backups, or export one manually, from Settings → Your data,
        Keystone also saves a copy of your data as a file in your device's Documents folder,
        outside the app's own private storage. Unlike everything else on this page, that file is
        visible to other apps on your device with file access, though it still never leaves your
        device unless you move it yourself.
      </p>

      <p>
        A few features keep small working copies on your device so they can do their job, and
        none of them send anything anywhere on their own:
      </p>
      <ul>
        <li>
          <b>Home screen widget (Android).</b> The widget shows the next few things on your day.
          To draw it, Keystone saves a short summary (the titles and times of those items) in the
          app's private storage. Those titles appear on your home screen, so anyone who can see
          your unlocked screen can read them. Remove the widget if you'd rather they didn't.
        </li>
        <li>
          <b>Reminders and notification buttons.</b> Reminders are scheduled on your device and
          appear in your notification shade with the title of the goal, event, or task, which can
          show on a lock screen depending on your phone's settings. Buttons such as Mark done and
          Snooze act on the data on your device.
        </li>
        <li>
          <b>Share into Keystone (Android).</b> When you share text, a link, or an address from
          another app to Keystone, it is handled on your device and saved as a task, note, or
          pin only if you choose to. If you pin a shared address, the lookup works like the map
          search described below.
        </li>
        <li>
          <b>Weekly review.</b> The weekly review is worked out on your device from your own
          goals, tasks, and contacts. Its optional end-of-week reminder is a local notification.
        </li>
        <li>
          <b>Usage counts and recovery copies.</b> "Your week in Keystone" counts how often you
          used the app and stays on your phone unless you choose to send it. If cloud sync is
          on, Keystone also keeps a copy of the last synced version, and one pre-merge copy, in
          the app's private storage, so a sync can be undone by hand if something goes wrong.
        </li>
      </ul>

      <h2>What can leave your device, and why</h2>
      <ul>
        <li>
          <b>An account (optional).</b> Signing in creates an account via our authentication
          provider, Clerk, which stores your email address. You don't need an account to use
          Keystone's free features.
        </li>
        <li>
          <b>Cloud sync (optional, Pro).</b> If you turn this on, your app data (events, goals,
          tasks, notes, contacts including any photos and addresses, map pins, and most
          settings) is stored on our server so it can follow you to another device. When two of
          your devices have both changed something, your phone combines the changes using the
          last synced copy; the server stores one copy and does not read or merge it. Settings
          that belong to a single device, such as your haptics choice, the last map position,
          and your Pro status, are not synced. The data is sent over an encrypted connection,
          is kept until you delete your account, and can be seen by us and our hosting
          provider as it is not end-to-end encrypted. It's on by default for Pro accounts that
          are signed in and can be switched off in Settings → Account &amp; sync.
        </li>
        <li>
          <b>Accountability partners (optional).</b> If you invite someone, or accept an invite, to
          be accountability partners, Keystone shares with that one person, and only them, your goal
          titles and progress and how many of today's tasks are done (not the tasks themselves).
          Your email address is visible to them. Nothing is shared until they accept; it is removed
          from our server when you remove your last partner; and either of you can end it at any
          time from Settings, Accountability partners.
        </li>
        <li>
          <b>Shared calendars (optional, Pro).</b> If you create or join a shared calendar, the
          specific events on that calendar are visible to the specific people on it. Nothing
          else in your data is shared.
        </li>
        <li>
          <b>Location (optional).</b> Keystone only uses your device's location if you actively
          use a location feature: dropping a pin, geocoding a contact's address, or setting up
          an arrival reminder. It doesn't track your location in the background beyond what an
          arrival reminder you've explicitly set up needs to fire.
        </li>
        <li>
          <b>Map search and address lookup.</b> Searching the map, dropping a pin by address, or
          entering a contact's address sends that search text to OpenStreetMap's Nominatim
          service to look up coordinates, and map tiles are loaded from OpenStreetMap. Both
          happen directly from your device, without going through our server. Keystone doesn't
          control what OpenStreetMap does with that traffic; see their own privacy policy.
        </li>
        <li>
          <b>Google Calendar &amp; Contacts (optional, Pro).</b> If you choose to connect Google
          in Settings → Account & sync, Keystone requests read/write access to your Google
          Calendar and read-only access to your Google Contacts. Contacts is a one-time import
          into your local data, same as picking a <code>.vcf</code> file. Calendar is kept in
          sync going forward, in both directions, while the app is open: single (non-repeating)
          events you create, edit, or delete in Keystone are pushed to your Google Calendar, and
          changes made on Google are pulled in the same way. This only happens while Keystone is
          open, not in the background. Our server holds a Google-issued token to do this, until
          you tap Disconnect (which also revokes it). Keystone's use of information received from
          Google APIs adheres to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements: that data is used only to show and sync your
          own events/contacts, is never used for advertising, and is never sold or shared with
          anyone other than you.
        </li>
        <li>
          <b>Canvas calendar (optional).</b> If you paste your Canvas Calendar Feed link into
          Settings → Canvas calendar, Keystone fetches it directly from your school's Canvas
          site, from your phone, to show your assignments and class dates on your calendar. The
          link stays on this device and is never sent to our server. The items it brings in become
          ordinary events in your data, so they are included in a backup or Cloud Sync if you use
          those. Disconnecting removes the link and the items it added.
        </li>
        <li>
          <b>Payment (Pro purchase).</b> Payment is handled entirely by the App Store or Google
          Play, depending on how you bought Pro. Keystone never sees or stores your card details,
          only whether the purchase succeeded.
        </li>
      </ul>

      <h2>Who else sees it</h2>
      <p>
        Keystone uses a small number of service providers to run: Clerk for authentication,
        Google (only if you choose to connect it, for the one-time import above),
        OpenStreetMap/Nominatim for map tiles and address search, and a hosting provider for the
        optional sync server. Each only sees the specific data their job requires (Clerk sees your
        email; Google sees only the read-only access you granted; OpenStreetMap sees the map area
        or address text you search; the sync server sees your data blob only if cloud sync is on).
        None of them are permitted to use your data for their own purposes. We don't sell data,
        and we don't run ads or third-party trackers in the app.
      </p>

      <h2>Your data, your control</h2>
      <ul>
        <li>Delete individual events, goals, contacts, or notes any time, right in the app.</li>
        <li>
          Disconnect Google any time from Settings → Account & sync. This revokes its access on
          Google's side and deletes the stored token; it doesn't remove events/contacts already
          imported, which is a separate, local action like anything else you've entered.
        </li>
        <li>
          Clear all local data from Settings → Your data. This resets the app on this device.
        </li>
        <li>
          Delete your account entirely from Settings → Account. This permanently removes your
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
