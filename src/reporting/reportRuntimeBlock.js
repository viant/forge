import { normalizeReportRuntimeHostIntent } from "./reportRuntimeHostIntent.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function buildDashboardReportRuntimeBlock({
  id = "reportRuntime",
  title = "",
  subtitle = "",
  reportSpec = {},
  reportFill = {},
  reportPrint = null,
  locale = "",
  hostIntent = null,
} = {}) {
  const normalizedHostIntent = normalizeReportRuntimeHostIntent(hostIntent);
  return {
    id: normalizeString(id || "reportRuntime"),
    kind: "dashboard.reportRuntime",
    ...(normalizeString(title || reportSpec?.title) ? { title: normalizeString(title || reportSpec?.title) } : {}),
    ...(normalizeString(subtitle) ? { subtitle: normalizeString(subtitle) } : {}),
    dashboard: {
      reportRuntime: {
        reportSpec: cloneValue(reportSpec || {}),
        reportFill: cloneValue(reportFill || {}),
        ...(reportPrint && typeof reportPrint === "object" && !Array.isArray(reportPrint)
          ? { reportPrint: cloneValue(reportPrint) }
          : {}),
        ...(normalizeString(locale) ? { locale: normalizeString(locale) } : {}),
        ...(normalizedHostIntent ? { hostIntent: normalizedHostIntent } : {}),
      },
    },
  };
}
