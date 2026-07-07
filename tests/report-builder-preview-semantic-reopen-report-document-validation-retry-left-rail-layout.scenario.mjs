import baseScenario from "./report-builder-preview-semantic-reopen-report-document-validation-retry.scenario.mjs";
import {
  buildPreviewCaptureLeftRailWidthStep,
  buildPreviewConfiguredLeftRailVisibilityWaitStep,
  buildPreviewPatchBuilderConfigStep,
} from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

const clearValidationIndex = baseSteps.findIndex(
  (step) => step?.type === "eval"
    && String(step?.expression || "").includes("clearSemanticValidationBehaviors"),
);

if (clearValidationIndex === -1) {
  throw new Error("Base validation retry scenario must clear semantic validation behaviors.");
}

export default {
  ...baseScenario,
  steps: [
    ...baseSteps.slice(0, clearValidationIndex),
    buildPreviewCaptureLeftRailWidthStep({
      beforeWidthVar: "__REPORT_BUILDER_VALIDATION_DRILL_RAIL_WIDTH_BEFORE__",
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
      beforeWidthVar: "__REPORT_BUILDER_VALIDATION_DRILL_RAIL_WIDTH_BEFORE__",
      requireSemanticBinding: true,
      requireScopeSummary: true,
      panelRequiredTexts: ["Select at least two breakdowns to capture a drill path."],
      previewRequiredTexts: [
        "Semantic Binding",
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Channel",
        "Measures Available Impressions, Household Uniques",
      ],
      bodyRequiredTexts: [
        "Semantic validation: Semantic provider unavailable.",
        "Retry validation",
      ],
    }),
    ...baseSteps.slice(clearValidationIndex),
    buildPreviewConfiguredLeftRailVisibilityWaitStep({
      beforeWidthVar: "__REPORT_BUILDER_VALIDATION_DRILL_RAIL_WIDTH_BEFORE__",
      requireSemanticBinding: true,
      requireScopeSummary: true,
      panelRequiredTexts: ["Select at least two breakdowns to capture a drill path."],
      previewRequiredTexts: [
        "Semantic Binding",
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Channel",
        "Measures Available Impressions, Household Uniques",
      ],
      bodyForbiddenTexts: [
        "Semantic validation: Semantic provider unavailable.",
        "Retry validation",
      ],
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-validation-retry-left-rail-layout.png",
      fullPage: true,
    },
  ],
};
