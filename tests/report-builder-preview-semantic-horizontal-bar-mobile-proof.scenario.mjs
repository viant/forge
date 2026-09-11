import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: { width: 1280, height: 900 },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "eval",
      expression: `(() => {
        const preview = window.__REPORT_BUILDER_PREVIEW__;
        if (!preview?.patchBuilderState || !preview?.replaceCollectionRows) throw new Error('Preview APIs are unavailable.');
        preview.patchBuilderState({
          selectedDimensions: ['channelV2'],
          selectedMeasures: ['avails'],
          primaryMeasure: 'avails',
          viewMode: 'chart',
          chartSpec: {
            title: 'Signed delivery by media owner',
            type: 'horizontal_bar',
            xField: 'channelV2',
            yFields: ['avails'],
            categoryLabel: { lines: 2, maxCharacters: 48 }
          }
        });
        return true;
      })()`,
    },
    {
      type: "waitForEval",
      expression: "(() => Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).some((panel) => (panel.innerText || panel.textContent || '').includes('Signed delivery by media owner') && !!panel.querySelector('.recharts-wrapper')))()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => {
        window.__REPORT_BUILDER_PREVIEW__.replaceCollectionRows([
          { channelV2: 'Extended Media Owner Label for Clamp Proof', avails: 920000 },
          { channelV2: 'Regional Transit Screens and Furniture', avails: 610000 },
          { channelV2: 'Negative Adjustment and Reconciliation', avails: -420000 },
          { channelV2: 'Airport and Cinema Publisher Group', avails: 275000 }
        ], { hasMore: false, error: null });
        return true;
      })()`,
    },
    { type: "waitForDomContains", text: "Negative Adjustment", timeoutMs: 60000 },
    { type: "setViewport", width: 390, height: 844 },
    { type: "wait", ms: 1000 },
    {
      type: "eval",
      expression: `(() => {
        const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => (entry.innerText || entry.textContent || '').includes('Signed delivery by media owner'));
        const root = panel?.querySelector('.recharts-wrapper');
        const grid = root?.querySelector('.recharts-cartesian-grid');
        if (!root || !grid) return false;
        const plotWidth = grid.getBBox().width;
        const categoryTicks = Array.from(root.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick text'));
        const numericTicks = Array.from(root.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick text'));
        const bars = Array.from(root.querySelectorAll('.recharts-bar-rectangle path, .recharts-bar-rectangle rect'))
          .map((node) => node.getBBox()).filter((box) => box.width > 0);
        const numericBoxes = numericTicks.map((node) => node.getBoundingClientRect()).sort((a, b) => a.left - b.left);
        const ticksDoNotOverlap = numericBoxes.every((box, index) => index === 0 || box.left >= numericBoxes[index - 1].right - 2);
        const twoLineLabels = categoryTicks.length >= 4 && categoryTicks.every((node) => node.querySelectorAll('tspan').length <= 2);
        const spansBothSides = bars.some((leftBar) => bars.some((rightBar) => (
          leftBar.x < rightBar.x && Math.abs((leftBar.x + leftBar.width) - rightBar.x) <= 3
        )));
        window.__horizontalBarMobileProof = { plotWidth, categoryTickCount: categoryTicks.length, numericTickCount: numericTicks.length, maxBarWidth: Math.max(0, ...bars.map((box) => box.width)), ticksDoNotOverlap, twoLineLabels, spansBothSides };
        const passed = root.getBoundingClientRect().width >= 250 && plotWidth >= 110 && numericTicks.length <= 3 && ticksDoNotOverlap && twoLineLabels && bars.some((box) => box.width >= 45) && spansBothSides;
        if (!passed) throw new Error(JSON.stringify({ ...window.__horizontalBarMobileProof, rootWidth: root.getBoundingClientRect().width, bars: bars.map((box) => ({ x: box.x, width: box.width })) }));
        return true;
      })()`,
    },
    { type: "screenshot", file: "horizontal-bar-mobile-proof.png", fullPage: true },
  ],
};
