// When to nudge someone to back up. Keystone keeps everything on the phone, and
// uninstalling the app (or reinstalling a different version) erases it, so a recent
// backup file is the only way back. Pure functions so they can be tested.
const DAY = 24 * 60 * 60 * 1000;
export const REMIND_AFTER_DAYS = 7; // since the last backup
export const FIRST_REMINDER_DAYS = 3; // grace for someone new who has never backed up
export const SNOOZE_DAYS = 7;

// Days since the last backup of either kind, or null if there never was one.
export function backupAgeDays(state, now = Date.now()) {
  const s = state?.settings || {};
  const stamps = [s.lastBackupAt, s.lastAutoBackupAt].map((v) => Date.parse(v || '')).filter(Number.isFinite);
  if (!stamps.length) return null;
  return Math.floor((now - Math.max(...stamps)) / DAY);
}

export function backupReminderDue(state, now = Date.now()) {
  const s = state?.settings || {};
  if (s.backupReminder === false) return false;
  if (Number(s.backupSnoozedUntil) > now) return false;
  const age = backupAgeDays(state, now);
  if (age !== null) return age >= REMIND_AFTER_DAYS;
  const start = Date.parse(s.backupClockStart || '');
  if (!Number.isFinite(start)) return false; // the clock starts the first time the card is considered
  return now - start >= FIRST_REMINDER_DAYS * DAY;
}

export function describeBackupAge(state, now = Date.now()) {
  const age = backupAgeDays(state, now);
  if (age === null) return 'No backup yet';
  if (age <= 0) return 'Last backup: today';
  return age === 1 ? 'Last backup: yesterday' : `Last backup: ${age} days ago`;
}
