import {isNumericValue} from "../utils/isNumericValue.js";
function normalizeString(value = "") {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeFiniteNumber(value) {
  return isNumericValue(value) ? Number(value) : null;
}

// Fixed presentation options only: never rows, identities, or authorization.
const dateFormatters=new Map();
const numberFormatters=new Map();
function exportFormatter(cache,Constructor,options){
  const key=JSON.stringify(options);
  if(cache.has(key))return cache.get(key);
  const formatter=new Constructor("en-US",options);
  if(cache.size>=16)cache.delete(cache.keys().next().value);
  cache.set(key,formatter);
  return formatter;
}
// Values whose shortest decimal already fits the requested precision need
// grouping/padding only. Keep Intl as the authority whenever rounding, exponent
// expansion or magnitudes beyond safe integers are involved. This avoids the
// bundled Intl polyfill's decimal arithmetic for each distinct exact table cell.
function formatExportDecimal(numeric, options) {
  const absolute = Math.abs(numeric);
  const decimal = String(absolute);
  const [integer, fraction = ""] = decimal.split(".");
  if (absolute <= Number.MAX_SAFE_INTEGER && !decimal.includes("e")
    && fraction.length <= options.maximumFractionDigits) {
    const sign = numeric < 0 || Object.is(numeric, -0) ? "-" : "";
    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const digits = fraction.padEnd(options.minimumFractionDigits, "0");
    return `${sign}${options.style === "currency" ? "$" : ""}${grouped}${digits ? `.${digits}` : ""}`;
  }
  return exportFormatter(numberFormatters, Intl.NumberFormat, options).format(numeric);
}

function formatExportDateValue(value, {
  includeTime = false,
} = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return exportFormatter(dateFormatters,Intl.DateTimeFormat, {
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
  return formatExportDecimal(numeric, {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping: true,
  }).replace(/,/g, " ");
}

export function formatExportNumericValue(value, format = "", {
  axis = false,
} = {}) {
  const normalizedFormat = normalizeString(format).toLowerCase();
  if (["id", "raw", "plain", "text"].includes(normalizedFormat)) return String(value);
  const numeric = normalizeFiniteNumber(value);
  if (numeric == null) {
    return normalizeString(value);
  }
  switch (normalizedFormat) {
    case "currency":
    case "currency2":
      return formatExportDecimal(numeric, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
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
    case "percentfraction2":
      return `${(numeric * 100).toFixed(2)}%`;
    case "number":
      return formatExportDecimal(numeric, {
        minimumFractionDigits: 0,
        maximumFractionDigits: axis ? (Number.isInteger(numeric) ? 0 : 1) : 5,
        useGrouping: true,
      });
    case "number2":
      return formatExportDecimal(numeric, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        useGrouping: true,
      });
    case "number5":
      return formatExportDecimal(numeric, {
        minimumFractionDigits: 5,
        maximumFractionDigits: 5,
        useGrouping: true,
      });
    case "":
      return formatExportDecimal(numeric, {
        minimumFractionDigits: 0,
        maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
        useGrouping: true,
      });
    default:
      return formatExportDecimal(numeric, {
        minimumFractionDigits: 0,
        maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
        useGrouping: true,
      });
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
  if (["id", "raw", "plain", "text"].includes(normalizedFormat)) return String(value);
  if (normalizedFormat === "date" || normalizedFormat === "datetime") {
    return formatExportDateValue(value, { includeTime: normalizedFormat === "datetime" });
  }
  const numeric = normalizeFiniteNumber(value);
  if (numeric != null) {
    return formatExportNumericValue(numeric, format, options);
  }
  return String(value);
}
