import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 390,
    height: 844,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__compact-action",
      text: "Setup",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "BREAK DOWN BY",
      timeoutMs: 60000,
    },
    {
      type: "selectSelector",
      selector: "select",
      index: 0,
      value: "agegroupId",
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Validating the semantic selection against the provider.') || text.includes('Semantic provider diagnostics') || text.includes('Resolve semantic selection issues'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic provider diagnostics",
      timeoutMs: 60000,
    },
    {
      type: "assertDomContains",
      text: "Audience Age Group is not supported for this semantic selection in the demo provider.",
    },
    {
      type: "assertDomContains",
      text: "Household Uniques cannot be combined with Audience Age Group in this demo semantic provider.",
    },
    {
      type: "assertDomContains",
      text: "Resolve semantic selection issues",
    },
    {
      type: "waitForEval",
      expression: "(() => { const runButtons = Array.from(document.querySelectorAll('button')).filter((button) => (button.innerText || '').trim() === 'Run'); return runButtons.length >= 2 && runButtons.every((button) => button.disabled === true); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-invalid-proof.png",
      fullPage: true,
    },
  ],
};
