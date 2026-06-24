import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.beginStandaloneDraft !== 'function') { throw new Error('preview beginStandaloneDraft unavailable'); } return preview.beginStandaloneDraft({ sourceKind: 'reportBuilder.tableRow', sourceContext: { label: '2026-05-01 • Display', metadata: { rowIndex: 0, dimensionValues: { eventDate: '2026-05-01', channelV2: 'Display' } } }, patch: { __scenarioTableRowDraft: true }, nowMs: 1700000002000 }); })()",
    },
    {
      type: "waitForDomContains",
      text: "Draft started from 2026-05-01 • Display.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const keys = ['reportBuilder.state.demoReportBuilder.demoReportBuilderWindow', 'reportBuilder.state.demoReportBuilder']; return keys.some((key) => { const raw = window.localStorage.getItem(key); if (!raw) { return false; } try { const parsed = JSON.parse(raw); return parsed?.explorationSession?.sourceRef?.kind === 'reportBuilder.tableRow' && parsed?.explorationSession?.sourceRef?.contextLabel === '2026-05-01 • Display' && parsed?.explorationSession?.sourceRef?.context?.dimensionValues?.channelV2 === 'Display'; } catch (_) { return false; } }); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Discard draft",
    },
    {
      type: "waitForDomContains",
      text: "Draft discarded.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const keys = ['reportBuilder.state.demoReportBuilder.demoReportBuilderWindow', 'reportBuilder.state.demoReportBuilder']; return keys.every((key) => { const raw = window.localStorage.getItem(key); if (!raw) { return true; } try { const parsed = JSON.parse(raw); return !parsed?.explorationSession; } catch (_) { return false; } }); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-exploration-table-row.png",
      fullPage: true,
    },
  ],
};
