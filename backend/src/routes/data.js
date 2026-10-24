import { Router } from 'express';
import { requireUser } from '../middleware/requireUser.js';
import { perUserLimiter } from '../middleware/rateLimit.js';
import { prisma } from '../db.js';

const router = Router();

// The frontend debounces pushes to one per 2.5s of active editing (see
// App.jsx's DataSync) — worst case, continuous editing for 15 minutes is
// ~360 pushes. This leaves headroom above that for a genuinely heavy
// session while still bounding a stuck-effect loop or bug that would
// otherwise hammer Postgres with unlimited 8MB upserts.
const putLimiter = perUserLimiter({ windowMs: 15 * 60 * 1000, limit: 400 });

// Whole-blob sync: the frontend already keeps its entire app state as one
// JSON object (localStorage key compass.data.v1), so this mirrors that
// shape 1:1 rather than modeling nine entity types relationally.
router.get('/', requireUser, async (req, res, next) => {
  try {
    const row = await prisma.userData.findUnique({ where: { userId: req.dbUser.id } });
    // `?since=<updatedAt>`: a poll that already holds this version does not
    // need the whole blob again, just confirmation that nothing changed.
    const since = typeof req.query.since === 'string' ? new Date(req.query.since) : null;
    if (row && since && !Number.isNaN(since.getTime()) && row.updatedAt.getTime() === since.getTime()) {
      return res.json({ unchanged: true, updatedAt: row.updatedAt });
    }
    res.json({ data: row?.data ?? null, updatedAt: row?.updatedAt ?? null });
  } catch (err) {
    next(err);
  }
});

router.put('/', requireUser, putLimiter, async (req, res, next) => {
  const { data, baseUpdatedAt } = req.body || {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Request body must be { data: <object> }' });
  }
  try {
    // Optimistic concurrency: a client that says which version it started
    // from only gets to write if that is still the current one. Otherwise it
    // is sent the current copy (409) so it can merge and try again, instead of
    // silently overwriting what another device saved in the meantime. A client
    // that sends no baseUpdatedAt (an older app version) keeps the old
    // overwrite behavior.
    if (baseUpdatedAt !== undefined && baseUpdatedAt !== null) {
      const base = new Date(baseUpdatedAt);
      if (Number.isNaN(base.getTime())) {
        return res.status(400).json({ error: 'baseUpdatedAt must be a date' });
      }
      const written = await prisma.userData.updateManyAndReturn({
        where: { userId: req.dbUser.id, updatedAt: base },
        data: { data },
      });
      if (written.length === 1) return res.json({ updatedAt: written[0].updatedAt });
      const current = await prisma.userData.findUnique({ where: { userId: req.dbUser.id } });
      if (current) {
        return res.status(409).json({ error: 'conflict', code: 'conflict', data: current.data, updatedAt: current.updatedAt });
      }
      // No row yet: this is the first write, fall through to create it.
    }
    const row = await prisma.userData.upsert({
      where: { userId: req.dbUser.id },
      update: { data },
      create: { userId: req.dbUser.id, data },
    });
    res.json({ updatedAt: row.updatedAt });
  } catch (err) {
    next(err);
  }
});

export default router;
