function normalizePreset(value = "") {
  return String(value || "").trim().toLowerCase().replaceAll("_", "");
}

function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeSemanticExpression(value = "") {
  return String(value || "")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/\s+/g, " ");
}

export function resolveReportRelativeTime(expression = "", now = new Date()) {
  const source = normalizeSemanticExpression(expression);
  if (!source) return null;
  const utc = /(?:\s+in\s+utc|\s+inutc)$/i.test(source);
  const normalized = source.replace(/\s+in\s*utc$/i, "").trim().toLowerCase();
  const result = new Date(now.getTime());
  if (["now", "today"].includes(normalized)) return result;
  if (normalized === "yesterday") {
    result.setTime(result.getTime() - 24 * 60 * 60 * 1000);
    return result;
  }
  if (normalized === "tomorrow") {
    result.setTime(result.getTime() + 24 * 60 * 60 * 1000);
    return result;
  }
  const match = normalized.match(/^(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|days?|weeks?)\s+(ahead|after|later|onward|ago|before|earlier|past)$/i);
  if (!match) return null;
  const count = Number(match[1]);
  const units = match[2].toLowerCase();
  const direction = ["ago", "before", "earlier", "past"].includes(match[3].toLowerCase()) ? -1 : 1;
  const unitMillis = units.startsWith("sec") ? 1000
    : units.startsWith("min") ? 60 * 1000
      : units.startsWith("hour") ? 60 * 60 * 1000
        : units.startsWith("week") ? 7 * 24 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
  result.setTime(result.getTime() + direction * count * unitMillis);
  if (utc) return new Date(result.toISOString());
  return result;
}

export function formatReportRelativeTime(expression = "", { now = new Date(), format = "date" } = {}) {
  const resolved = resolveReportRelativeTime(expression, now);
  if (!resolved) return "";
  return String(format || "date").toLowerCase() === "datetime"
    ? resolved.toISOString()
    : formatDateISO(resolved);
}

export function resolveReportRelativeDateRange(preset = "", now = new Date()) {
  const normalizedPreset = normalizePreset(preset);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  switch (normalizedPreset) {
    case "today":
      break;
    case "yesterday":
      start.setDate(end.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case "last3days":
    case "3d":
      start.setDate(end.getDate() - 2);
      break;
    case "last7days":
    case "7d":
      start.setDate(end.getDate() - 6);
      break;
    case "last30days":
    case "30d":
      start.setDate(end.getDate() - 29);
      break;
    default:
      return null;
  }
  return { start: formatDateISO(start), end: formatDateISO(end) };
}

export function resolveReportRelativeDateRangeSpec(spec = {}, now = new Date(), referenceRequest = null) {
  if (normalizePreset(spec?.preset) === "previousperiod") {
    const atPath = (path) => String(path || "").split(".").reduce((value, key) => value?.[key], referenceRequest);
    return resolveReportPreviousPeriodRange(atPath(spec.startParamPath), atPath(spec.endParamPath));
  }
  const presetRange = resolveReportRelativeDateRange(spec?.preset, now);
  if (presetRange) return presetRange;
  const start = formatReportRelativeTime(spec?.startExpression, { now, format: spec?.format });
  const end = formatReportRelativeTime(spec?.endExpression, { now, format: spec?.format });
  return start && end ? { start, end } : null;
}

// Civil date arithmetic is independent of the browser timezone and DST. The
// preceding interval has the same inclusive day count and never overlaps.
export function resolveReportPreviousPeriodRange(start, end) {
  const parse = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(value + "T00:00:00.000Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  };
  const from = parse(start), to = parse(end);
  if (!from || !to || from > to) throw new Error("Previous period requires a valid bounded civil date range.");
  const day = 86400000;
  const length = (to.getTime() - from.getTime()) / day + 1;
  const previousStart = new Date(from.getTime() - length * day);
  const previousEnd = new Date(from.getTime() - day);
  if (previousStart.getUTCFullYear() < 1) throw new Error("Previous period exceeds the supported civil date range.");
  return { start: previousStart.toISOString().slice(0, 10), end: previousEnd.toISOString().slice(0, 10) };
}
