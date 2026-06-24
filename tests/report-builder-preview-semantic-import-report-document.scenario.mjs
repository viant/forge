import {
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
      artifactExpression: "payload?.reportDocument",
      filename: "capacity-trend.report-document.json",
      missingArtifactMessage: "seeded report document not found",
      importedNoticeText: "Imported ReportDocument Capacity Trend Q3. Reopen in builder is ready.",
    }),
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Reopen in builder",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Capacity Trend Q3 for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic Binding",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-report-document.png",
      fullPage: true,
    },
  ],
};
