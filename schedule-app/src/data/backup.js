import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { encryptBackup, isEncryptedBackup, MIN_PASSWORD_LENGTH } from './backupCrypto.js';

// On-device JSON backups, separate from (and in addition to) Cloud Sync.
// Written to the Documents directory, which on Android is the public,
// user-visible Documents folder (outside the app's own private storage, so
// it survives an uninstall) and on iOS is the app's sandboxed Documents
// directory, which gets swept into the user's normal device backup unless
// they've turned that off. Neither is as strong a guarantee as Cloud Sync,
// but both are real improvement over "only exists in this app's storage."
const BACKUP_DIR = 'KeystoneBackups';
const KEEP_LAST = 5;
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const isNative = Capacitor.isNativePlatform();

export function backupSupported() {
  return isNative;
}

// A backup is only written once a password has been chosen (it is encrypted
// with it). The password lives in this device's own settings and is never synced.
export const hasBackupPassword = (state) =>
  typeof state?.settings?.backupPassphrase === 'string' && state.settings.backupPassphrase.length >= MIN_PASSWORD_LENGTH;

function backupFilename(date = new Date()) {
  return `keystone-backup-${date.toISOString().slice(0, 10)}-${date.getTime()}.json`;
}

async function listBackups() {
  try {
    const { files } = await Filesystem.readdir({ path: BACKUP_DIR, directory: Directory.Documents });
    return files
      .filter((f) => f.name.endsWith('.json'))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    // Directory doesn't exist yet — no backups taken so far.
    return [];
  }
}

async function pruneOldBackups() {
  const files = await listBackups();
  const excess = files.length - KEEP_LAST;
  if (excess <= 0) return;
  for (const f of files.slice(0, excess)) {
    await Filesystem.deleteFile({ path: `${BACKUP_DIR}/${f.name}`, directory: Directory.Documents }).catch(() => {});
  }
}

// Writes one backup now and prunes older ones beyond KEEP_LAST. Used by both
// the manual "Export" button and the automatic daily check below.
export async function writeBackupNow(state) {
  if (!isNative) return null;
  if (!hasBackupPassword(state)) throw new Error('Set a backup password first.');
  // The password is for the file's lock, and the Canvas link is a private key to a
  // calendar; neither goes inside the file.
  const { backupPassphrase, canvasFeedUrl, ...settings } = state.settings || {};
  const json = JSON.stringify({ ...state, settings }, null, 2);
  const filename = backupFilename();
  await Filesystem.writeFile({
    path: `${BACKUP_DIR}/${filename}`,
    data: await encryptBackup(json, backupPassphrase),
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  await pruneOldBackups();
  return filename;
}

// Earlier versions wrote backups as plain readable text. Once a password is set
// those are removed (they are our own files, in our own folder), so nothing
// readable is left behind. Returns how many were deleted.
export async function removeUnencryptedBackups() {
  if (!isNative) return 0;
  let removed = 0;
  for (const f of await listBackups()) {
    try {
      const { data } = await Filesystem.readFile({
        path: `${BACKUP_DIR}/${f.name}`,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      let encrypted = false;
      try {
        encrypted = isEncryptedBackup(JSON.parse(data));
      } catch {
        encrypted = false;
      }
      if (!encrypted) {
        await Filesystem.deleteFile({ path: `${BACKUP_DIR}/${f.name}`, directory: Directory.Documents });
        removed++;
      }
    } catch {
      /* unreadable: leave it */
    }
  }
  return removed;
}

// Called once on app start. Writes a fresh backup if it's been at least a
// day since the last one (tracked in settings, not by scanning the
// filesystem, since that's cheap and avoids a readdir on every launch).
// Opt-in only — see the first-launch prompt in App.jsx — so this is a no-op
// until the person has actually said yes, not just because they're on native.
export async function maybeAutoBackup(state, actions) {
  if (!isNative) return;
  if (state.settings?.autoBackupEnabled !== true) return;
  if (!hasBackupPassword(state)) return; // nothing is written unencrypted
  const last = state.settings?.lastAutoBackupAt ? new Date(state.settings.lastAutoBackupAt).getTime() : 0;
  if (Date.now() - last < AUTO_BACKUP_INTERVAL_MS) return;
  try {
    await writeBackupNow(state);
    actions.setSettings({ lastAutoBackupAt: new Date().toISOString() });
  } catch (err) {
    // Best-effort — a failed background backup shouldn't surface as an
    // error to someone who didn't ask for anything just by opening the app.
    console.warn('Auto backup failed:', err.message);
  }
}
