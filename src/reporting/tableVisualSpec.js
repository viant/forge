function normalizeString(value = "") {
  return String(value || "").trim();
}

function isTruncatedPlaceholder(value = "") {
  return normalizeString(value) === "[MaxDepth]";
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeStringArray(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value))
    .filter(Boolean);
}

function normalizeRange(range = {}) {
  if (!range || typeof range !== "object" || Array.isArray(range)) {
    return null;
  }
  const mode = normalizeString(range.mode);
  const next = {
    ...(mode ? { mode } : {}),
    ...(Number.isFinite(Number(range.min)) ? { min: Number(range.min) } : {}),
    ...(Number.isFinite(Number(range.max)) ? { max: Number(range.max) } : {}),
  };
  return Object.keys(next).length > 0 ? next : null;
}

function normalizeRules(rules = []) {
  return (Array.isArray(rules) ? rules : [])
    .map((rule) => {
      if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
        return null;
      }
      const next = {
        ...("value" in rule ? { value: cloneValue(rule.value) } : {}),
        ...(normalizeString(rule.tone) ? { tone: normalizeString(rule.tone) } : {}),
        ...(normalizeString(rule.label) ? { label: normalizeString(rule.label) } : {}),
        ...(normalizeString(rule.color) ? { color: normalizeString(rule.color) } : {}),
        ...(normalizeString(rule.background) ? { background: normalizeString(rule.background) } : {}),
      };
      return Object.keys(next).length > 0 ? next : null;
    })
    .filter(Boolean);
}

function normalizeSegments(segments = []) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment) => {
      if (!segment || typeof segment !== "object" || Array.isArray(segment)) {
        return null;
      }
      const valueField = normalizeString(segment.valueField);
      if (!valueField) {
        return null;
      }
      const next = {
        valueField,
        ...(normalizeString(segment.label) ? { label: normalizeString(segment.label) } : {}),
        ...(normalizeString(segment.color) ? { color: normalizeString(segment.color) } : {}),
      };
      return next;
    })
    .filter(Boolean);
}

export function normalizeReportTableCellVisual(cellVisual = {}) {
  if (!cellVisual || typeof cellVisual !== "object" || Array.isArray(cellVisual)) {
    return null;
  }
  const kind = normalizeString(cellVisual.kind);
  if (!["dataBar", "progressBar", "sparkBar", "shareBar", "tone", "badge", "delta", "rank"].includes(kind)) {
    return null;
  }
  const next = {
    kind,
    ...(normalizeString(cellVisual.valueField) ? { valueField: normalizeString(cellVisual.valueField) } : {}),
    ...(normalizeRange(cellVisual.range) ? { range: normalizeRange(cellVisual.range) } : {}),
    ...(normalizeStringArray(cellVisual.palette).length > 0 ? { palette: normalizeStringArray(cellVisual.palette) } : {}),
    ...(normalizeSegments(cellVisual.segments).length > 0 ? { segments: normalizeSegments(cellVisual.segments) } : {}),
    ...(normalizeString(cellVisual.nullBehavior) ? { nullBehavior: normalizeString(cellVisual.nullBehavior) } : {}),
    ...(normalizeRules(cellVisual.rules).length > 0 ? { rules: normalizeRules(cellVisual.rules) } : {}),
    ...(cellVisual?.positiveIsGood === false ? { positiveIsGood: false } : {}),
  };
  return next;
}

export function normalizeReportTableBlockColumn(column = {}) {
  if (!column || typeof column !== "object" || Array.isArray(column)) {
    return null;
  }
  const key = normalizeString(column.key);
  if (!key || isTruncatedPlaceholder(key)) {
    return null;
  }
  const cellVisual = normalizeReportTableCellVisual(column.cellVisual);
  return {
    key,
    ...(normalizeString(column.sourceKey) ? { sourceKey: normalizeString(column.sourceKey) } : {}),
    ...(normalizeString(column.displayKey) ? { displayKey: normalizeString(column.displayKey) } : {}),
    ...(column?.displayValueMap && typeof column.displayValueMap === "object" && !Array.isArray(column.displayValueMap)
      ? { displayValueMap: cloneValue(column.displayValueMap) }
      : {}),
    ...(normalizeString(column.kind) ? { kind: normalizeString(column.kind) } : {}),
    ...(normalizeString(column.label) ? { label: normalizeString(column.label) } : {}),
    ...(normalizeString(column.format) ? { format: normalizeString(column.format) } : {}),
    ...(normalizeString(column.align) ? { align: normalizeString(column.align) } : {}),
    ...(column?.runtimeFilterable === true ? { runtimeFilterable: true } : {}),
    ...(cellVisual ? { cellVisual } : {}),
  };
}

export function normalizeReportDocumentTableBlock(block = {}) {
  const id = normalizeString(block?.id || "tableBlock");
  const title = normalizeString(block?.title || "Table");
  const datasetRef = normalizeString(block?.datasetRef || "primary");
  const rawColumns = Array.isArray(block?.columns) ? block.columns : [];
  const rawColumnKeys = Array.isArray(block?.columnKeys) ? block.columnKeys : [];
  const explicitColumns = (Array.isArray(block?.columns) ? block.columns : [])
    .map((column) => normalizeReportTableBlockColumn(column))
    .filter(Boolean);
  const columns = explicitColumns.length > 0
    ? explicitColumns
    : normalizeStringArray(block?.columnKeys)
      .filter((key) => !isTruncatedPlaceholder(key))
      .map((key) => ({ key }));
  if (
    columns.length === 0
    && (
      rawColumns.some((column) => isTruncatedPlaceholder(column?.key))
      || rawColumnKeys.some((key) => isTruncatedPlaceholder(key))
    )
  ) {
    return null;
  }
  return {
    id,
    kind: "tableBlock",
    title,
    datasetRef,
    columns,
  };
}
