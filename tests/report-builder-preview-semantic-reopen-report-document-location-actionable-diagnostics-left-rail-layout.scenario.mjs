import baseScenario from "./report-builder-preview-semantic-reopen-report-document-location-actionable-diagnostics.scenario.mjs";
import {
  buildPreviewCaptureLeftRailWidthStep,
  buildPreviewConfiguredLeftRailVisibilityWaitStep,
  buildPreviewPatchBuilderConfigStep,
} from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

const patchCleanCompileStateIndex = baseSteps.findIndex(
  (step) => step?.type === "eval"
    && String(step?.expression || "").includes("reopenedCompileState")
    && String(step?.expression || "").includes("\"status\":\"clean\""),
);

if (patchCleanCompileStateIndex === -1) {
  throw new Error("Base location actionable diagnostics scenario must patch reopened compile state to clean.");
}

export default {
  ...baseScenario,
  steps: [
    ...baseSteps.slice(0, patchCleanCompileStateIndex),
    buildPreviewCaptureLeftRailWidthStep({
      beforeWidthVar: "__REPORT_BUILDER_LOCATION_ACTIONABLE_RAIL_WIDTH_BEFORE__",
    }),
    buildPreviewPatchBuilderConfigStep({
      patch: {
        layout: {
          leftRailWidthPercent: 20,
        },
      },
      missingApiMessage: "patchBuilderConfig API not available for left rail width.",
    }),
    buildPreviewConfiguredLeftRailVisibilityWaitStep({
      beforeWidthVar: "__REPORT_BUILDER_LOCATION_ACTIONABLE_RAIL_WIDTH_BEFORE__",
      requireSemanticBinding: true,
      requireScopeSummary: true,
      previewRequiredTexts: [
        "Semantic Binding",
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Available Impressions",
      ],
      bodyRequiredTexts: [
        "Reopened compile diagnostics",
        "Primary Table references unavailable table column",
        "Runtime Diagnostics",
      ],
    }),
    ...baseSteps.slice(patchCleanCompileStateIndex),
    buildPreviewConfiguredLeftRailVisibilityWaitStep({
      beforeWidthVar: "__REPORT_BUILDER_LOCATION_ACTIONABLE_RAIL_WIDTH_BEFORE__",
      requireSemanticBinding: true,
      requireScopeSummary: true,
      previewRequiredTexts: [
        "Semantic Binding",
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Available Impressions",
      ],
      bodyForbiddenTexts: [
        "Reopened compile diagnostics",
        "Runtime Diagnostics",
      ],
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-actionable-diagnostics-left-rail-layout.png",
      fullPage: true,
    },
  ],
};
