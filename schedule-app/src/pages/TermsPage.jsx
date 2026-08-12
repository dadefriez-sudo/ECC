import LegalPage from '../components/LegalPage.jsx';

// Standard terms scoped to what Keystone actually is and sells — a local-
// first personal productivity app with an optional one-time Pro purchase,
// not a subscription or a platform with user-to-user commerce. Worth a
// lawyer's pass before publishing, same as the privacy policy.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="August 12, 2026">
      <p>
        These terms cover your use of Keystone. By using the app, you agree to them. If you
        don't agree, please don't use Keystone.
      </p>

      <h2>The service</h2>
      <p>
        Keystone is a personal calendar, goals, and contacts app. Core features are free. Pro is
        an optional one-time purchase that unlocks additional features listed on the pricing
        page — it is not a subscription, and there's nothing to cancel once purchased.
      </p>

      <h2>Accounts</h2>
      <p>
        An account is only required for cloud sync, shared calendars, and buying Pro. You're
        responsible for keeping your sign-in credentials secure, and for anything that happens
        under your account.
      </p>

      <h2>Purchases</h2>
      <p>
        Pro is billed once, through Stripe, the App Store, or Google Play depending on where you
        bought it. Refunds are handled according to that platform's own refund policy — Apple's
        or Google's store policies for purchases made there, or by contacting us directly for
        purchases made through Stripe.
      </p>

      <h2>Your content</h2>
      <p>
        You own what you put into Keystone — your events, goals, notes, and contacts. You're
        responsible for the accuracy of anything you enter, including information about other
        people (for example, a contact's phone number or address). Don't use shared calendars or
        invites to spam, harass, or contact someone who hasn't agreed to it.
      </p>

      <h2>Termination</h2>
      <p>
        You can delete your account at any time from Settings → Account. We may suspend or
        terminate access for use that violates these terms, such as abusing the sharing or
        invite features.
      </p>

      <h2>Disclaimer</h2>
      <p>
        Keystone is provided "as is." Reminders, travel-time warnings, and route suggestions are
        estimates meant to help you plan — they're not guarantees, and you're responsible for
        confirming anything time-sensitive or safety-related yourself. To the extent the law
        allows, we aren't liable for indirect or consequential damages arising from your use of
        the app.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        If these terms change materially, we'll update the date above and let you know in the
        app.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can go to <span className="legal-placeholder">[your support email here]</span>.
      </p>
    </LegalPage>
  );
}
