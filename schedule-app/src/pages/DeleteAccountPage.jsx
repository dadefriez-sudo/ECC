import LegalPage from '../components/LegalPage.jsx';

// A standalone, linkable page for Google Play / App Store "account
// deletion" requirements — both stores require a way to request deletion
// that doesn't depend on having the app installed, in addition to the
// in-app option under Settings → Account.
export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your account" updated="October 2, 2026">
      <h2>In the app</h2>
      <p>
        Open Keystone, go to <b>Settings → Account</b>, and tap <b>Delete account</b>. This
        permanently and immediately deletes your Keystone account, your Pro purchase record, and
        everything stored on our server for it: cloud-synced data and any shared calendars you
        own. It can't be undone.
      </p>
      <p className="muted small">
        Data already saved locally on that device isn't touched by this — that's a separate,
        local action under Settings → Your data, for anyone who also wants the on-device copy
        gone.
      </p>

      <h2>Without the app</h2>
      <p>
        No app installed, or can't sign in? Email{' '}
        <a href="mailto:keystone.planner@gmail.com?subject=Delete%20my%20Keystone%20account">
          keystone.planner@gmail.com
        </a>{' '}
        from the email address your account uses, with the subject "Delete my account." We'll
        verify it's you and permanently delete your account and everything stored on our server
        for it within 7 days, then confirm by reply.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your account and sign-in credentials</li>
        <li>Your Pro purchase record</li>
        <li>Any data stored on our server: cloud-synced app data, shared calendars you own</li>
      </ul>
      <p className="muted small">
        Data stored only on your own device (if cloud sync was never turned on) isn't affected by
        either method — delete that separately from Settings → Your data on each device.
      </p>
    </LegalPage>
  );
}
