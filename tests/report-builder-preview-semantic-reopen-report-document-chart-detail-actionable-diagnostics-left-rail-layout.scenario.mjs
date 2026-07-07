import baseScenario from "./report-builder-preview-semantic-reopen-report-document-chart-detail-actionable-diagnostics.scenario.mjs";
import {
  buildPreviewCaptureLeftRailWidthStep,
  buildPreviewConfiguredLeftRailVisibilityWaitStep,
  buildPreviewPatchBuilderConfigStep,
} from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

const firstRuntimeActionIndex = baseSteps.findIndex(
  (step) => step?.type === "clickSelectorContains"
    && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action"
    && step?.text === "Show channel details",
);

if (firstRuntimeActionIndex === -1) {
  throw new Error("Base chart actionable diagnostics scenario must include the first runtime detail action click.");
}

export default {
  ...baseScenario,
  steps: [
    ...baseSteps.slice(0, firstRuntimeActionIndex),
    buildPreviewCaptureLeftRailWidthStep({
      beforeWidthVar: "__REPORT_BUILDER_CHART_ACTIONABLE_RAIL_WIDTH_BEFORE__",
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
      beforeWidthVar: "__REPORT_BUILDER_CHART_ACTIONABLE_RAIL_WIDTH_BEFORE__",
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
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
      ],
      runtimeRootSelector: ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel",
      runtimeRequiredTexts: ["Show channel details"],
      bodyRequiredTexts: [
        "Reopened compile diagnostics",
        "Primary Chart is no longer compatible with the current builder selection.",
      ],
    }),
    ...baseSteps.slice(firstRuntimeActionIndex),
    buildPreviewConfiguredLeftRailVisibilityWaitStep({
      beforeWidthVar: "__REPORT_BUILDER_CHART_ACTIONABLE_RAIL_WIDTH_BEFORE__",
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
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
      ],
      bodyForbiddenTexts: [
        "Reopened compile diagnostics",
        "Runtime Diagnostics",
      ],
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-chart-detail-actionable-diagnostics-left-rail-layout.png",
      fullPage: true,
    },
  ],
};
