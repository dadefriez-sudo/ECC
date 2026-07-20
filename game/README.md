# Gravity Dash 🚀

A one-thumb, endless arcade game built as a single self-contained HTML file.
Tap anywhere to flip gravity, dodge the spikes, grab the coins. Speed ramps up
the longer you survive. Works in any mobile browser, installs as a PWA, and
wraps cleanly into a native app.

**Play:** open `game/index.html` in any browser (desktop: click / Space to flip).

## Why this is easy to monetize

The whole point of the design is a short, replayable loop ("just one more run")
with natural, non-annoying places to show ads and sell things. Every
monetization touchpoint lives in **two objects** at the top of the `<script>`
block — `Ads` and `IAP` — so going live is a handful of edits, not a rewrite.

### Revenue surfaces already wired in

| Surface | Where it fires | Type |
|---|---|---|
| **Rewarded — Revive** | Game Over → "📺 Revive & keep going" | Highest-value; players opt in to save a good run |
| **Rewarded — 2× coins** | Game Over → "📺 2× coins" | Doubles the run's coins |
| **Rewarded — +50 coins** | Shop → "Watch ad" | On-demand soft currency |
| **Interstitial** | Every 3rd death (frequency-capped, skipped if Remove-Ads owned) | `Ads.maybeInterstitial()` |
| **Banner slot** | Start & Game Over screens (`.adslot` divs) | Passive |
| **IAP — Remove Ads** | Shop · $2.99 | Kills interstitials/banners |
| **IAP — Coin pack** | Shop · $1.99 | 500 coins |
| **Skins** | Shop · buy with earned coins | Soft-currency sink that drives ad-watching & coin-pack sales |

The demo build uses `confirm()` dialogs to *simulate* an ad/purchase so you can
test the reward flow immediately. Replace those with your SDK.

## Going live — the only 3 places you edit

**1. Rewarded video** (`Ads.rewarded`) — resolve `true` when the reward is earned:

```js
rewarded(reason){
  return new Promise((resolve)=>{
    admob.rewarded.load("YOUR_REWARDED_UNIT_ID");
    admob.rewarded.show()
      .on("rewarded", () => resolve(true))
      .on("closed",   () => resolve(false));
  });
}
```

**2. Interstitial** (`Ads.maybeInterstitial`) — the frequency cap and Remove-Ads
check are already done; just show the ad and resolve:

```js
// inside the returned Promise:
admob.interstitial.show().then(resolve).catch(resolve);
```

**3. In-app purchase** (`IAP.buy`) — resolve `true` on a verified purchase:

```js
buy(product){
  return billing.purchase(product.id).then(r => r.status === "purchased");
}
```

That's it — the game logic never changes.

## Recommended networks

- **AdMob** (Google) — best fill for a casual game; rewarded + interstitial + banner.
- **Unity Ads** / **AppLovin MAX** — strong rewarded eCPM; MAX lets you mediate several networks.
- **Web only:** Google AdSense / H5 ad SDKs (e.g. GameDistribution, CrazyGames) if you publish as a web game.

## Shipping it

- **Web / PWA:** host `index.html` anywhere static (GitHub Pages, Netlify, Cloudflare Pages). Add a `manifest.json` + service worker to make it installable.
- **Native app store:** wrap with **Capacitor** (recommended) or Cordova, then add the AdMob + Billing plugins and point the three stubs above at them. One codebase → iOS + Android.

```bash
npm i -g @capacitor/cli
npx cap init "Gravity Dash" com.you.gravitydash
npx cap add ios && npx cap add android
# put index.html in the web dir, then:
npx cap sync
```

## Tuning knobs (top of the script)

- `Ads.interstitialEvery` — deaths between interstitials (default `3`).
- `SKINS` — add cosmetics; `price` is in coins (`0` = free/owned).
- Difficulty ramp: `G.speed = baseSpeed + min(t*0.35, ...)` in `update()`.
- Coin/spike spawn rates: `spawnColumn()`.

## Retention ideas (next, if you want more revenue)

Daily reward, a coin-doubler "starter pack" IAP, a revive that gets pricier each
use, leaderboards, and a daily challenge — all bolt onto the existing loop.
