import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import { apiLimiter } from './middleware/rateLimit.js';
import meRoutes from './routes/me.js';
import billingRoutes from './routes/billing.js';
import dataRoutes from './routes/data.js';
import calendarsRoutes from './routes/calendars.js';
import accountabilityRoutes from './routes/accountability.js';
import googleRoutes from './routes/google.js';
import assistantRoutes from './routes/assistant.js';
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
  app.disable('x-powered-by');

  // This is a JSON API, never a page: say so, so a browser doesn't sniff, frame,
  // cache or leak the address of anything it returns.
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
      'Cross-Origin-Resource-Policy': 'same-site',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
    });
    next();
  });

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
        // FRONTEND_URL not set: allow any origin only outside production (local
        // development). In production an unset value means only the native app's
        // own origins work, never "anyone", and the startup warning says why.
        if (!process.env.FRONTEND_URL && process.env.NODE_ENV !== 'production') return callback(null, true);
        // No Origin header at all (native non-WebView clients, curl, server-
        // to-server) — nothing to check against, so let it through.
        if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
      },
    })
  );

  // Webhooks need the raw request body for signature verification — mount
  // before express.json() touches the stream. Left outside apiLimiter: it's
  // server-to-server from Clerk, already signature-verified, and rate-
  // limiting it risks dropping a retry of a webhook that matters.
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

  // Request bodies are read only up to a small limit everywhere except the data
  // sync route, which needs room for contact photos (inline data URLs) and reads
  // its own larger body *after* the caller has signed in (see routes/data.js).
  // Accepting 8 MB from anyone, before checking who they are, let an anonymous
  // client tie up the process with junk.
  const smallJson = express.json({ limit: '1mb' });
  app.use((req, res, next) => (req.path.startsWith('/api/data') ? next() : smallJson(req, res, next)));
  app.use(clerkMiddleware());

  app.use('/api/me', meRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/data', dataRoutes);
  app.use('/api/calendars', calendarsRoutes);
  app.use('/api/accountability', accountabilityRoutes);
  app.use('/api/google', googleRoutes);
  app.use('/api/assistant', assistantRoutes);

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // A body over the limit is the caller's doing, not a server fault.
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
    // Name and code only: a full error object can carry request or query values.
    console.error('[error]', req.method, req.path, err?.name, err?.code || '');
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
