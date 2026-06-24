import {
  buildAriaSectionButtonClickStep,
  buildPreviewBootstrapSteps,
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
    ...buildSeededSavedPayloadArtifactImportSteps({
      reportId: "capacityTrendQ3",
      artifactExpression: "record?.exportRequest?.reportFill",
      filename: "capacity-trend.report-fill.json",
      missingArtifactMessage: "seeded report fill not found",
      importedNoticeText: "Imported ReportFill capacity-trend.report-fill. Inspect or download is ready.",
    }).slice(6),
    buildSectionButtonClickStep({
      sectionIncludes: "Imported ReportFill:",
      buttonTexts: ["Attach to ReportSpec"],
      missingSectionMessage: "imported report fill notice not found",
      missingButtonMessage: "attach button not found",
    }),
    {
      type: "waitForDomContains",
      text: "Imported ReportFill is attached to the imported ReportSpec runtime preview.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const section = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Imported runtime preview')); const text = section?.innerText || section?.textContent || ''; return text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions'); })()",
      timeoutMs: 60000,
    },
    buildAriaSectionButtonClickStep({
      ariaLabel: "Imported runtime preview",
      buttonTexts: ["Inspect export", "Hide export"],
      missingSectionMessage: "imported runtime section not found",
      missingButtonMessage: "inspect export button not found",
    }),
    {
      type: "waitForEval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Imported export request summary\"]')).find(Boolean); if (!summary) { return false; } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const text = container?.innerText || container?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"kind\": \"reportExportRequest\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "ATTACHED REPORTFILL",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"rowCount\": 8",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-report-fill-attach-report-spec-export-request.png",
      fullPage: true,
    },
  ],
};
