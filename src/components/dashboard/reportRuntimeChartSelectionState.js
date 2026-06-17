function normalizeString(value = "") {
  return String(value || "").trim();
}

export function setReportRuntimeChartSelection(previousSelections = {}, blockId = "", selection = null) {
  const normalizedBlockId = normalizeString(blockId);
  if (!normalizedBlockId) {
    return previousSelections && typeof previousSelections === "object" ? previousSelections : {};
  }
  return {
    ...(previousSelections && typeof previousSelections === "object" ? previousSelections : {}),
    [normalizedBlockId]: selection,
  };
}

export function clearReportRuntimeChartSelection(previousSelections = {}, blockId = "") {
  const normalizedBlockId = normalizeString(blockId);
  if (!normalizedBlockId) {
    return previousSelections && typeof previousSelections === "object" ? previousSelections : {};
  }
  return {
    ...(previousSelections && typeof previousSelections === "object" ? previousSelections : {}),
    [normalizedBlockId]: null,
  };
}
