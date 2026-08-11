import rateLimit from 'express-rate-limit';

// Two tiers. The assistant route already has its own hand-rolled per-user
// throttle (see routes/assistant.js) because it also needs to reason about
// API spend, not just request count — everything else had nothing at all.

// Applied to the whole API, keyed by IP (nothing here needs auth to know
// who's asking). Generous on purpose: this is a backstop against a runaway
// script or a blunt scrape, not a budget for normal use — the data-sync
// poll alone is one request a minute per active device, and this leaves
// an order of magnitude of headroom above that.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// For specific write endpoints that are both spammable and keyed to a
// signed-in user (calendar/invite/event creation, the full data-blob PUT).
// Mount *after* requireUser so req.dbUser exists and this can key by
// account rather than IP — several people can legitimately share an IP
// (NAT, a office network), but they can't share an account.
export function perUserLimiter({ windowMs, limit }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.dbUser?.id || req.ip,
    message: { error: 'Too many requests, please slow down.' },
  });
}
