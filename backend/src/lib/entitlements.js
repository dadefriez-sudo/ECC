// Who counts as Pro, in one place. Pro is a one-time purchase; an active legacy
// subscription and the beta-tester allowlist (an env var, so adding someone
// never needs a deploy) count too. The assistant is stricter on purpose and
// does not honour the beta list, so it has its own check below.
const PRO_STATUSES = new Set(['active', 'trialing']);

const betaEmails = () =>
  new Set(
    (process.env.BETA_TESTER_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );

export function isBetaTester(u) {
  return betaEmails().has((u?.email || '').toLowerCase());
}

export function isPro(u) {
  return !!u?.lifetimePurchasedAt || PRO_STATUSES.has(u?.subscriptionStatus) || isBetaTester(u);
}

// Paid (lifetime or legacy subscription), not a beta tester.
export function hasPaidPro(u) {
  return !!u?.lifetimePurchasedAt || PRO_STATUSES.has(u?.subscriptionStatus);
}
