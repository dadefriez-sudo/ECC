// Password-protected backups. A backup holds everything in the app: names,
// phone numbers, addresses and notes about other people. It is written to the
// phone's shared Documents folder, which other apps and file managers can read,
// so it is encrypted before it gets there.
//
// AES-256-GCM with a key derived from the person's password (PBKDF2, SHA-256,
// 250,000 rounds, random salt per file). GCM also detects a wrong password or a
// damaged file. Nothing about the password is stored in the file.
export const MIN_PASSWORD_LENGTH = 8;
const ITERATIONS = 250000;
const FORMAT = 2;

const te = new TextEncoder();
const td = new TextDecoder();

// Chunked: spreading a multi-megabyte array into String.fromCharCode overflows the call stack.
function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isEncryptedBackup(value) {
  return !!value && typeof value === 'object' && value.keystoneBackup === FORMAT && typeof value.data === 'string';
}

// Returns the text to write to the file.
export async function encryptBackup(plainText, password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`The backup password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(plainText)));
  return JSON.stringify({
    keystoneBackup: FORMAT,
    kdf: 'PBKDF2-SHA256',
    iter: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(cipher),
  });
}

// Takes the parsed envelope. Throws Error('wrong-password') if the password is
// wrong or the file has been altered.
export async function decryptBackup(envelope, password) {
  if (!isEncryptedBackup(envelope)) throw new Error('not-encrypted');
  try {
    const key = await deriveKey(String(password || ''), fromBase64(envelope.salt), Number(envelope.iter) || ITERATIONS);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.data));
    return td.decode(plain);
  } catch {
    throw new Error('wrong-password');
  }
}
