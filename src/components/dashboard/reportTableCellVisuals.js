import equal from "fast-deep-equal";
import { buildReportVisualTint } from "../../reporting/reportVisualColor.js";

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

function resolveCellVisualSegments(column = {}) {
  return Array.isArray(column?.cellVisual?.segments) ? column.cellVisual.segments : [];
}

function resolveDeltaTone(value = 0, positiveIsGood = true) {
  if (value === 0) {
    return "info";
  }
  return (value > 0) === positiveIsGood ? "success" : "danger";
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
    const kind = normalizeString(column?.cellVisual?.kind);
    if (kind === "dataBar" || kind === "progressBar" || kind === "sparkBar") {
      const range = resolveColumnRange(column, rows);
      return {
        ...column,
        cellVisualRuntime: range ? { range } : null,
      };
    }
    if (kind === "rank") {
      const ranks = resolveColumnRankMap(column, rows);
      return {
        ...column,
        cellVisualRuntime: ranks ? { ranks } : null,
      };
    }
    return column;
  });
}

export function resolveReportTableCellVisualState(row = {}, column = {}) {
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
    const colorField = normalizeString(column?.cellVisual?.colorField);
    const colorValue = colorField ? row?.[colorField] : rawValue;
    const colorRule = resolveRuleMatch(colorValue, resolveCellVisualRules(column));
    const ruleColor = normalizeString(colorRule?.color);
    const resolvedPalette = colorRule
      ? [normalizeString(colorRule?.background) || buildReportVisualTint(ruleColor) || palette[0], ruleColor || palette[1]].filter(Boolean)
      : palette;
    return {
      kind,
      value: numericValue,
      percent: buildDataBarPercent(numericValue, range),
      palette: resolvedPalette,
    };
  }
  if (kind === "shareBar") {
    const segments = resolveCellVisualSegments(column)
      .map((segment, index) => {
        const valueField = normalizeString(segment?.valueField);
        if (!valueField) {
          return null;
        }
        const numericValue = normalizeNumber(row?.[valueField]);
        if (numericValue == null || numericValue < 0) {
          return null;
        }
        return {
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
    };
  }
  if (kind === "delta") {
    const numericValue = normalizeNumber(rawValue);
    if (numericValue == null) {
      return null;
    }
    return {
      kind,
      value: numericValue,
      tone: resolveDeltaTone(numericValue, column?.cellVisual?.positiveIsGood !== false),
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
