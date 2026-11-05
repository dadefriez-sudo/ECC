import { Router, raw } from 'express';
import { verifyWebhook } from '@clerk/express/webhooks';
import { prisma } from '../db.js';
import { verifiedPrimaryEmail } from '../lib/validate.js';

const router = Router();

// verifyWebhook() re-serializes req.body for signature checking, so this
// route must see the raw bytes too — mount before express.json().
router.post('/', raw({ type: 'application/json' }), async (req, res) => {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error('[clerk webhook] signature verification failed:', err.message);
    return res.status(400).send('Webhook verification failed');
  }

  try {
    switch (evt.type) {
      case 'user.created': {
        const email = verifiedPrimaryEmail(evt.data.email_addresses, evt.data.primary_email_address_id);
        if (email) {
          await prisma.user.upsert({
            where: { clerkId: evt.data.id },
            update: { email },
            create: { clerkId: evt.data.id, email },
          });
        }
        break;
      }
      case 'user.deleted': {
        await prisma.user
          .delete({ where: { clerkId: evt.data.id } })
          .catch(() => {}); // already gone / never provisioned — fine
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[clerk webhook] handler error:', err?.name, err?.code || '');
    res.status(500).send('Webhook handler error');
  }
});

export default router;
