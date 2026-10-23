import crypto from 'node:crypto';

// Small input checks shared by the routes. The routes used to store whatever
// strings they were sent (up to the 8 MB body limit), which let one account
// fill the database with a few requests; these keep fields to a sane size and
// shape without being strict about anything a real client sends.
export const LIMITS = { name: 100, title: 200, notes: 5000, email: 254 };

export const isColor = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v);
export const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isTime = (v) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
export const isEmail = (v) => typeof v === 'string' && v.length <= LIMITS.email && /^[^@\s]+@[^@\s]+$/.test(v);
export const withinLimit = (v, max) => typeof v === 'string' && v.length <= max;

// An unguessable invite token. The schema's default is a cuid, which is built to
// be unique, not secret; an invite link is a bearer credential, so use real
// randomness (192 bits).
export const newInviteToken = () => crypto.randomBytes(24).toString('base64url');
