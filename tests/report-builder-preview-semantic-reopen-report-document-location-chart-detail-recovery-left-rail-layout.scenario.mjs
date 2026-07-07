import baseScenario from "./report-builder-preview-semantic-reopen-report-document-location-chart-detail-recovery.scenario.mjs";
import {
  buildAuthoredRuntimeSemanticSurfaceWaitStep,
  buildPreviewCaptureLeftRailWidthStep,
  buildPreviewConfiguredLeftRailVisibilityWaitStep,
  buildPreviewPatchBuilderConfigStep,
} from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

const firstDetailActionIndex = baseSteps.findIndex(
  (step) => step?.type === "clickSelectorContains"
    && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action"
    && step?.text === "Show market details"
    && step?.index === 0,
);

if (firstDetailActionIndex === -1) {
  throw new Error("Base reopened location chart detail recovery scenario must include the first chart detail action click.");
}

export default {
  ...baseScenario,
  steps: [
    ...baseSteps.slice(0, firstDetailActionIndex),
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
      beforeWidthVar: "__REPORT_BUILDER_LOCATION_CHART_RECOVERY_RAIL_WIDTH_BEFORE__",
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
      beforeWidthVar: "__REPORT_BUILDER_LOCATION_CHART_RECOVERY_RAIL_WIDTH_BEFORE__",
      requireSemanticBinding: true,
      requireScopeSummary: true,
      panelOneOfTexts: [
        "Current path:",
        "Select at least two breakdowns to capture a drill path.",
      ],
      previewRequiredTexts: [
        "Semantic Binding",
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Available Impressions",
      ],
      runtimeRootSelector: ".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel",
      runtimeRequiredTexts: ["Show market details", "US"],
    }),
    ...baseSteps.slice(firstDetailActionIndex),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-chart-detail-recovery-left-rail-layout.png",
      fullPage: true,
    },
  ],
};
