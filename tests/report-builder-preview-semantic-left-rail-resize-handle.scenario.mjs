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
      type: "waitForEval",
      expression: "(() => { const rail = document.querySelector('.forge-report-builder__left'); const resizer = document.querySelector('.forge-report-builder__left-resizer'); const thumb = document.querySelector('.forge-report-builder__left-resizer-label'); const moveLeft = document.querySelector('.forge-report-builder__left-resizer-step[aria-label=\"Move divider left\"]'); const moveRight = document.querySelector('.forge-report-builder__left-resizer-step[aria-label=\"Move divider right\"]'); return !!rail && !!resizer && !!thumb && !!moveLeft && !!moveRight && /%/.test(thumb.textContent || ''); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const rail = document.querySelector('.forge-report-builder__left'); const moveRight = document.querySelector('.forge-report-builder__left-resizer-step[aria-label=\"Move divider right\"]'); if (!rail || !moveRight) { throw new Error('Left rail move-right control not found.'); } window.__REPORT_BUILDER_LEFT_RAIL_WIDTH_BEFORE_MOVE__ = Math.round(rail.getBoundingClientRect().width); moveRight.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const rail = document.querySelector('.forge-report-builder__left'); const resizer = document.querySelector('.forge-report-builder__left-resizer'); if (!rail || !resizer) { return false; } const before = Number(window.__REPORT_BUILDER_LEFT_RAIL_WIDTH_BEFORE_MOVE__ || 0); const width = Math.round(rail.getBoundingClientRect().width); const valueNow = Number(resizer.getAttribute('aria-valuenow') || 0); return before > 0 && width >= before + 8 && valueNow >= 25; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const rail = document.querySelector('.forge-report-builder__left'); const resizer = document.querySelector('.forge-report-builder__left-resizer'); if (!rail || !resizer) { throw new Error('Left rail resizer not found.'); } const railRect = rail.getBoundingClientRect(); const gripRect = resizer.getBoundingClientRect(); const startX = Math.round(gripRect.left + (gripRect.width / 2)); const nextX = startX + 96; window.__REPORT_BUILDER_LEFT_RAIL_WIDTH_BEFORE_DRAG__ = Math.round(railRect.width); resizer.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: startX, clientY: Math.round(gripRect.top + 20) })); window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, buttons: 1, clientX: nextX, clientY: Math.round(gripRect.top + 20) })); window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: nextX, clientY: Math.round(gripRect.top + 20) })); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const rail = document.querySelector('.forge-report-builder__left'); const resizer = document.querySelector('.forge-report-builder__left-resizer'); const label = document.querySelector('.forge-report-builder__left-resizer-label'); if (!rail || !resizer || !label) { return false; } const before = Number(window.__REPORT_BUILDER_LEFT_RAIL_WIDTH_BEFORE_DRAG__ || 0); const width = Math.round(rail.getBoundingClientRect().width); const valueNow = Number(resizer.getAttribute('aria-valuenow') || 0); return before > 0 && width >= before + 24 && valueNow >= 26 && /%/.test(label.textContent || ''); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-left-rail-resize-handle.png",
      fullPage: true,
    },
  ],
};
