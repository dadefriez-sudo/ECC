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
    // Which account(s) the person is saved under (a Google account, the phone, a SIM...).
    const accounts = Array.isArray(c.accounts) ? c.accounts.map((a) => String(a)).filter(Boolean) : [];
    if (seen.has(contact.id)) continue;
    seen.add(contact.id);
    out.push({ ...contact, accounts, google: !!c.google, existing: !!findExistingContact(existingContacts, contact) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

// The accounts the phone's contacts are saved under, Google ones first, for the
// picker's filter. Each is { name, google, count }.
export function contactAccounts(list) {
  const map = new Map();
  for (const c of list) {
    for (const name of c.accounts?.length ? c.accounts : ['On this phone']) {
      const cur = map.get(name) || { name, google: false, count: 0 };
      cur.count += 1;
      if (c.google && /@/.test(name)) cur.google = true;
      map.set(name, cur);
    }
  }
  return [...map.values()].sort((a, b) => Number(b.google) - Number(a.google) || a.name.localeCompare(b.name));
}

export const inAccount = (c, account) => (c.accounts?.length ? c.accounts : ['On this phone']).includes(account);
