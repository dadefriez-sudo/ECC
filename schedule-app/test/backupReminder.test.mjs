import test from 'node:test';
import assert from 'node:assert/strict';
import { backupAgeDays, backupReminderDue, describeBackupAge } from '../src/data/backupReminder.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-12T12:00:00Z');
const at = (days) => new Date(NOW - days * DAY).toISOString();
const st = (settings) => ({ settings });

test('a new install is not nagged until the grace period has passed', () => {
  assert.equal(backupReminderDue(st({}), NOW), false); // clock not started yet
  assert.equal(backupReminderDue(st({ backupClockStart: at(1) }), NOW), false);
  assert.equal(backupReminderDue(st({ backupClockStart: at(3) }), NOW), true);
});

test('a recent backup, manual or automatic, keeps the reminder away', () => {
  assert.equal(backupReminderDue(st({ lastBackupAt: at(2), backupClockStart: at(30) }), NOW), false);
  assert.equal(backupReminderDue(st({ lastAutoBackupAt: at(1), backupClockStart: at(30) }), NOW), false);
});

test('a week-old backup brings it back; the newer of the two stamps counts', () => {
  assert.equal(backupReminderDue(st({ lastBackupAt: at(7) }), NOW), true);
  assert.equal(backupReminderDue(st({ lastBackupAt: at(20), lastAutoBackupAt: at(1) }), NOW), false);
});

test('snoozing and turning the reminder off both hide it', () => {
  assert.equal(backupReminderDue(st({ lastBackupAt: at(30), backupSnoozedUntil: NOW + DAY }), NOW), false);
  assert.equal(backupReminderDue(st({ lastBackupAt: at(30), backupSnoozedUntil: NOW - 1 }), NOW), true);
  assert.equal(backupReminderDue(st({ lastBackupAt: at(30), backupReminder: false }), NOW), false);
});

test('the status line says how old the last backup is', () => {
  assert.equal(backupAgeDays(st({}), NOW), null);
  assert.equal(describeBackupAge(st({}), NOW), 'No backup yet');
  assert.equal(describeBackupAge(st({ lastBackupAt: at(0) }), NOW), 'Last backup: today');
  assert.equal(describeBackupAge(st({ lastBackupAt: at(1) }), NOW), 'Last backup: yesterday');
  assert.equal(describeBackupAge(st({ lastBackupAt: at(9) }), NOW), 'Last backup: 9 days ago');
});
