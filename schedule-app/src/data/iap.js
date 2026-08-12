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
export function initIAP(getToken, onVerified) {
  if (!isNative) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = loadPurchasePlugin().then(({ store, ProductType, Platform }) => {
    const nativePlatform = Capacitor.getPlatform() === 'ios' ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;

    store.register([{ id: PRO_PRODUCT_ID, type: ProductType.NON_CONSUMABLE, platform: nativePlatform }]);

    store.when().approved(async (transaction) => {
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
        onVerified?.();
      } catch (err) {
        console.warn('Purchase verification failed:', err.message);
      }
    });

    return store.initialize([nativePlatform]);
  });
  return initPromise;
}

export async function purchasePro() {
  if (!isNative) throw new Error('In-app purchase is only available in the app.');
  const { store, Platform } = await loadPurchasePlugin();
  const nativePlatform = Capacitor.getPlatform() === 'ios' ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;
  const product = store.get(PRO_PRODUCT_ID, nativePlatform);
  const offer = product?.getOffer();
  if (!offer) throw new Error('Pro isn’t available for purchase right now — try again in a moment.');
  const err = await offer.order();
  if (err) throw new Error(err.message || 'Purchase failed.');
}

// Apple requires a visible "Restore Purchases" action for any non-
// consumable product (App Review guideline 3.1.1) — someone who reinstalls,
// or bought on another device signed into the same App Store account, has
// no other way to get their purchase re-recognized here. Restored
// transactions flow through the same `approved` handler above.
export async function restorePurchases() {
  if (!isNative) throw new Error('Restoring purchases is only available in the app.');
  const { store } = await loadPurchasePlugin();
  const err = await store.restorePurchases();
  if (err) throw new Error(err.message || 'Restore failed.');
}
