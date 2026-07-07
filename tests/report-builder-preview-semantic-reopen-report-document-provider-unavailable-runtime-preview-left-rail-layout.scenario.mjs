import baseScenario from "./report-builder-preview-semantic-reopen-report-document-provider-unavailable-runtime-preview.scenario.mjs";
import {
  buildPreviewCaptureLeftRailWidthStep,
  buildPreviewConfiguredLeftRailVisibilityWaitStep,
  buildPreviewPatchBuilderConfigStep,
} from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

const providerRestoredIndex = baseSteps.findIndex(
  (step) => step?.type === "eval"
    && String(step?.expression || "").includes("setSemanticModelProviderAvailable(true)"),
);

if (providerRestoredIndex === -1) {
  throw new Error("Base provider-unavailable runtime-preview scenario must restore the semantic model provider.");
}

export default {
  ...baseScenario,
  steps: [
    ...baseSteps.slice(0, providerRestoredIndex),
    buildPreviewCaptureLeftRailWidthStep({
      beforeWidthVar: "__REPORT_BUILDER_PROVIDER_UNAVAILABLE_RAIL_WIDTH_BEFORE__",
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
      beforeWidthVar: "__REPORT_BUILDER_PROVIDER_UNAVAILABLE_RAIL_WIDTH_BEFORE__",
      requireSemanticBinding: false,
      requireScopeSummary: false,
      panelOneOfTexts: [
        "Current path:",
        "Select at least two breakdowns to capture a drill path.",
      ],
      previewRequiredTexts: [
        "Capacity Trend Q3",
        "Compile the authored runtime preview",
      ],
      previewForbiddenTexts: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
      ],
      bodyRequiredTexts: [
        "Semantic model unavailable: Semantic binding is active, but no semantic model provider is available in the current runtime context.",
      ],
    }),
    ...baseSteps.slice(providerRestoredIndex),
    buildPreviewConfiguredLeftRailVisibilityWaitStep({
      beforeWidthVar: "__REPORT_BUILDER_PROVIDER_UNAVAILABLE_RAIL_WIDTH_BEFORE__",
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
        "Filters",
      ],
      bodyForbiddenTexts: [
        "Semantic model unavailable: Semantic binding is active, but no semantic model provider is available in the current runtime context.",
      ],
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-provider-unavailable-runtime-preview-left-rail-layout.png",
      fullPage: true,
    },
  ],
};
