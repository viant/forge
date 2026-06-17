import { resolveKey } from "../utils/selector.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hasPresentValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function resolveTableColumnRawValue(row = {}, column = {}) {
  const sourceKey = normalizeString(column?.sourceKey || column?.key);
  return sourceKey ? resolveKey(row, sourceKey) : undefined;
}

function resolveTableColumnDisplayValue(row = {}, column = {}) {
  const displayKey = normalizeString(column?.displayKey);
  if (displayKey) {
    const displayValue = resolveKey(row, displayKey);
    if (hasPresentValue(displayValue)) {
      return displayValue;
    }
  }
  return resolveTableColumnRawValue(row, column);
}

function resolveCellVisualValue(row = {}, column = {}) {
  const valueField = normalizeString(column?.cellVisual?.valueField || column?.key);
  return valueField ? resolveKey(row, valueField) : undefined;
}

function resolveCellVisualRules(column = {}) {
  return Array.isArray(column?.cellVisual?.rules) ? column.cellVisual.rules : [];
}

function resolveRuleMatch(value, rules = []) {
  return (Array.isArray(rules) ? rules : []).find((rule) => JSON.stringify(rule?.value) === JSON.stringify(value)) || null;
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

function buildRuntimeColumns(columns = [], rows = []) {
  return (Array.isArray(columns) ? columns : []).map((column) => {
    if (normalizeString(column?.cellVisual?.kind) !== "dataBar") {
      return cloneValue(column);
    }
    const range = resolveColumnRange(column, rows);
    return {
      ...cloneValue(column),
      cellVisualRuntime: range ? { range } : null,
    };
  });
}

function resolveCellVisualState(row = {}, column = {}) {
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
    const percent = !range
      ? 0
      : (range.max === range.min
          ? (range.max === 0 ? 0 : 1)
          : clamp((numericValue - range.min) / (range.max - range.min), 0, 1));
    return {
      kind,
      value: numericValue,
      percent,
      palette: cloneValue(palette),
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

export function buildReportFillTableRows(columns = [], rows = []) {
  const runtimeColumns = buildRuntimeColumns(columns, rows);
  return (Array.isArray(rows) ? rows : []).map((row, rowIndex) => ({
    rowIndex,
    cells: runtimeColumns.map((column) => ({
      key: normalizeString(column?.key),
      sourceKey: normalizeString(column?.sourceKey || column?.key),
      displayKey: normalizeString(column?.displayKey || column?.key),
      value: cloneValue(resolveTableColumnRawValue(row, column) ?? null),
      displayValue: cloneValue(resolveTableColumnDisplayValue(row, column) ?? null),
      visualState: cloneValue(resolveCellVisualState(row, column)),
    })),
  }));
}
