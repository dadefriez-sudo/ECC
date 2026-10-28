import LegalPage from '../components/LegalPage.jsx';

// Generated from docs/legal/privacy-policy.md, the same text as the website. Edit that
// file and regenerate rather than editing this one, so the two never drift apart.
// Worth a lawyer's pass before launch.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 28, 2026">
      <p>
        Keystone is made by KeyStone Software ("we", "us"). It is built around one idea: your
        calendar, your goals and your people are your data, and they stay on your device by
        default. This page explains what Keystone collects, when anything leaves your device,
        who else sees it, and how to delete it.
      </p>
      <h2>The short version</h2>
      <ul>
        <li>
          You can use Keystone's free features without an account. In that case nothing you
          enter is sent to us.
        </li>
        <li>
          We do not run ads, we do not use analytics or third-party trackers, and we do not sell
          your data.
        </li>
        <li>
          A few optional features send data off your device. Each one is listed below, with what
          it sends and why.
        </li>
        <li>
          You can delete your data on your phone, and your account and everything stored for it,
          at any time.
        </li>
      </ul>
      <h2>What stays on your device</h2>
      <p>
        Everything you enter (events, goals, tasks, notes, contacts, map pins and settings) is
        stored on your device. Keystone works fully offline, and none of this is sent anywhere
        unless you turn on one of the optional features below.
      </p>
      <p>
        If you turn on automatic backups, or export a backup by hand from Settings → Your data,
        Keystone saves a copy of your data as a file in your device's Documents folder, outside
        the app's private storage. Backups are locked with a password you choose. That file is
        visible to other apps on your device that have file access, and it never leaves your
        device unless you move it yourself.
      </p>
      <p>
        A few features keep small working copies on your device so they can do their job. None
        of them send anything on their own:
      </p>
      <ul>
        <li>
          <b>Home screen widget (Android).</b> The widget shows the next few things in your day.
          To draw it, Keystone saves a short summary (the titles and times of those items) in
          the app's private storage. Those titles appear on your home screen, so anyone who can
          see your unlocked screen can read them. Remove the widget if you would rather they did
          not.
        </li>
        <li>
          <b>Reminders and notification buttons.</b> Reminders are scheduled on your device and
          appear in your notifications with the title of the goal, event or task, which can show
          on a lock screen depending on your phone's settings. Buttons such as Done and Snooze
          act on the data on your device.
        </li>
        <li>
          <b>Share into Keystone (Android).</b> When you share text, a link or an address from
          another app to Keystone, it is handled on your device and saved as a task, note or pin
          only if you choose.
        </li>
        <li>
          <b>Weekly review and check-ins.</b> The weekly review and the check-in after an event
          are worked out on your device from your own goals, tasks, events and contacts. Their
          reminders are local notifications.
        </li>
        <li>
          <b>Usage counts and recovery copies.</b> "Your week in Keystone" counts how often you
          used the app and stays on your phone. If cloud sync is on, Keystone also keeps a copy
          of the last synced version, and one copy from before a merge, in the app's private
          storage, so a sync can be undone by hand if something goes wrong.
        </li>
      </ul>
      <h2>What can leave your device, and why</h2>
      <p>
        Each of these is optional.
      </p>
      <ul>
        <li>
          <b>An account.</b> Signing in creates an account through our sign-in provider, Clerk,
          which stores your email address. You do not need an account to use the free features.
        </li>
        <li>
          <b>Cloud sync (Pro).</b> If you turn this on, your app data (events, goals, tasks,
          notes, contacts including photos and addresses, map pins and most settings) is stored
          on our server so it can follow you to another device. When two of your devices have
          both changed something, your phone combines the changes. The server keeps one copy and
          does not read or merge it. Settings that belong to one device, such as your haptics
          choice and your Pro status, are not synced. The data is sent over an encrypted
          connection and kept until you delete your account. It is not end-to-end encrypted, so
          we and our hosting provider are able to see it. It can be switched off in Settings →
          Account and sync.
        </li>
        <li>
          <b>Accountability partners.</b> If you invite someone, or accept an invite, to be
          accountability partners, Keystone shares with that one person, and only them, your
          goal titles and progress and how many of today's tasks are done (not the tasks
          themselves). Your email address is visible to them. Nothing is shared until they
          accept. It is removed from our server when you remove your last partner, and either of
          you can end it at any time.
        </li>
        <li>
          <b>Shared calendars (Pro for more than a few).</b> If you create or join a shared
          calendar, the events on that calendar are visible to the people on it. Nothing else in
          your data is shared.
        </li>
        <li>
          <b>Location.</b> Keystone only uses your device's location when you use a location
          feature: dropping a pin, using "Use my location", showing your position on the map, or
          an arrival reminder you set up. It does not track your location in the background
          beyond what an arrival reminder you set up needs. Your position stays on your device.
        </li>
        <li>
          <b>Map tiles and address search.</b> The map loads map pictures from OpenStreetMap
          and, for the satellite and gray styles, from Esri. Searching the map or entering an
          address sends the search text to OpenStreetMap's Nominatim service to find
          coordinates. These requests go straight from your device to those services, not
          through our server, and they can see your IP address and the area you are viewing. We
          do not control what they do with that traffic. See their own privacy policies.
        </li>
        <li>
          <b>Google Calendar and Contacts (Pro).</b> If you connect Google in Settings, Keystone
          asks for read and write access to your Google Calendar and read-only access to your
          Google Contacts. Contacts are a one-time import into your local data. The calendar is
          kept in step while the app is open: single (non-repeating) events you create, edit or
          delete in Keystone are pushed to Google Calendar, and changes made on Google are
          pulled in. This only happens while Keystone is open. Our server holds a Google-issued
          token to do this until you tap Disconnect, which also revokes it. Keystone's use of
          information received from Google APIs follows the <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including
          the Limited Use requirements: the data is used only to show and sync your own events
          and contacts, is never used for advertising, and is never sold or shared with anyone
          other than you.
        </li>
        <li>
          <b>Your phone's contacts.</b> If you tap Import from phone, Android asks for
          permission to read your contacts. Keystone reads them on the device to show you a list
          and copies only the ones you tick (name, phone number, email and address) into your
          Keystone data. It never writes to your phone's contacts, and the permission is not
          used for anything else.
        </li>
        <li>
          <b>Your phone's calendar.</b> If you tap Import from phone calendar, Android asks for
          permission to read your calendar. Keystone lists your calendars on the device and
          copies the events from the ones you choose (title, date and time, location and notes)
          into your Keystone calendar. It never changes your phone's calendar, and the
          permission is not used for anything else. Keystone remembers which calendars and date
          range you picked, on your device only.
        </li>
        <li>
          <b>Canvas calendar (Pro).</b> If you paste your Canvas Calendar Feed link into
          Settings, Keystone fetches it directly from your school's Canvas site, from your
          phone, to show your assignments and class dates on your calendar. The link stays on
          your device and is never sent to our server or included in backups or sync. The items
          it brings in become ordinary events in your data, so they are included in a backup or
          cloud sync if you use those. Disconnecting removes the link and the items it added.
          Keystone is not made by or affiliated with Instructure or your school.
        </li>
        <li>
          <b>Links you tap.</b> Links in your notes open in your browser or another app on your
          phone. A Canvas link tries the Canvas Student app first if it is installed. Those apps
          and websites have their own privacy practices. Keystone does not send them anything
          but the link.
        </li>
        <li>
          <b>Payment (Pro).</b> Payment is handled entirely by Google Play (or the App Store).
          Keystone never sees your card details. When you buy Pro, our server confirms the
          purchase with Google and records that Pro was bought, along with the transaction
          identifier.
        </li>
        <li>
          <b>Feedback.</b> "Send feedback" opens your email app with a draft. Nothing is sent
          until you send it.
        </li>
      </ul>
      <h2>Who else sees it</h2>
      <p>
        We use a small number of service providers: Clerk for sign-in, Google (Play purchase
        checks, and Calendar and Contacts if you connect them), OpenStreetMap and Esri for map
        pictures and address search, and a hosting provider for the optional sync server. Each
        one sees only what its job needs. Clerk sees your email. Google sees the access you
        granted. OpenStreetMap and Esri see the map area or address text you request. The sync
        server sees your data only if cloud sync is on. None of them may use your data for their
        own purposes. We do not sell your data and we do not show ads.
      </p>
      <h2>Where your data is kept and for how long</h2>
      <p>
        Data on your phone stays there until you delete it. If you use the optional server
        features, data is stored on servers run by our hosting provider, which may be in a
        different country from you, until you delete your account or turn the feature off and
        remove the data. After an account is deleted, copies can remain in the provider's
        routine backups for a short time before they are overwritten.
      </p>
      <h2>Security</h2>
      <p>
        Data sent to our server is encrypted in transit. Backups you create are encrypted with
        the password you choose, and we cannot recover that password for you. On your phone,
        your data is protected by Android and by your phone's lock screen. No system is
        perfectly secure, so keep your phone locked and your backup password safe.
      </p>
      <h2>Your data, your control</h2>
      <ul>
        <li>
          Delete individual events, goals, contacts or notes at any time in the app.
        </li>
        <li>
          Disconnect Google at any time from Settings. This revokes its access on Google's side
          and deletes the stored token. It does not remove events or contacts you already
          imported, which is a separate step on your device.
        </li>
        <li>
          Clear all local data from Settings → Your data. This resets the app on that device.
        </li>
        <li>
          Delete your account from Settings → Account. This permanently removes your account,
          your Pro purchase record, and everything stored on our server for it (synced data and
          shared calendars you own). It does not touch data already saved on your device. You
          can also email us to request deletion if you cannot sign in.
        </li>
        <li>
          Depending on where you live (for example the EU, the UK or California), you may have
          rights to access, correct, delete or export your personal data. Most of that you can
          do yourself in the app. For anything else, email us and we will respond. We do not
          sell or share your personal information for advertising.
        </li>
      </ul>
      <h2>Children's privacy</h2>
      <p>
        Keystone is not directed at children under 13, and we do not knowingly collect personal
        information from them. If you believe a child has given us personal information, email
        us and we will delete it.
      </p>
      <h2>Changes to this policy</h2>
      <p>
        If this policy changes in a way that affects what we collect or how we use it, we will
        update the date above and, for material changes, tell you in the app.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about this policy or your data can go to <a
        href="mailto:keystone.planner@gmail.com">keystone.planner@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
