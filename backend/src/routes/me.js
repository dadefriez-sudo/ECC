import { Router } from 'express';
import { clerkClient } from '@clerk/express';
import { prisma } from '../db.js';
import { requireUser } from '../middleware/requireUser.js';

const router = Router();

const PRO_STATUSES = new Set(['active', 'trialing']);

router.get('/', requireUser, (req, res) => {
  const u = req.dbUser;
  // Pro is a one-time purchase now; an active legacy subscription still
  // counts, so nobody who paid before the switch loses access.
  const isLifetime = !!u.lifetimePurchasedAt;
  res.json({
    id: u.id,
    email: u.email,
    isPro: isLifetime || PRO_STATUSES.has(u.subscriptionStatus),
    isLifetime,
    lifetimePurchasedAt: u.lifetimePurchasedAt,
    // Only set for pre-switch subscribers — the frontend uses this to decide
    // whether to offer the "manage billing" escape hatch at all.
    subscriptionStatus: u.subscriptionStatus,
    currentPeriodEnd: u.currentPeriodEnd,
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

