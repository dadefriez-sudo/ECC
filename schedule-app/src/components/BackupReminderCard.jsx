import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useStore, useActions } from '../data/store.jsx';
import { useToast } from '../data/toast.jsx';
import { backupSupported, writeBackupNow, hasBackupPassword } from '../data/backup.js';
import { backupReminderDue, describeBackupAge, SNOOZE_DAYS } from '../data/backupReminder.js';

// Everything in Keystone lives on this phone, so uninstalling or reinstalling the app
// erases it. This card shows on Home (phone app only) when there is no recent backup, with
// a one-tap backup. "Later" hides it for a week.
export default function BackupReminderCard() {
  const { state } = useStore();
  const actions = useActions();
  const navigate = useNavigate();
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  const supported = backupSupported();

  // Start the clock the first time, so a brand-new install isn't nagged on day one.
  useEffect(() => {
    if (supported && !state.settings?.backupClockStart) {
      actions.setSettings({ backupClockStart: new Date().toISOString() });
    }
  }, [supported]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!supported || !backupReminderDue(state)) return null;

  const backUp = async () => {
    // A backup is locked with a password; if there isn't one yet, More → Your data sets it.
    if (!hasBackupPassword(state)) return navigate('/more?q=your data');
    setBusy(true);
    try {
      await writeBackupNow(state);
      actions.setSettings({ lastBackupAt: new Date().toISOString() });
      showToast('Backup saved to Documents › KeystoneBackups');
    } catch (err) {
      showToast(err.message || 'Could not save the backup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="detail-section review-card backup-card" role="note">
      <div className="review-card-head">
        <span className="detail-label"><Icon name="warning" /> Back up your data</span>
        <button
          className="icon-btn"
          onClick={() => actions.setSettings({ backupSnoozedUntil: Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000 })}
          aria-label="Remind me later"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <p className="review-card-line">
        Your goals, events and people live only on this phone. Uninstalling or reinstalling Keystone erases them,
        and a backup is the only way to get them back.
      </p>
      <div className="review-card-actions">
        <button className="btn btn-primary btn-sm" onClick={backUp} disabled={busy}>
          {busy ? 'Saving…' : hasBackupPassword(state) ? 'Back up now' : 'Set up backup'}
        </button>
        <span className="muted small">{describeBackupAge(state)}</span>
      </div>
    </section>
  );
}
