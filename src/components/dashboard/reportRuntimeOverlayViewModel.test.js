import assert from "node:assert/strict";

import {
  buildReportRuntimeDiagnosticsViewModel,
  buildReportRuntimeHostIntentViewModel,
} from "./reportRuntimeOverlayViewModel.js";

assert.deepEqual(buildReportRuntimeDiagnosticsViewModel([
  {
    code: "detailTargetPartial",
    severity: "warning",
    blockId: "primaryChart",
    path: "reportDocument.blocks.primaryChart.targetRef",
    message: "Detail target resolved with omitted parameters: campaign.",
    suggestedFix: "Update the authored target mapping or remove the missing parameter.",
  },
]), {
  hasDiagnostics: true,
  diagnostics: [
    {
      code: "detailTargetPartial",
      severity: "warning",
      blockId: "primaryChart",
      path: "reportDocument.blocks.primaryChart.targetRef",
      message: "Detail target resolved with omitted parameters: campaign.",
      suggestedFix: "Update the authored target mapping or remove the missing parameter.",
    },
  ],
});

assert.deepEqual(buildReportRuntimeDiagnosticsViewModel([
  {
    code: "runtimeRefinementUnsupported",
    severity: "warning",
    message: "Runtime refinement actions are unavailable for Age Group because no backend runtime filter mapping is declared.",
  },
  {
    code: "detailTargetPartial",
    severity: "warning",
    blockId: "primaryChart",
    path: "reportDocument.blocks.primaryChart.targetRef",
    message: "Detail target resolved with omitted parameters: campaign.",
    suggestedFix: "Update the authored target mapping or remove the missing parameter.",
  },
]), {
  hasDiagnostics: true,
  diagnostics: [
    {
      code: "detailTargetPartial",
      severity: "warning",
      blockId: "primaryChart",
      path: "reportDocument.blocks.primaryChart.targetRef",
      message: "Detail target resolved with omitted parameters: campaign.",
      suggestedFix: "Update the authored target mapping or remove the missing parameter.",
    },
  ],
});

assert.deepEqual(buildReportRuntimeDiagnosticsViewModel([]), {
  hasDiagnostics: false,
  diagnostics: [],
});

assert.deepEqual(buildReportRuntimeHostIntentViewModel({
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing.",
  targetRef: "target://example/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
    scope: "national",
  },
}, {
  canClearHostIntent: true,
}), {
  hasHostIntent: true,
  hostIntent: {
    title: "Resolved detail target",
    description: "Ready for host routing.",
    intentKind: "detailTarget",
    navigationMode: "hostRoute",
    targetRef: "target://example/performance/channel-detail",
    parameters: [
      { key: "channel", value: "Display" },
      { key: "scope", value: "national" },
    ],
  },
  canClearHostIntent: true,
});

assert.deepEqual(buildReportRuntimeHostIntentViewModel(null), {
  hasHostIntent: false,
  hostIntent: null,
  canClearHostIntent: false,
});

console.log("reportRuntimeOverlayViewModel ✓ summarizes diagnostics and host-intent overlays for the runtime surface");
