import {
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSavedPayloadPreparationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "waitForEval",
      expression: "!((document.body?.innerText || document.body?.textContent || '').includes('Local Draft'))",
      timeoutMs: 5000,
    },
    {
      type: "assertDomNotContains",
      text: "Local Draft",
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__measure-pill')).some((entry) => ((entry.innerText || entry.textContent || '').trim().includes('Reach Rate')))",
      timeoutMs: 60000,
    },
    ...buildSavedPayloadPreparationSteps({
      documentVersion: "11",
      draftTriggerText: "Reach Rate",
    }),
    {
      type: "eval",
      expression: "(() => { const api = window.__REPORT_BUILDER_PREVIEW__; if (!api || typeof api.appendSeededSavedReportPayloadRecord !== 'function' || typeof api.patchSeededSavedReportPayload !== 'function') { throw new Error('Preview saved payload APIs not available.'); } const appended = api.appendSeededSavedReportPayloadRecord({ reportId: 'marketEfficiencyBriefQ3', title: 'Market Efficiency Brief Q3', templateId: 'market_efficiency_brief', presetKind: 'chart', presetTitle: 'Locations · Top Markets', documentVersion: 11, artifactId: 'market_efficiency_brief_q3', savedAt: 980000 }); if (!appended) { throw new Error('Failed to append seeded saved report payload record.'); } const patched = api.patchSeededSavedReportPayload('marketEfficiencyBriefQ3', { compileState: { status: 'invalid', diagnostics: [ { code: 'documentBlockColumnUnavailable', severity: 'error', blockId: 'reachRateTable', path: 'reportDocument.blocks.reachRateTable.columns[2]', message: \"Reach Rate Table references unavailable table column 'reachRate'.\", suggestedFix: 'Re-select the field in the builder or edit the table block to use one of the current selected dimensions or measures.' } ] } }); if (!patched || patched.compileState?.status !== 'invalid') { throw new Error('Patch did not produce expected invalid compileState.'); } return true; })()",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare list response",
    },
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response:",
      timeoutMs: 60000,
    },
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "marketEfficiencyBriefQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Market Efficiency Brief Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Selected entry compile warning:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reach Rate Table references unavailable table column 'reachRate'.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument request: Market Efficiency Brief Q3",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"reportId\": \"marketEfficiencyBriefQ3\"",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get request",
    },
    {
      type: "waitForEval",
      expression: "!!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"marketEfficiencyBriefQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Open selected response",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Market Efficiency Brief Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Persisted compile warning:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reach Rate Table references unavailable table column 'reachRate'.",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Market Efficiency Brief Q3",
      reportId: "marketEfficiencyBriefQ3",
      documentVersion: 11,
    }),
    {
      type: "waitForDomContains",
      text: "Reopened compile warning:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reach Rate Table references unavailable table column 'reachRate'.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Edit authored block reachRateTable",
    },
    {
      type: "waitForDomContains",
      text: "Edit Table Block",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-selected-invalid-get-report-document-table-response.png",
      fullPage: true,
    },
  ],
};
