import { prisma as defaultPrisma } from '../db.js';

// Finds or creates the app's User row for a Clerk sign-in whose email is already verified.
//
// Rows are keyed by clerkId, but email is unique too. When the Clerk instance changes (development
// to production, which is a different set of users), the same person arrives with a new clerkId and
// the same verified email. Creating a second row would collide on email, so the existing row is
// re-linked to the new clerkId instead. That keeps their Pro purchase and synced data attached to
// them, and is safe because only a verified primary email gets here.
export async function provisionUser({ clerkId, email }, db = defaultPrisma) {
  const byClerk = await db.user.findUnique({ where: { clerkId } });
  if (byClerk) return byClerk;
  const byEmail = await db.user.findUnique({ where: { email } });
  if (byEmail) return db.user.update({ where: { id: byEmail.id }, data: { clerkId } });
  try {
    return await db.user.create({ data: { clerkId, email } });
  } catch (err) {
    // Two requests creating the same person at once: the loser finds the winner's row.
    if (err?.code === 'P2002') {
      const again = (await db.user.findUnique({ where: { clerkId } })) || (await db.user.findUnique({ where: { email } }));
      if (again) return again;
    }
    throw err;
  }
}
