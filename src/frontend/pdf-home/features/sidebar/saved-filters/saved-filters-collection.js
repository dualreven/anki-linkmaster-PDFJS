function buildSignaturePart(value) {
  if (Array.isArray(value)) { return value; }
  if (value && typeof value === "object") { return value; }
  return value ?? null;
}

export function buildSavedFilterSignature(filter) {
  if (!filter || typeof filter !== "object") {
    throw new Error("[SavedFilters] buildSavedFilterSignature: filter must be an object");
  }
  return JSON.stringify({
    searchText: String(filter.searchText || ""),
    filters: buildSignaturePart(filter.filters),
    sort: buildSignaturePart(filter.sort) || []
  });
}

export function upsertSavedFilter({ savedFilters, newFilter, maxItems, nowMs }) {
  if (!Array.isArray(savedFilters)) {
    throw new Error("[SavedFilters] upsertSavedFilter: savedFilters must be an array");
  }
  if (!newFilter || typeof newFilter !== "object") {
    throw new Error("[SavedFilters] upsertSavedFilter: newFilter must be an object");
  }
  const limit = Number(maxItems || 0) > 0 ? Number(maxItems) : 50;
  const now = Number(nowMs || 0) > 0 ? Number(nowMs) : Date.now();

  const key = buildSavedFilterSignature(newFilter);
  const idx = savedFilters.findIndex((sf) => buildSavedFilterSignature(sf) === key);

  if (idx >= 0) {
    const exist = savedFilters[idx];
    const updated = { ...exist, name: newFilter.name || exist.name, ts: now };
    const rest = savedFilters.filter((_, i) => i !== idx);
    const out = [updated, ...rest];
    return out.length > limit ? out.slice(0, limit) : out;
  }

  const out = [newFilter, ...savedFilters];
  return out.length > limit ? out.slice(0, limit) : out;
}
