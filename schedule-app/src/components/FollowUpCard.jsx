import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import Checkbox from './Checkbox.jsx';
import { useStore, useActions } from '../data/store.jsx';
import { useToast } from '../data/toast.jsx';
import { pendingFollowUps, closeFollowUp } from '../data/eventFollowUp.js';
import { eventContactIds, expandEventOnDay, formatTime, todayISO } from '../data/helpers.js';

// After an event ends (and the person asked for a check-in), Home asks how it
// went. Notes go to the timeline of whoever the event was with; with nobody
// linked they're saved as a note. Dismissing just closes the question.
export default function FollowUpCard() {
  const { state } = useStore();
  const actions = useActions();
  const showToast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [, tick] = useState(0);
  const [open, setOpen] = useState(null); // { occ, date }
  const [text, setText] = useState('');
  const [markDone, setMarkDone] = useState(true);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const pending = useMemo(
    () => pendingFollowUps(state),
    [state.events, state.settings?.eventFollowUp, tick] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Arriving from the notification: open that event's check-in straight away.
  useEffect(() => {
    const f = location.state?.followUp;
    if (!f) return;
    const ev = (state.events || []).find((e) => e.id === f.id);
    const occ = ev && expandEventOnDay(ev, f.date)[0];
    if (occ) startNote({ occ, date: f.date });
    navigate('/', { replace: true, state: null });
  }, [location.state?.followUp]); // eslint-disable-line react-hooks/exhaustive-deps

  const startNote = (item) => {
    setOpen(item);
    setText('');
    setMarkDone(true);
  };

  const master = (occ) => (state.events || []).find((e) => e.id === occ.id);

  const finish = (item, { note, done }) => {
    const ev = master(item.occ);
    if (!ev) return;
    const body = (note || '').trim();
    if (body) {
      const people = eventContactIds(item.occ);
      const today = todayISO();
      const entry = `${item.occ.title || 'Event'}: ${body}`;
      if (people.length) {
        for (const contactId of people) {
          actions.addInteraction({ contactId, date: item.date, text: entry, createdAt: today });
        }
      } else {
        actions.addNote({
          title: item.occ.title || 'Event',
          body,
          checklist: null,
          color: '',
          pinned: false,
          createdAt: today,
          updatedAt: today,
        });
      }
    }
    actions.updateEvent(closeFollowUp(ev, item.occ, { markDone: done }));
    showToast(body ? (eventContactIds(item.occ).length ? 'Added to their timeline' : 'Saved as a note') : 'Done');
  };

  const first = pending[0];
  return (
    <>
      {first && (
        <section className="detail-section review-card checkin-card">
          <div className="review-card-head">
            <span className="detail-label"><Icon name="calendar" /> How did it go?</span>
            <button
              className="icon-btn"
              onClick={() => finish(first, { note: '', done: false })}
              aria-label="Dismiss check-in"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <p className="review-card-line">{first.occ.title || 'Event'}</p>
          <p className="muted small checkin-sub">
            {formatTime(first.occ.start)}
            {first.occ.end ? ` – ${formatTime(first.occ.end)}` : ''}
            {pending.length > 1 ? ` · ${pending.length - 1} more` : ''}
          </p>
          <div className="review-card-actions">
            <button className="btn btn-primary btn-sm" onClick={() => startNote(first)}>
              Add a note
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => finish(first, { note: '', done: true })}>
              Mark done
            </button>
          </div>
        </section>
      )}
      {open && (
        <Modal
          open
          title={open.occ.title || 'Event'}
          onClose={() => setOpen(null)}
          footer={
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setOpen(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  finish(open, { note: text, done: markDone });
                  setOpen(null);
                }}
              >
                Save
              </button>
            </div>
          }
        >
          <div className="form">
            <label className="field">
              <span>How did it go?</span>
              <textarea
                rows="5"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What happened, what to remember, what's next…"
              />
            </label>
            <label className="check-row">
              <Checkbox checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} ariaLabel="Mark event done" />
              <span>Mark the event done</span>
            </label>
            <p className="muted small">
              {eventContactIds(open.occ).length
                ? 'Your note is added to their timeline.'
                : 'No one is linked to this event, so your note is saved in Notes.'}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
