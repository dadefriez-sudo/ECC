import { Router } from 'express';
import { requireUser } from '../middleware/requireUser.js';
import { perUserLimiter } from '../middleware/rateLimit.js';
import { prisma } from '../db.js';
import { isEmail, newInviteToken } from '../lib/validate.js';

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
  // The snapshot is a few goal titles and counts; a partner downloads it on
  // every refresh, so don't let it be used to park (or serve) megabytes.
  if (JSON.stringify(data).length > 64 * 1024) {
    return res.status(413).json({ error: 'Snapshot is too large' });
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

// Erase what this person has shared. Called when their last partner is removed,
// so progress isn't left sitting on the server with no one it's shared with.
router.delete('/snapshot', requireUser, async (req, res, next) => {
  try {
    await prisma.accountabilitySnapshot.deleteMany({ where: { userId: req.dbUser.id } });
    res.json({ ok: true });
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
      where: { fromUserId: req.dbUser.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ invites });
  } catch (err) {
    next(err);
  }
});

router.post('/invites', requireUser, inviteLimiter, async (req, res, next) => {
  // The email is optional and only a label for the inviter's own list: an invite
  // is accepted by whoever holds the link, so there is nothing to type up front.
  const email = (req.body?.email || '').trim().toLowerCase();
  if (email && !isEmail(email)) return res.status(400).json({ error: 'That does not look like an email address' });
  if (email && email === req.dbUser.email.toLowerCase()) {
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
        token: newInviteToken(),
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

// "Who is inviting me?" — shown on the join screen so accepting is a deliberate
// tap, not something that happens just because a link was opened. Reveals only
// the inviter's email (which the invite holder is about to share progress with).
router.get('/invites/:token', requireUser, async (req, res, next) => {
  try {
    const invite = await prisma.accountabilityInvite.findUnique({ where: { token: req.params.token } });
    const inviter = invite ? await prisma.user.findUnique({ where: { id: invite.fromUserId } }) : null;
    if (!invite || !inviter) return res.status(404).json({ error: 'This invite is no longer valid.' });
    const existing = await prisma.accountabilityPartner.findUnique({
      where: { userId_partnerId: { userId: req.dbUser.id, partnerId: inviter.id } },
    });
    let status = 'valid';
    if (inviter.id === req.dbUser.id) status = 'self';
    else if (existing) status = 'already_partners';
    else if (invite.acceptedAt) status = 'used';
    else if (invite.expiresAt < new Date()) status = 'expired';
    res.json({ fromEmail: inviter.email, expiresAt: invite.expiresAt, status });
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
    const inviter = await prisma.user.findUnique({ where: { id: invite.fromUserId } });
    if (!inviter) return res.status(404).json({ error: 'This invite is no longer valid.' });
    if (invite.fromUserId === req.dbUser.id) return res.status(400).json({ error: "You can't accept your own invite" });

    const existing = await prisma.accountabilityPartner.findUnique({
      where: { userId_partnerId: { userId: req.dbUser.id, partnerId: invite.fromUserId } },
    });
    // Already partners (a double tap, or the same link opened twice): that's the
    // outcome they wanted, so say so instead of an error.
    if (existing) {
      if (!invite.acceptedAt) {
        await prisma.accountabilityInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      }
      return res.json({ partnerId: invite.fromUserId, partnerEmail: inviter.email, alreadyPartners: true });
    }
    if (invite.acceptedAt) return res.status(400).json({ error: 'This invite was already used.' });
    if (invite.expiresAt < new Date()) return res.status(400).json({ error: 'This invite has expired. Ask them for a new one.' });

    if (!isPro(req.dbUser)) {
      const count = await partnerCount(req.dbUser.id);
      if (count >= FREE_PARTNER_LIMIT) {
        return res.status(402).json({
          error: `Free accounts can have ${FREE_PARTNER_LIMIT} accountability partner. Upgrade to Pro to accept more.`,
          code: 'partner_limit',
        });
      }
    }
    if (!isPro(inviter)) {
      const inviterCount = await partnerCount(inviter.id);
      if (inviterCount >= FREE_PARTNER_LIMIT) {
        return res.status(402).json({
          error: 'This person is on a free account and already has an accountability partner.',
          code: 'partner_limit_inviter',
        });
      }
    }

    try {
      await prisma.$transaction([
        prisma.accountabilityInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
        prisma.accountabilityPartner.create({ data: { userId: req.dbUser.id, partnerId: invite.fromUserId } }),
        prisma.accountabilityPartner.create({ data: { userId: invite.fromUserId, partnerId: req.dbUser.id } }),
      ]);
    } catch (err) {
      // Two accepts raced and the other one won: same outcome, not an error.
      if (err.code === 'P2002') {
        return res.json({ partnerId: invite.fromUserId, partnerEmail: inviter.email, alreadyPartners: true });
      }
      throw err;
    }
    res.json({ partnerId: invite.fromUserId, partnerEmail: inviter.email, alreadyPartners: false });
  } catch (err) {
    next(err);
  }
});

export default router;
