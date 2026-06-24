import {
  buildPreviewBootstrapSteps,
  buildSemanticValidationBehaviorInjectionSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 720,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    buildSemanticValidationBehaviorInjectionSteps({
      match: {
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        dimensions: ["event_date", "channel", "age_group"],
        measures: ["available_impressions", "household_uniques"],
      },
      delayMs: 1500,
    }),
    {
      type: "clickRole",
      role: "button",
      name: "Performance metrics settings",
    },
    {
      type: "waitForDomContains",
      text: "BREAK DOWN BY",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; window.__semanticStaleValidationBaseline = { validateSelectionCount: Number(preview?.validateSelectionCount || 0) || 0, behaviorCount: Array.isArray(preview?.semanticValidationBehaviors) ? preview.semanticValidationBehaviors.length : 0 }; return true; })()",
    },
    {
      type: "selectSelector",
      selector: "select",
      index: 0,
      value: "agegroupId",
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = window.__semanticStaleValidationBaseline; const text = document.body?.innerText || document.body?.textContent || ''; if (!preview || !baseline) { return false; } const validateSelectionCount = Number(preview.validateSelectionCount || 0) || 0; const remainingBehaviors = Array.isArray(preview.semanticValidationBehaviors) ? preview.semanticValidationBehaviors.length : 0; const started = validateSelectionCount > baseline.validateSelectionCount && remainingBehaviors < baseline.behaviorCount; if (!started) { return false; } if (!window.__semanticStaleValidationInFlightAt) { window.__semanticStaleValidationInFlightAt = Date.now(); } return text.includes('Validating the semantic selection against the provider.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "selectSelector",
      selector: "select",
      index: 0,
      value: "",
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; const runButtons = Array.from(document.querySelectorAll('button')).filter((button) => (button.innerText || '').trim() === 'Run'); return Date.now() - (window.__semanticStaleValidationInFlightAt || 0) >= 1800 && !text.includes('Semantic provider diagnostics') && !text.includes('Resolve semantic selection issues') && !text.includes('Audience Age Group is not supported for this semantic selection in the demo provider.') && !text.includes('Household Uniques cannot be combined with Audience Age Group in this demo semantic provider.') && !text.includes('Validating the semantic selection against the provider.') && runButtons.length === 1 && runButtons[0].disabled === false; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-stale-proof.png",
      fullPage: true,
    },
  ],
};
