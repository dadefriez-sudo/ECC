import { useState } from 'react';
import Modal from './Modal.jsx';
import { MIN_PASSWORD_LENGTH } from '../data/backupCrypto.js';

// Asks for the password that locks (and later unlocks) backup files.
// mode "set": choose one (typed twice). mode "enter": type the one a backup was made with.
export default function BackupPasswordModal({ open, mode = 'set', onSubmit, onClose }) {
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const setting = mode === 'set';

  const submit = async () => {
    if (setting) {
      if (pw.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      if (pw !== again) return setError("The two passwords don't match.");
    } else if (!pw) {
      return setError('Enter the password for this backup.');
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(pw);
      setPw('');
      setAgain('');
    } catch (err) {
      setError(err?.message === 'wrong-password' ? "That password didn't open the backup." : err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={setting ? 'Choose a backup password' : 'Backup password'}
      onClose={onClose}
      footer={
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {setting ? 'Save password' : 'Open backup'}
          </button>
        </div>
      }
    >
      <div className="form">
        {setting && (
          <p className="muted small">
            Backups are saved to your Documents folder, where other apps can read files. This password locks
            them. <strong>If you forget it, a backup can't be opened</strong>, so write it down somewhere safe.
          </p>
        )}
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={setting ? 'new-password' : 'current-password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !setting && submit()}
            autoFocus
          />
        </label>
        {setting && (
          <label className="field">
            <span>Type it again</span>
            <input
              type="password"
              autoComplete="new-password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </label>
        )}
        {error && <p className="partner-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
