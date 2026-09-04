import { Router } from 'express';
import { clerkClient } from '@clerk/express';
import { prisma } from '../db.js';
import { requireUser } from '../middleware/requireUser.js';

const router = Router();

const PRO_STATUSES = new Set(['active', 'trialing']);

// Comma-separated allowlist for beta testers — grants Pro without a real
// purchase, gated purely by env var so adding/removing someone never needs
// a code deploy. Case-insensitive since Clerk itself normalizes email case
// inconsistently across providers (Google sign-in vs. email/password).
const BETA_TESTER_EMAILS = new Set(
  (process.env.BETA_TESTER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

router.get('/', requireUser, (req, res) => {
  const u = req.dbUser;
  // Pro is a one-time purchase now; an active legacy subscription still
  // counts, so nobody who paid before the switch loses access.
  const isLifetime = !!u.lifetimePurchasedAt;
  const isBetaTester = BETA_TESTER_EMAILS.has((u.email || '').toLowerCase());
  res.json({
    id: u.id,
    email: u.email,
    isPro: isLifetime || PRO_STATUSES.has(u.subscriptionStatus) || isBetaTester,
    isLifetime,
    isBetaTester,
    lifetimePurchasedAt: u.lifetimePurchasedAt,
    // Only set for pre-switch subscribers — the frontend uses this to decide
    // whether to offer the "manage billing" escape hatch at all.
    subscriptionStatus: u.subscriptionStatus,
    currentPeriodEnd: u.currentPeriodEnd,
    googleConnected: !!u.googleRefreshToken,
  });
});

// Self-service account deletion (App Store guideline 5.1.1(v) / Play policy
// both require this to exist somewhere reachable in-app). Deletes the local
// row first — cascading to UserData, owned shared calendars, and calendar
// memberships via Prisma's onDelete: Cascade — so no app data survives even
// if the Clerk call below fails. Deleting the Clerk user also fires the
// user.deleted webhook (webhooksClerk.js), which does the same local delete
// and no-ops if it's already gone.
router.delete('/', requireUser, async (req, res, next) => {
  const clerkId = req.dbUser.clerkId;
  try {
    await prisma.user.delete({ where: { clerkId } }).catch(() => {});
    await clerkClient.users.deleteUser(clerkId);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;

