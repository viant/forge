import baseScenario from "./report-builder-preview-semantic-reopen-report-document-chart-detail-response.scenario.mjs";
import {
  buildAuthoredRuntimeSemanticSurfaceWaitStep,
  buildPreviewCaptureLeftRailWidthStep,
  buildPreviewConfiguredLeftRailVisibilityWaitStep,
  buildPreviewPatchBuilderConfigStep,
} from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

const legendClickIndex = baseSteps.findIndex(
  (step) => step?.type === "clickSelector"
    && step?.selector === ".forge-report-runtime-chart-panel .forge-chart-legend-action",
);

if (legendClickIndex === -1) {
  throw new Error("Base reopened chart detail response scenario must include the chart legend click.");
}

export default {
  ...baseScenario,
  steps: [
    ...baseSteps.slice(0, legendClickIndex),
    {
      type: "waitForDomContains",
      text: "Semantic binding: Ad Delivery • Entity: Line Delivery",
      timeoutMs: 60000,
    },
    buildAuthoredRuntimeSemanticSurfaceWaitStep({
      dimensionText: "Dimensions Delivery Date, Channel",
      measureText: "Measures Available Impressions",
    }),
    buildPreviewCaptureLeftRailWidthStep({
      beforeWidthVar: "__REPORT_BUILDER_CHART_DETAIL_RAIL_WIDTH_BEFORE__",
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
      beforeWidthVar: "__REPORT_BUILDER_CHART_DETAIL_RAIL_WIDTH_BEFORE__",
      requireSemanticBinding: true,
      requireScopeSummary: true,
      panelOneOfTexts: [
        "Current path:",
        "Select at least two breakdowns to capture a drill path.",
      ],
      panelRequiredTexts: ["Show channel details"],
      previewRequiredTexts: [
        "Semantic Binding",
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
      ],
      runtimeRootSelector: ".forge-report-runtime-chart-panel",
      runtimeRequiredTexts: ["Show channel details"],
    }),
    ...baseSteps.slice(legendClickIndex),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-chart-detail-response-left-rail-layout.png",
      fullPage: true,
    },
  ],
};
