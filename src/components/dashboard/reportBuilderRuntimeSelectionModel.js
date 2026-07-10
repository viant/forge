function normalizeString(value = "") {
  return String(value || "").trim();
}

export function resolveCurrentReportBuilderRuntimeBlock(blocks = [], {
  preferredId = "",
  kind = "",
} = {}) {
  const normalizedBlocks = (Array.isArray(blocks) ? blocks : [])
    .filter((block) => block && typeof block === "object" && !Array.isArray(block));
  const normalizedPreferredId = normalizeString(preferredId);
  if (normalizedPreferredId) {
    const explicit = normalizedBlocks.find((block) => normalizeString(block?.id) === normalizedPreferredId) || null;
    if (explicit) {
      return explicit;
    }
  }
  const normalizedKind = normalizeString(kind);
  if (!normalizedKind) {
    return null;
  }
  return normalizedBlocks.find((block) => normalizeString(block?.kind) === normalizedKind) || null;
}
