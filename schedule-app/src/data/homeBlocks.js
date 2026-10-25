// Home page blocks (Pro: reorder + show/hide, editable right on the Home
// page itself, not just from Settings). Each id renders its full existing
// content — the goal rings, the whole reminders list, the whole task list,
// the whole notes grid — never a shrunk-down counter/stat tile.
export const HOME_BLOCK_TYPES = [
  { id: 'challenge', label: "Today's challenge", icon: 'compass' },
  { id: 'goals', label: 'Goals', icon: 'target' },
  { id: 'nudges', label: 'Nudges', icon: 'lightbulb' },
  { id: 'upnext', label: 'Up next', icon: 'clock' },
  { id: 'reminders', label: 'Important reminders', icon: 'bell' },
  { id: 'recap', label: 'Weekly recap', icon: 'chart' },
  { id: 'tasks', label: 'Tasks', icon: 'check' },
  { id: 'notes', label: 'Notes', icon: 'note' },
];

export const DEFAULT_HOME_BLOCKS = HOME_BLOCK_TYPES.map((b) => ({ id: b.id, enabled: true }));

// Same merge pattern used across the app's other reorderable lists: keeps
// stored order/enabled flags for known blocks, drops stale/unknown/
// duplicate entries, and appends any new block type (enabled) so it shows
// up for existing users without a migration step.
export function normalizeHomeBlocks(list) {
  const known = new Set(HOME_BLOCK_TYPES.map((b) => b.id));
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    if (!item || !known.has(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({ id: item.id, enabled: !!item.enabled });
  }
  // A block type added after someone saved their layout appears (switched on)
  // next to the block it belongs with, not dumped at the bottom, so an
  // unchanged layout stays in its default order.
  for (const [i, b] of HOME_BLOCK_TYPES.entries()) {
    if (seen.has(b.id)) continue;
    // Immediately before the next block (in default order) that this layout has.
    const next = HOME_BLOCK_TYPES.slice(i + 1).find((x) => out.some((o) => o.id === x.id));
    const at = next ? out.findIndex((o) => o.id === next.id) : -1;
    const entry = { id: b.id, enabled: true };
    if (at === -1) out.push(entry);
    else out.splice(at, 0, entry);
  }
  return out;
}
