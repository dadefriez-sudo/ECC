import { prisma } from '../../src/db.js';
// Test-only sign-in: "Authorization: Bearer test:<email>" is that user.
export async function requireUser(req, res, next) {
  const m = (req.headers.authorization || '').match(/^Bearer test:(.+)$/);
  if (!m) return res.status(401).json({ error: 'Unauthorized' });
  const email = m[1].toLowerCase();
  try {
    req.dbUser = await prisma.user.upsert({ where: { clerkId: email }, update: {}, create: { clerkId: email, email } });
    next();
  } catch (e) {
    next(e);
  }
}
