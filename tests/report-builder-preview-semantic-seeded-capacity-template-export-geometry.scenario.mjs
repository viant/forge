import {
  buildPreviewBootstrapSteps,
  buildSavedPayloadPreparationSteps,
  buildSelectedListEntryExportButtonStep,
} from "./report-builder-preview-scenario-builders.mjs";

function buildSelectedEntryExportInspectionSteps({
  reportId = "",
  selectedTitle = "",
  templateLabel = "",
  exportTitle = "",
  bookmarkId = "",
  expectedFilename = "",
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
    buildSelectedListEntryExportButtonStep({ mode: "inspect" }),
    {
      type: "waitForDomContains",
      text: `"title": "${String(exportTitle)}"`,
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"pageGeometry\": {",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"width\": 792",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"height\": 612",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: `"id": "${String(bookmarkId)}"`,
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Selected list entry export request summary\"]')).find(Boolean); if (!summary) { throw new Error('Selected list entry export request summary not found.'); } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const button = Array.from(container.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Download export request')); if (!button) { throw new Error('Download export request button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: `window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === ${JSON.stringify(String(expectedFilename))} && window.__artifactDownloadCapture.payloadReady === true`,
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `window.__artifactDownloadCapture && window.__artifactDownloadCapture.payloadReady === true && window.__artifactDownloadCapture.mimeType.includes('application/json') && window.__artifactDownloadCapture.payload.includes(${JSON.stringify(`"title": "${String(exportTitle)}"`)}) && window.__artifactDownloadCapture.payload.includes('"width": 792') && window.__artifactDownloadCapture.payload.includes('"height": 612') && window.__artifactDownloadCapture.payload.includes(${JSON.stringify(`"id": "${String(bookmarkId)}"`)})`,
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Selected list entry export request summary\"]')).find(Boolean); if (!summary) { throw new Error('Selected list entry export request summary not found.'); } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const button = Array.from(container.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Hide export request')); if (!button) { throw new Error('Hide export request button not found.'); } button.click(); return true; })()",
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
    ...buildPreviewBootstrapSteps({ captureDownloads: true }),
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
    ...buildSelectedEntryExportInspectionSteps({
      reportId: "capacityQ3",
      selectedTitle: "Capacity Q3",
      templateLabel: "Capacity Inventory Brief",
      exportTitle: "Capacity Q3",
      bookmarkId: "bookmark.primaryTable",
      expectedFilename: "Capacity Q3-savedPayload-pdf-export-request.json",
    }),
    ...buildSelectedEntryExportInspectionSteps({
      reportId: "capacityLocationQ3",
      selectedTitle: "Capacity Location Q3",
      templateLabel: "Capacity Location Brief",
      exportTitle: "Capacity Location Q3",
      bookmarkId: "bookmark.primaryTable",
      expectedFilename: "Capacity Location Q3-savedPayload-pdf-export-request.json",
    }),
    ...buildSelectedEntryExportInspectionSteps({
      reportId: "capacityInventoryTopChannelsQ3",
      selectedTitle: "Capacity Inventory Top Channels Q3",
      templateLabel: "Capacity Inventory Brief",
      exportTitle: "Capacity Inventory Top Channels Q3",
      bookmarkId: "bookmark.primaryChart",
      expectedFilename: "Capacity Inventory Top Channels Q3-savedPayload-pdf-export-request.json",
    }),
    ...buildSelectedEntryExportInspectionSteps({
      reportId: "capacityLocationsTopMarketsQ3",
      selectedTitle: "Capacity Locations Top Markets Q3",
      templateLabel: "Capacity Location Brief",
      exportTitle: "Capacity Locations Top Markets Q3",
      bookmarkId: "bookmark.primaryChart",
      expectedFilename: "Capacity Locations Top Markets Q3-savedPayload-pdf-export-request.json",
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-seeded-capacity-template-export-geometry.png",
      fullPage: true,
    },
  ],
};
