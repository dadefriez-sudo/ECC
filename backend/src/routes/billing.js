import { Router } from 'express';
import Stripe from 'stripe';
import { google } from 'googleapis';
import { SignedDataVerifier, Environment } from '@apple/app-store-server-library';
import { requireUser } from '../middleware/requireUser.js';
import { prisma } from '../db.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Pro is a single one-time purchase, so there is exactly one price and the
// client never sends a price ID — checkout can't be pointed at an arbitrary
// price in the account.
const LIFETIME_PRICE_ID = process.env.STRIPE_PRICE_ID_LIFETIME || process.env.STRIPE_PRICE_ID;

async function ensureStripeCustomer(user) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { clerkId: user.clerkId, userId: user.id },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

// Starts the one-time Pro purchase — redirect the browser to the returned URL.
router.post('/checkout', requireUser, async (req, res, next) => {
  try {
    if (!LIFETIME_PRICE_ID) {
      return res.status(400).json({ error: 'No Stripe price configured for Pro' });
    }
    // Already bought — don't let a double-tap or a stale tab charge twice.
    if (req.dbUser.lifetimePurchasedAt) {
      return res.status(400).json({ error: 'You already own Keystone Pro.' });
    }

    const customerId = await ensureStripeCustomer(req.dbUser);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: LIFETIME_PRICE_ID, quantity: 1 }],
      // So the webhook can identify the buyer even if the customer lookup
      // ever fails to match.
      client_reference_id: req.dbUser.id,
      metadata: { userId: req.dbUser.id, clerkId: req.dbUser.clerkId, kind: 'lifetime' },
      // One-time payments don't get an automatic invoice; ask for one so the
      // buyer has a receipt they can find later.
      invoice_creation: { enabled: true },
      success_url: `${process.env.FRONTEND_URL}/#/more?checkout=success`,
      cancel_url: `${process.env.FRONTEND_URL}/#/pricing?checkout=cancelled`,
    });
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// Opens Stripe's hosted billing page. Only meaningful for people who
// subscribed before Pro became a one-time purchase — it's how they cancel.
// New buyers have nothing recurring to manage and never see this.
router.post('/portal', requireUser, async (req, res, next) => {
  try {
    if (!req.dbUser.stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account yet.' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: req.dbUser.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/#/more`,
    });
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// --- In-app purchase (StoreKit 2 / Play Billing) verification ------------
//
// The native app sells the same one-time Pro unlock through each store's
// own purchase flow instead of Stripe Checkout (see
// schedule-app/src/data/iap.js) — App Store guideline 3.1.1 requires
// digital goods to go through StoreKit, not a web payment flow, inside the
// app. This verifies the raw receipt each platform hands back directly
// against Apple's / Google's own servers. No third-party receipt-
// validation service sits in the loop — deliberately, so nothing here can
// grant Pro without an actual purchase Apple or Google will vouch for.

const PRO_PRODUCT_ID_IOS = process.env.PRO_PRODUCT_ID_IOS || 'keystone_pro_lifetime';
const PRO_PRODUCT_ID_ANDROID = process.env.PRO_PRODUCT_ID_ANDROID || 'keystone_pro_lifetime';

// Built once per process, not per request — constructing a SignedDataVerifier
// re-parses the root certs every time, and there's nothing request-specific
// about it.
let appleVerifiers; // { production: SignedDataVerifier|null, sandbox: SignedDataVerifier|null } | undefined until first use
function getAppleVerifiers() {
  if (appleVerifiers !== undefined) return appleVerifiers;
  const bundleId = process.env.APPLE_BUNDLE_ID;
  const certs = (process.env.APPLE_ROOT_CERT_BASE64 || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((b64) => Buffer.from(b64, 'base64'));
  if (!bundleId || certs.length === 0) {
    appleVerifiers = { production: null, sandbox: null };
    return appleVerifiers;
  }
  // Production verification requires the app's numeric App Store ID, which
  // doesn't exist until the app listing itself does — production purchases
  // simply can't verify until APPLE_APP_APPLE_ID is set, but sandbox
  // (TestFlight / development) purchases can be tested before that.
  const appAppleId = process.env.APPLE_APP_APPLE_ID ? Number(process.env.APPLE_APP_APPLE_ID) : undefined;
  appleVerifiers = {
    production: appAppleId
      ? new SignedDataVerifier(certs, true, Environment.PRODUCTION, bundleId, appAppleId)
      : null,
    sandbox: new SignedDataVerifier(certs, true, Environment.SANDBOX, bundleId),
  };
  return appleVerifiers;
}

async function verifyAppleTransaction({ productId, transactionId, receipt }) {
  const { production, sandbox } = getAppleVerifiers();
  if (!production && !sandbox) {
    throw new Error('Apple purchase verification is not configured on the server.');
  }
  // Try production first (real purchases), then sandbox (TestFlight /
  // development) — a verifier rejects a transaction from the environment it
  // wasn't built for, so trying both is the standard way to accept either
  // without the client having to declare which one it's running in.
  let decoded;
  let lastErr;
  for (const verifier of [production, sandbox]) {
    if (!verifier) continue;
    try {
      decoded = await verifier.verifyAndDecodeTransaction(receipt);
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!decoded) throw new Error(`Apple transaction verification failed: ${lastErr?.message || 'unknown error'}`);
  if (decoded.bundleId !== process.env.APPLE_BUNDLE_ID) throw new Error('Bundle id mismatch.');
  if (decoded.productId !== (productId || PRO_PRODUCT_ID_IOS)) throw new Error('Unexpected product id.');
  if (decoded.revocationDate) throw new Error('This purchase was refunded.');
  const resolvedId = decoded.originalTransactionId || decoded.transactionId || transactionId;
  if (!resolvedId) throw new Error('No transaction id in the verified receipt.');
  return resolvedId;
}

let androidPublisher; // Bridge instance | false (not configured) | undefined until first use
function getAndroidPublisher() {
  if (androidPublisher !== undefined) return androidPublisher;
  const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credsJson) {
    androidPublisher = false;
    return androidPublisher;
  }
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credsJson),
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  androidPublisher = google.androidpublisher({ version: 'v3', auth });
  return androidPublisher;
}

async function verifyGoogleTransaction({ productId, receipt }) {
  const publisher = getAndroidPublisher();
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!publisher || !packageName) {
    throw new Error('Google Play purchase verification is not configured on the server.');
  }
  const resolvedProductId = productId || PRO_PRODUCT_ID_ANDROID;
  const { data } = await publisher.purchases.products.get({
    packageName,
    productId: resolvedProductId,
    token: receipt,
  });
  // purchaseState: 0 = purchased, 1 = canceled, 2 = pending.
  if (data.purchaseState !== 0) throw new Error('This purchase is not in a completed state.');
  if (data.acknowledgementState === 0) {
    // The client normally acknowledges via the plugin's own finish() call —
    // this is a safety net, since an unacknowledged Play Billing purchase
    // auto-refunds after 3 days.
    await publisher.purchases.products
      .acknowledge({ packageName, productId: resolvedProductId, token: receipt, requestBody: {} })
      .catch(() => {});
  }
  // orderId is Google's own stable purchase identifier — unlike
  // purchaseToken, it doesn't change if the same purchase is restored later.
  return data.orderId || receipt;
}

router.post('/verify-purchase', requireUser, async (req, res, next) => {
  try {
    const { platform, productId, transactionId, receipt } = req.body || {};
    if (!platform || !receipt) {
      return res.status(400).json({ error: 'Missing platform or receipt.' });
    }
    // Already granted (Stripe or a prior IAP verification) — a duplicate
    // 'approved' event from the store shouldn't re-verify or re-write.
    if (req.dbUser.lifetimePurchasedAt) {
      return res.json({ verified: true, alreadyOwned: true });
    }

    if (platform !== 'ios' && platform !== 'android') {
      return res.status(400).json({ error: 'Unknown platform.' });
    }

    // Verification failures are an expected, user-facing outcome (a
    // refunded purchase, a tampered receipt, a wrong product id) — reported
    // as 400s with their own message, same as the checkout route's "already
    // own Pro" case above, rather than falling into the generic 500 handler
    // that deliberately hides error detail for genuinely unexpected faults.
    let resolvedId;
    try {
      resolvedId =
        platform === 'ios'
          ? await verifyAppleTransaction({ productId, transactionId, receipt })
          : await verifyGoogleTransaction({ productId, receipt });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      await prisma.user.update({
        where: { id: req.dbUser.id },
        data: { lifetimePurchasedAt: new Date(), iapPlatform: platform, iapTransactionId: resolvedId },
      });
    } catch (err) {
      // Unique constraint on iapTransactionId: either this exact request
      // raced itself (a retry landing twice — fine, it's this account
      // either way) or the transaction is already attached to someone else
      // (don't silently transfer a purchase between accounts).
      if (err.code === 'P2002') {
        const existing = await prisma.user.findUnique({ where: { iapTransactionId: resolvedId } });
        if (existing?.id === req.dbUser.id) return res.json({ verified: true });
        return res.status(409).json({ error: 'This purchase is already linked to a different account.' });
      }
      throw err;
    }
    res.json({ verified: true });
  } catch (err) {
    next(err);
  }
});

export default router;
