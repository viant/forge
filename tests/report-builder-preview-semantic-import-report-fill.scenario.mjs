import {
  buildSectionButtonClickStep,
  buildSeededSavedPayloadArtifactImportSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildSeededSavedPayloadArtifactImportSteps({
      reportId: "capacityTrendQ3",
      artifactExpression: "payload?.reportSpec",
      filename: "capacity-trend.report-spec.json",
      missingArtifactMessage: "seeded report spec not found",
      importedNoticeText: "Imported ReportSpec Capacity Trend Q3. Compiled local runtime preview is ready.",
    }),
    {
      type: "waitForDomContains",
      text: "Imported ReportSpec Capacity Trend Q3. Compiled local runtime preview is ready.",
      timeoutMs: 60000,
    },
    ...buildSeededSavedPayloadArtifactImportSteps({
      reportId: "capacityTrendQ3",
      artifactExpression: "record?.exportRequest?.reportFill",
      filename: "capacity-trend.report-fill.json",
      missingArtifactMessage: "seeded report fill not found",
      importedNoticeText: "Imported ReportFill capacity-trend.report-fill. Inspect or download is ready.",
    }),
    {
      type: "waitForDomContains",
      text: "Imported ReportFill:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Canonical filled-data contract imported locally. Inspect or download the JSON artifact directly.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic Binding",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Model Ad Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Entity Line Delivery",
      timeoutMs: 60000,
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Imported ReportFill:",
      buttonTexts: ["Inspect ReportFill", "Hide ReportFill"],
      missingSectionMessage: "imported report fill notice not found",
      missingButtonMessage: "inspect report fill button not found",
    }),
    {
      type: "waitForDomContains",
      text: "\"kind\": \"reportFill\"",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-report-fill.png",
      fullPage: true,
    },
  ],
};
