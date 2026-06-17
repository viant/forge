import { createDrillMetadataProvider } from "../../reporting/drillMetadataProvider.js";
import { createReportBuilderDrillMetadataProvider, normalizeReportBuilderDrillMetadata } from "../../reporting/reportBuilderDrillMetadata.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

export function resolveReportRuntimeDrillMetadataProvider({
  reportSpec = {},
  runtimeHandlers = null,
} = {}) {
  const explicitProvider = runtimeHandlers?.drillMetadataProvider;
  if (explicitProvider && typeof explicitProvider.listAvailableRefinements === "function") {
    return explicitProvider;
  }
  const normalizedDrillMetadata = normalizeReportBuilderDrillMetadata({
    drillMetadata: reportSpec?.drillMetadata,
  });
  if ((normalizedDrillMetadata?.hierarchies?.length || 0) === 0
    && (normalizedDrillMetadata?.detailTargets?.length || 0) === 0
    && (normalizedDrillMetadata?.fieldActions?.length || 0) === 0) {
    return null;
  }
  return createDrillMetadataProvider(createReportBuilderDrillMetadataProvider({
    drillMetadata: normalizedDrillMetadata,
  }));
}

export function hasReportRuntimeDrillMetadata(reportSpec = {}) {
  const normalizedDrillMetadata = normalizeReportBuilderDrillMetadata({
    drillMetadata: reportSpec?.drillMetadata,
  });
  return normalizeString(reportSpec?.kind) === "reportSpec"
    ? (normalizedDrillMetadata.hierarchies.length > 0
      || normalizedDrillMetadata.detailTargets.length > 0
      || normalizedDrillMetadata.fieldActions.length > 0)
    : false;
}
