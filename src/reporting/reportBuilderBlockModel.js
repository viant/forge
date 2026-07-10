function normalizeString(value = "") {
  return String(value || "").trim();
}

export function resolveReportBuilderBlock(document = null) {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  return blocks.find((block) => normalizeString(block?.kind) === "reportBuilderBlock") || null;
}
