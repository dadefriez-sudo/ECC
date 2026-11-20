// People with no group, A to Z. A person whose group was deleted counts too.
export function ungroupedContacts(state) {
  const ids = new Set((state?.statuses || []).map((s) => s.id));
  return (state?.contacts || [])
    .filter((c) => !c.statusId || !ids.has(c.statusId))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}
