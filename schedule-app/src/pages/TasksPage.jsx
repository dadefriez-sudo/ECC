import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, useActions } from '../data/store.jsx';
import EditorSheet from '../components/EditorSheet.jsx';
import Checkbox from '../components/Checkbox.jsx';
import SwipeToDelete from '../components/SwipeToDelete.jsx';
import AddressField from '../components/AddressField.jsx';
import { Brand } from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../data/toast.jsx';
import { useEdgeFade } from '../data/useEdgeFade.js';
import { requestNotificationPermission, notificationsSupported } from '../data/notifications.js';
import { todayISO, addDays, toISODate, formatTime, formatShortDate } from '../data/helpers.js';

const TASK_REMINDER_OFFSETS = [
  { mins: 15, label: '15 min before' },
  { mins: 30, label: '30 min before' },
  { mins: 60, label: '1 hour before' },
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M4 12l5 5 11-11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// A dedicated home for tasks — Home's own task block is deliberately
// compact (a handful of open items, everything else one tap away), which
// starts to feel cramped once there are enough tasks that "what's actually
// due soon" stops being obvious at a glance. This page trades that
// compactness for grouping by when something's due, which is the thing a
// task list is actually for.
export default function TasksPage() {
  const { state } = useStore();
  const actions = useActions();
  const navigate = useNavigate();
  const showToast = useToast();
  const taskCompleteAnim = state.settings?.taskCompleteAnim ?? true;
  const taskSwipeRefs = useRef(new Map());
  const today = todayISO();

  const deleteTaskWithUndo = (t) => {
    actions.deleteTask(t.id);
    showToast(`"${t.title || 'Task'}" deleted`, 'Undo', () => actions.addTask(t));
  };

  // Same two-phase completion flash as Home's task list — see that file's
  // own comment for why it's two beats (ticked, then filed) rather than one
  // instant re-sort. Kept in step with Home deliberately; if this ever
  // needs to change, change it there too.
  const POP_MS = 500;
  const FILE_MS = 260;
  const [justCompletedIds, setJustCompletedIds] = useState(new Set());
  const [filingIds, setFilingIds] = useState(new Set());
  const completionTimers = useRef(new Map());
  const withoutId = (id) => (prev) => {
    if (!prev.has(id)) return prev;
    const next = new Set(prev);
    next.delete(id);
    return next;
  };
  const cancelCompletion = (id) => {
    for (const t of completionTimers.current.get(id) || []) clearTimeout(t);
    completionTimers.current.delete(id);
    setJustCompletedIds(withoutId(id));
    setFilingIds(withoutId(id));
  };
  const flashCompleted = (id) => {
    cancelCompletion(id);
    setJustCompletedIds((prev) => new Set(prev).add(id));
    completionTimers.current.set(id, [
      setTimeout(() => {
        setJustCompletedIds(withoutId(id));
        setFilingIds((prev) => new Set(prev).add(id));
      }, POP_MS),
      setTimeout(() => {
        setFilingIds(withoutId(id));
        completionTimers.current.delete(id);
      }, POP_MS + FILE_MS),
    ]);
  };
  useEffect(
    () => () => {
      for (const timers of completionTimers.current.values()) timers.forEach(clearTimeout);
      completionTimers.current.clear();
    },
    []
  );
  const toggleTaskDone = (t) => {
    if (t.done) {
      cancelCompletion(t.id);
      actions.updateTask({ ...t, done: false });
      return;
    }
    flashCompleted(t.id);
    const completedDates = [...(t.completedDates || []), todayISO()];
    if (t.repeat && t.repeat !== 'none' && t.dueDate) {
      const nextDueDate = toISODate(addDays(t.dueDate, t.repeat === 'weekly' ? 7 : 1));
      actions.updateTask({ ...t, done: false, dueDate: nextDueDate, completedDates });
    } else {
      actions.updateTask({ ...t, done: true, completedDates });
    }
  };

  const [expandedTaskIds, setExpandedTaskIds] = useState(new Set());
  const toggleTaskExpanded = (id) =>
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleSubtaskDone = (task, i) => {
    const subtasks = task.subtasks.slice();
    subtasks[i] = { ...subtasks[i], done: !subtasks[i].done };
    actions.updateTask({ ...task, subtasks });
  };

  const [newTaskText, setNewTaskText] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const initialTaskJson = useRef('');
  const reminderChipsRef = useRef(null);
  const reminderChipsFade = useEdgeFade(reminderChipsRef, [editingTask?.id]);

  const openNewTask = () => {
    const d = {
      title: newTaskText.trim(),
      notes: '',
      location: '',
      dueDate: '',
      dueTime: '',
      reminderOffsets: [],
      repeat: 'none',
      subtasks: [],
    };
    setEditingTask(d);
    initialTaskJson.current = JSON.stringify(d);
    setNewTaskText('');
  };
  const openEditTask = (t) => {
    const d = {
      ...t,
      notes: t.notes || '',
      location: t.location || '',
      dueDate: t.dueDate || '',
      dueTime: t.dueTime || '',
      reminderOffsets: t.reminderOffsets || [],
      repeat: t.repeat || 'none',
      subtasks: t.subtasks || [],
    };
    setEditingTask(d);
    initialTaskJson.current = JSON.stringify(d);
  };
  const addTaskSubtask = () =>
    setEditingTask((t) => ({ ...t, subtasks: [...(t.subtasks || []), { text: '', done: false }] }));
  const taskDirty = editingTask ? JSON.stringify(editingTask) !== initialTaskJson.current : false;
  const toggleTaskReminderOffset = (mins) => {
    setEditingTask((t) => ({
      ...t,
      reminderOffsets: t.reminderOffsets.includes(mins)
        ? t.reminderOffsets.filter((m) => m !== mins)
        : [...t.reminderOffsets, mins],
    }));
  };
  const saveTask = async () => {
    const title = editingTask.title.trim();
    if (!title) return setEditingTask(null);
    const canRemind = !!(editingTask.dueDate && editingTask.dueTime);
    const reminderOffsets = canRemind ? editingTask.reminderOffsets : [];
    if (reminderOffsets.length > 0) {
      await requestNotificationPermission();
      actions.setSettings({ notifications: true });
    }
    const payload = {
      title,
      notes: editingTask.notes.trim(),
      location: editingTask.location.trim(),
      dueDate: editingTask.dueDate,
      dueTime: editingTask.dueTime,
      reminderOffsets,
      repeat: editingTask.dueDate ? editingTask.repeat || 'none' : 'none',
      subtasks: (editingTask.subtasks || [])
        .map((s) => ({ ...s, text: s.text.trim() }))
        .filter((s) => s.text),
    };
    if (editingTask.id) actions.updateTask({ ...editingTask, ...payload });
    else actions.addTask({ ...payload, createdAt: today });
    setEditingTask(null);
  };

  // Group open tasks by when they're due — the thing a dedicated list is
  // for that Home's compact block deliberately skips.
  const { groups, doneTasks } = useMemo(() => {
    const settling = (t) => justCompletedIds.has(t.id) || filingIds.has(t.id);
    const overdue = [], dueToday = [], upcoming = [], noDate = [], done = [];
    for (const t of state.tasks || []) {
      if (t.done && !settling(t)) {
        done.push(t);
        continue;
      }
      if (!t.dueDate) noDate.push(t);
      else if (t.dueDate < today) overdue.push(t);
      else if (t.dueDate === today) dueToday.push(t);
      else upcoming.push(t);
    }
    const byDue = (a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99');
    overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    dueToday.sort(byDue);
    upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || byDue(a, b));
    done.sort((a, b) => lastCompleted(b).localeCompare(lastCompleted(a)));
    const list = [
      { key: 'overdue', label: 'Overdue', items: overdue },
      { key: 'today', label: 'Today', items: dueToday },
      { key: 'upcoming', label: 'Upcoming', items: upcoming },
      { key: 'nodate', label: 'No due date', items: noDate },
    ].filter((g) => g.items.length > 0);
    return { groups: list, doneTasks: done };
  }, [state.tasks, justCompletedIds, filingIds, today]);

  const [showDone, setShowDone] = useState(false);
  const clearDoneTasks = () => {
    const removed = doneTasks;
    if (removed.length === 0) return;
    for (const t of removed) actions.deleteTask(t.id);
    setShowDone(false);
    showToast(
      `Cleared ${removed.length} finished task${removed.length === 1 ? '' : 's'}`,
      'Undo',
      () => {
        for (const t of removed) actions.addTask(t);
      }
    );
  };

  const renderTaskRow = (t) => (
    <li key={t.id} className={filingIds.has(t.id) ? 'task-filing' : undefined}>
      <SwipeToDelete
        ref={(el) => {
          if (el) taskSwipeRefs.current.set(t.id, el);
          else taskSwipeRefs.current.delete(t.id);
        }}
        onDelete={() => deleteTaskWithUndo(t)}
      >
        <div className="task-row">
          <button
            className={`task-check${t.done || justCompletedIds.has(t.id) ? ' task-check--on' : ''}${justCompletedIds.has(t.id) && taskCompleteAnim ? ' task-check--pop' : ''}`}
            data-haptic={t.done ? 'tap' : 'confirm'}
            onClick={() => toggleTaskDone(t)}
            aria-label={t.done ? 'Mark not done' : 'Mark done'}
          >
            {(t.done || justCompletedIds.has(t.id)) && <CheckIcon />}
            <span className="task-check-sparkles" aria-hidden="true">
              <i /><i /><i /><i /><i /><i />
            </span>
          </button>
          <button className="task-title-btn" onClick={() => openEditTask(t)}>
            <span className={`task-title${t.done ? ' task-title--done' : ''}`}>
              {t.title}
              {t.repeat && t.repeat !== 'none' && <span className="repeat-glyph"> <Icon name="repeat" size={13} /></span>}
            </span>
            {(t.location || t.dueDate) && !t.done && (
              <span className="task-meta muted small">
                {[t.location, t.dueDate && formatShortDate(t.dueDate)].filter(Boolean).join(' · ')}
              </span>
            )}
          </button>
          {t.dueTime && !t.done && <span className="reminder-time">{formatTime(t.dueTime)}</span>}
          {(t.subtasks || []).length > 0 && (
            <button
              className={`subtask-badge${expandedTaskIds.has(t.id) ? ' subtask-badge--open' : ''}`}
              onClick={() => toggleTaskExpanded(t.id)}
              aria-label={expandedTaskIds.has(t.id) ? 'Hide subtasks' : 'Show subtasks'}
            >
              {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}
            </button>
          )}
          <button
            className="icon-btn task-del"
            onClick={() => taskSwipeRefs.current.get(t.id)?.remove()}
            aria-label="Delete task"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </SwipeToDelete>
      {(t.subtasks || []).length > 0 && expandedTaskIds.has(t.id) && (
        <ul className="subtask-list">
          {t.subtasks.map((s, i) => (
            <li key={i} className="subtask-row">
              <button
                className={`task-check task-check--sm${s.done ? ' task-check--on' : ''}`}
                data-haptic={s.done ? 'tap' : 'confirm'}
                onClick={() => toggleSubtaskDone(t, i)}
                aria-label={s.done ? 'Mark not done' : 'Mark done'}
              >
                {s.done && <CheckIcon />}
              </button>
              <span className={`subtask-text${s.done ? ' subtask-text--done' : ''}`}>{s.text}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );

  const totalOpen = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-row">
          <button className="icon-btn" onClick={() => navigate('/')} aria-label="Back">
            <Icon name="chevronLeft" size={22} />
          </button>
          <Brand>Tasks</Brand>
        </div>
      </header>

      <section className="detail-section">
        <div className="task-add-row">
          <input
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && openNewTask()}
            placeholder="Add a task…"
          />
          <button className="btn btn-primary btn-sm" onClick={openNewTask}>
            Add
          </button>
        </div>
      </section>

      {totalOpen === 0 && doneTasks.length === 0 && (
        <div className="empty">
          <div className="empty-icon"><Icon name="check" size={48} /></div>
          <h2>Nothing on your list</h2>
          <p className="muted">Add a task above, or from the quick-add menu anywhere in the app.</p>
        </div>
      )}

      {groups.map((g) => (
        <section className="detail-section" key={g.key}>
          <div className="section-head">
            <span className="detail-label">{g.label} · {g.items.length}</span>
          </div>
          <ul className="task-list">{g.items.map(renderTaskRow)}</ul>
        </section>
      ))}

      {doneTasks.length > 0 && (
        <section className="detail-section">
          <ul className="task-list">
            <li className="task-done-head">
              <button
                className={`task-done-toggle${showDone ? ' task-done-toggle--open' : ''}`}
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
              >
                <Icon name="chevronDown" size={15} />
                Done · {doneTasks.length}
              </button>
              <button className="task-done-clear" onClick={clearDoneTasks}>
                Clear
              </button>
            </li>
            {showDone && doneTasks.map(renderTaskRow)}
          </ul>
        </section>
      )}

      <EditorSheet
        open={!!editingTask}
        title={editingTask?.id ? 'Edit task' : 'New task'}
        dirty={taskDirty}
        onSave={saveTask}
        onDiscard={() => setEditingTask(null)}
        danger={
          editingTask?.id
            ? { label: 'Delete task', onClick: () => { deleteTaskWithUndo(editingTask); setEditingTask(null); } }
            : undefined
        }
      >
        {editingTask && (
          <div className="form">
            <label className="field">
              <span>Task</span>
              <input
                value={editingTask.title}
                onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                placeholder="What needs doing?"
              />
            </label>
            <div className="field">
              <span>Subtasks</span>
              {(editingTask.subtasks || []).map((item, i) => (
                <div className="checklist-row" key={i}>
                  <button
                    type="button"
                    className={`task-check${item.done ? ' task-check--on' : ''}`}
                    data-haptic={item.done ? 'tap' : 'confirm'}
                    onClick={() => {
                      const next = editingTask.subtasks.slice();
                      next[i] = { ...next[i], done: !next[i].done };
                      setEditingTask({ ...editingTask, subtasks: next });
                    }}
                    aria-label={item.done ? 'Mark not done' : 'Mark done'}
                  >
                    {item.done && <CheckIcon />}
                    <span className="task-check-sparkles" aria-hidden="true">
                      <i /><i /><i /><i /><i /><i />
                    </span>
                  </button>
                  <input
                    value={item.text}
                    onChange={(e) => {
                      const next = editingTask.subtasks.slice();
                      next[i] = { ...next[i], text: e.target.value };
                      setEditingTask({ ...editingTask, subtasks: next });
                    }}
                    placeholder="Subtask"
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      const next = editingTask.subtasks.filter((_, idx) => idx !== i);
                      setEditingTask({ ...editingTask, subtasks: next });
                    }}
                    aria-label="Remove subtask"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={addTaskSubtask}>
                + Add subtask
              </button>
            </div>
            <div className="field">
              <span>Location</span>
              <AddressField
                value={editingTask.location}
                placeholder="Optional"
                onChange={(text) => setEditingTask({ ...editingTask, location: text })}
              />
            </div>
            <div className="field-row">
              <label className="field">
                <span>Due date</span>
                <input
                  type="date"
                  value={editingTask.dueDate}
                  onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Due time</span>
                <input
                  type="time"
                  value={editingTask.dueTime}
                  onChange={(e) => setEditingTask({ ...editingTask, dueTime: e.target.value })}
                />
              </label>
            </div>
            {editingTask.dueDate && editingTask.dueTime && (
              <p className="muted small">Shows on the Planner calendar at that time.</p>
            )}
            {editingTask.dueDate && (
              <div className="field">
                <span>Repeats</span>
                <div className="seg seg--full">
                  {[
                    { value: 'none', label: 'Never' },
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                  ].map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={`seg-btn${(editingTask.repeat || 'none') === o.value ? ' seg-btn--on' : ''}`}
                      onClick={() => setEditingTask({ ...editingTask, repeat: o.value })}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {editingTask.repeat && editingTask.repeat !== 'none' && (
                  <p className="muted small">
                    Checking it off moves the due date forward instead of leaving it done for good.
                  </p>
                )}
              </div>
            )}
            <label className="field">
              <span>Notes</span>
              <textarea
                rows="4"
                value={editingTask.notes}
                onChange={(e) => setEditingTask({ ...editingTask, notes: e.target.value })}
                placeholder="Any details…"
              />
            </label>
            {editingTask.dueDate && editingTask.dueTime && (
              <div className="field">
                <span>Remind me</span>
                <div
                  ref={reminderChipsRef}
                  className={`chips${reminderChipsFade.left ? ' chips--fade-left' : ''}${reminderChipsFade.right ? ' chips--fade-right' : ''}`}
                >
                  {TASK_REMINDER_OFFSETS.map((o) => (
                    <button
                      key={o.mins}
                      type="button"
                      className={`chip${editingTask.reminderOffsets.includes(o.mins) ? ' chip--on' : ''}`}
                      onClick={() => toggleTaskReminderOffset(o.mins)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {editingTask.reminderOffsets.length > 0 && !notificationsSupported() && (
                  <span className="muted small">This browser can't show notifications.</span>
                )}
              </div>
            )}
          </div>
        )}
      </EditorSheet>
    </div>
  );
}

function lastCompleted(t) {
  const dates = t.completedDates || [];
  return dates.length ? dates[dates.length - 1] : '';
}
