import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

const assertClosed = `(() => {
  const root = document.querySelector('.forge-report-builder');
  const center = root?.querySelector('.forge-report-builder__center');
  return root?.querySelectorAll('[data-report-filter-surface="true"]').length === 0
    && root?.querySelectorAll('.forge-report-runtime-filter-control').length === 0
    && !!root?.classList.contains('forge-report-builder--workspace-report')
    && center?.getBoundingClientRect().width >= root?.getBoundingClientRect().width * 0.94;
})()`;

const assertPlacement = (placement, className = "") => `(() => {
  const root = document.querySelector('.forge-report-builder');
  const surfaces = Array.from(root?.querySelectorAll('[data-report-filter-surface="true"]') || []);
  const surfaceRect = surfaces[0]?.getBoundingClientRect();
  const centerRect = root?.querySelector('.forge-report-builder__center')?.getBoundingClientRect();
  const containedControls = Array.from(surfaces[0]?.querySelectorAll('button, input, select') || []).every((control) => {
    const rect = control.getBoundingClientRect();
    return rect.left >= surfaceRect.left - 1 && rect.right <= surfaceRect.right + 1;
  });
  const railBoundaryIsClean = '${placement}' === 'top' || window.innerWidth <= 980 || (
    root?.querySelectorAll('.forge-report-builder__filter-rail-close').length === 1
    && root?.querySelectorAll('.forge-report-builder__left-resizer-dock, .forge-report-builder__left-resizer-thumb').length === 0
    && surfaceRect.width >= 238 && surfaceRect.width <= 322
  );
  const surfacesDoNotOverlap = '${placement}' === 'left'
    ? surfaceRect.right <= centerRect.left + 2
    : ('${placement}' === 'right' ? centerRect.right <= surfaceRect.left + 2 : surfaceRect.bottom <= centerRect.bottom);
  return surfaces.length === 1
    && surfaces[0].getAttribute('data-report-filter-surface-placement') === '${placement}'
    && root?.querySelectorAll('.forge-report-runtime-filter-control').length === 0
    && containedControls && railBoundaryIsClean && surfacesDoNotOverlap
    ${className ? `&& !!root?.classList.contains('${className}')` : ""};
})()`;

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: { width: 1280, height: 900 },
  steps: [
    ...buildPreviewBootstrapSteps(),
    { type: "eval", expression: "window.__REPORT_BUILDER_PREVIEW__.patchBuilderConfig({ filterPresentation: 'left' })" },
    { type: "waitForEval", expression: assertClosed, timeoutMs: 60000 },
    { type: "clickRole", role: "button", name: "Open report filters and options" },
    { type: "waitForEval", expression: assertPlacement("left", "forge-report-builder--filters-left"), timeoutMs: 60000 },
    { type: "screenshot", file: "filter-surface-left.png", fullPage: true },
    { type: "clickRole", role: "button", name: "Close report filters and options" },
    { type: "waitForEval", expression: assertClosed, timeoutMs: 60000 },

    { type: "eval", expression: "window.__REPORT_BUILDER_PREVIEW__.patchBuilderConfig({ filterPresentation: 'right' })" },
    { type: "clickRole", role: "button", name: "Open report filters and options" },
    { type: "waitForEval", expression: assertPlacement("right", "forge-report-builder--filters-right"), timeoutMs: 60000 },
    { type: "screenshot", file: "filter-surface-right.png", fullPage: true },
    { type: "clickRole", role: "button", name: "Close report filters and options" },
    { type: "waitForEval", expression: assertClosed, timeoutMs: 60000 },

    { type: "eval", expression: "window.__REPORT_BUILDER_PREVIEW__.patchBuilderConfig({ filterPresentation: 'top' })" },
    { type: "clickRole", role: "button", name: "Open report filters and options" },
    { type: "waitForEval", expression: assertPlacement("top"), timeoutMs: 60000 },
    { type: "screenshot", file: "filter-surface-top.png", fullPage: true },
    { type: "clickRole", role: "button", name: "Close report filters and options" },
    { type: "waitForEval", expression: assertClosed, timeoutMs: 60000 },

    { type: "setViewport", width: 390, height: 844 },
    { type: "wait", ms: 500 },
    { type: "clickRole", role: "button", name: "Filters", exact: true },
    { type: "waitForEval", expression: assertPlacement("top"), timeoutMs: 60000 },
    { type: "screenshot", file: "filter-surface-compact-open.png", fullPage: true },
    { type: "clickRole", role: "button", name: "Done", exact: true },
    { type: "waitForEval", expression: "(() => { const root = document.querySelector('.forge-report-builder'); return root?.querySelectorAll('[data-report-filter-surface=\"true\"]').length === 0 && root?.querySelectorAll('.forge-report-runtime-filter-control').length === 0; })()", timeoutMs: 60000 },
    { type: "screenshot", file: "filter-surface-placements-compact-closed.png", fullPage: true },
  ],
};
