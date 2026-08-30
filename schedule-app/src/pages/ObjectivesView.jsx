import { useMemo, useRef, useState } from 'react';
import EditorSheet from '../components/EditorSheet.jsx';
import Modal from '../components/Modal.jsx';
import Checkbox from '../components/Checkbox.jsx';
import Select from '../components/Select.jsx';
import Icon from '../components/Icon.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import { selectTick, successTick } from '../data/haptics.js';
import {
  todayISO,
  fromISODate,
  formatShortDate,
  daysUntil,
  objectiveMilestones,
  objectiveProgress,
  objectivePaceStatus,
  objectivePeriodLabel,
  quarterRange,
  yearRange,
  currentQuarter,
  computeGoalStreak,
  ringStyle,
} from '../data/helpers.js';

const emptyObjective = () => {
  const year = new Date().getFullYear();
  const quarter = currentQuarter();
  return {
    title: '',
    description: '',
    category: '',
    period: 'quarterly',
    year,
    quarter,
    ...quarterRange(year, quarter),
    linkedGoalIds: [],
  };
};

const emptyMilestone = (objectiveId) => ({
  objectiveId,
  title: '',
  targetDate: '',
  quantifiable: false,
  target: '',
  current: '',
  unit: '',
  done: false,
});

const PACE_LABEL = {
  'on-track': 'On track',
  behind: 'Behind pace',
  complete: 'Complete',
  overdue: 'Overdue',
};

// High-level objectives (quarterly/annual) broken into milestones, one layer
// above the daily/weekly habits GoalsPage already tracks. Progress here is
// never typed in directly — it's always the average of a checklist, the same
// way a habit's percentage is always derived from logged counts, so the
// number on screen can't drift from the milestones that make it up.
export default function ObjectivesView({ state, actions, isPro, navigate }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [editing, setEditing] = useState(null); // objective draft
  const [editingMilestone, setEditingMilestone] = useState(null); // milestone draft
  const [confirmDeleteObjective, setConfirmDeleteObjective] = useState(null);
  const [confirmDeleteMilestone, setConfirmDeleteMilestone] = useState(null);
  const initialJsonRef = useRef('');
  const msInitialJsonRef = useRef('');

  const toggleExpanded = (id) => {
    selectTick();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Soonest deadline first — the one most worth a glance today belongs at
  // the top, not buried under whatever was created most recently.
  const objectives = useMemo(
    () =>
      state.objectives
        .filter((o) => o.status !== 'archived')
        .slice()
        .sort((a, b) => (a.endDate || '').localeCompare(b.endDate || '')),
    [state.objectives]
  );

  const summary = useMemo(() => {
    if (objectives.length === 0) return null;
    const pcts = objectives.map((o) => objectiveProgress(o.id, state.milestones));
    const avg = Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length);
    const onTrack = objectives.filter((o, i) => {
      const status = objectivePaceStatus(o, pcts[i]);
      return status === 'on-track' || status === 'complete';
    }).length;
    return { avg, onTrack, total: objectives.length };
  }, [objectives, state.milestones]);

  // Gated like Contact Timeline — an inline upgrade card in place of the
  // view rather than a redirect, so switching back to Habits (still free)
  // is one tap on the segmented control right above, not a trip out of the
  // Goals tab entirely.
  if (!isPro) {
    return (
      <div className="empty upgrade-empty">
        <div className="empty-icon">
          <Icon name="crown" size={48} />
        </div>
        <h2>Objectives are a Pro feature</h2>
        <p className="muted">
          Track quarterly and annual goals broken into milestones, with progress that rolls up
          automatically — and the option to link a daily or weekly habit as the cadence behind it.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/pricing')}>
          See Pro plans
        </button>
      </div>
    );
  }

  const openNewObjective = () => {
    const d = emptyObjective();
    setEditing(d);
    initialJsonRef.current = JSON.stringify(d);
  };
  const openEditObjective = (o) => {
    const start = fromISODate(o.startDate);
    const d = { ...o, year: start.getFullYear(), quarter: Math.floor(start.getMonth() / 3) + 1 };
    setEditing(d);
    initialJsonRef.current = JSON.stringify(d);
  };
  const objDirty = editing ? JSON.stringify(editing) !== initialJsonRef.current : false;

  const setObjPeriod = (period) => {
    setEditing((prev) => {
      const next = { ...prev, period };
      if (period === 'quarterly') Object.assign(next, quarterRange(prev.year, prev.quarter));
      else if (period === 'annual') Object.assign(next, yearRange(prev.year));
      return next;
    });
  };
  const setObjYear = (year) => {
    if (!year) return;
    setEditing((prev) => {
      const next = { ...prev, year };
      if (prev.period === 'quarterly') Object.assign(next, quarterRange(year, prev.quarter));
      else if (prev.period === 'annual') Object.assign(next, yearRange(year));
      return next;
    });
  };
  const setObjQuarter = (quarter) => {
    setEditing((prev) => ({ ...prev, quarter, ...quarterRange(prev.year, quarter) }));
  };

  const saveObjective = () => {
    const title = editing.title.trim();
    if (!title) return;
    const payload = {
      title,
      description: editing.description.trim(),
      category: editing.category.trim(),
      period: editing.period,
      startDate: editing.startDate,
      endDate: editing.endDate,
      linkedGoalIds: editing.linkedGoalIds || [],
      status: editing.status || 'active',
    };
    if (editing.id) actions.updateObjective({ ...editing, ...payload });
    else actions.addObjective(payload);
    setEditing(null);
  };

  const openNewMilestone = (objectiveId) => {
    const d = emptyMilestone(objectiveId);
    setEditingMilestone(d);
    msInitialJsonRef.current = JSON.stringify(d);
  };
  const openEditMilestone = (m) => {
    const d = { ...m, quantifiable: !!(m.target && m.target > 0), target: m.target || '', current: m.current || 0 };
    setEditingMilestone(d);
    msInitialJsonRef.current = JSON.stringify(d);
  };
  const msDirty = editingMilestone ? JSON.stringify(editingMilestone) !== msInitialJsonRef.current : false;

  const saveMilestone = () => {
    const title = editingMilestone.title.trim();
    if (!title) return;
    const { quantifiable } = editingMilestone;
    const target = quantifiable ? Math.max(1, Number(editingMilestone.target) || 1) : null;
    const current = quantifiable ? Math.max(0, Number(editingMilestone.current) || 0) : 0;
    const done = quantifiable ? current >= target : !!editingMilestone.done;
    const wasDone = editingMilestone.id
      ? !!state.milestones.find((m) => m.id === editingMilestone.id)?.done
      : false;
    const payload = {
      objectiveId: editingMilestone.objectiveId,
      title,
      targetDate: editingMilestone.targetDate,
      target,
      current,
      unit: quantifiable ? editingMilestone.unit.trim() : '',
      done,
      doneAt: done ? editingMilestone.doneAt || todayISO() : '',
    };
    if (editingMilestone.id) actions.updateMilestone({ ...editingMilestone, ...payload });
    else actions.addMilestone(payload);
    if (done && !wasDone) successTick();
    setEditingMilestone(null);
  };

  const toggleMilestoneDone = (m) => {
    const done = !m.done;
    actions.updateMilestone({ ...m, done, doneAt: done ? todayISO() : '' });
    if (done) successTick();
    else selectTick();
  };
  const stepMilestone = (m, delta) => {
    const next = Math.max(0, Math.min(m.target, (m.current || 0) + delta));
    const wasDone = m.current >= m.target;
    actions.updateMilestone({
      ...m,
      current: next,
      done: next >= m.target,
      doneAt: next >= m.target ? m.doneAt || todayISO() : '',
    });
    if (!wasDone && next >= m.target) successTick();
    else selectTick();
  };

  return (
    <>
      {summary && (
        <section className="summary-card">
          <div className="summary-ring" style={ringStyle(summary.avg)}>
            <span>{summary.avg}%</span>
          </div>
          <div className="summary-meta">
            <strong>
              {summary.onTrack} of {summary.total} objective{summary.total === 1 ? '' : 's'} on track
            </strong>
            <span className="muted">Across every active objective</span>
          </div>
        </section>
      )}

      {objectives.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="trophy" size={48} />
          </div>
          <h2>Set a high-level goal</h2>
          <p className="muted">
            Quarterly or annual objectives, broken into milestones you can actually check off —
            optionally driven by one of your daily or weekly habits.
          </p>
          <button className="btn btn-primary" onClick={openNewObjective}>
            + New objective
          </button>
        </div>
      ) : (
        objectives.map((o) => {
          const mine = objectiveMilestones(o.id, state.milestones).slice().sort((a, b) =>
            (a.targetDate || '9999-99-99').localeCompare(b.targetDate || '9999-99-99')
          );
          const pct = objectiveProgress(o.id, state.milestones);
          const status = objectivePaceStatus(o, pct);
          const doneCount = mine.filter((m) => m.done).length;
          const isOpen = expanded.has(o.id);
          const left = daysUntil(o.endDate);
          const linkedGoals = (o.linkedGoalIds || [])
            .map((id) => state.goals.find((g) => g.id === id))
            .filter(Boolean);

          return (
            <div key={o.id} className="objective-card">
              <button className="objective-head" onClick={() => toggleExpanded(o.id)} aria-expanded={isOpen}>
                <div className="objective-ring" style={ringStyle(pct)}>
                  <span>{pct}%</span>
                </div>
                <div className="objective-meta">
                  <div className="objective-title-row">
                    <span className="objective-title">{o.title}</span>
                    <span className="objective-period-chip">{objectivePeriodLabel(o)}</span>
                  </div>
                  <span className={`objective-status objective-status--${status}`}>
                    {PACE_LABEL[status]}
                    {status !== 'complete' &&
                      left != null &&
                      (status === 'overdue' ? ` · ${Math.abs(left)}d over` : ` · ${left}d left`)}
                  </span>
                  <span className="muted small">
                    {doneCount} of {mine.length} milestone{mine.length === 1 ? '' : 's'}
                  </span>
                </div>
                <Icon
                  name="chevronDown"
                  size={16}
                  className={`objective-chevron${isOpen ? ' objective-chevron--open' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="objective-body">
                  {linkedGoals.length > 0 && (
                    <div className="objective-linked">
                      {linkedGoals.map((g) => (
                        <span key={g.id} className="objective-linked-chip">
                          <Icon name="flame" size={13} /> {g.title} · {computeGoalStreak(g)}{' '}
                          {g.period === 'daily' ? 'day' : 'week'} streak
                        </span>
                      ))}
                    </div>
                  )}

                  {mine.length === 0 && (
                    <p className="muted small objective-no-milestones">No milestones yet.</p>
                  )}

                  {mine.map((m) => {
                    const overdue = !m.done && m.targetDate && m.targetDate < todayISO();
                    const dateNode = m.targetDate && (
                      <span className={`milestone-date${overdue ? ' milestone-date--overdue' : ''}`}>
                        {' '}
                        · {overdue ? 'Overdue' : `Due ${formatShortDate(m.targetDate)}`}
                      </span>
                    );
                    if (m.target && m.target > 0) {
                      const mpct = Math.min(100, Math.round((m.current / m.target) * 100));
                      return (
                        <div key={m.id} className={`goal-card${m.done ? ' goal-card--done' : ''}`}>
                          <button className="goal-info" onClick={() => openEditMilestone(m)}>
                            <div className="goal-title-row">
                              <span className="goal-title">{m.title}</span>
                              {m.done && (
                                <span className="check-badge">
                                  <Icon name="check" size={15} />
                                </span>
                              )}
                            </div>
                            <div className="progress-track">
                              <div className="progress-fill" style={{ width: `${mpct}%` }} />
                            </div>
                            <span className="goal-count">
                              <AnimatedNumber value={m.current} /> / {m.target} {m.unit}
                              {dateNode}
                            </span>
                          </button>
                          <div className="stepper">
                            <button
                              className="step-btn"
                              onClick={() => stepMilestone(m, -1)}
                              disabled={m.current <= 0}
                              aria-label={`Decrease ${m.title}`}
                            >
                              −
                            </button>
                            <button
                              className="step-btn step-btn--plus"
                              onClick={() => stepMilestone(m, 1)}
                              aria-label={`Increase ${m.title}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={m.id} className={`milestone-row${m.done ? ' milestone-row--done' : ''}`}>
                        <Checkbox checked={m.done} onChange={() => toggleMilestoneDone(m)} ariaLabel={`Mark ${m.title} done`} />
                        <button className="milestone-row-info" onClick={() => openEditMilestone(m)}>
                          <span className="milestone-row-title">{m.title}</span>
                          {dateNode}
                        </button>
                      </div>
                    );
                  })}

                  <button className="btn btn-ghost btn-sm milestone-add" onClick={() => openNewMilestone(o.id)}>
                    <Icon name="plus" size={14} /> Add milestone
                  </button>

                  <div className="objective-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEditObjective(o)}>
                      <Icon name="pencil" size={14} /> Edit objective
                    </button>
                    <button
                      className="btn btn-ghost btn-sm danger-text"
                      onClick={() => setConfirmDeleteObjective(o)}
                    >
                      <Icon name="trash" size={14} /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {objectives.length > 0 && (
        <button className="fab" onClick={openNewObjective} aria-label="New objective">
          <Icon name="plus" size={26} />
        </button>
      )}

      {/* Objective editor */}
      <EditorSheet
        open={!!editing}
        title={editing?.id ? 'Edit objective' : 'New objective'}
        dirty={objDirty}
        onSave={saveObjective}
        onDiscard={() => setEditing(null)}
        danger={
          editing?.id
            ? {
                label: 'Delete objective',
                onClick: () => {
                  setConfirmDeleteObjective(editing);
                  setEditing(null);
                },
              }
            : undefined
        }
      >
        {editing && (
          <div className="form">
            <label className="field">
              <span>Objective</span>
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="e.g. Launch the new website"
              />
            </label>
            <div className="field">
              <span>Timeframe</span>
              <div className="seg seg--full">
                <button
                  className={`seg-btn${editing.period === 'quarterly' ? ' seg-btn--on' : ''}`}
                  onClick={() => setObjPeriod('quarterly')}
                >
                  Quarterly
                </button>
                <button
                  className={`seg-btn${editing.period === 'annual' ? ' seg-btn--on' : ''}`}
                  onClick={() => setObjPeriod('annual')}
                >
                  Annual
                </button>
                <button
                  className={`seg-btn${editing.period === 'custom' ? ' seg-btn--on' : ''}`}
                  onClick={() => setObjPeriod('custom')}
                >
                  Custom
                </button>
              </div>
            </div>
            {editing.period === 'custom' ? (
              <div className="field-row">
                <label className="field">
                  <span>Start</span>
                  <input
                    type="date"
                    value={editing.startDate}
                    onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>End</span>
                  <input
                    type="date"
                    value={editing.endDate}
                    onChange={(e) => setEditing({ ...editing, endDate: e.target.value })}
                  />
                </label>
              </div>
            ) : (
              <div className="field-row">
                {editing.period === 'quarterly' && (
                  <label className="field">
                    <span>Quarter</span>
                    <select value={editing.quarter} onChange={(e) => setObjQuarter(Number(e.target.value))}>
                      <option value={1}>Q1</option>
                      <option value={2}>Q2</option>
                      <option value={3}>Q3</option>
                      <option value={4}>Q4</option>
                    </select>
                  </label>
                )}
                <label className="field">
                  <span>Year</span>
                  <input
                    type="number"
                    value={editing.year}
                    onChange={(e) => setObjYear(Number(e.target.value))}
                  />
                </label>
              </div>
            )}
            <label className="field">
              <span>Category</span>
              <input
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                placeholder="e.g. Health"
                list="objective-categories"
              />
              <datalist id="objective-categories">
                {[...new Set(state.objectives.map((o) => o.category).filter(Boolean))].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>Link habits</span>
              <Select
                value={editing.linkedGoalIds || []}
                onChange={(v) => setEditing({ ...editing, linkedGoalIds: v })}
                placeholder="None linked"
                multiple
                searchable
                options={[...state.goals]
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((g) => ({ value: g.id, label: g.title }))}
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                rows="3"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="Optional"
              />
            </label>
          </div>
        )}
      </EditorSheet>

      {/* Milestone editor */}
      <EditorSheet
        open={!!editingMilestone}
        title={editingMilestone?.id ? 'Edit milestone' : 'New milestone'}
        dirty={msDirty}
        onSave={saveMilestone}
        onDiscard={() => setEditingMilestone(null)}
        danger={
          editingMilestone?.id
            ? {
                label: 'Delete milestone',
                onClick: () => {
                  setConfirmDeleteMilestone(editingMilestone);
                  setEditingMilestone(null);
                },
              }
            : undefined
        }
      >
        {editingMilestone && (
          <div className="form">
            <label className="field">
              <span>Milestone</span>
              <input
                value={editingMilestone.title}
                onChange={(e) => setEditingMilestone({ ...editingMilestone, title: e.target.value })}
                placeholder="e.g. Finalize design"
              />
            </label>
            <label className="field">
              <span>Target date</span>
              <input
                type="date"
                value={editingMilestone.targetDate}
                onChange={(e) => setEditingMilestone({ ...editingMilestone, targetDate: e.target.value })}
              />
            </label>
            <label className="check-row">
              <Checkbox
                checked={editingMilestone.quantifiable}
                onChange={(e) => setEditingMilestone({ ...editingMilestone, quantifiable: e.target.checked })}
                ariaLabel="Track a number"
              />
              <span>Track a number (e.g. miles, customers)</span>
            </label>
            {editingMilestone.quantifiable ? (
              <div className="field-row">
                <label className="field">
                  <span>Target</span>
                  <input
                    type="number"
                    min="1"
                    value={editingMilestone.target}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, target: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Current</span>
                  <input
                    type="number"
                    min="0"
                    value={editingMilestone.current}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, current: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Unit</span>
                  <input
                    value={editingMilestone.unit}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, unit: e.target.value })}
                    placeholder="e.g. miles"
                  />
                </label>
              </div>
            ) : (
              <label className="check-row">
                <Checkbox
                  checked={editingMilestone.done}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, done: e.target.checked })}
                  ariaLabel="Done"
                />
                <span>Done</span>
              </label>
            )}
          </div>
        )}
      </EditorSheet>

      <Modal
        open={!!confirmDeleteObjective}
        title="Delete objective?"
        onClose={() => setConfirmDeleteObjective(null)}
        footer={
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirmDeleteObjective(null)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                actions.deleteObjective(confirmDeleteObjective.id);
                setConfirmDeleteObjective(null);
              }}
            >
              Delete
            </button>
          </div>
        }
      >
        <p>This removes all of its milestones too. This can't be undone.</p>
      </Modal>

      <Modal
        open={!!confirmDeleteMilestone}
        title="Delete milestone?"
        onClose={() => setConfirmDeleteMilestone(null)}
        footer={
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirmDeleteMilestone(null)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                actions.deleteMilestone(confirmDeleteMilestone.id);
                setConfirmDeleteMilestone(null);
              }}
            >
              Delete
            </button>
          </div>
        }
      >
        <p>This can't be undone.</p>
      </Modal>
    </>
  );
}
