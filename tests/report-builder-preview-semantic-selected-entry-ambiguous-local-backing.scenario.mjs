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
            reportId: "capacityShared",
            title: "Capacity Shared Saved View",
            documentVersion: 8,
            savedAt: 9300,
            importedArtifactKind: "reportBuilder.savedView",
            document: {
              version: 1,
              kind: "reportDocument",
              id: "capacityShared",
              title: "Capacity Shared Saved View",
            },
            source: {
              kind: "reportBuilder.savedView",
              reportId: "capacityShared",
              sourceArtifactId: "saved_view_capacity_shared",
            },
          },
          {
            reportId: "capacityShared",
            title: "Capacity Shared Published Snapshot",
            documentVersion: 9,
            savedAt: 9400,
            importedArtifactKind: "reportBuilder.publishedSnapshot",
            document: {
              version: 1,
              kind: "reportDocument",
              id: "capacityShared",
              title: "Capacity Shared Published Snapshot",
            },
            source: {
              kind: "reportBuilder.publishedSnapshot",
              reportId: "capacityShared",
              sourceArtifactId: "published_snapshot_capacity_shared",
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
              reportRef: { reportId: "capacityShared" },
              documentVersion: 9,
              title: "Capacity Shared",
              artifactRef: "report://capacityShared",
              lifecycle: "draft",
              shareableVersion: 9,
              capabilities: {
                view: true,
                share: true,
                publish: true,
                export: true,
              },
              ownerRef: "team://preview/reporting",
            },
          ],
          cursor: "",
          hasMore: false,
        }, {
          selectedEntryKey: "capacityShared",
        });
      })()`,
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Shared",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "ambiguous local backing",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "This imported catalog entry matches multiple local reopen artifacts for the same report id.",
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
        const share = buttons.find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Share'));
        const publish = buttons.find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Publish'));
        const disabled = (node) => !!node && (node.disabled || node.getAttribute('aria-disabled') === 'true');
        const lifecycleReason = 'Explicit source identity is required before lifecycle actions can continue.';
        const lifecycleBlocked = (node) => disabled(node)
          && (((node?.getAttribute('title') || '').includes(lifecycleReason))
            || ((node?.getAttribute('aria-label') || '').includes(lifecycleReason)));
        return disabled(prepareSelected)
          && disabled(openSelected)
          && disabled(unavailable)
          && !!explain
          && lifecycleBlocked(share)
          && lifecycleBlocked(publish);
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
        return text.includes('Capacity Shared')
          && text.includes('ambiguous local backing')
          && text.includes('Multiple local artifacts match this report id. Explicit source identity is required before a selected-entry export request can be prepared.');
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
      text: "Get ReportDocument request: Capacity Shared",
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
        return text.includes('Capacity Shared')
          && text.includes('ambiguous local backing');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-selected-entry-ambiguous-local-backing.png",
      fullPage: true,
    },
  ],
};
