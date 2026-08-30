import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import { apiLimiter } from './middleware/rateLimit.js';
import meRoutes from './routes/me.js';
import billingRoutes from './routes/billing.js';
import dataRoutes from './routes/data.js';
import calendarsRoutes from './routes/calendars.js';
import googleRoutes from './routes/google.js';
import assistantRoutes from './routes/assistant.js';
import stripeWebhookRouter from './routes/webhooksStripe.js';
import clerkWebhookRouter from './routes/webhooksClerk.js';

export function createApp() {
  const app = express();

  // Render (see README §4) puts exactly one reverse proxy in front of this
  // process. Without this, every request's req.ip is the proxy's own
  // address — every user would collapse into one IP-based rate-limit
  // bucket, and everyone would get throttled together instead of only
  // whoever's actually misbehaving. `1` trusts only that one hop's
  // X-Forwarded-For entry, not an arbitrary client-supplied header.
  app.set('trust proxy', 1);

  // The native app shell (Capacitor) has no server config of its own, so it
  // runs its WebView on Capacitor's own default origins rather than
  // FRONTEND_URL — https://localhost on Android, capacitor://localhost on
  // iOS. Restricting origin to just FRONTEND_URL (the deployed web site)
  // meant every authenticated call from the native app got CORS-blocked,
  // surfacing to the app as a generic "Failed to fetch". Auth here is a
  // Bearer token in the Authorization header, not a cookie, so widening
  // this doesn't add a CSRF-style risk — a page on another origin still
  // can't call these routes without already having a legitimate token.
  const ALLOWED_ORIGINS = new Set(
    [process.env.FRONTEND_URL, 'https://localhost', 'capacitor://localhost', 'http://localhost'].filter(Boolean)
  );
  app.use(
    cors({
      origin(origin, callback) {
        // FRONTEND_URL not set yet (e.g. still being configured) — same
        // permissive fallback the old `origin: ... || true` had, rather
        // than the native app's origins being the only ones that work.
        if (!process.env.FRONTEND_URL) return callback(null, true);
        // No Origin header at all (native non-WebView clients, curl, server-
        // to-server) — nothing to check against, so let it through.
        if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
      },
    })
  );

  // Webhooks need the raw request body for signature verification — mount
  // them before express.json() touches the stream. Left outside apiLimiter:
  // they're server-to-server from Stripe/Clerk, already signature-verified,
  // and rate-limiting them risks dropping a retry of a webhook that matters.
  app.use('/api/webhooks/stripe', stripeWebhookRouter);
  app.use('/api/webhooks/clerk', clerkWebhookRouter);

  // Liveness probe — must not depend on Clerk/DB being configured, since
  // hosting platforms hit this before/without any of that being ready, and
  // must not be rate-limited, since some platforms poll it every few
  // seconds — so it's mounted ahead of apiLimiter, not behind it.
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // A blunt, IP-keyed backstop against a runaway client or a scrape — see
  // middleware/rateLimit.js. Specific write endpoints layer a tighter,
  // per-user limit on top of this once requireUser has run.
  app.use(apiLimiter);

  // Higher than Express's 100kb default: the synced data blob can include
  // contact/profile photos as inline data URLs.
  app.use(express.json({ limit: '8mb' }));
  app.use(clerkMiddleware());

  app.use('/api/me', meRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/data', dataRoutes);
  app.use('/api/calendars', calendarsRoutes);
  app.use('/api/google', googleRoutes);
  app.use('/api/assistant', assistantRoutes);

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
