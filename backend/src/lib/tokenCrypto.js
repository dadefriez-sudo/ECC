import crypto from 'node:crypto';

// Encrypts googleRefreshToken before it touches the database — plaintext in
// the DB meant anyone with direct DB access (not through the API, which is
// already locked down) could read a live token and pull a user's Google
// Calendar. Optional and additive like the other lazy-config secrets in this
// codebase (see billing.js's getStripe): if TOKEN_ENCRYPTION_KEY isn't set,
// tokens are stored/read as plaintext exactly like before this existed, so
// rollout doesn't require touching existing rows.
const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'v1:';

let key; // Buffer | null, undefined until first use
function getKey() {
  if (key !== undefined) return key;
  const raw = process.env.TOKEN_ENCRYPTION_KEY || '';
  if (!raw) {
    key = null;
    return key;
  }
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of 32 random bytes).');
  }
  key = decoded;
  return key;
}

export function encryptToken(plaintext) {
  const k = getKey();
  if (!k) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, k, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

// Rows written before TOKEN_ENCRYPTION_KEY was configured are still plain
// text (no "v1:" prefix) — passed through unchanged rather than erroring, so
// an already-connected user isn't forced to reconnect the moment the key is
// added. They naturally get encrypted the next time they (re)connect Google.
export function decryptToken(stored) {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  const k = getKey();
  if (!k) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not set but a stored token is encrypted — cannot decrypt.');
  }
  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, k, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
