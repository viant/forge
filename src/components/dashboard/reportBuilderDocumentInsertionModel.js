function normalizeString(value = "") {
  return String(value || "").trim();
}

export function resolveDefaultReportBuilderInsertionAfterId({
  preferredInsertionAfterId = "",
  authoredBlocks = [],
} = {}) {
  const explicitInsertionAfterId = normalizeString(preferredInsertionAfterId);
  if (explicitInsertionAfterId) {
    return explicitInsertionAfterId;
  }
  const lastAuthoredBlockId = (Array.isArray(authoredBlocks) ? authoredBlocks : [])
    .map((block) => normalizeString(block?.id))
    .filter(Boolean)
    .slice(-1)[0];
  return lastAuthoredBlockId || "primaryBuilder";
}
