function normalizeString(value = "") {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatExportDateValue(value, {
  includeTime = false,
} = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

function formatGroupedNumberWithSpaces(value, {
  minimumFractionDigits = 0,
  maximumFractionDigits = 0,
} = {}) {
  const numeric = normalizeFiniteNumber(value);
  if (numeric == null) {
    return normalizeString(value);
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping: true,
  }).format(numeric).replace(/,/g, " ");
}

export function formatExportNumericValue(value, format = "", {
  axis = false,
} = {}) {
  const numeric = normalizeFiniteNumber(value);
  if (numeric == null) {
    return normalizeString(value);
  }
  const normalizedFormat = normalizeString(format).toLowerCase();
  switch (normalizedFormat) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric);
    case "compact":
    case "compactnumber":
      {
        const absolute = Math.abs(numeric);
        const compactUnits = [
          [1_000_000_000_000, "T"],
          [1_000_000_000, "B"],
          [1_000_000, "M"],
          [1_000, "K"],
        ];
        const match = compactUnits.find(([threshold]) => absolute >= threshold);
        if (match) {
          const [threshold, suffix] = match;
          const precision = axis ? 1 : (absolute / threshold >= 100 ? 0 : 2);
          return `${(numeric / threshold).toFixed(precision).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")}${suffix}`;
        }
      }
      return formatGroupedNumberWithSpaces(numeric, {
        minimumFractionDigits: 0,
        maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
      });
    case "percent":
      return `${numeric.toFixed(1)}%`;
    case "percentfraction":
      return `${(numeric * 100).toFixed(1)}%`;
    case "number":
      return formatGroupedNumberWithSpaces(numeric, {
        minimumFractionDigits: 0,
        maximumFractionDigits: axis ? (Number.isInteger(numeric) ? 0 : 1) : 5,
      });
    case "number5":
      return formatGroupedNumberWithSpaces(numeric, {
        minimumFractionDigits: 5,
        maximumFractionDigits: 5,
      });
    case "":
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
        useGrouping: true,
      }).format(numeric);
    default:
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
        useGrouping: true,
      }).format(numeric);
  }
}

export function formatExportValue(value, format = "", options = {}) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.map((entry) => formatExportValue(entry, format, options)).join(", ");
  }
  if (isPlainObject(value)) {
    const start = normalizeString(value?.start);
    const end = normalizeString(value?.end);
    if (start || end) {
      if (start && end) {
        return `${start} to ${end}`;
      }
      return start || end;
    }
    return JSON.stringify(value);
  }
  const normalizedFormat = normalizeString(format).toLowerCase();
  if (normalizedFormat === "date" || normalizedFormat === "datetime") {
    return formatExportDateValue(value, { includeTime: normalizedFormat === "datetime" });
  }
  const numeric = normalizeFiniteNumber(value);
  if (numeric != null) {
    return formatExportNumericValue(numeric, format, options);
  }
  return String(value);
}
