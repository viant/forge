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
    case "compactnumber":
      if (axis) {
        const absolute = Math.abs(numeric);
        if (absolute >= 1_000_000) {
          return `${(numeric / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
        }
        if (absolute >= 1_000) {
          return `${(numeric / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
        }
      }
      return formatGroupedNumberWithSpaces(numeric, {
        minimumFractionDigits: Number.isInteger(numeric) ? 0 : 5,
        maximumFractionDigits: Number.isInteger(numeric) ? 0 : 5,
      });
    case "percent":
      return `${numeric.toFixed(1)}%`;
    case "percentfraction":
      return `${(numeric * 100).toFixed(1)}%`;
    case "number":
    case "":
      if (axis) {
        if (Number.isInteger(numeric)) {
          return new Intl.NumberFormat("en-US", {
            maximumFractionDigits: 0,
            useGrouping: true,
          }).format(numeric);
        }
        return new Intl.NumberFormat("en-US", {
          maximumFractionDigits: 1,
          useGrouping: true,
        }).format(numeric);
      }
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 5,
        maximumFractionDigits: 5,
        useGrouping: true,
      }).format(numeric);
    default:
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 5,
        maximumFractionDigits: 5,
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
  const numeric = normalizeFiniteNumber(value);
  if (numeric != null) {
    return formatExportNumericValue(numeric, format, options);
  }
  return String(value);
}
