import {
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSavedPayloadPreparationSteps,
  buildSeededSavedPayloadCompileStatePatchSteps,
} from "./report-builder-preview-scenario-builders.mjs";

const invalidHeadlineKpiCompileState = {
  status: "invalid",
  diagnostics: [
    {
      code: "documentBlockValueFieldUnavailable",
      severity: "error",
      blockId: "headlineKpi",
      path: "reportDocument.blocks.headlineKpi.valueField",
      message: "Headline KPI references unavailable KPI value field 'avails'.",
      suggestedFix: "Select the measure again or edit the KPI block.",
    },
  ],
};

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
    ...buildSeededSavedPayloadCompileStatePatchSteps({
      reportId: "capacityQ3",
      compileState: invalidHeadlineKpiCompileState,
      expectedStatus: "invalid",
    }),
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
      value: "capacityQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Selected entry compile warning:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Resolve authored block validation issues before preparing writable ReportDocument payloads.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Headline KPI references unavailable KPI value field 'avails'.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument request: Capacity Q3",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"reportId\": \"capacityQ3\"",
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
      text: "\"reportId\": \"capacityQ3\"",
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
      text: "Get ReportDocument response: Capacity Q3",
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
      text: "Headline KPI references unavailable KPI value field 'avails'.",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Q3",
      reportId: "capacityQ3",
      documentVersion: 11,
    }),
    {
      type: "waitForDomContains",
      text: "Reopened compile warning:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Headline KPI references unavailable KPI value field 'avails'.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Edit authored block headlineKpi",
    },
    {
      type: "waitForDomContains",
      text: "Edit KPI Block",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-selected-invalid-get-report-document-response.png",
      fullPage: true,
    },
  ],
};
