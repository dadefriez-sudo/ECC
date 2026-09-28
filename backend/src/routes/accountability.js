import { Router } from 'express';
import { requireUser } from '../middleware/requireUser.js';
import { perUserLimiter } from '../middleware/rateLimit.js';
import { prisma } from '../db.js';

const router = Router();

const INVITE_TTL_DAYS = 7;
// Free accounts can have this many accountability partners; Pro removes
// the cap. Checked on BOTH sides of an accept — the inviter when they send
// the invite, the accepter when they accept it — since either one could
// already be at their own limit.
const FREE_PARTNER_LIMIT = 1;
// Same isPro computation as routes/me.js (duplicated rather than shared,
// matching how routes/assistant.js and routes/calendars.js already do
// their own copy) — Pro is a one-time purchase now; an active legacy
// subscription and the beta-tester allowlist both still count.
const PRO_STATUSES = new Set(['active', 'trialing']);
const BETA_TESTER_EMAILS = new Set(
  (process.env.BETA_TESTER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);
function isPro(u) {
  return (
    !!u.lifetimePurchasedAt ||
    PRO_STATUSES.has(u.subscriptionStatus) ||
    BETA_TESTER_EMAILS.has((u.email || '').toLowerCase())
  );
}

// Mirrors calendars.js's own limiter shape/reasoning: invites and the
// snapshot push are the two things a client could otherwise flood.
const inviteLimiter = perUserLimiter({ windowMs: 60 * 60 * 1000, limit: 30 });
const snapshotLimiter = perUserLimiter({ windowMs: 60 * 60 * 1000, limit: 120 });

async function partnerCount(userId) {
  return prisma.accountabilityPartner.count({ where: { userId } });
}

// List everyone I'm partnered with, each with their latest pushed progress
// summary (null if they've never pushed one, e.g. just accepted and
// haven't opened the app since).
router.get('/partners', requireUser, async (req, res, next) => {
  try {
    const rows = await prisma.accountabilityPartner.findMany({
      where: { userId: req.dbUser.id },
      include: { partner: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const snapshots = await prisma.accountabilitySnapshot.findMany({
      where: { userId: { in: rows.map((r) => r.partnerId) } },
    });
    const snapshotByUserId = Object.fromEntries(snapshots.map((s) => [s.userId, s]));
    res.json({
      partners: rows.map((r) => ({
        userId: r.partner.id,
        email: r.partner.email,
        since: r.createdAt,
        progress: snapshotByUserId[r.partnerId]?.data ?? null,
        progressUpdatedAt: snapshotByUserId[r.partnerId]?.updatedAt ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Remove a partnership — deletes both directional rows so it disappears
// from both people's lists, not just the one who acted.
router.delete('/partners/:userId', requireUser, async (req, res, next) => {
  try {
    await prisma.accountabilityPartner.deleteMany({
      where: {
        OR: [
          { userId: req.dbUser.id, partnerId: req.params.userId },
          { userId: req.params.userId, partnerId: req.dbUser.id },
        ],
      },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Snapshot --------------------------------------------------------------
// Deliberately NOT gated on Pro/cloud sync — this is the small piece of
// data that makes the free tier's one partner actually work (see the
// schema comment on AccountabilitySnapshot).

router.put('/snapshot', requireUser, snapshotLimiter, async (req, res, next) => {
  const { data } = req.body || {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Request body must be { data: <object> }' });
  }
  try {
    const row = await prisma.accountabilitySnapshot.upsert({
      where: { userId: req.dbUser.id },
      update: { data },
      create: { userId: req.dbUser.id, data },
    });
    res.json({ updatedAt: row.updatedAt });
  } catch (err) {
    next(err);
  }
});

// --- Invites -----------------------------------------------------------
// Sending the actual email is out of scope here — this just creates the
// invite row and returns a token the frontend can turn into a shareable
// link, same as calendars.js's invite flow.

router.get('/invites', requireUser, async (req, res, next) => {
  try {
    const invites = await prisma.accountabilityInvite.findMany({
      where: { fromUserId: req.dbUser.id, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ invites });
  } catch (err) {
    next(err);
  }
});

router.post('/invites', requireUser, inviteLimiter, async (req, res, next) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required' });
  if (email === req.dbUser.email.toLowerCase()) {
    return res.status(400).json({ error: "You can't invite yourself" });
  }
  try {
    if (!isPro(req.dbUser)) {
      const count = await partnerCount(req.dbUser.id);
      if (count >= FREE_PARTNER_LIMIT) {
        return res.status(402).json({
          error: `Free accounts can have ${FREE_PARTNER_LIMIT} accountability partner. Upgrade to Pro for more.`,
          code: 'partner_limit',
        });
      }
    }
    const invite = await prisma.accountabilityInvite.create({
      data: {
        fromUserId: req.dbUser.id,
        email,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    res.status(201).json({ invite });
  } catch (err) {
    next(err);
  }
});

router.delete('/invites/:id', requireUser, async (req, res, next) => {
  try {
    const invite = await prisma.accountabilityInvite.findUnique({ where: { id: req.params.id } });
    if (!invite || invite.fromUserId !== req.dbUser.id) return res.status(404).json({ error: 'Invite not found' });
    await prisma.accountabilityInvite.delete({ where: { id: invite.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Accepting doesn't require any prior relationship — keyed by the invite
// token, same as calendars.js's accept route.
router.post('/invites/:token/accept', requireUser, async (req, res, next) => {
  try {
    const invite = await prisma.accountabilityInvite.findUnique({ where: { token: req.params.token } });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.acceptedAt) return res.status(400).json({ error: 'Invite already used' });
    if (invite.expiresAt < new Date()) return res.status(400).json({ error: 'Invite expired' });
    if (invite.fromUserId === req.dbUser.id) return res.status(400).json({ error: "You can't accept your own invite" });

    const existing = await prisma.accountabilityPartner.findUnique({
      where: { userId_partnerId: { userId: req.dbUser.id, partnerId: invite.fromUserId } },
    });
    if (existing) {
      await prisma.accountabilityInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      return res.json({ partnerId: invite.fromUserId, alreadyPartners: true });
    }

    if (!isPro(req.dbUser)) {
      const count = await partnerCount(req.dbUser.id);
      if (count >= FREE_PARTNER_LIMIT) {
        return res.status(402).json({
          error: `Free accounts can have ${FREE_PARTNER_LIMIT} accountability partner. Upgrade to Pro to accept more.`,
          code: 'partner_limit',
        });
      }
    }
    const inviter = await prisma.user.findUnique({ where: { id: invite.fromUserId } });
    if (inviter && !isPro(inviter)) {
      const inviterCount = await partnerCount(inviter.id);
      if (inviterCount >= FREE_PARTNER_LIMIT) {
        return res.status(402).json({
          error: 'This person is on a free account and already has an accountability partner.',
          code: 'partner_limit_inviter',
        });
      }
    }

    await prisma.$transaction([
      prisma.accountabilityInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
      prisma.accountabilityPartner.create({
        data: { userId: req.dbUser.id, partnerId: invite.fromUserId },
      }),
      prisma.accountabilityPartner.create({
        data: { userId: invite.fromUserId, partnerId: req.dbUser.id },
      }),
    ]);
    res.json({ partnerId: invite.fromUserId, alreadyPartners: false });
  } catch (err) {
    next(err);
  }
});

export default router;
