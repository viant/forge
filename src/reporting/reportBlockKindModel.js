function normalizeString(value = "") {
  return String(value || "").trim();
}

export function isReportDatasetBackedBlockKind(kind = "") {
  const normalizedKind = normalizeString(kind);
  return normalizedKind === "tableBlock"
    || normalizedKind === "chartBlock"
    || normalizedKind === "kpiBlock"
    || normalizedKind === "collectionBlock"
    || normalizedKind === "geoMapBlock"
    || normalizedKind === "badgesBlock"
    || normalizedKind === "filterBarBlock";
}
