import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import { useStore, useActions } from '../data/store.jsx';
import { useToast } from '../data/toast.jsx';
import { listenForNativeEvents } from '../data/nativeBridge.js';
import { geocodeAddress } from '../data/geocode.js';
import { todayISO } from '../data/helpers.js';

// Handles what the Android side reports: text shared into Keystone (offers to
// save it as a task, a note or a map pin) and taps on the widget (the + button
// and each row).
export default function ShareReceiver() {
  const { state } = useStore();
  const actions = useActions();
  const navigate = useNavigate();
  const showToast = useToast();
  const [shared, setShared] = useState(null); // { text, subject } | null
  const [busy, setBusy] = useState(false);

  useEffect(
    () =>
      listenForNativeEvents({
        onShare: (d) => {
          if (d?.text?.trim()) setShared({ text: d.text.trim(), subject: (d.subject || '').trim() });
        },
        onAction: (action, d) => {
          if (action === 'newTask') navigate('/tasks', { state: { quickNewTask: true } });
          else if (action === 'openItem' && d?.id) {
            // Same destinations Home's own rows use.
            if (d.kind === 'goal') navigate('/goals', { state: { openGoalId: d.id } });
            else if (d.kind === 'task') navigate('/tasks', { state: { openTaskId: d.id } });
            else navigate('/planner', { state: { openEventId: d.id, openEventDate: todayISO() } });
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (!shared) return null;
  const firstLine = (shared.subject || shared.text.split('\n')[0]).slice(0, 120);
  const close = () => setShared(null);

  const asTask = () => {
    actions.addTask({ title: firstLine, notes: shared.text === firstLine ? '' : shared.text, createdAt: todayISO() });
    showToast('Added to your tasks');
    close();
  };
  const asNote = () => {
    actions.addNote({
      title: shared.subject || '',
      body: shared.text,
      checklist: null,
      color: '',
      pinned: false,
      createdAt: todayISO(),
      updatedAt: todayISO(),
    });
    showToast('Saved as a note');
    close();
  };
  const asPlace = async () => {
    setBusy(true);
    const hit = await geocodeAddress(shared.text.split('\n').join(', '));
    setBusy(false);
    if (!hit) {
      showToast("Couldn't find that place. Try saving it as a note.");
      return;
    }
    actions.addPin({
      emoji: '📍',
      label: firstLine.slice(0, 60),
      notes: '',
      lat: hit.lat,
      lng: hit.lng,
      contactId: '',
      arriveRadius: 0,
      createdAt: todayISO(),
    });
    showToast('Pinned on the map');
    close();
    navigate('/map');
  };

  return (
    <Modal
      open
      title="Add to Keystone"
      onClose={close}
      footer={
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={close}>
            Cancel
          </button>
        </div>
      }
    >
      <div className="form">
        <p className="share-preview">{shared.text.length > 280 ? `${shared.text.slice(0, 280)}…` : shared.text}</p>
        <div className="stack-btns">
          <button className="btn btn-primary" onClick={asTask}>
            Add as a task
          </button>
          <button className="btn btn-ghost" onClick={asNote}>
            Save as a note
          </button>
          <button className="btn btn-ghost" onClick={asPlace} disabled={busy}>
            {busy ? 'Looking it up…' : 'Pin as a place'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
