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
      artifactExpression: "payload",
      filename: "capacity-trend.saved-report-payload.json",
      missingArtifactMessage: "seeded saved report payload not found",
      importedNoticeText: "Imported saved report payload Capacity Trend Q3.",
    }),
    {
      type: "waitForDomContains",
      text: "Saved report payload: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "reportBuilder.savedReportPayload",
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Document version\"]",
      value: "6",
    },
    {
      type: "waitForDomContains",
      text: "Using document version 6.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get response",
    },
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
      file: "report-builder-preview-semantic-import-saved-report-payload.png",
      fullPage: true,
    },
  ],
};
