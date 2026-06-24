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
      expression: "window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors([{ match: { blockKind: 'tableBlock', fieldRef: 'eventDate' }, actions: [ { id: 'keep_date', label: 'Keep only', kind: 'keep' }, { id: 'exclude_date', label: 'Exclude', kind: 'exclude' }, { id: 'drill_time', label: 'Drill to Time Detail', kind: 'drill', nextFieldRef: 'country' }, { id: 'detail_date', label: 'Show date details', kind: 'detail', targetRef: 'target://example/performance/date-detail' } ] }]);",
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-runtime-table-panel .forge-dashboard-row-action').length >= 1",
      timeoutMs: 60000,
    },
    {
      type: "assertDomContains",
      text: "Runtime Diagnostics",
    },
    {
      type: "assertDomContains",
      text: "Runtime refinement actions are unavailable for Date because no backend runtime filter mapping is declared.",
    },
    {
      type: "assertDomContains",
      text: "Show date details",
    },
    {
      type: "assertDomNotContains",
      text: "Keep only",
    },
    {
      type: "assertDomNotContains",
      text: "Exclude",
    },
    {
      type: "assertDomNotContains",
      text: "Drill to Time Detail",
    },
    {
      type: "screenshot",
      file: "report-builder-preview-runtime-table-unsupported-warning-proof.png",
      fullPage: true,
    },
  ],
};
