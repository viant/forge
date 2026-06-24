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
    {
      type: "eval",
      expression: `(() => {
        const preview = window.__REPORT_BUILDER_PREVIEW__;
        if (!preview || typeof preview.replaceSeededSavedReportPayloads !== "function") {
          throw new Error("replaceSeededSavedReportPayloads API not available.");
        }
        return preview.replaceSeededSavedReportPayloads([
          {
            reportId: "capacityImported",
            title: "Capacity Imported Saved View",
            documentVersion: 8,
            savedAt: 9300,
            importedArtifactKind: "reportBuilder.savedView",
            document: {
              version: 1,
              kind: "reportDocument",
              id: "capacityImported",
              title: "Capacity Imported Saved View",
            },
            source: {
              kind: "reportBuilder.savedView",
              reportId: "capacityImported",
              sourceArtifactId: "saved_view_capacity_imported",
            },
          },
        ]);
      })()`,
    },
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
              reportRef: { reportId: "capacityImported" },
              documentVersion: 8,
              title: "Capacity Imported",
              source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityImported",
                sourceArtifactId: "saved_view_capacity_imported",
              },
            },
          ],
          cursor: "",
          hasMore: false,
        }, {
          selectedEntryKey: "capacityImported",
        });
      })()`,
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Imported",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "reopen-ready",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "This imported catalog entry is backed by a local reopen artifact, but no local export-ready artifact is available yet.",
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
        const enabled = (node) => !!node && !(node.disabled || node.getAttribute('aria-disabled') === 'true');
        return enabled(prepareSelected) && enabled(openSelected) && !!unavailable && !!explain;
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
        return text.includes('Capacity Imported')
          && text.includes('reopen-ready')
          && text.includes('A local reopen artifact is available for this catalog entry, but no local export-ready artifact is available yet. Save or prepare a matching export-ready artifact first.');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Imported",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-selected-entry-reopenable-no-exportable.png",
      fullPage: true,
    },
  ],
};
