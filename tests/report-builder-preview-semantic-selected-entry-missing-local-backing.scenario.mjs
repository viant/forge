import {
  buildPreviewBootstrapSteps,
  buildSavedPayloadPreparationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

const savedPayloadPreparationSteps = buildSavedPayloadPreparationSteps({
  documentVersion: "11",
  draftTriggerText: "Reach Rate",
});

const beforePrepareListResponse = savedPayloadPreparationSteps.slice(0, -2);
const prepareListResponseStep = savedPayloadPreparationSteps[savedPayloadPreparationSteps.length - 2];
const waitForListResponseStep = savedPayloadPreparationSteps[savedPayloadPreparationSteps.length - 1];

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    ...beforePrepareListResponse,
    prepareListResponseStep,
    waitForListResponseStep,
    {
      type: "eval",
      expression: `(() => {
        const preview = window.__REPORT_BUILDER_PREVIEW__;
        if (!preview || typeof preview.replacePreparedListReportDocumentsResponse !== "function") {
          throw new Error("replacePreparedListReportDocumentsResponse API not available.");
        }
        return preview.replacePreparedListReportDocumentsResponse({
          version: 1,
          kind: "listReportDocumentsResponse",
          entries: [
            {
              reportRef: { reportId: "capacityExternal" },
              documentVersion: 12,
              title: "Capacity External",
            },
          ],
          cursor: "",
          hasMore: false,
        }, {
          selectedEntryKey: "capacityExternal",
        });
      })()`,
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity External",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "no local backing",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "This imported catalog entry can prepare a get request and reopen diagnostic, but it cannot expand into a local reopen bundle until a matching local reopen artifact is available.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const prepareSelected = buttons.find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Prepare selected get response'));
        const openSelected = buttons.find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Open selected response'));
        const unavailable = buttons.find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Export unavailable'));
        const explain = buttons.find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Why export is unavailable'));
        const disabled = (node) => !!node && (node.disabled || node.getAttribute('aria-disabled') === 'true');
        return disabled(prepareSelected) && disabled(openSelected) && disabled(unavailable) && !!explain;
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Why export is unavailable",
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const panel = document.querySelector('[aria-label="Selected catalog entry export request summary"]');
        const text = panel?.innerText || panel?.textContent || '';
        return text.includes('Capacity External')
          && text.includes('no local backing')
          && text.includes('No unique local export-ready artifact is available for this catalog entry yet. Prepare a matching local reopen or saved artifact first.');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument request: Capacity External",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get request",
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const panel = document.querySelector('[aria-label="Get ReportDocument request summary"]');
        const text = panel?.innerText || panel?.textContent || '';
        return text.includes('Capacity External')
          && text.includes('no local backing');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-selected-entry-missing-local-backing.png",
      fullPage: true,
    },
  ],
};
