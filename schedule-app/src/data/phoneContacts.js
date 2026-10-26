import { findExistingContact } from './contactMatch.js';

// Turns what the phone returns into the same plain shape the .vcf import makes,
// drops entries with no name, and flags the ones Keystone already has.
export function normalizePhoneContacts(raw, existingContacts = []) {
  const seen = new Set();
  const out = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    const name = String(c?.name || '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const first = (list) => (Array.isArray(list) ? String(list.find((v) => String(v || '').trim()) || '').trim() : '');
    const contact = {
      id: String(c.id ?? `${name}|${first(c.phones)}`),
      name,
      phone: first(c.phones),
      email: first(c.emails),
      // The phone stores addresses with line breaks; one line reads better and geocodes the same.
      address: first(c.addresses).replace(/\s*\n\s*/g, ', '),
    };
    if (seen.has(contact.id)) continue;
    seen.add(contact.id);
    out.push({ ...contact, existing: !!findExistingContact(existingContacts, contact) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
