const REPORT_LAYOUT_GRID_COLUMNS = 12;

const REPORT_LAYOUT_SPAN_PRESETS = Object.freeze([
  { span: 12, label: "Full" },
  { span: 8, label: "Two-thirds" },
  { span: 6, label: "Half" },
  { span: 4, label: "Third" },
  { span: 3, label: "Quarter" },
]);

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeReportLayoutSpanValue(value = null) {
  const numeric = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > REPORT_LAYOUT_GRID_COLUMNS) {
    return null;
  }
  return numeric;
}

function normalizeLegacyReportLayoutSize(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "quarter" || normalized === "1/4") {
    return 3;
  }
  if (normalized === "third" || normalized === "1/3") {
    return 4;
  }
  if (normalized === "half") {
    return 6;
  }
  if (normalized === "two-thirds" || normalized === "twothirds" || normalized === "2/3") {
    return 8;
  }
  if (normalized === "full") {
    return REPORT_LAYOUT_GRID_COLUMNS;
  }
  return null;
}

export { REPORT_LAYOUT_GRID_COLUMNS, REPORT_LAYOUT_SPAN_PRESETS };

export function resolveReportLayoutSpan(source = null, {
  defaultSpan = REPORT_LAYOUT_GRID_COLUMNS,
} = {}) {
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const explicitSpan = normalizeReportLayoutSpanValue(source?.span);
    if (explicitSpan) {
      return explicitSpan;
    }
    const legacySpan = normalizeLegacyReportLayoutSize(source?.size);
    if (legacySpan) {
      return legacySpan;
    }
    return defaultSpan;
  }
  const legacySpan = normalizeLegacyReportLayoutSize(source);
  if (legacySpan) {
    return legacySpan;
  }
  const explicitSpan = normalizeReportLayoutSpanValue(source);
  if (explicitSpan) {
    return explicitSpan;
  }
  return defaultSpan;
}

export function buildReportLayoutItem(blockId = "", source = null, {
  omitDefaultSpan = true,
  preserveLegacyHalf = false,
} = {}) {
  const normalizedBlockId = normalizeString(blockId);
  if (!normalizedBlockId) {
    return null;
  }
  const normalizedSource = source && typeof source === "object" && !Array.isArray(source)
    ? source
    : {
      span: normalizeReportLayoutSpanValue(source),
      size: normalizeString(source),
    };
  const explicitSpan = normalizeReportLayoutSpanValue(normalizedSource?.span);
  if (explicitSpan) {
    return omitDefaultSpan && explicitSpan === REPORT_LAYOUT_GRID_COLUMNS
      ? { blockId: normalizedBlockId }
      : { blockId: normalizedBlockId, span: explicitSpan };
  }
  const legacySpan = normalizeLegacyReportLayoutSize(normalizedSource?.size);
  if (legacySpan === 6 && preserveLegacyHalf) {
    return { blockId: normalizedBlockId, size: "half" };
  }
  if (legacySpan) {
    return omitDefaultSpan && legacySpan === REPORT_LAYOUT_GRID_COLUMNS
      ? { blockId: normalizedBlockId }
      : { blockId: normalizedBlockId, span: legacySpan };
  }
  return { blockId: normalizedBlockId };
}

export function resolveReportLayoutPreset(span = REPORT_LAYOUT_GRID_COLUMNS) {
  const normalizedSpan = resolveReportLayoutSpan(span);
  return REPORT_LAYOUT_SPAN_PRESETS.find((entry) => entry.span === normalizedSpan) || {
    span: normalizedSpan,
    label: `${normalizedSpan}/12`,
  };
}

export function resolveNextReportLayoutSpan(span = REPORT_LAYOUT_GRID_COLUMNS) {
  const normalizedSpan = resolveReportLayoutSpan(span);
  const currentIndex = REPORT_LAYOUT_SPAN_PRESETS.findIndex((entry) => entry.span === normalizedSpan);
  if (currentIndex >= 0) {
    return REPORT_LAYOUT_SPAN_PRESETS[(currentIndex + 1) % REPORT_LAYOUT_SPAN_PRESETS.length].span;
  }
  return REPORT_LAYOUT_SPAN_PRESETS[0].span;
}

export function resolveReportLayoutSnappedSpan({
  clientX = 0,
  left = 0,
  width = 0,
  columns = REPORT_LAYOUT_GRID_COLUMNS,
} = {}) {
  const normalizedColumns = Math.max(1, Math.trunc(Number(columns) || REPORT_LAYOUT_GRID_COLUMNS));
  const normalizedWidth = Number(width) || 0;
  if (!Number.isFinite(normalizedWidth) || normalizedWidth <= 0) {
    return REPORT_LAYOUT_GRID_COLUMNS;
  }
  const rawRatio = (Number(clientX) - Number(left)) / normalizedWidth;
  const ratio = Math.max(0, Math.min(1, rawRatio));
  return Math.max(1, Math.min(normalizedColumns, Math.round(ratio * normalizedColumns)));
}
