import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore, useActions } from '../data/store.jsx';
import EditorSheet from '../components/EditorSheet.jsx';
import Checkbox from '../components/Checkbox.jsx';
import SwipeToDelete from '../components/SwipeToDelete.jsx';
import AddressField from '../components/AddressField.jsx';
import MilestonesDue from '../components/MilestonesDue.jsx';
import { Brand } from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../data/toast.jsx';
import { useEdgeFade } from '../data/useEdgeFade.js';
import { requestNotificationPermission, notificationsSupported } from '../data/notifications.js';
import { todayISO, nextTaskDueDate, formatTime, formatShortDate } from '../data/helpers.js';
import { useBackDismiss } from '../data/useBackDismiss.js';

const TASK_REMINDER_OFFSETS = [
  { mins: 15, label: '15 min before' },
  { mins: 30, label: '30 min before' },
  { mins: 60, label: '1 hour before' },
  { mins: 1440, label: '1 day before' },
];

// How a due date reads under a task: nothing for today (the section already
// says so), otherwise "Yesterday", "3 days ago", "Tomorrow", a weekday for the
// coming week, and a short date beyond that.
function friendlyDue(iso, today) {
  if (!iso || iso === today) return '';
  const day = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const diff = Math.round((day(iso) - day(today)) / 86400000);
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${-diff} days ago`;
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
  return formatShortDate(iso);
}

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
  const location = useLocation();
  const showToast = useToast();
  const taskCompleteAnim = state.settings?.taskCompleteAnim ?? true;
  const today = todayISO();

  // Only reachable from Home's "See all" link, so the device's own back
  // gesture (Android hardware/nav-bar back, iOS edge swipe) should return
  // there — not wherever raw history happens to put it. Registered for the
  // page's whole lifetime, layering correctly under any open editor sheet
  // (its own useBackDismiss closes first; this one only fires once nothing
  // else is intercepting).
  useBackDismiss(true, () => navigate('/'));

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
  // Skip a repeating task for now: moves it to its next upcoming date without
  // logging a completion (so the weekly recap isn't padded), with Undo.
  const skipRepeatingTask = (id) => {
    const t = state.tasks.find((x) => x.id === id);
    if (!t || !t.dueDate) return;
    const next = nextTaskDueDate(t.dueDate, t.repeat);
    actions.updateTask({ ...t, dueDate: next });
    setEditingTask(null);
    showToast(`Skipped. Next due ${formatShortDate(next)}`, 'Undo', () => actions.updateTask(t));
  };

  const toggleTaskDone = (t) => {
    if (t.done) {
      cancelCompletion(t.id);
      actions.updateTask({ ...t, done: false });
      return;
    }
    flashCompleted(t.id);
    const completedDates = [...(t.completedDates || []), todayISO()];
    if (t.repeat && t.repeat !== 'none' && t.dueDate) {
      const nextDueDate = nextTaskDueDate(t.dueDate, t.repeat);
      actions.updateTask({ ...t, done: false, dueDate: nextDueDate, completedDates });
      // A repeating task un-ticks itself and moves on, so there's no checkbox to
      // reverse a mistaken tap — offer Undo, which restores the task exactly as
      // it was (old due date, no extra completion logged).
      showToast(`Done. Next due ${formatShortDate(nextDueDate)}`, 'Undo', () => {
        cancelCompletion(t.id);
        actions.updateTask(t);
      });
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
  // Arriving here from Home's "Important reminders" (openTaskId in nav
  // state) opens that task's editor directly, instead of just landing on
  // the list and leaving it to be found by hand.
  useEffect(() => {
    // Also: the home screen widget's + opens a new task right here.
    if (location.state?.quickNewTask) {
      openNewTask();
      window.history.replaceState({}, '');
      return;
    }
    const id = location.state?.openTaskId;
    if (!id) return;
    const t = state.tasks.find((x) => x.id === id);
    if (t) openEditTask(t);
    window.history.replaceState({}, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
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
      <SwipeToDelete onDelete={() => deleteTaskWithUndo(t)}>
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
            {!t.done && t.notes?.trim() && <span className="task-notes muted small">{t.notes.trim()}</span>}
            {!t.done && [t.location, friendlyDue(t.dueDate, today)].some(Boolean) && (
              <span className={`task-meta muted small${t.dueDate && t.dueDate < today ? ' task-meta--late' : ''}`}>
                {[t.location, friendlyDue(t.dueDate, today)].filter(Boolean).join(' · ')}
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

  // "N left today": today's open tasks, with overdue counted alongside. What
  // was finished today (a repeating task that rolled forward counts too)
  // fills the ring.
  const [filter, setFilter] = useState('all');
  const groupItems = (key) => groups.find((g) => g.key === key)?.items || [];
  const leftToday = groupItems('today').length;
  const overdueCount = groupItems('overdue').length;
  const doneToday = (state.tasks || []).filter((t) => {
    if (justCompletedIds.has(t.id) || filingIds.has(t.id)) return false;
    const last = (t.completedDates || [])[(t.completedDates || []).length - 1];
    const repeating = t.repeat && t.repeat !== 'none';
    return last === today && (repeating || t.done);
  }).length;
  const dayTotal = doneToday + leftToday + overdueCount;
  const allClear = dayTotal > 0 && leftToday + overdueCount === 0;

  const moveOverdueToToday = () => {
    const before = groupItems('overdue');
    if (before.length === 0) return;
    for (const t of before) actions.updateTask({ ...t, dueDate: today });
    showToast(
      `Moved ${before.length} task${before.length === 1 ? '' : 's'} to today`,
      'Undo',
      () => before.forEach((t) => actions.updateTask(t))
    );
  };
  const FILTERS = [
    { key: 'all', label: 'All', n: totalOpen },
    { key: 'today', label: 'Today', n: leftToday },
    { key: 'overdue', label: 'Overdue', n: overdueCount },
    { key: 'upcoming', label: 'Upcoming', n: groupItems('upcoming').length },
    { key: 'nodate', label: 'No date', n: groupItems('nodate').length },
  ].filter((f) => f.key === 'all' || f.n > 0);
  // A filter whose group has since emptied falls back to showing everything.
  const activeFilter = FILTERS.some((f) => f.key === filter) ? filter : 'all';
  const shownGroups = activeFilter === 'all' ? groups : groups.filter((g) => g.key === activeFilter);

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-row">
          <Brand>Tasks</Brand>
        </div>
      </header>

      <MilestonesDue onOpen={() => navigate('/goals', { state: { view: 'objectives' } })} />

      {dayTotal > 0 && (
        <section className={`detail-section task-progress${allClear ? ' task-progress--clear' : ''}`}>
          {allClear ? (
            <>
              <div className="task-progress-emoji" aria-hidden="true">🎉</div>
              <strong className="task-progress-title">All done for today</strong>
              <span className="muted small">
                {doneToday} of {dayTotal} finished
              </span>
            </>
          ) : (
            <div className="task-progress-main">
              <div
                className="task-progress-ring"
                style={{ '--p': Math.round((doneToday / dayTotal) * 100) }}
                aria-hidden="true"
              >
                <span>
                  {doneToday}/{dayTotal}
                </span>
              </div>
              <div className="task-progress-text">
                <strong className="task-progress-title">
                  {leftToday === 0 ? 'Nothing else due today' : `${leftToday} left today`}
                </strong>
                <span className="muted small">
                  {overdueCount > 0 ? `Plus ${overdueCount} overdue` : 'Nice and steady.'}
                </span>
              </div>
            </div>
          )}
          <div className="task-progress-bar" aria-hidden="true">
            <i style={{ width: `${Math.round((doneToday / dayTotal) * 100)}%` }} />
          </div>
        </section>
      )}

      <section className="detail-section task-add-card">
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

      {FILTERS.length > 2 && (
        <div className="chips task-filter-chips">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`chip${activeFilter === f.key ? ' chip--on' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className="task-chip-n">{f.n}</span>
            </button>
          ))}
        </div>
      )}

      <div className="tasks-flow">
        {shownGroups.map((g) => (
          <section key={g.key} className={`task-group task-group--${g.key}`}>
            <div className="task-group-head">
              <span className="detail-label">
                {g.label} · {g.items.length}
              </span>
              {g.key === 'overdue' && (
                <button className="task-group-action" onClick={moveOverdueToToday}>
                  Move to today
                </button>
              )}
            </div>
            <ul className="task-list">{g.items.map(renderTaskRow)}</ul>
          </section>
        ))}

        {doneTasks.length > 0 && (
          <section className="task-group">
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
      </div>

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
                {editingTask.id && editingTask.repeat && editingTask.repeat !== 'none' && (
                  <button type="button" className="btn btn-ghost full" onClick={() => skipRepeatingTask(editingTask.id)}>
                    Skip this time
                  </button>
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
