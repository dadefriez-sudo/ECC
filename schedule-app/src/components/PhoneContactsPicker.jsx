import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import Checkbox from './Checkbox.jsx';
import { readPhoneContacts } from '../data/nativeBridge.js';
import { normalizePhoneContacts } from '../data/phoneContacts.js';

// "Import from phone": lists the phone's contacts and brings in only the ones
// ticked. Nothing leaves the phone and nothing is imported without a tick.
// People already in Keystone (same email, phone number or name) are shown but
// can't be picked again, so importing twice doesn't make duplicates.
export default function PhoneContactsPicker({ open, existingContacts, onImport, onClose }) {
  const [state, setState] = useState({ status: 'loading', list: [], error: '' });
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(() => new Set());

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setState({ status: 'loading', list: [], error: '' });
    setQuery('');
    setPicked(new Set());
    readPhoneContacts()
      .then((raw) => {
        if (!cancelled) setState({ status: 'ready', list: normalizePhoneContacts(raw, existingContacts), error: '' });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: err?.code === 'denied' ? 'denied' : 'error',
          list: [],
          error: err?.message || 'Could not read your contacts.',
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state.list;
    return state.list.filter((c) => `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q));
  }, [state.list, query]);
  const selectable = shown.filter((c) => !c.existing);
  const allShownPicked = selectable.length > 0 && selectable.every((c) => picked.has(c.id));

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const c of selectable) {
        if (allShownPicked) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });

  const importPicked = () => {
    const chosen = state.list.filter((c) => picked.has(c.id));
    if (chosen.length) onImport(chosen);
    onClose();
  };

  const newCount = state.list.filter((c) => !c.existing).length;
  return (
    <Modal
      open={open}
      title="Import from phone"
      onClose={onClose}
      tall
      footer={
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={importPicked} disabled={picked.size === 0}>
            {picked.size ? `Import ${picked.size}` : 'Import'}
          </button>
        </div>
      }
    >
      {state.status === 'loading' && <p className="muted center-pad">Reading your contacts…</p>}
      {state.status === 'denied' && (
        <div className="form">
          <p>Keystone needs permission to read your contacts.</p>
          <p className="muted small">
            You can allow it in your phone's Settings → Apps → Keystone → Permissions → Contacts, then try
            again. Keystone only reads them, and only brings in the ones you pick.
          </p>
        </div>
      )}
      {state.status === 'error' && <p className="partner-error" role="alert">{state.error}</p>}
      {state.status === 'ready' && (
        <div className="form phone-import">
          <p className="muted small">
            {state.list.length === 0
              ? 'No contacts with a name were found on this phone.'
              : `${state.list.length} on your phone, ${newCount} not in Keystone yet. Keystone only reads them, and only brings in the ones you pick.`}
          </p>
          {state.list.length > 0 && (
            <>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your phone's contacts"
                aria-label="Search your phone's contacts"
              />
              <label className="check-row phone-import-all">
                <Checkbox checked={allShownPicked} onChange={toggleAll} ariaLabel="Select everyone shown" />
                <span>
                  {allShownPicked ? 'Clear' : 'Select'} all{query.trim() ? ' shown' : ' new'} ({selectable.length})
                </span>
              </label>
              <ul className="phone-import-list">
                {shown.map((c) => (
                  <li key={c.id} className={c.existing ? 'phone-import-row phone-import-row--have' : 'phone-import-row'}>
                    <label className="check-row">
                      <Checkbox
                        checked={picked.has(c.id)}
                        onChange={() => toggle(c.id)}
                        ariaLabel={`Import ${c.name}`}
                        disabled={c.existing}
                      />
                      <span className="phone-import-text">
                        <strong>{c.name}</strong>
                        <span className="muted small">
                          {c.existing ? 'Already in Keystone' : [c.phone, c.email].filter(Boolean).join(' · ') || 'No phone or email'}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
                {shown.length === 0 && <li className="muted small">No match.</li>}
              </ul>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
