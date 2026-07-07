import {
  buildPreviewBootstrapSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps({ captureDownloads: true }),
    {
      type: "eval",
      expression: "(() => { const api = window.__REPORT_BUILDER_PREVIEW__; if (!api || typeof api.getSeededSavedReportPayloads !== 'function' || typeof api.replaceSeededSavedReportPayloads !== 'function') { throw new Error('Preview seeded saved payload API not available.'); } return import('/src/reporting/fixtures/capacityDirectSeriesFixtureState.js').then(({ buildCapacityDirectSeriesFixtureState }) => { const record = buildCapacityDirectSeriesFixtureState().record; const existing = api.getSeededSavedReportPayloads(); const next = [...existing.filter((entry) => { const target = entry?.savedReportPayload || entry; const reportId = target?.reportDocument?.id || target?.reportRef?.reportId || target?.reportId || ''; return reportId !== 'capacityKpiBlendByDateQ3'; }), record]; const replaced = api.replaceSeededSavedReportPayloads(next); return Array.isArray(replaced) && replaced.some((entry) => { const target = entry?.savedReportPayload || entry; return (target?.reportDocument?.id || '') === 'capacityKpiBlendByDateQ3'; }); }); })()",
    },
    {
      type: "eval",
      expression: "(() => { const api = window.__REPORT_BUILDER_PREVIEW__; if (!api || typeof api.replacePreparedListReportDocumentsResponse !== 'function') { throw new Error('replacePreparedListReportDocumentsResponse API not available.'); } return import('/src/reporting/fixtures/capacityDirectSeriesFixtureState.js').then(({ buildCapacityDirectSeriesFixtureState }) => { const fixture = buildCapacityDirectSeriesFixtureState(); const result = api.replacePreparedListReportDocumentsResponse(fixture.listReportDocumentsResponse, { selectedReportId: 'capacityKpiBlendByDateQ3' }); return !!result && result.selectedEntryKey.includes('capacityKpiBlendByDateQ3'); }); })()",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity KPI Blend Q3",
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
      name: "Review get request",
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityKpiBlendByDateQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Reopen bundle: Capacity KPI Blend Q3",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Review reopen bundle",
    },
    {
      type: "waitForDomContains",
      text: "\"documentVersion\": 9",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.patchBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.patchBuilderState({ selectedDimensions: ['eventDate', 'channelV2'], viewMode: 'table', chartSpec: null })",
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 2 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('eventDate') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('channelV2') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'table' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec == null",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Reopen in builder",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Capacity KPI Blend Q3 for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity KPI Blend Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'eventDate' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.length === 2 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.includes('avails') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.includes('hhUniqs') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Avails + HH Uniques by Date' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.type === 'bar' && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceDetailTargetBehaviors !== 'function') { throw new Error('replaceDetailTargetBehaviors API not available.'); } return preview.replaceDetailTargetBehaviors([{ match: { targetRef: 'target://example/performance/date-detail' }, result: { targetRef: 'target://example/performance/date-detail', navigationMode: 'hostRoute', parameters: { eventDate: '$value', country: '$row.country' } } }]); })()",
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceCollectionRows !== 'function') { throw new Error('Preview replaceCollectionRows API not available.'); } preview.replaceCollectionRows([{ eventDate: '2026-05-01', avails: 40000, hhUniqs: 16000, country: 'US' }, { eventDate: '2026-05-01', avails: 34700, hhUniqs: 15200, country: 'US' }, { eventDate: '2026-05-02', avails: 42000, hhUniqs: 17000, country: 'US' }, { eventDate: '2026-05-02', avails: 36400, hhUniqs: 15600, country: 'US' }, { eventDate: '2026-05-03', avails: 36000, hhUniqs: 14800, country: 'CA' }, { eventDate: '2026-05-03', avails: 33700, hhUniqs: 14200, country: 'CA' }, { eventDate: '2026-05-04', avails: 38000, hhUniqs: 15500, country: 'CA' }, { eventDate: '2026-05-04', avails: 35800, hhUniqs: 14900, country: 'CA' }], { hasMore: false, error: null }); return true; })()",
    },
    {
      type: "waitForDomContains",
      text: "34.7K",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const mark = panel?.querySelector('.recharts-bar-rectangle'); if (!mark) { throw new Error('Reopened compiled runtime chart mark not found.'); } mark.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Selected value:') && text.includes('2026-05-01') && text.includes('avails') && text.includes('Show date details'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const button = Array.from(panel?.querySelectorAll('.forge-report-runtime-chart-action') || []).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Show date details')); if (!button) { throw new Error('Reopened compiled runtime Show date details action not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => Array.from(document.querySelectorAll('.forge-report-runtime-host-intent')).some((entry) => !entry.closest('.forge-report-builder__runtime-preview') && (entry.innerText || entry.textContent || '').includes('target://example/performance/date-detail') && (entry.innerText || entry.textContent || '').includes('eventDate') && (entry.innerText || entry.textContent || '').includes('2026-05-01') && (entry.innerText || entry.textContent || '').includes('country') && (entry.innerText || entry.textContent || '').includes('US') && !document.body.innerText.includes('Detail target resolved with omitted parameters: country.')) )()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect export",
    },
    {
      type: "waitForEval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Draft export request summary\"]')).find(Boolean); if (!summary) { return false; } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const text = container?.innerText || container?.textContent || ''; const pre = container?.querySelector('pre'); if (!pre) { return false; } const raw = pre.textContent || ''; try { const parsed = JSON.parse(raw); const reportPrint = parsed?.reportPrint || {}; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && parsed?.kind === 'reportExportRequest' && parsed?.source?.from === 'draft' && reportPrint?.kind === 'reportPrint' && reportPrint?.title === 'Capacity KPI Blend Q3' && raw.includes('\"id\": \"bookmark.primaryChart\"') && raw.includes('Avails + HH Uniques by Date'); } catch (_) { return false; } })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Draft export request summary\"]')).find(Boolean); if (!summary) { throw new Error('Draft export request summary not found.'); } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const pre = container?.querySelector('pre'); if (!pre) { throw new Error('Draft export request payload not found.'); } sessionStorage.setItem('__directSeriesDraftExportBaseline', pre.textContent || ''); return true; })()",
    },
    {
      type: "eval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Draft export request summary\"]')).find(Boolean); if (!summary) { throw new Error('Draft export request summary not found.'); } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const button = Array.from(container.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Hide export request')); if (!button) { throw new Error('Hide export request button not found.'); } button.click(); return true; })()",
    },
    {
      type: "reload",
    },
    {
      type: "waitForDomContains",
      text: "Semantic binding: Ad Delivery • Entity: Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity KPI Blend Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Avails + HH Uniques by Date' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.type === 'bar' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'eventDate' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.length === 2 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.includes('avails') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.includes('hhUniqs') && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceDetailTargetBehaviors !== 'function') { throw new Error('replaceDetailTargetBehaviors API not available.'); } return preview.replaceDetailTargetBehaviors([{ match: { targetRef: 'target://example/performance/date-detail' }, result: { targetRef: 'target://example/performance/date-detail', navigationMode: 'hostRoute', parameters: { eventDate: '$value', country: '$row.country' } } }]); })()",
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceCollectionRows !== 'function') { throw new Error('Preview replaceCollectionRows API not available.'); } preview.replaceCollectionRows([{ eventDate: '2026-05-01', avails: 40000, hhUniqs: 16000, country: 'US' }, { eventDate: '2026-05-01', avails: 34700, hhUniqs: 15200, country: 'US' }, { eventDate: '2026-05-02', avails: 42000, hhUniqs: 17000, country: 'US' }, { eventDate: '2026-05-02', avails: 36400, hhUniqs: 15600, country: 'US' }, { eventDate: '2026-05-03', avails: 36000, hhUniqs: 14800, country: 'CA' }, { eventDate: '2026-05-03', avails: 33700, hhUniqs: 14200, country: 'CA' }, { eventDate: '2026-05-04', avails: 38000, hhUniqs: 15500, country: 'CA' }, { eventDate: '2026-05-04', avails: 35800, hhUniqs: 14900, country: 'CA' }], { hasMore: false, error: null }); return true; })()",
    },
    {
      type: "waitForDomContains",
      text: "34.7K",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const mark = panel?.querySelector('.recharts-bar-rectangle'); if (!mark) { throw new Error('Hydrated compiled runtime chart mark not found.'); } mark.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Selected value:') && text.includes('2026-05-01') && text.includes('avails') && text.includes('Show date details'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const button = Array.from(panel?.querySelectorAll('.forge-report-runtime-chart-action') || []).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Show date details')); if (!button) { throw new Error('Hydrated compiled runtime Show date details action not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => Array.from(document.querySelectorAll('.forge-report-runtime-host-intent')).some((entry) => !entry.closest('.forge-report-builder__runtime-preview') && (entry.innerText || entry.textContent || '').includes('target://example/performance/date-detail') && (entry.innerText || entry.textContent || '').includes('eventDate') && (entry.innerText || entry.textContent || '').includes('2026-05-01') && (entry.innerText || entry.textContent || '').includes('country') && (entry.innerText || entry.textContent || '').includes('US') && !document.body.innerText.includes('Detail target resolved with omitted parameters: country.')) )()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect export",
    },
    {
      type: "waitForEval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Draft export request summary\"]')).find(Boolean); if (!summary) { return false; } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const text = container?.innerText || container?.textContent || ''; const pre = container?.querySelector('pre'); if (!pre) { return false; } const raw = pre.textContent || ''; try { const parsed = JSON.parse(raw); const reportPrint = parsed?.reportPrint || {}; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && parsed?.kind === 'reportExportRequest' && parsed?.source?.from === 'draft' && reportPrint?.kind === 'reportPrint' && reportPrint?.title === 'Capacity KPI Blend Q3' && raw.includes('\"id\": \"bookmark.primaryChart\"') && raw.includes('Avails + HH Uniques by Date'); } catch (_) { return false; } })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Draft export request summary\"]')).find(Boolean); if (!summary) { throw new Error('Draft export request summary not found.'); } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const pre = container?.querySelector('pre'); if (!pre) { throw new Error('Draft export request payload not found.'); } window.__directSeriesDraftExportCurrent = pre.textContent || ''; return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const baseline = sessionStorage.getItem('__directSeriesDraftExportBaseline') || ''; const current = window.__directSeriesDraftExportCurrent || ''; return !!baseline && !!current && baseline === current; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-direct-series-detail-selection-rows.png",
      fullPage: true,
    },
  ],
};
