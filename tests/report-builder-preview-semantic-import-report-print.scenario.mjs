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
      artifactExpression: "record?.exportRequest?.reportPrint",
      filename: "capacity-trend.report-print.json",
      missingArtifactMessage: "seeded report print not found",
      importedNoticeText: "Imported ReportPrint Capacity Trend Q3. Inspect or download is ready.",
    }).slice(6),
    {
      type: "waitForEval",
      expression: "(() => { const title = window.__IMPORTED_REPORT_PRINT_TITLE__ || 'Report'; return document.body.innerText.includes(`Imported ReportPrint ${title}. Inspect or download is ready.`); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Imported ReportPrint:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Canonical print-layout contract imported locally. Inspect or download the JSON artifact directly.",
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
      type: "waitForEval",
      expression: "(() => { const section = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Imported ReportPrint:')); const text = section?.innerText || section?.textContent || ''; const buttons = Array.from(section?.querySelectorAll('button') || []).map((entry) => ((entry.innerText || entry.textContent || '').trim())); return text.includes('No export snapshot') && !buttons.includes('Export snapshot') && !buttons.includes('Review export'); })()",
      timeoutMs: 60000,
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Imported ReportPrint:",
      buttonTexts: ["Inspect ReportPrint", "Hide ReportPrint"],
      missingSectionMessage: "imported report print notice not found",
      missingButtonMessage: "inspect report print button not found",
    }),
    {
      type: "waitForDomContains",
      text: "\"kind\": \"reportPrint\"",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-report-print.png",
      fullPage: true,
    },
  ],
};
