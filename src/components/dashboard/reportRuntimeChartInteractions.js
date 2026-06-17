function normalizeString(value = "") {
  return String(value || "").trim();
}

const SUPPORTED_SINGLE_SERIES_CARTESIAN_TYPES = new Set([
  "line",
  "bar",
  "area",
  "horizontal_bar",
  "funnel_bar",
]);

const SUPPORTED_SINGLE_SERIES_CATEGORY_TYPES = new Set([
  "pie",
  "donut",
]);

const SUPPORTED_MULTI_SERIES_CARTESIAN_TYPES = new Set([
  "line",
  "bar",
  "area",
]);

export function resolveReportRuntimeChartInteractionSupport(chartSpec = {}) {
  const type = normalizeString(chartSpec?.type).toLowerCase();
  const seriesField = normalizeString(chartSpec?.seriesField);
  if (!type) {
    return {
      enabled: false,
      reason: "missingType",
      message: "Chart actions are unavailable because this chart does not declare a type.",
      legendEnabled: false,
    };
  }
  if (seriesField) {
    if (SUPPORTED_MULTI_SERIES_CARTESIAN_TYPES.has(type)) {
      return {
        enabled: true,
        reason: "",
        message: "",
        legendEnabled: true,
      };
    }
    return {
      enabled: false,
      reason: "seriesField",
      message: "Chart actions are currently available only for supported cartesian series-field charts, single-series charts, and categorical pies/donuts.",
      legendEnabled: false,
    };
  }
  if (SUPPORTED_SINGLE_SERIES_CATEGORY_TYPES.has(type)) {
    return {
      enabled: true,
      reason: "",
      message: "",
      legendEnabled: false,
    };
  }
  if (!SUPPORTED_SINGLE_SERIES_CARTESIAN_TYPES.has(type)) {
    return {
      enabled: false,
      reason: "unsupportedType",
      message: "Chart actions are currently available only for supported cartesian charts and categorical pies/donuts.",
      legendEnabled: false,
    };
  }
  return {
    enabled: true,
    reason: "",
    message: "",
    legendEnabled: false,
  };
}
