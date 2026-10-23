// Is this contact (from an import) already in People? Matches on email, then on
// phone number digits, then on name when the incoming contact has neither, so
// "Import contacts again" brings over what's new instead of duplicating everyone.
const digits = (v) => String(v || '').replace(/\D/g, '');
const norm = (v) => String(v || '').trim().toLowerCase();

export function findExistingContact(existing, incoming) {
  const email = norm(incoming.email);
  const phone = digits(incoming.phone);
  const name = norm(incoming.name);
  for (const c of existing) {
    if (email && norm(c.email) === email) return c;
    if (phone.length >= 7 && digits(c.phone).slice(-10) === phone.slice(-10)) return c;
    if (!email && phone.length < 7 && name && norm(c.name) === name) return c;
  }
  return null;
}
