import {
  buildInlineArtifactImportSteps,
} from "./report-builder-preview-scenario-builders.mjs";

const publishedSnapshotRecordExpression = `(() => {
  const preview = window.__REPORT_BUILDER_PREVIEW__;
  const payloads = preview?.getSeededSavedReportPayloads?.() || [];
  const target = payloads.find((entry) => (entry?.savedReportPayload?.reportDocument?.id || entry?.reportId) === 'capacityTrendQ3') || payloads[0];
  const payload = target?.savedReportPayload || target;
  const exportRequest = target?.exportRequest;
  if (!payload?.reportDocument || !exportRequest) {
    throw new Error('seeded reopened lifecycle published-snapshot record source not found');
  }
  return {
    reportId: payload.reportDocument.id || 'capacityTrendQ3',
    title: 'Capacity Trend Q3 Published Snapshot',
    documentVersion: (exportRequest?.source?.documentVersion || 6) + 1,
    savedAt: (payload?.savedAt || 6100) + 1,
    importedArtifactKind: 'reportBuilder.publishedSnapshot',
    lifecycle: 'published',
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
    throw new Error('seeded reopened lifecycle saved-view record source not found');
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

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildInlineArtifactImportSteps({
      artifactExpression: publishedSnapshotRecordExpression,
      filename: "capacity-trend.reopened-lifecycle.published-snapshot.saved-record.json",
      importedNoticeText: "Imported published snapshot Capacity Trend Q3 Published Snapshot. Reopen and export are ready.",
      captureDownloads: true,
    }),
    {
      type: "eval",
      expression: `(() => {
        const input = document.querySelector('input[aria-label="Import report file"]');
        if (!input) { throw new Error('import api unavailable'); }
        const artifact = ${savedViewRecordExpression};
        const file = new File([JSON.stringify(artifact, null, 2)], 'capacity-trend.reopened-lifecycle.saved-view.saved-record.json', { type: 'application/json' });
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
      filename: "capacity-trend.reopened-lifecycle.published-snapshot.list-response.json",
      importedNoticeText: "Imported listReportDocuments response with 1 entry.",
      captureDownloads: false,
    }),
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
        const section = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Reopened ReportDocument: Capacity Trend Q3 Published Snapshot'));
        if (!section) { return false; }
        const buttons = Array.from(section.querySelectorAll('button'));
        const archive = buttons.find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Archive'));
        return !!archive && !archive.disabled;
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => {
        const section = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Reopened ReportDocument: Capacity Trend Q3 Published Snapshot'));
        if (!section) { throw new Error('reopened published snapshot section not found'); }
        const button = Array.from(section.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Archive'));
        if (!button) { throw new Error('reopened archive button not found'); }
        button.click();
        return true;
      })()`,
    },
    {
      type: "waitForDomContains",
      text: "Archived shared artifact for Capacity Trend Q3 Published Snapshot.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const section = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Reopened ReportDocument: Capacity Trend Q3 Published Snapshot'));
        if (!section) { return false; }
        const text = section.innerText || section.textContent || '';
        const buttons = Array.from(section.querySelectorAll('button')).map((entry) => ((entry.innerText || entry.textContent || '').trim()));
        return text.includes('archived')
          && !buttons.includes('Archive')
          && buttons.includes('Share')
          && buttons.includes('Restore live builder');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Latest shared artifact",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const panel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Latest shared artifact'));
        const text = panel?.innerText || panel?.textContent || '';
        return text.includes('published-snapshot artifact')
          && text.includes('published_snapshot_capacityTrendQ3_1')
          && text.includes('The latest archive action preserved an immutable snapshot artifact for this report.');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect artifact",
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const panel = document.querySelector('[aria-label="Latest shared artifact summary"]');
        const text = panel?.innerText || panel?.textContent || '';
        return text.includes('"kind": "reportBuilder.publishedSnapshot"')
          && text.includes('"lifecycle": "archived"')
          && text.includes('"artifactRef": "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3_1"');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopened-session-lifecycle-archive.png",
      fullPage: true,
    },
  ],
};
