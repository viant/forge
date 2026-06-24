import {
  buildInlineArtifactImportSteps,
  buildSelectedListEntryExportButtonStep,
} from "./report-builder-preview-scenario-builders.mjs";

const publishedSnapshotRecordExpression = `(() => {
  const preview = window.__REPORT_BUILDER_PREVIEW__;
  const payloads = preview?.getSeededSavedReportPayloads?.() || [];
  const target = payloads.find((entry) => (entry?.savedReportPayload?.reportDocument?.id || entry?.reportId) === 'capacityTrendQ3') || payloads[0];
  const payload = target?.savedReportPayload || target;
  const exportRequest = target?.exportRequest;
  if (!payload?.reportDocument || !exportRequest) {
    throw new Error('seeded published-snapshot record source not found');
  }
  return {
    reportId: payload.reportDocument.id || 'capacityTrendQ3',
    title: 'Capacity Trend Q3 Published Snapshot',
    documentVersion: (exportRequest?.source?.documentVersion || 6) + 1,
    savedAt: (payload?.savedAt || 6100) + 1,
    importedArtifactKind: 'reportBuilder.publishedSnapshot',
    document: {
      ...payload.reportDocument,
      title: 'Capacity Trend Q3 Published Snapshot',
    },
    reportSpec: exportRequest.reportSpec,
    source: {
      kind: 'reportBuilder.publishedSnapshot',
      reportId: payload.reportDocument.id || 'capacityTrendQ3',
      sourceArtifactId: 'published_snapshot_capacityTrendQ3',
    },
    exportRequest: {
      ...exportRequest,
      source: {
        ...exportRequest.source,
        from: 'publishedSnapshot',
        artifactKind: 'reportBuilder.publishedSnapshot',
        artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3',
        sourceArtifactId: 'published_snapshot_capacityTrendQ3',
        documentVersion: (exportRequest?.source?.documentVersion || 6) + 1,
        title: 'Capacity Trend Q3 Published Snapshot',
      },
    },
  };
})()`;

const publishedSnapshotListResponseExpression = `(() => ({
  version: 1,
  kind: 'listReportDocumentsResponse',
  entries: [
    {
      reportRef: { reportId: 'capacityTrendQ3' },
      documentVersion: 12,
      title: 'Capacity Trend Q3 Published Snapshot',
      source: {
        kind: 'reportBuilder.publishedSnapshot',
        reportId: 'capacityTrendQ3',
        sourceArtifactId: 'published_snapshot_capacityTrendQ3',
      },
    },
  ],
  cursor: '',
  hasMore: false,
}))()`;

const savedViewRecordExpression = `(() => {
  const preview = window.__REPORT_BUILDER_PREVIEW__;
  const payloads = preview?.getSeededSavedReportPayloads?.() || [];
  const target = payloads.find((entry) => (entry?.savedReportPayload?.reportDocument?.id || entry?.reportId) === 'capacityTrendQ3') || payloads[0];
  const payload = target?.savedReportPayload || target;
  const exportRequest = target?.exportRequest;
  if (!payload?.reportDocument || !exportRequest) {
    throw new Error('seeded saved-view record source not found');
  }
  return {
    reportId: payload.reportDocument.id || 'capacityTrendQ3',
    title: 'Capacity Trend Q3 Saved View',
    documentVersion: exportRequest?.source?.documentVersion || 6,
    savedAt: payload?.savedAt || 6100,
    importedArtifactKind: 'reportBuilder.savedView',
    document: {
      ...payload.reportDocument,
      title: 'Capacity Trend Q3 Saved View',
    },
    reportSpec: exportRequest.reportSpec,
    source: {
      kind: 'reportBuilder.savedView',
      reportId: payload.reportDocument.id || 'capacityTrendQ3',
      sourceArtifactId: 'saved_view_capacityTrendQ3',
    },
    exportRequest: {
      ...exportRequest,
      source: {
        ...exportRequest.source,
        from: 'savedView',
        artifactKind: 'reportBuilder.savedView',
        artifactRef: 'reportBuilder.savedView://saved_view_capacityTrendQ3',
        sourceArtifactId: 'saved_view_capacityTrendQ3',
        title: 'Capacity Trend Q3 Saved View',
      },
    },
  };
})()`;

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildInlineArtifactImportSteps({
      artifactExpression: publishedSnapshotRecordExpression,
      filename: "capacity-trend.published-snapshot.saved-record.json",
      importedNoticeText: "Imported published snapshot Capacity Trend Q3 Published Snapshot. Reopen and export are ready.",
      captureDownloads: true,
    }),
    {
      type: "eval",
      expression: `(() => {
        const input = document.querySelector('input[aria-label="Import report file"]');
        if (!input) { throw new Error('import api unavailable'); }
        const artifact = ${savedViewRecordExpression};
        const file = new File([JSON.stringify(artifact, null, 2)], 'capacity-trend.saved-view.saved-record.json', { type: 'application/json' });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`,
    },
    {
      type: "waitForDomContains",
      text: "Imported saved view Capacity Trend Q3 Saved View. Reopen and export are ready.",
      timeoutMs: 60000,
    },
    ...buildInlineArtifactImportSteps({
      artifactExpression: publishedSnapshotListResponseExpression,
      filename: "capacity-trend.published-snapshot.list-response.json",
      importedNoticeText: "Imported listReportDocuments response with 1 entry.",
      captureDownloads: false,
    }),
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Trend Q3 Published Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "No local payload backing",
    },
    buildSelectedListEntryExportButtonStep({ mode: "inspect" }),
    {
      type: "waitForEval",
      expression: `(() => {
        const summary = Array.from(document.querySelectorAll('[aria-label="Selected list entry export request summary"]')).find(Boolean);
        if (!summary) { return false; }
        const container = summary.closest('.forge-report-builder__chart-inline-notice');
        const text = container?.innerText || container?.textContent || '';
        const pre = container?.querySelector('pre');
        const raw = pre?.textContent || '';
        return text.includes('imported published-snapshot')
          && text.includes('published-snapshot artifact')
          && raw.includes('"from": "publishedSnapshot"')
          && raw.includes('"artifactKind": "reportBuilder.publishedSnapshot"')
          && raw.includes('"artifactRef": "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3"');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-list-entry-published-snapshot-export-request.png",
      fullPage: true,
    },
  ],
};
