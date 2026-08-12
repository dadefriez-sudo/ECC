# In-app purchase (StoreKit 2 / Play Billing)

Pro sells two different ways depending on where the app is running:

- **Web** — Stripe Checkout (`backend/src/routes/billing.js`'s `/checkout` route), unchanged.
- **Native (iOS/Android app)** — StoreKit 2 / Google Play Billing, via `capacitor-plugin-cdv-purchase`
  on the client and `/api/billing/verify-purchase` on the backend. This is required, not optional:
  App Store guideline 3.1.1 requires digital goods purchased inside the app to go through
  StoreKit, not a web payment flow.

Both paths grant the exact same thing — the `lifetimePurchasedAt` flag on the `User` row — so
nothing downstream (feature gating, the `isPro` flag from `/api/me`) needs to know or care which
one someone used.

Verification is done directly against Apple's and Google's own APIs, deliberately without a
third-party receipt-validation service in the loop (see the earlier decision in this project: a
one-time purchase's receipt-validation surface is small enough to own directly rather than adding
another account/dependency for it).

## 1. Create the product in App Store Connect

1. Your app record → **Features → In-App Purchases** → create a new **Non-Consumable**.
2. Product ID: `keystone_pro_lifetime` (must match `PRO_PRODUCT_ID` in
   `schedule-app/src/data/iap.js` and `PRO_PRODUCT_ID_IOS` in the backend env — change all three
   together if you use a different id).
3. Set pricing, display name, and description; submit for review along with your first build
   (Apple reviews IAP products alongside the app binary, not separately in advance).

## 2. Create the product in Play Console

1. Your app → **Monetize → Products → In-app products** → create a new product.
2. Product ID: `keystone_pro_lifetime` (same note as above — `PRO_PRODUCT_ID_ANDROID`).
3. Set pricing and activate it.

## 3. Backend credentials

All in `backend/.env.example`, with pointers to exactly where to find each one:

- `APPLE_BUNDLE_ID` — your app's bundle id (matches `capacitor.config.ts`'s `appId`).
- `APPLE_APP_APPLE_ID` — the app's numeric App Store ID. Only needed for verifying real
  (production) purchases; sandbox/TestFlight purchases verify without it, so this can wait until
  the app listing itself exists.
- `APPLE_ROOT_CERT_BASE64` — Apple's own root CA certificate, base64-encoded. Used to verify the
  signature chain on every transaction StoreKit 2 hands back, so a tampered or forged receipt
  can't grant Pro.
- `GOOGLE_SERVICE_ACCOUNT_JSON` — a Play Console service account with Play Developer API access,
  as one JSON blob.
- `GOOGLE_PLAY_PACKAGE_NAME` — your Android application id.

Leaving a platform's vars unset doesn't break anything — that platform's purchases simply can't
verify (a clean 400 from `/api/billing/verify-purchase`, not a crash) until they're set.

## What's genuinely untestable from this environment

This was built and verified as far as a sandboxed Linux environment allows:

- The backend route was checked for correct wiring (mounts, syntax, graceful "not configured"
  responses) — see `backend/src/routes/billing.js`.
- The client purchase flow (`schedule-app/src/data/iap.js`) was verified to build correctly and,
  importantly, to **not** pull the purchase library into the web bundle at all — it's a dynamic
  import, so a web visitor to the Pricing page never fetches it; only the native app shell does.
- The web (Stripe) and demo purchase paths were exercised end-to-end in a browser and still work
  unchanged.

None of the following can happen without Xcode, Android Studio, a real device or simulator, and
real store credentials — all outside what this environment has:

- Actually placing a StoreKit/Play Billing purchase and confirming a real signed transaction
  verifies correctly against the Apple root cert / Google Play Developer API.
- Confirming the "Restore Purchases" flow re-recognizes an existing purchase on a fresh install.
- Confirming the sandbox-then-production verification fallback in `verifyAppleTransaction`
  behaves as expected with a real TestFlight purchase.

**Before shipping this**, run through a real sandbox purchase on both platforms once you have
the credentials above in place and can build from Xcode/Android Studio (see
`appstore-assets/CAPACITOR.md`) — this is exactly the kind of payment-path code that deserves a
real end-to-end test before it's live, not just a clean build.
