import { nextTaskDueDate, todayISO } from './helpers.js';

// The same rule everywhere a task gets ticked off (Home, Tasks, the home screen widget):
// log today in completedDates; a repeating task rolls to its next due date instead of
// staying done.
export function completeTask(t, today = todayISO()) {
  const completedDates = [...(t.completedDates || []), today];
  if (t.repeat && t.repeat !== 'none' && t.dueDate) {
    return { ...t, done: false, dueDate: nextTaskDueDate(t.dueDate, t.repeat, today), completedDates };
  }
  return { ...t, done: true, completedDates };
}
