import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { Avatar } from './Avatar.jsx';
import { useStore, useActions } from '../data/store.jsx';
import { selectTick } from '../data/haptics.js';
import { ungroupedContacts } from '../data/ungrouped.js';

// One person at a time: tap a group and they are filed and the next one appears. Skip leaves
// someone alone; Back undoes the last step. The list is fixed when the sheet opens, so people
// don't shuffle around as they are filed.
export default function QuickGroupSort({ open, onClose }) {
  const { state } = useStore();
  const actions = useActions();
  const [queue, setQueue] = useState([]); // contact ids
  const [index, setIndex] = useState(0);
  const [steps, setSteps] = useState([]); // { id, filed } per step taken, for Back and the summary

  useEffect(() => {
    if (!open) return;
    setQueue(ungroupedContacts(state).map((c) => c.id));
    setIndex(0);
    setSteps([]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = state.statuses || [];
  const total = queue.length;
  const current = index < total ? (state.contacts || []).find((c) => c.id === queue[index]) : null;
  const finished = total > 0 && index >= total;
  const filedCount = steps.filter((s) => s.filed).length;

  const advance = (filed) => {
    setSteps((s) => [...s, { id: queue[index], filed }]);
    setIndex((i) => i + 1);
  };
  const file = (group) => {
    if (!current) return;
    selectTick();
    actions.updateContact({ ...current, statusId: group.id });
    advance(true);
  };
  const skip = () => {
    selectTick();
    advance(false);
  };
  const back = () => {
    const last = steps[steps.length - 1];
    if (!last) return;
    selectTick();
    if (last.filed) {
      const c = (state.contacts || []).find((x) => x.id === last.id);
      if (c) actions.updateContact({ ...c, statusId: '' });
    }
    setSteps((s) => s.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
  };

  return (
    <Modal open={open} title="Sort people into groups" onClose={onClose} tall>
      {groups.length === 0 ? (
        <p className="muted center-pad">Add a group first (the + Add button on People groups), then come back to sort people.</p>
      ) : total === 0 ? (
        <p className="muted center-pad">Everyone is already in a group.</p>
      ) : finished || !current ? (
        <div className="qgs-done">
          <h3>All sorted</h3>
          <p className="muted">
            {filedCount} {filedCount === 1 ? 'person' : 'people'} added to a group
            {total - filedCount > 0 ? `, ${total - filedCount} skipped` : ''}.
          </p>
          <div className="qgs-actions">
            {steps.length > 0 && (
              <button className="btn btn-ghost" onClick={back}>
                Back
              </button>
            )}
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="qgs">
          <div className="qgs-progress" aria-label={`Person ${index + 1} of ${total}`}>
            <div className="qgs-bar">
              <span style={{ width: `${(index / total) * 100}%` }} />
            </div>
            <span className="muted small">
              {index + 1} of {total}
            </span>
          </div>
          <div className="qgs-person">
            <Avatar name={current.name} photo={current.photo} size="lg" />
            <strong>{current.name}</strong>
            {(current.phone || current.email) && <span className="muted small">{current.phone || current.email}</span>}
          </div>
          <div className="qgs-groups">
            {groups.map((g) => (
              <button key={g.id} className="qgs-group" onClick={() => file(g)}>
                <span className="swatch" style={{ background: g.color }} />
                <span>{g.label}</span>
              </button>
            ))}
          </div>
          <div className="qgs-actions">
            <button className="btn btn-ghost" onClick={back} disabled={steps.length === 0}>
              Back
            </button>
            <button className="btn btn-ghost" onClick={skip}>
              Skip
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
