import {
  buildInlineArtifactImportSteps,
  buildSelectedListEntryExportButtonStep,
} from "./report-builder-preview-scenario-builders.mjs";

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

const savedViewListResponseExpression = `(() => ({
  version: 1,
  kind: 'listReportDocumentsResponse',
  entries: [
    {
      reportRef: { reportId: 'capacityTrendQ3' },
      documentVersion: 12,
      title: 'Capacity Trend Q3 Saved View',
      source: {
        kind: 'reportBuilder.savedView',
        reportId: 'capacityTrendQ3',
        sourceArtifactId: 'saved_view_capacityTrendQ3',
      },
    },
  ],
  cursor: '',
  hasMore: false,
}))()`;

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

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildInlineArtifactImportSteps({
      artifactExpression: savedViewRecordExpression,
      filename: "capacity-trend.saved-view.history-current.saved-record.json",
      importedNoticeText: "Imported saved view Capacity Trend Q3 Saved View. Reopen and export are ready.",
      captureDownloads: true,
    }),
    {
      type: "eval",
      expression: `(() => {
        const input = document.querySelector('input[aria-label="Import report file"]');
        if (!input) { throw new Error('import api unavailable'); }
        const artifact = ${publishedSnapshotRecordExpression};
        const file = new File([JSON.stringify(artifact, null, 2)], 'capacity-trend.published-snapshot.history-current.saved-record.json', { type: 'application/json' });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`,
    },
    {
      type: "waitForDomContains",
      text: "Imported published snapshot Capacity Trend Q3 Published Snapshot. Reopen and export are ready.",
      timeoutMs: 60000,
    },
    ...buildInlineArtifactImportSteps({
      artifactExpression: savedViewListResponseExpression,
      filename: "capacity-trend.saved-view.history-current.list-response.json",
      importedNoticeText: "Imported listReportDocuments response with 1 entry.",
      captureDownloads: false,
    }),
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Trend Q3 Saved View",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => {
        const preview = window.__REPORT_BUILDER_PREVIEW__;
        if (!preview || typeof preview.replacePreparedListReportDocumentsResponse !== 'function') {
          throw new Error('replacePreparedListReportDocumentsResponse API not available.');
        }
        const result = preview.replacePreparedListReportDocumentsResponse(${publishedSnapshotListResponseExpression}, {
          selectedEntryKey: 'capacityTrendQ3',
        });
        return !!result?.response && result.selectedEntryKey === 'capacityTrendQ3';
      })()`,
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Trend Q3 Published Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => {
        const preview = window.__REPORT_BUILDER_PREVIEW__;
        if (!preview || typeof preview.replacePreparedListReportDocumentsResponse !== 'function') {
          throw new Error('replacePreparedListReportDocumentsResponse API not available.');
        }
        const result = preview.replacePreparedListReportDocumentsResponse(${savedViewListResponseExpression}, {
          selectedEntryKey: 'capacityTrendQ3',
        });
        return !!result?.response && result.selectedEntryKey === 'capacityTrendQ3';
      })()`,
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Trend Q3 Saved View",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => {
        const preview = window.__REPORT_BUILDER_PREVIEW__;
        if (!preview || typeof preview.replaceExportBehaviors !== 'function') {
          throw new Error('preview export behavior api not available');
        }
        preview.replaceExportBehaviors([
          {
            match: {
              phase: 'status',
              source: 'savedView',
              format: 'pdf',
              artifactRef: 'reportBuilder.savedView://saved_view_capacityTrendQ3',
              jobId: 'demo-export-job-1',
            },
            result: {
              status: 'succeeded',
              artifactId: 'demo-export-artifact-selected-saved-view-history-a',
              artifactRef: 'reportBuilder.savedView://saved_view_capacityTrendQ3',
              format: 'pdf',
              scope: 'savedView',
            },
          },
          {
            match: {
              phase: 'artifact',
              artifactId: 'demo-export-artifact-selected-saved-view-history-a',
              artifactRef: 'reportBuilder.savedView://saved_view_capacityTrendQ3',
              format: 'pdf',
            },
            result: {
              artifactId: 'demo-export-artifact-selected-saved-view-history-a',
              artifactRef: 'reportBuilder.savedView://saved_view_capacityTrendQ3',
              format: 'pdf',
              contentType: 'application/pdf',
              bytes: Array.from(new TextEncoder().encode('%PDF-selected-entry saved-view history A saved_view_capacityTrendQ3')),
            },
          },
          {
            match: {
              phase: 'status',
              source: 'savedView',
              format: 'pdf',
              artifactRef: 'reportBuilder.savedView://saved_view_capacityTrendQ3',
              jobId: 'demo-export-job-2',
            },
            result: {
              status: 'succeeded',
              artifactId: 'demo-export-artifact-selected-saved-view-history-b',
              artifactRef: 'reportBuilder.savedView://saved_view_capacityTrendQ3',
              format: 'pdf',
              scope: 'savedView',
            },
          },
          {
            match: {
              phase: 'artifact',
              artifactId: 'demo-export-artifact-selected-saved-view-history-b',
              artifactRef: 'reportBuilder.savedView://saved_view_capacityTrendQ3',
              format: 'pdf',
            },
            result: {
              artifactId: 'demo-export-artifact-selected-saved-view-history-b',
              artifactRef: 'reportBuilder.savedView://saved_view_capacityTrendQ3',
              format: 'pdf',
              contentType: 'application/pdf',
              bytes: Array.from(new TextEncoder().encode('%PDF-selected-entry saved-view history B saved_view_capacityTrendQ3')),
            },
          },
        ]);
        return true;
      })()`,
    },
    buildSelectedListEntryExportButtonStep(),
    {
      type: "waitForDomContains",
      text: "Accepted PDF export for Capacity Trend Q3 Saved View.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Refresh status",
    },
    {
      type: "waitForDomContains",
      text: "Export demo-export-job-1 is succeeded.",
      timeoutMs: 60000,
    },
    buildSelectedListEntryExportButtonStep(),
    {
      type: "waitForDomContains",
      text: "Accepted PDF export for Capacity Trend Q3 Saved View.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Refresh status",
    },
    {
      type: "waitForDomContains",
      text: "Export demo-export-job-2 is succeeded.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Recent exports') && text.includes('demo-export-artifact-selected-saved-view-history-a') && text.includes('demo-export-artifact-selected-saved-view-history-b') && text.includes('Current export selection') && text.includes('Use current') && text.includes('Download artifact'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); const cardText = entry.closest('div[style]')?.innerText || entry.closest('div[style]')?.textContent || ''; return text === 'Use current' && cardText.includes('demo-export-artifact-selected-saved-view-history-a'); }); if (!button) { throw new Error('Selected saved-view history A Use current button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const buttons = Array.from(document.querySelectorAll('button')).filter((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Use current')); const target = buttons.find((entry) => { const cardText = entry.closest('div[style]')?.innerText || entry.closest('div[style]')?.textContent || ''; return cardText.includes('demo-export-artifact-selected-saved-view-history-a'); }); const other = buttons.find((entry) => { const cardText = entry.closest('div[style]')?.innerText || entry.closest('div[style]')?.textContent || ''; return cardText.includes('demo-export-artifact-selected-saved-view-history-b'); }); const targetText = target?.closest('div[style]')?.innerText || target?.closest('div[style]')?.textContent || ''; const otherText = other?.closest('div[style]')?.innerText || other?.closest('div[style]')?.textContent || ''; return targetText.includes('Current export selection') && !otherText.includes('Current export selection'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Download artifact",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Capacity Trend Q3 Saved View.pdf' && window.__artifactDownloadCapture.payloadReady === true",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.mimeType === 'application/pdf' && window.__artifactDownloadCapture.payload.includes('%PDF-selected-entry saved-view history A saved_view_capacityTrendQ3')",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-list-entry-saved-view-history-card-use-current.png",
      fullPage: true,
    },
  ],
};
