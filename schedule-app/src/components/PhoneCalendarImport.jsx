import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Checkbox from './Checkbox.jsx';
import { readPhoneCalendars, readPhoneCalendarEvents } from '../data/nativeBridge.js';
import { normalizePhoneEvents, planPhoneCalendarImport, colorFromInt } from '../data/phoneCalendar.js';

const RANGES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
];

// "Import from phone calendar": pick which of the phone's calendars to bring in
// and how far ahead. Read only, nothing leaves the phone, and importing again
// updates what's already there instead of adding it twice.
export default function PhoneCalendarImport({ open, existingEvents, onApply, onClose }) {
  const [status, setStatus] = useState('loading'); // loading | pick | working | done | denied | error
  const [calendars, setCalendars] = useState([]);
  const [picked, setPicked] = useState(() => new Set());
  const [days, setDays] = useState(90);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setStatus('loading');
    setResult(null);
    setError('');
    readPhoneCalendars()
      .then((list) => {
        if (cancelled) return;
        const sorted = [...list].sort((a, b) => `${a.account} ${a.name}`.localeCompare(`${b.account} ${b.name}`));
        setCalendars(sorted);
        setPicked(new Set(sorted.filter((c) => c.visible).map((c) => c.id)));
        setStatus('pick');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Could not read your calendars.');
        setStatus(err?.code === 'denied' ? 'denied' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = async () => {
    setStatus('working');
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startMs = startOfToday.getTime();
      const endMs = startMs + days * 86400000;
      const raw = await readPhoneCalendarEvents({ calendarIds: [...picked], startMs, endMs });
      const colors = Object.fromEntries(calendars.map((c) => [c.id, colorFromInt(c.color)]));
      const plan = planPhoneCalendarImport(existingEvents, normalizePhoneEvents(raw, colors));
      onApply(plan);
      setResult({ added: plan.add.length, updated: plan.update.length, total: raw.length });
      setStatus('done');
    } catch (err) {
      setError(err?.message || 'Could not read your events.');
      setStatus('error');
    }
  };

  const footer =
    status === 'pick' ? (
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={run} disabled={picked.size === 0}>
          Import
        </button>
      </div>
    ) : status === 'done' || status === 'error' || status === 'denied' ? (
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    ) : null;

  return (
    <Modal open={open} title="Import from phone calendar" onClose={onClose} tall footer={footer}>
      {(status === 'loading' || status === 'working') && (
        <p className="muted center-pad">{status === 'loading' ? 'Reading your calendars…' : 'Importing…'}</p>
      )}
      {status === 'denied' && (
        <div className="form">
          <p>Keystone needs permission to read your calendar.</p>
          <p className="muted small">
            Allow it in your phone's Settings → Apps → Keystone → Permissions → Calendar, then try again.
            Keystone only reads it, and only brings in what you choose here.
          </p>
        </div>
      )}
      {status === 'error' && <p className="partner-error" role="alert">{error}</p>}
      {status === 'pick' && (
        <div className="form phone-import">
          {calendars.length === 0 ? (
            <p className="muted">No calendars were found on this phone.</p>
          ) : (
            <>
              <p className="muted small">
                Choose which calendars to bring in. Keystone only reads them. Repeating events come in as
                separate events, and importing again updates them instead of adding them twice.
              </p>
              <ul className="phone-import-list">
                {calendars.map((c) => (
                  <li key={c.id} className="phone-import-row">
                    <label className="check-row">
                      <Checkbox checked={picked.has(c.id)} onChange={() => toggle(c.id)} ariaLabel={`Import ${c.name}`} />
                      <span className="phone-import-text">
                        <strong>
                          <i className="cal-dot" style={{ background: colorFromInt(c.color) || 'var(--accent)' }} /> {c.name}
                        </strong>
                        <span className="muted small">{c.account}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="field">
                <span>How far ahead</span>
                <div className="seg seg--full">
                  {RANGES.map((r) => (
                    <button
                      key={r.days}
                      className={`seg-btn${days === r.days ? ' seg-btn--on' : ''}`}
                      onClick={() => setDays(r.days)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="muted small">
                If you also use Google Calendar sync in Keystone, importing a Google calendar from here would
                show those events twice. Use one or the other for the same calendar.
              </p>
            </>
          )}
        </div>
      )}
      {status === 'done' && result && (
        <div className="form">
          <p>
            <strong>{result.added}</strong> added{result.updated ? `, ${result.updated} updated` : ''}.
          </p>
          {result.total === 0 && <p className="muted small">No events were found in that range.</p>}
          {result.total > 0 && result.added === 0 && result.updated === 0 && (
            <p className="muted small">Everything in that range was already in Keystone.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
