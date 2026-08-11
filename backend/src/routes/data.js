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
    res.json({ data: row?.data ?? null, updatedAt: row?.updatedAt ?? null });
  } catch (err) {
    next(err);
  }
});

router.put('/', requireUser, putLimiter, async (req, res, next) => {
  const { data } = req.body || {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Request body must be { data: <object> }' });
  }
  try {
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
