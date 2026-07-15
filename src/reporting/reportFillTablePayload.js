import { resolveKey } from "../utils/selector.js";
import { formatDashboardValue } from "../components/dashboard/dashboardUtils.js";

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

function resolveDisplayValueMapValue(column = {}, value = undefined) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const displayValueMap = column?.displayValueMap && typeof column.displayValueMap === "object" && !Array.isArray(column.displayValueMap)
    ? column.displayValueMap
    : null;
  if (!displayValueMap) {
    return undefined;
  }
  const key = String(value);
  return Object.prototype.hasOwnProperty.call(displayValueMap, key)
    ? displayValueMap[key]
    : undefined;
}

function resolveTableColumnRawValue(row = {}, column = {}) {
  const sourceKey = normalizeString(column?.sourceKey || column?.key);
  return sourceKey ? resolveKey(row, sourceKey) : undefined;
}

function resolveTableColumnDisplayValue(row = {}, column = {}) {
  const rawValue = resolveTableColumnRawValue(row, column);
  const displayKey = normalizeString(column?.displayKey);
  const sourceKey = normalizeString(column?.sourceKey || column?.key);
  if (displayKey && displayKey !== sourceKey) {
    const displayValue = resolveKey(row, displayKey);
    if (hasPresentValue(displayValue)) {
      return displayValue;
    }
  }
  const mappedDisplayValue = resolveDisplayValueMapValue(column, rawValue);
  if (hasPresentValue(mappedDisplayValue)) {
    return mappedDisplayValue;
  }
  return rawValue;
}

function resolveCellVisualValue(row = {}, column = {}) {
  const valueField = normalizeString(column?.cellVisual?.valueField || column?.key);
  return valueField ? resolveKey(row, valueField) : undefined;
}

function resolveCellVisualRules(column = {}) {
  return Array.isArray(column?.cellVisual?.rules) ? column.cellVisual.rules : [];
}

function resolveCellVisualSegments(column = {}) {
  return Array.isArray(column?.cellVisual?.segments) ? column.cellVisual.segments : [];
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

function resolveColumnRankMap(column = {}, rows = []) {
  if (normalizeString(column?.cellVisual?.kind) !== "rank") {
    return null;
  }
  const values = (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeNumber(resolveCellVisualValue(row, column)))
    .filter((value) => value != null)
    .sort((left, right) => right - left);
  if (values.length === 0) {
    return null;
  }
  const ranks = new Map();
  let currentRank = 0;
  let lastValue = null;
  values.forEach((value) => {
    if (lastValue === null || value !== lastValue) {
      currentRank += 1;
      lastValue = value;
    }
    if (!ranks.has(value)) {
      ranks.set(value, currentRank);
    }
  });
  return ranks;
}

function buildRuntimeColumns(columns = [], rows = []) {
  return (Array.isArray(columns) ? columns : []).map((column) => {
    const kind = normalizeString(column?.cellVisual?.kind);
    if (kind === "dataBar" || kind === "progressBar" || kind === "sparkBar") {
      const range = resolveColumnRange(column, rows);
      return {
        ...cloneValue(column),
        cellVisualRuntime: range ? { range } : null,
      };
    }
    if (kind === "rank") {
      const ranks = resolveColumnRankMap(column, rows);
      return {
        ...cloneValue(column),
        cellVisualRuntime: ranks ? { ranks } : null,
      };
    }
    return cloneValue(column);
  });
}

function resolveCellVisualState(row = {}, column = {}) {
  const kind = normalizeString(column?.cellVisual?.kind);
  if (!kind) {
    return null;
  }
  const rawValue = resolveCellVisualValue(row, column);
  if (kind === "dataBar" || kind === "progressBar" || kind === "sparkBar") {
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
  if (kind === "shareBar") {
    const segments = resolveCellVisualSegments(column)
      .map((segment, index) => {
        const valueField = normalizeString(segment?.valueField);
        if (!valueField) {
          return null;
        }
        const numericValue = normalizeNumber(resolveKey(row, valueField));
        if (numericValue == null || numericValue < 0) {
          return null;
        }
        return {
          valueField,
          label: normalizeString(segment?.label || valueField) || valueField,
          color: normalizeString(segment?.color) || (Array.isArray(column?.cellVisual?.palette) ? column.cellVisual.palette[index] : "") || "#137cbd",
          value: numericValue,
        };
      })
      .filter(Boolean);
    if (segments.length === 0) {
      return null;
    }
    const total = segments.reduce((sum, segment) => sum + segment.value, 0);
    return {
      kind,
      segments: segments.map((segment) => ({
        label: segment.label,
        color: segment.color,
        value: segment.value,
        percent: total > 0 ? clamp(segment.value / total, 0, 1) : 0,
      })),
      label: segments.map((segment) => `${segment.label} ${formatDashboardValue(total > 0 ? segment.value / total : 0, "percentFraction")}`).join(" · "),
    };
  }
  if (kind === "delta") {
    const numericValue = normalizeNumber(rawValue);
    if (numericValue == null) {
      return null;
    }
    const positiveIsGood = column?.cellVisual?.positiveIsGood !== false;
    const tone = numericValue === 0
      ? "info"
      : ((numericValue > 0) === positiveIsGood ? "success" : "danger");
    const formatted = formatDashboardValue(numericValue, column?.format);
    const normalizedLabel = numericValue > 0
      ? `+${formatted}`
      : String(formatted);
    return {
      kind,
      value: numericValue,
      tone,
      label: normalizedLabel,
    };
  }
  if (kind === "rank") {
    const numericValue = normalizeNumber(rawValue);
    if (numericValue == null) {
      return null;
    }
    const rank = column?.cellVisualRuntime?.ranks?.get?.(numericValue);
    if (!Number.isFinite(rank)) {
      return null;
    }
    return {
      kind,
      value: rank,
      tone: "info",
      label: `#${rank}`,
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
    ...(normalizeString(rule?.background) ? { backgroundColor: normalizeString(rule.background) } : {}),
    ...(normalizeString(rule?.color) ? { textColor: normalizeString(rule.color), borderColor: normalizeString(rule.color) } : {}),
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
