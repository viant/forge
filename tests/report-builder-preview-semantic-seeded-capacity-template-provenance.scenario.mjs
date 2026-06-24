import {
  buildPreviewBootstrapSteps,
  buildSavedPayloadPreparationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

function buildSelectedEntryGetResponseSteps({
  reportId = "",
  selectedTitle = "",
  templateLabel = "",
  responseTitle = "",
} = {}) {
  return [
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: String(reportId),
    },
    {
      type: "waitForDomContains",
      text: `Selected entry: ${String(selectedTitle)}`,
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes(${JSON.stringify(`Selected entry: ${String(selectedTitle)}`)}) && text.includes(${JSON.stringify(`Template: ${String(templateLabel)}`)}); })()`,
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: String(responseTitle),
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => { const panel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes(${JSON.stringify(String(responseTitle))})); const text = panel?.innerText || panel?.textContent || ''; return !!panel && text.includes(${JSON.stringify(String(responseTitle))}) && text.includes(${JSON.stringify(`Template: ${String(templateLabel)}`)}); })()`,
      timeoutMs: 60000,
    },
  ];
}

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
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__measure-pill')).some((entry) => ((entry.innerText || entry.textContent || '').trim().includes('Reach Rate')))",
      timeoutMs: 60000,
    },
    ...buildSavedPayloadPreparationSteps({
      documentVersion: "11",
      draftTriggerText: "Reach Rate",
    }),
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response: 7 entries",
      timeoutMs: 60000,
    },
    ...buildSelectedEntryGetResponseSteps({
      reportId: "capacityQ3",
      selectedTitle: "Capacity Q3",
      templateLabel: "Capacity Inventory Brief",
      responseTitle: "Get ReportDocument response: Capacity Q3",
    }),
    {
      type: "clickRole",
      role: "button",
      name: "Hide get response",
    },
    ...buildSelectedEntryGetResponseSteps({
      reportId: "capacityLocationsTopMarketsQ3",
      selectedTitle: "Capacity Locations Top Markets Q3",
      templateLabel: "Capacity Location Brief",
      responseTitle: "Get ReportDocument response: Capacity Locations Top Markets Q3",
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-seeded-capacity-template-provenance.png",
      fullPage: true,
    },
  ],
};
