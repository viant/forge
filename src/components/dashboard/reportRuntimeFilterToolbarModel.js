function normalizeString(value = "") {
  return String(value ?? "").trim();
}

function hasActiveValue(value) {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value).some(hasActiveValue);
  return true;
}

export function listPublishedRuntimeFilters(filterBarBlocks = []) {
  const seen = new Set();
  return (Array.isArray(filterBarBlocks) ? filterBarBlocks : []).flatMap((block) => (
    Array.isArray(block?.content?.params) ? block.content.params : []
  )).filter((filter) => {
    const id = normalizeString(filter?.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function buildReportRuntimeFilterToolbarModel(filterBarBlocks = []) {
  const filters = listPublishedRuntimeFilters(filterBarBlocks);
  const activeCount = filters.filter((filter) => filter?.enabled !== false && hasActiveValue(filter?.value)).length;
  return {
    visible: filters.length > 0,
    activeCount,
    filters,
  };
}
