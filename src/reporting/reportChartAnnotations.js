function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeNumericString(value = "") {
  return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : null;
}

function normalizeAnnotationValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = normalizeString(value);
    if (!normalized) {
      return null;
    }
    const numeric = normalizeNumericString(normalized);
    return numeric == null ? normalized : numeric;
  }
  return null;
}

function normalizeOpacity(value, fallback = 0.12) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, numeric));
}

function normalizeAxis(value = "", fallback = "x") {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === "y" ? "y" : fallback;
}

function normalizePosition(value = "", fallback = "end") {
  const normalized = normalizeString(value).toLowerCase();
  return ["start", "middle", "end"].includes(normalized) ? normalized : fallback;
}

export function resolveChartAnnotationStrokeDasharray(lineStyle = "") {
  const normalized = normalizeString(lineStyle).toLowerCase();
  if (normalized === "dotted") {
    return "2 4";
  }
  if (normalized === "dashed") {
    return "6 4";
  }
  return "";
}

export function normalizeChartAnnotations(chartModel = {}) {
  const annotations = chartModel?.annotations;
  if (!annotations || typeof annotations !== "object" || Array.isArray(annotations)) {
    return [];
  }

  const items = [];

  const verticalMarkers = Array.isArray(annotations?.verticalMarkers) ? annotations.verticalMarkers : [];
  verticalMarkers.forEach((entry = {}, index) => {
    const value = normalizeAnnotationValue(entry?.value ?? entry?.x);
    if (value == null) {
      return;
    }
    items.push({
      id: normalizeString(entry?.id || `vertical-marker-${index + 1}`),
      kind: "verticalMarker",
      axis: "x",
      value,
      label: normalizeString(entry?.label || entry?.title),
      color: normalizeString(entry?.color || "#d9822b") || "#d9822b",
      lineStyle: normalizeString(entry?.lineStyle || entry?.style || "dashed"),
      position: normalizePosition(entry?.position, "end"),
    });
  });

  const referenceLines = Array.isArray(annotations?.referenceLines) ? annotations.referenceLines : [];
  referenceLines.forEach((entry = {}, index) => {
    const value = normalizeAnnotationValue(entry?.value);
    if (value == null) {
      return;
    }
    items.push({
      id: normalizeString(entry?.id || `reference-line-${index + 1}`),
      kind: "referenceLine",
      axis: normalizeAxis(entry?.axis, "y"),
      value,
      label: normalizeString(entry?.label || entry?.title),
      color: normalizeString(entry?.color || "#7a46d8") || "#7a46d8",
      lineStyle: normalizeString(entry?.lineStyle || entry?.style || "solid"),
      position: normalizePosition(entry?.position, "end"),
    });
  });

  const bands = Array.isArray(annotations?.bands) ? annotations.bands : [];
  bands.forEach((entry = {}, index) => {
    const from = normalizeAnnotationValue(entry?.from ?? entry?.start ?? entry?.x1 ?? entry?.y1);
    const to = normalizeAnnotationValue(entry?.to ?? entry?.end ?? entry?.x2 ?? entry?.y2);
    if (from == null || to == null) {
      return;
    }
    items.push({
      id: normalizeString(entry?.id || `band-${index + 1}`),
      kind: "band",
      axis: normalizeAxis(entry?.axis, "x"),
      from,
      to,
      label: normalizeString(entry?.label || entry?.title),
      color: normalizeString(entry?.color || "#137cbd") || "#137cbd",
      opacity: normalizeOpacity(entry?.opacity, 0.12),
    });
  });

  const notes = Array.isArray(annotations?.notes) ? annotations.notes : [];
  notes.forEach((entry = {}, index) => {
    const x = normalizeAnnotationValue(entry?.x);
    const y = normalizeAnnotationValue(entry?.y);
    const label = normalizeString(entry?.label || entry?.title);
    if (x == null || y == null || !label) {
      return;
    }
    items.push({
      id: normalizeString(entry?.id || `note-${index + 1}`),
      kind: "note",
      x,
      y,
      label,
      color: normalizeString(entry?.color || "#0f9960") || "#0f9960",
    });
  });

  return items;
}
