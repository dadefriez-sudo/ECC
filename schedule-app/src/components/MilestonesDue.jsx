import { useMemo } from 'react';
import Icon from './Icon.jsx';
import { useStore, useActions } from '../data/store.jsx';
import { todayISO, addDays, toISODate, formatShortDate } from '../data/helpers.js';
import { selectTick, successTick } from '../data/haptics.js';

// Objective milestones that are overdue or due in the next two weeks, so they
// sit next to the day's habits and tasks instead of living only inside the
// Objectives tab. Quantifiable milestones get a +1; plain ones a check circle.
// Renders nothing when there is nothing close.
const SOON_DAYS = 14;
const MAX_ROWS = 3;

function dueLabel(iso, today) {
  const day = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const diff = Math.round((day(iso) - day(today)) / 86400000);
  if (diff < 0)
    return { text: diff === -1 ? 'Overdue since yesterday' : `Overdue ${-diff} days`, late: true };
  if (diff === 0) return { text: 'Due today', late: false };
  if (diff === 1) return { text: 'Due tomorrow', late: false };
  if (diff < 7) return { text: `Due in ${diff} days`, late: false };
  return { text: `Due ${formatShortDate(iso)}`, late: false };
}

export default function MilestonesDue({ onOpen }) {
  const { state } = useStore();
  const actions = useActions();
  const today = todayISO();
  const rows = useMemo(() => {
    const limit = toISODate(addDays(today, SOON_DAYS));
    const objectives = new Map((state.objectives || []).map(o => [o.id, o]));
    return (state.milestones || [])
      .filter(m => !m.done && m.targetDate && m.targetDate <= limit && objectives.has(m.objectiveId))
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
      .map(m => ({ m, objective: objectives.get(m.objectiveId) }));
  }, [state.milestones, state.objectives, today]);
  if (rows.length === 0) return null;

  const complete = m => {
    actions.updateMilestone({ ...m, done: true, doneAt: today, current: m.target || m.current || 0 });
    successTick();
  };
  const step = m => {
    const next = Math.min(m.target, (m.current || 0) + 1);
    actions.updateMilestone({
      ...m,
      current: next,
      done: next >= m.target,
      doneAt: next >= m.target ? today : ''
    });
    if (next >= m.target) successTick();
    else selectTick();
  };

  return (
    <section className="detail-section ms-due">
      <div className="section-head">
        <span className="detail-label">
          <Icon name="target" /> Milestones due
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onOpen}>
          All objectives
        </button>
      </div>
      {rows.slice(0, MAX_ROWS).map(({ m, objective }) => {
        const due = dueLabel(m.targetDate, today);
        const quant = m.quantifiable && m.target;
        return (
          <div key={m.id} className="ms-due-row">
            <span className="ms-due-ctl">
              {quant ? (
                <button className="ms-due-step" onClick={() => step(m)} aria-label={`Add one to ${m.title}`}>
                  +1
                </button>
              ) : (
                <button
                  className="task-check"
                  data-haptic="none"
                  onClick={() => complete(m)}
                  aria-label={`Mark ${m.title} done`}
                />
              )}
            </span>
            <button className="ms-due-main" onClick={onOpen}>
              <span className="ms-due-title">{m.title}</span>
              <span className={`ms-due-sub small${due.late ? ' ms-due-sub--late' : ' muted'}`}>
                {[
                  quant ? `${m.current || 0}/${m.target}${m.unit ? ` ${m.unit}` : ''}` : '',
                  objective.title,
                  due.text
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
          </div>
        );
      })}
      {rows.length > MAX_ROWS && (
        <button className="btn btn-ghost btn-sm" onClick={onOpen}>
          +{rows.length - MAX_ROWS} more
        </button>
      )}
    </section>
  );
}
