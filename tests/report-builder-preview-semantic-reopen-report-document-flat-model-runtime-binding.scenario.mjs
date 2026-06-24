import {
  buildPreviewBootstrapSteps,
  buildSavedPayloadPreparationSteps,
  buildSelectedReportDocumentPreparationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps({ captureDownloads: false }),
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceSemanticModelBehaviors !== 'function') { throw new Error('replaceSemanticModelBehaviors API not available.'); } return preview.replaceSemanticModelBehaviors([{ match: { modelRef: 'model://example/performance/delivery@v1' }, result: { modelRef: 'model://example/performance/delivery@v1', version: 2, label: 'Audience Delivery', entities: [{ id: 'line_delivery', label: 'Audience Line Delivery', fields: [{ id: 'event_date', label: 'Event Date', featureType: 'dimension', dataType: 'date' }, { id: 'channel', label: 'Channel', featureType: 'dimension', dataType: 'string' }, { id: 'country_code', label: 'Market', featureType: 'dimension', dataType: 'string', category: 'Location', definitionRef: 'harmonizer://feature/location', governance: { status: 'approved', classification: 'harmonizer.audience' } }, { id: 'available_impressions', label: 'Available Impressions', featureType: 'measure', format: 'compactNumber', dataType: 'number', aggregation: 'sum' }, { id: 'audience_index', label: 'Audience Index', featureType: 'measure', format: 'number', dataType: 'number', aggregation: 'avg', category: 'Audience', definitionRef: 'harmonizer://feature/user.segment.index', governance: { status: 'approved', certification: 'reviewed', classification: 'harmonizer.audience' } }, { id: 'audience_segment', label: 'Audience Segment', featureType: 'parameter', dataType: 'string', category: 'Audience', definitionRef: 'harmonizer://feature/user.segment', governance: { status: 'approved', classification: 'harmonizer.audience' } }, { id: 'reporting_window', label: 'Date Range', featureType: 'parameter', dataType: 'date' }] }] } }]); })()",
    },
    {
      type: "reload",
    },
    {
      type: "waitForDomContains",
      text: "Semantic binding: Audience Delivery • Entity: Audience Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.getModelCount >= 1",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.appendSeededSavedReportPayloadRecord !== 'function' || typeof preview.getSavedReportPayloads !== 'function' || typeof preview.replaceSeededSavedReportPayloads !== 'function' || typeof preview.getBuilderConfig !== 'function') { throw new Error('Saved payload preview APIs not available.'); } const existing = preview.getSavedReportPayloads(); const filtered = existing.filter((entry) => { const payload = entry?.savedReportPayload || entry; return (payload?.reportDocument?.id || '') !== 'flatAudienceSegmentQ3'; }); preview.replaceSeededSavedReportPayloads(filtered); const baseBinding = preview.getBuilderConfig()?.binding || null; return preview.appendSeededSavedReportPayloadRecord({ reportId: 'flatAudienceSegmentQ3', title: 'Flat Audience Segment Q3', artifactId: 'flat_audience_segment_q3', documentVersion: 14, savedAt: 9376, baseState: { selectedMeasures: ['audienceIndex'], primaryMeasure: 'audienceIndex', selectedDimensions: ['country'], viewMode: 'table', chartSpec: null, orderField: 'audienceIndex', orderDir: 'desc', pageSize: 50, staticFilters: { dateRange: { start: '2026-05-01', end: '2026-05-04' }, audienceSegmentFilter: ['Young Adults'] }, binding: baseBinding } }); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.getSavedReportPayloads !== 'function') { return false; } const payload = (preview.getSavedReportPayloads() || []).map((entry) => entry?.savedReportPayload || entry).find((entry) => (entry?.reportDocument?.id || '') === 'flatAudienceSegmentQ3'); const summary = payload?.reportSpec?.semanticSummary || payload?.reportDocument?.semanticSummary || null; const measure = summary?.selectedMeasures?.find((field) => field?.id === 'audience_index'); const parameter = summary?.selectedParameters?.find((field) => field?.id === 'audience_segment'); return !!payload && summary?.modelLabel === 'Audience Delivery' && summary?.entityLabel === 'Audience Line Delivery' && measure?.definitionRef === 'harmonizer://feature/user.segment.index' && parameter?.definitionRef === 'harmonizer://feature/user.segment' && Array.isArray(payload?.reportDocument?.blocks?.[0]?.state?.staticFilters?.audienceSegmentFilter) && payload.reportDocument.blocks[0].state.staticFilters.audienceSegmentFilter.includes('Young Adults'); })()",
      timeoutMs: 60000,
    },
    ...buildSavedPayloadPreparationSteps({ documentVersion: "14", draftTriggerText: "Audience Index" }),
    ...buildSelectedReportDocumentPreparationSteps({
      reportId: "flatAudienceSegmentQ3",
      responseTitle: "Get ReportDocument response: Flat Audience Segment Q3",
    }),
    {
      type: "waitForDomContains",
      text: "\"harmonizer://feature/user.segment.index\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"harmonizer://feature/user.segment\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Reopen in builder",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Flat Audience Segment Q3 for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Flat Audience Segment Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic binding: Audience Delivery • Entity: Audience Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures[0] === 'audienceIndex' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'country' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.staticFilters?.audienceSegmentFilter) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().staticFilters.audienceSegmentFilter.includes('Young Adults') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.orderField === 'audienceIndex' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'table'",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-flat-model-runtime-binding.png",
      fullPage: true,
    },
  ],
};
