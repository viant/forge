import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1600,
    height: 980,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "waitForEval",
      expression: "(() => { const rail = document.querySelector('.forge-report-builder__left'); const filters = rail ? Array.from(rail.querySelectorAll('.forge-report-builder__bottom--rail')).find((node) => ((node.innerText || node.textContent || '').includes('Open Filters'))) : null; const jump = document.querySelector('.forge-report-builder__left-jump'); const text = filters?.innerText || filters?.textContent || ''; return !!rail && !!filters && !!jump && text.includes('Open Filters') && filters.getBoundingClientRect().height > 120; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const rail = document.querySelector('.forge-report-builder__left'); if (!rail) { throw new Error('Left rail not found.'); } rail.scrollTo({ top: rail.scrollHeight, behavior: 'auto' }); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const rail = document.querySelector('.forge-report-builder__left'); const filters = rail ? Array.from(rail.querySelectorAll('.forge-report-builder__bottom--rail')).find((node) => ((node.innerText || node.textContent || '').includes('Open Filters'))) : null; if (!rail || !filters) { return false; } const railRect = rail.getBoundingClientRect(); const filterRect = filters.getBoundingClientRect(); const railBottomGap = Math.max(0, rail.scrollHeight - rail.clientHeight - rail.scrollTop); return rail.scrollTop > 0 && railBottomGap < 2 && filterRect.height > 120 && filterRect.bottom <= railRect.bottom - 8; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-left-rail-scroll-bottom.png",
      fullPage: true,
    },
  ],
};
