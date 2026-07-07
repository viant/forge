import baseScenario from "./report-builder-preview-semantic-detail-target-provider-preset-save-reopen.scenario.mjs";
import {
  buildAuthoredRuntimeSemanticSurfaceWaitStep,
  buildPreviewCaptureLeftRailWidthStep,
  buildPreviewConfiguredLeftRailVisibilityWaitStep,
  buildPreviewPatchBuilderConfigStep,
} from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

const runtimeActionIndex = baseSteps.findIndex(
  (step) => step?.type === "clickSelectorContains"
    && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action"
    && step?.text === "Show Channel details",
);

if (runtimeActionIndex === -1) {
  throw new Error("Base provider preset save/reopen scenario must include the reopened runtime detail action click.");
}

export default {
  ...baseScenario,
  steps: [
    ...baseSteps.slice(0, runtimeActionIndex),
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
      beforeWidthVar: "__REPORT_BUILDER_REOPENED_DRILL_RAIL_WIDTH_BEFORE__",
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
      beforeWidthVar: "__REPORT_BUILDER_REOPENED_DRILL_RAIL_WIDTH_BEFORE__",
      requireSemanticBinding: true,
      requireScopeSummary: true,
      panelRequiredTexts: ["Current path:", "Show channel details"],
      previewRequiredTexts: [
        "Semantic Binding",
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
      ],
      runtimeRootSelector: ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel",
      runtimeRequiredTexts: ["Show Channel details"],
    }),
    ...baseSteps.slice(runtimeActionIndex),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-detail-target-provider-preset-save-reopen-left-rail-layout.png",
      fullPage: true,
    },
  ],
};
