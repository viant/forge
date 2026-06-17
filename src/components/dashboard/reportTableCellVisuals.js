import equal from "fast-deep-equal";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveCellVisualValue(row = {}, column = {}) {
  const valueField = normalizeString(column?.cellVisual?.valueField || column?.key);
  return valueField ? row?.[valueField] : undefined;
}

function resolveCellVisualRules(column = {}) {
  return Array.isArray(column?.cellVisual?.rules) ? column.cellVisual.rules : [];
}

function resolveRuleMatch(value, rules = []) {
  return rules.find((rule) => equal(rule?.value, value)) || null;
}

function resolveColumnRange(column = {}, rows = []) {
  const range = column?.cellVisual?.range;
  if (!range || typeof range !== "object" || Array.isArray(range)) {
    return null;
  }
  const explicitMin = normalizeNumber(range.min);
  const explicitMax = normalizeNumber(range.max);
  if (explicitMin != null || explicitMax != null) {
    const min = explicitMin != null ? explicitMin : explicitMax;
    const max = explicitMax != null ? explicitMax : explicitMin;
    return min != null && max != null ? { min, max } : null;
  }
  if (normalizeString(range.mode) !== "columnMax") {
    return null;
  }
  const values = (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeNumber(resolveCellVisualValue(row, column)))
    .filter((value) => value != null);
  if (values.length === 0) {
    return null;
  }
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function buildDataBarPercent(value, range) {
  if (value == null || !range) {
    return 0;
  }
  if (range.max === range.min) {
    return range.max === 0 ? 0 : 1;
  }
  return clamp((value - range.min) / (range.max - range.min), 0, 1);
}

export function buildReportTableRuntimeColumns(columns = [], rows = []) {
  return (Array.isArray(columns) ? columns : []).map((column) => {
    if (normalizeString(column?.cellVisual?.kind) !== "dataBar") {
      return column;
    }
    const range = resolveColumnRange(column, rows);
    return {
      ...column,
      cellVisualRuntime: range ? { range } : null,
    };
  });
}

export function resolveReportTableCellVisualState(row = {}, column = {}) {
  const kind = normalizeString(column?.cellVisual?.kind);
  if (!kind) {
    return null;
  }
  const rawValue = resolveCellVisualValue(row, column);
  if (kind === "dataBar") {
    const numericValue = normalizeNumber(rawValue);
    if (numericValue == null) {
      return null;
    }
    const range = column?.cellVisualRuntime?.range || null;
    const palette = Array.isArray(column?.cellVisual?.palette) ? column.cellVisual.palette : [];
    return {
      kind,
      value: numericValue,
      percent: buildDataBarPercent(numericValue, range),
      palette,
    };
  }
  const rule = resolveRuleMatch(rawValue, resolveCellVisualRules(column));
  if (!rule) {
    return null;
  }
  return {
    kind,
    tone: normalizeString(rule?.tone || "info") || "info",
    label: normalizeString(rule?.label) || String(rawValue ?? ""),
  };
}
