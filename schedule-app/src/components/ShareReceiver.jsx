import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import { useStore, useActions } from '../data/store.jsx';
import { useToast } from '../data/toast.jsx';
import { listenForNativeEvents, takeWidgetLogs } from '../data/nativeBridge.js';
import { App as CapApp } from '@capacitor/app';
import { goalKey } from '../data/helpers.js';
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
  const [placeError, setPlaceError] = useState(false);

  useEffect(
    () =>
      listenForNativeEvents({
        onShare: (d) => {
          if (d?.text?.trim()) setShared({ text: d.text.trim(), subject: (d.subject || '').trim() });
        },
        onAction: (action, d) => {
          if (action === 'newTask') navigate('/tasks', { state: { quickNewTask: true } });
          else if (action === 'newEvent') navigate('/planner', { state: { quickNewEvent: true } });
          else if (action === 'newNote') navigate('/', { state: { quickNewNote: true } });
          else if (action === 'newPerson') navigate('/contacts', { state: { quickNewContact: true } });
          else if (action === 'openGoals') navigate('/goals');
          else if (action === 'openPeople') navigate('/contacts');
          else if (action === 'openPlanner') {
            // id: a date to show in Day view, "month" for the month, empty for the planner as it was.
            if (d?.id === 'month') navigate('/planner', { state: { openMonth: true } });
            else if (d?.id) navigate('/planner', { state: { openDate: d.id } });
            else navigate('/planner');
          } else if (action === 'openContact' && d?.id) navigate(`/contacts/${d.id}`);
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

  // Goal taps made on the widget while the app was closed: apply each once, now and
  // whenever the app comes back to the front.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    let live = true;
    const apply = async () => {
      const logs = await takeWidgetLogs();
      if (!live || !logs.length) return;
      const byGoal = new Map();
      for (const l of logs) byGoal.set(l.i, (byGoal.get(l.i) || 0) + (Number(l.d) || 0));
      for (const [id, delta] of byGoal) {
        const g = stateRef.current.goals.find((x) => x.id === id);
        if (!g) continue;
        const key = goalKey(g.period || 'weekly', new Date());
        actions.setGoalProgress(id, key, Math.max(0, (g.progress?.[key] || 0) + delta));
      }
    };
    apply();
    let handle;
    CapApp.addListener('appStateChange', ({ isActive }) => isActive && apply())
      .then((h) => (live ? (handle = h) : h.remove()))
      .catch(() => {});
    return () => {
      live = false;
      handle?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!shared) return null;
  const firstLine = (shared.subject || shared.text.split('\n')[0]).slice(0, 120);
  const close = () => {
    setShared(null);
    setPlaceError(false);
  };

  const asTask = () => {
    // The title is the subject (Keep's note title) or the first line; the rest
    // of the text is the task's notes, without repeating the title line.
    const lines = shared.text.split('\n');
    const body = (shared.subject ? shared.text : lines.slice(1).join('\n')).trim();
    const notes = body === firstLine ? '' : body;
    actions.addTask({ title: firstLine, notes, createdAt: todayISO() });
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
    setPlaceError(false);
    const hit = await geocodeAddress(shared.text.split('\n').join(', '));
    setBusy(false);
    if (!hit) {
      // Shown inside the sheet: a toast would sit behind it and only appear
      // once the sheet closed.
      setPlaceError(true);
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
        {placeError && (
          <p className="partner-error" role="alert">
            Couldn't find that place, so it can't be pinned. Try saving it as a note or task instead.
          </p>
        )}
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
