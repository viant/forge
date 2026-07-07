import baseScenario from "./report-builder-preview-semantic-reopen-report-document-location-chart-actionable-diagnostics.scenario.mjs";
import {
  buildAuthoredRuntimeSemanticSurfaceWaitStep,
  buildPreviewCaptureLeftRailWidthStep,
  buildPreviewConfiguredLeftRailVisibilityWaitStep,
  buildPreviewPatchBuilderConfigStep,
} from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

const reopenedInvalidIndex = baseSteps.findIndex(
  (step) => step?.type === "waitForEval"
    && String(step?.expression || "").includes("reopenedCompileState?.status === 'invalid'"),
);

if (reopenedInvalidIndex === -1) {
  throw new Error("Base location chart actionable diagnostics scenario must confirm the reopened compile state is invalid.");
}

export default {
  ...baseScenario,
  steps: [
    ...baseSteps.slice(0, reopenedInvalidIndex + 1),
    {
      type: "waitForDomContains",
      text: "Semantic binding: Ad Delivery • Entity: Line Delivery",
      timeoutMs: 60000,
    },
    buildAuthoredRuntimeSemanticSurfaceWaitStep({
      dimensionText: "Dimensions Market",
      measureText: "Measures Available Impressions",
    }),
    buildPreviewCaptureLeftRailWidthStep({
      beforeWidthVar: "__REPORT_BUILDER_LOCATION_CHART_ACTIONABLE_RAIL_WIDTH_BEFORE__",
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
      beforeWidthVar: "__REPORT_BUILDER_LOCATION_CHART_ACTIONABLE_RAIL_WIDTH_BEFORE__",
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
        "Primary Chart is no longer compatible with the current builder selection.",
        "Runtime Diagnostics",
      ],
    }),
    ...baseSteps.slice(reopenedInvalidIndex + 1),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-chart-actionable-diagnostics-left-rail-layout.png",
      fullPage: true,
    },
  ],
};
