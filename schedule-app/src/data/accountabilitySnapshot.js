// The small progress summary pushed to /api/accountability/snapshot for a
// partner to read — deliberately not the whole app state (that's the
// Pro-gated cloud-sync blob), just enough to answer "how's it going": each
// active goal's progress against target, and today's task completion.
import { todayISO, goalKey } from './helpers.js';

const MAX_GOALS = 12;

export function buildAccountabilitySnapshot(state) {
  const today = todayISO();
  const now = new Date();
  const goals = (state.goals || []).slice(0, MAX_GOALS).map((g) => {
    const key = goalKey(g.period || 'weekly', now);
    return {
      id: g.id,
      title: g.title,
      period: g.period || 'weekly',
      target: g.target || 0,
      unit: g.unit || '',
      progress: g.progress?.[key] || 0,
    };
  });
  const tasksToday = (state.tasks || []).filter((t) => t.dueDate === today);
  return {
    goals,
    tasksToday: { total: tasksToday.length, done: tasksToday.filter((t) => t.done).length },
    updatedAt: new Date().toISOString(),
  };
}
