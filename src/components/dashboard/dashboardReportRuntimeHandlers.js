import { resolveReportRuntimePreviewDetailProvider } from "./reportRuntimePreviewHandlers.js";
import { hasDrillMetadataProvider } from "../../reporting/drillMetadataProvider.js";

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
  if (hasDrillMetadataProvider(baseHandlers?.drillMetadataProvider)) {
    return baseHandlers;
  }
  const sanitizedBaseHandlers = baseHandlers
    ? {
      ...baseHandlers,
      ...(baseHandlers?.drillMetadataProvider && !hasDrillMetadataProvider(baseHandlers.drillMetadataProvider)
        ? { drillMetadataProvider: undefined }
        : {}),
    }
    : null;
  const drillMetadataProvider = resolveReportRuntimePreviewDetailProvider({
    semanticModelHandler: context?.handlers?.semanticModel || null,
    reportSpec,
  });
  if (!drillMetadataProvider) {
    return sanitizedBaseHandlers;
  }
  return {
    ...(sanitizedBaseHandlers || {}),
    drillMetadataProvider,
  };
}
