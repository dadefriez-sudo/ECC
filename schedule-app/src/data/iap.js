import { Capacitor } from '@capacitor/core';
import { verifyPurchase } from './api.js';

// Native purchase of the same one-time Pro unlock Stripe sells on the web —
// required by App Store guideline 3.1.1 (digital goods bought inside the
// app must go through StoreKit, not a web checkout). Same product id
// registered on both stores by convention; see appstore-assets/IAP.md for
// the App Store Connect / Play Console setup this depends on.
export const PRO_PRODUCT_ID = 'keystone_pro_lifetime';

const isNative = Capacitor.isNativePlatform();

export function iapAvailable() {
  return isNative;
}

// capacitor-plugin-cdv-purchase is real weight (its StoreKit/Play Billing
// bridge code) that only ever does anything on native — dynamically
// imported so a web visitor to the Pricing page never fetches it at all,
// instead of it riding along in that page's chunk unconditionally.
let modulePromise = null;
function loadPurchasePlugin() {
  if (!modulePromise) modulePromise = import('capacitor-plugin-cdv-purchase');
  return modulePromise;
}

let initPromise = null;

// Wires purchases to our own backend (POST /api/billing/verify-purchase)
// instead of the plugin's built-in validator mechanism — deliberately: that
// mechanism expects either Fovea's hosted receipt-validation service or a
// server implementing their specific contract, and the whole point of this
// approach was owning verification ourselves against Apple's/Google's own
// server APIs directly (see backend/src/routes/billing.js) rather than
// adding another third-party account to the purchase path.
//
// onVerified() fires after the backend confirms a purchase — callers use it
// to re-pull /api/me and pick up the new isPro flag, the same one Stripe
// purchases already flow through.
// Verifications currently running, so restorePurchases() can wait for the
// restored transaction to actually finish verifying before anyone checks
// whether Pro came back (the store hands those over asynchronously, after
// restorePurchases() itself has already resolved).
const inflight = new Set();
let lastVerifyError = null;

// onError(err) fires when the backend refuses or can't be reached for a
// purchase — previously this was only a console.warn, which on a phone is
// invisible: a purchase that went through on Google Play but failed
// verification just looked like "nothing happened", with no way to tell why.
export function initIAP(getToken, onVerified, onError) {
  if (!isNative) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = loadPurchasePlugin().then(({ store, ProductType, Platform }) => {
    const nativePlatform = Capacitor.getPlatform() === 'ios' ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;

    store.register([{ id: PRO_PRODUCT_ID, type: ProductType.NON_CONSUMABLE, platform: nativePlatform }]);

    store.when().approved((transaction) => {
      const job = (async () => {
        try {
          const receipt =
            transaction.platform === Platform.APPLE_APPSTORE
              ? transaction.jwsRepresentation
              : transaction.nativePurchase?.purchaseToken;
          if (!receipt) throw new Error('No receipt data on this transaction.');
          await verifyPurchase(getToken, {
            platform: transaction.platform === Platform.APPLE_APPSTORE ? 'ios' : 'android',
            productId: transaction.products?.[0]?.id || PRO_PRODUCT_ID,
            transactionId: transaction.transactionId,
            receipt,
          });
          // Only finish (acknowledge/consume) once the backend has actually
          // recorded the purchase — if verification failed, leaving the
          // transaction unfinished means the store re-delivers it (next
          // launch, or via restorePurchases()) instead of losing it to a
          // transient network error.
          await transaction.finish();
          lastVerifyError = null;
          onVerified?.();
        } catch (err) {
          lastVerifyError = err;
          console.warn('Purchase verification failed:', err.message);
          onError?.(err);
        }
      })();
      inflight.add(job);
      job.finally(() => inflight.delete(job));
      return job;
    });

    return store.initialize([nativePlatform]);
  });
  return initPromise;
}

export async function purchasePro() {
  if (!isNative) throw new Error('In-app purchase is only available in the app.');
  // loadPurchasePlugin() only awaits the dynamic import resolving — it says
  // nothing about whether store.initialize() (kicked off separately by
  // initIAP, and genuinely slow: it's the network round-trip to Play
  // Billing / StoreKit for product + offer details) has actually finished.
  // Tapping "Unlock Pro" before that completes landed here with a product
  // that exists but has no offers yet, which read as "Pro isn't available"
  // even when it's really just "still loading" — wait for the same
  // in-flight init promise initIAP already started before checking.
  if (initPromise) await initPromise;
  const { store, Platform } = await loadPurchasePlugin();
  const nativePlatform = Capacitor.getPlatform() === 'ios' ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;
  const product = store.get(PRO_PRODUCT_ID, nativePlatform);
  const offer = product?.getOffer();
  if (!offer) throw new Error('Pro isn’t available for purchase right now. Try again in a moment.');
  const err = await offer.order();
  if (err) throw new Error(err.message || 'Purchase failed.');
}

// Apple requires a visible "Restore Purchases" action for any non-
// consumable product (App Review guideline 3.1.1) — someone who reinstalls,
// or bought on another device signed into the same App Store account, has
// no other way to get their purchase re-recognized here. Restored
// transactions flow through the same `approved` handler above.
//
// Resolves with the verification error, if one of the restored purchases was
// refused by the backend (null otherwise) — and only once any restored
// transaction has finished verifying, so the caller's "did Pro come back?"
// check isn't racing the very request that would make it true.
export async function restorePurchases() {
  if (!isNative) throw new Error('Restoring purchases is only available in the app.');
  if (initPromise) await initPromise;
  const { store } = await loadPurchasePlugin();
  lastVerifyError = null;
  const err = await store.restorePurchases();
  if (err) throw new Error(err.message || 'Restore failed.');
  // The store delivers restored transactions on a later tick, after the call
  // above has resolved; give them a moment to show up, then wait out any
  // verification they kicked off.
  await new Promise((r) => setTimeout(r, 1500));
  await Promise.allSettled([...inflight]);
  return lastVerifyError;
}
