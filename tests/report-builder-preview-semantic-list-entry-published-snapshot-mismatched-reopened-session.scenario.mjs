import {
  buildInlineArtifactImportSteps,
  buildSelectedListEntryExportButtonStep,
} from "./report-builder-preview-scenario-builders.mjs";

const isolatedSavedViewNote = "Saved view runtime note should stay isolated from the published snapshot.";

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

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildInlineArtifactImportSteps({
      artifactExpression: publishedSnapshotRecordExpression,
      filename: "capacity-trend.published-snapshot.mismatch-guard.saved-record.json",
      importedNoticeText: "Imported published snapshot Capacity Trend Q3 Published Snapshot. Reopen and export are ready.",
      captureDownloads: true,
    }),
    {
      type: "eval",
      expression: `(() => {
        const input = document.querySelector('input[aria-label="Import report file"]');
        if (!input) { throw new Error('import api unavailable'); }
        const artifact = ${savedViewRecordExpression};
        const file = new File([JSON.stringify(artifact, null, 2)], 'capacity-trend.saved-view.mismatch-guard.saved-record.json', { type: 'application/json' });
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
      filename: "capacity-trend.published-snapshot.mismatch-guard.list-response.json",
      importedNoticeText: "Imported listReportDocuments response with 1 entry.",
      captureDownloads: false,
    }),
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
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Trend Q3 Saved View",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Reopen in builder",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Capacity Trend Q3 Saved View for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity Trend Q3 Saved View",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => {
        const preview = window.__REPORT_BUILDER_PREVIEW__;
        if (!preview || typeof preview.applyAuthoredDocumentBlock !== 'function') {
          throw new Error('applyAuthoredDocumentBlock API not available.');
        }
        const result = preview.applyAuthoredDocumentBlock({
          kind: 'markdownBlock',
          seed: {
            id: 'savedViewRuntimeNote',
            title: 'Saved View Runtime Note',
            markdown: '## Saved View Runtime Note\\n${isolatedSavedViewNote}',
          },
        });
        return !!result?.valid;
      })()`,
    },
    {
      type: "waitForDomContains",
      text: "Saved View Runtime Note",
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
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Trend Q3 Published Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get response",
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const panel = document.querySelector('[aria-label="Get ReportDocument response summary"]');
        const text = panel?.innerText || panel?.textContent || '';
        return text.includes('"kind": "getReportDocumentResponse"')
          && text.includes('"title": "Capacity Trend Q3 Published Snapshot"')
          && text.includes('"kind": "reportBuilder.publishedSnapshot"')
          && text.includes('"sourceArtifactId": "published_snapshot_capacityTrendQ3"')
          && !text.includes(${JSON.stringify(isolatedSavedViewNote)})
          && !text.includes('Saved View Runtime Note');
      })()`,
      timeoutMs: 60000,
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
          && raw.includes('"artifactRef": "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3"')
          && !raw.includes(${JSON.stringify(isolatedSavedViewNote)})
          && !raw.includes('Saved View Runtime Note');
      })()`,
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
              source: 'publishedSnapshot',
              format: 'pdf',
              artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3',
            },
            result: {
              status: 'succeeded',
              artifactId: 'demo-export-artifact-selected-published-snapshot-history',
              artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3',
              format: 'pdf',
              scope: 'publishedSnapshot',
            },
          },
          {
            match: {
              phase: 'artifact',
              artifactId: 'demo-export-artifact-selected-published-snapshot-history',
              artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3',
              format: 'pdf',
            },
            result: {
              artifactId: 'demo-export-artifact-selected-published-snapshot-history',
              artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3',
              format: 'pdf',
              contentType: 'application/pdf',
              bytes: Array.from(new TextEncoder().encode('%PDF-selected-entry published-snapshot history published_snapshot_capacityTrendQ3')),
            },
          },
        ]);
        return true;
      })()`,
    },
    buildSelectedListEntryExportButtonStep(),
    {
      type: "waitForDomContains",
      text: "Accepted PDF export for Capacity Trend Q3 Published Snapshot.",
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
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-artifact-selected-published-snapshot-history') && text.includes('succeeded') && !text.includes('demo-export-artifact-1'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Recent exports') && text.includes('demo-export-artifact-selected-published-snapshot-history') && text.includes('Current export selection') && !text.includes('demo-export-artifact-reopened-saved-view-pinned'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Reopen in builder",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Capacity Trend Q3 Published Snapshot for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity Trend Q3 Published Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const reopened = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Reopened ReportDocument: Capacity Trend Q3 Published Snapshot'));
        if (!reopened) { return false; }
        const text = reopened.innerText || reopened.textContent || '';
        const buttons = Array.from(reopened.querySelectorAll('button')).map((entry) => ((entry.innerText || entry.textContent || '').trim()));
        return text.includes('published_snapshot_capacityTrendQ3')
          && !text.includes('saved_view_capacityTrendQ3')
          && !text.includes(${JSON.stringify(isolatedSavedViewNote)})
          && !text.includes('Saved View Runtime Note')
          && (buttons.includes('Inspect export') || buttons.includes('Review export'));
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const reopened = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Reopened ReportDocument: Capacity Trend Q3 Published Snapshot')); if (!reopened) { throw new Error('Reopened published-snapshot section not found.'); } const button = Array.from(reopened.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); return text === 'Inspect export' || text === 'Review export'; }); if (!button) { throw new Error('Inspect export button not found in reopened published-snapshot section.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const summary = Array.from(document.querySelectorAll('[aria-label="Reopened export request summary"]')).find(Boolean);
        if (!summary) { return false; }
        const container = summary.closest('.forge-report-builder__chart-inline-notice');
        const text = container?.innerText || container?.textContent || '';
        const pre = container?.querySelector('pre');
        const raw = pre?.textContent || '';
        return text.includes('published-snapshot artifact')
          && raw.includes('"from": "publishedSnapshot"')
          && raw.includes('"artifactRef": "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3"')
          && !raw.includes(${JSON.stringify(isolatedSavedViewNote)})
          && !raw.includes('Saved View Runtime Note');
      })()`,
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
              source: 'publishedSnapshot',
              format: 'pdf',
              artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3',
            },
            result: {
              status: 'succeeded',
              artifactId: 'demo-export-artifact-reopened-published-snapshot-pinned',
              artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3',
              format: 'pdf',
              scope: 'publishedSnapshot',
            },
          },
          {
            match: {
              phase: 'artifact',
              artifactId: 'demo-export-artifact-reopened-published-snapshot-pinned',
              artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3',
              format: 'pdf',
            },
            result: {
              artifactId: 'demo-export-artifact-reopened-published-snapshot-pinned',
              artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3',
              format: 'pdf',
              contentType: 'application/pdf',
              bytes: Array.from(new TextEncoder().encode('%PDF-pinned reopened published-snapshot published_snapshot_capacityTrendQ3')),
            },
          },
        ]);
        return true;
      })()`,
    },
    {
      type: "eval",
      expression: "(() => { const reopened = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Reopened ReportDocument: Capacity Trend Q3 Published Snapshot')); if (!reopened) { throw new Error('Reopened published-snapshot section not found for export submit.'); } const button = Array.from(reopened.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); return text === 'Export snapshot' || text === 'Review export'; }); if (!button) { throw new Error('Export snapshot button not found in reopened published-snapshot section.'); } button.click(); return true; })()",
    },
    {
      type: "waitForDomContains",
      text: "Accepted PDF export for Capacity Trend Q3 Published Snapshot.",
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
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-artifact-reopened-published-snapshot-pinned') && text.includes('succeeded') && !text.includes('demo-export-artifact-1'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Recent exports') && text.includes('demo-export-artifact-reopened-published-snapshot-pinned') && text.includes('Current export selection') && !text.includes('demo-export-artifact-reopened-saved-view-pinned'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Download artifact",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Capacity Trend Q3 Published Snapshot.pdf' && window.__artifactDownloadCapture.payloadReady === true",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.mimeType === 'application/pdf' && window.__artifactDownloadCapture.payload.includes('%PDF-pinned reopened published-snapshot published_snapshot_capacityTrendQ3')",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-list-entry-published-snapshot-mismatched-reopened-session.png",
      fullPage: true,
    },
  ],
};
