import { resolveReportRuntimePreviewDetailProvider } from "./reportRuntimePreviewHandlers.js";

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function resolveDashboardReportRuntimeHandlers({
  context = {},
  reportSpec = {},
} = {}) {
  const baseHandlers = isPlainObject(context?.handlers?.reportRuntime)
    ? context.handlers.reportRuntime
    : null;
  if (baseHandlers?.drillMetadataProvider) {
    return baseHandlers;
  }
  const drillMetadataProvider = resolveReportRuntimePreviewDetailProvider({
    semanticModelHandler: context?.handlers?.semanticModel || null,
    reportSpec,
  });
  if (!drillMetadataProvider) {
    return baseHandlers;
  }
  return {
    ...(baseHandlers || {}),
    drillMetadataProvider,
  };
}
