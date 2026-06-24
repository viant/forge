import {
  buildAriaSectionButtonClickStep,
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
      type: "waitForEval",
      expression: "(() => document.body.innerText.toLowerCase().includes('imported runtime'))()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Source file: capacity-trend.report-spec.json",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Local runtime preview compiled directly from the imported ReportSpec file.",
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
    {
      type: "waitForDomContains",
      text: "Chart actions are unavailable because this runtime preview is read-only.",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "Click a chart mark to apply authored runtime actions.",
    },
    {
      type: "waitForEval",
      expression: "(() => { const section = document.querySelector('section[aria-label=\"Imported runtime preview\"]'); const text = section?.innerText || section?.textContent || ''; const buttons = Array.from(section?.querySelectorAll('button') || []).map((entry) => ((entry.innerText || entry.textContent || '').trim())); return text.includes('No export snapshot') && !buttons.includes('Export snapshot') && !buttons.includes('Review export'); })()",
      timeoutMs: 60000,
    },
    buildAriaSectionButtonClickStep({
      ariaLabel: "Imported runtime preview",
      buttonTexts: ["Inspect ReportPrint"],
      missingSectionMessage: "imported runtime section not found",
      missingButtonMessage: "runtime inspect report print button not found",
    }),
    {
      type: "waitForDomContains",
      text: "\"kind\": \"reportPrint\"",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-report-spec.png",
      fullPage: true,
    },
  ],
};
