import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: { width: 1280, height: 1000 },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "eval",
      expression: `(() => {
        const mount = document.createElement('div');
        mount.id = 'runtime-stabilization-proof';
        mount.style.cssText = 'padding:20px;background:#f5f8fc;';
        document.body.replaceChildren(mount);
        return import('/src/demos/reportBuilder/runtimeStabilizationProof.js').then(({ mountRuntimeStabilizationProof }) => {
          window.__unmountRuntimeStabilizationProof = mountRuntimeStabilizationProof(mount);
          return true;
        });
      })()`,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const root = document.querySelector('#runtime-stabilization-proof');
        const text = root?.innerText || root?.textContent || '';
        const chart = root?.querySelector('.forge-report-runtime-chart-panel');
        const table = root?.querySelector('.forge-report-runtime-table-panel');
        const chartBars = Array.from(chart?.querySelectorAll('.recharts-bar-rectangle path, .recharts-bar-rectangle rect') || []).map((node) => node.getBBox().width);
        const categoricalPanel = Array.from(root?.querySelectorAll('.forge-report-runtime-chart-panel') || []).find((entry) => (entry.innerText || entry.textContent || '').includes('Categorical distribution'));
        const categoricalTicks = Array.from(categoricalPanel?.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick text') || []);
        const categoricalTitle = Array.from(categoricalPanel?.querySelectorAll('.recharts-label') || []).find((node) => (node.textContent || '').trim() === 'Exposure Device');
        const categoricalTitleBox = categoricalTitle?.getBoundingClientRect();
        const forbiddenStarters = ['Table', 'Avails by Date', 'Headline KPI', 'Delivery Comparison'];
        return text.includes('Saved KPI') && text.includes('800')
          && forbiddenStarters.every((title) => !text.includes(title))
          && !text.includes('Report refresh unavailable')
          && !text.includes('could not be refreshed for the current authorized scope')
          && !text.includes('internal named dataset refresh failure')
          && chart?.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick').length === 4
          && Math.max(0, ...chartBars) >= 300
          && categoricalTicks.length === 4 && categoricalTitleBox
          && categoricalTicks.every((tick) => tick.getBoundingClientRect().bottom <= categoricalTitleBox.top - 4)
          && table?.querySelectorAll('.forge-dashboard-table tbody tr').length === 8;
      })()`,
      timeoutMs: 60000,
    },
    { type: "screenshot", file: "populated-diagnostics-desktop.png", fullPage: true },
    { type: "setViewport", width: 390, height: 844 },
    { type: "wait", ms: 750 },
    {
      type: "waitForEval",
      expression: `(() => {
        const root = document.querySelector('#runtime-stabilization-proof');
        const panel = root?.querySelector('.forge-report-runtime-table-panel');
        const scroller = panel?.querySelector('.forge-dashboard-table-wrap[data-horizontal-scroll="true"]');
        const hint = panel?.querySelector('.forge-dashboard-table-scroll-hint');
        const widths = Array.from(scroller?.querySelectorAll('th') || []).map((cell) => cell.getBoundingClientRect().width);
        const categoricalPanel = Array.from(root?.querySelectorAll('.forge-report-runtime-chart-panel') || []).find((entry) => (entry.innerText || entry.textContent || '').includes('Categorical distribution'));
        const categoricalGrid = categoricalPanel?.querySelector('.recharts-cartesian-grid');
        const geoPanel = root?.querySelector('.forge-report-runtime-geo-panel');
        const geoLayout = geoPanel?.querySelector('.forge-report-runtime-geo-layout');
        const geoTiles = geoPanel?.querySelector('.forge-report-runtime-geo-tiles');
        const geoPanelRect = geoPanel?.getBoundingClientRect();
        const geoLayoutRect = geoLayout?.getBoundingClientRect();
        const geoTilesRect = geoTiles?.getBoundingClientRect();
        const linePanels = Array.from(root?.querySelectorAll('.forge-report-runtime-chart-panel') || []).filter((entry) => (entry.innerText || entry.textContent || '').includes('daily trend'));
        const lineGeometryValid = linePanels.length === 2 && linePanels.every((linePanel, index) => {
          const ticks = Array.from(linePanel.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick text'));
          const boxes = ticks.map((node) => node.getBoundingClientRect()).sort((a, b) => a.left - b.left);
          const title = Array.from(linePanel.querySelectorAll('.recharts-label')).find((node) => (node.textContent || '').trim() === 'Report Date');
          const titleBox = title?.getBoundingClientRect();
          const ticksSeparate = boxes.every((box, tickIndex) => tickIndex === 0 || box.left >= boxes[tickIndex - 1].right - 1);
          const curves = linePanel.querySelectorAll('.recharts-line-curve').length;
          return ticks.length >= 2 && ticks.length <= 3 && ticksSeparate && titleBox
            && boxes.every((box) => box.bottom <= titleBox.top - 4)
            && curves === (index === 0 ? 1 : 2);
        });
        const donutPanel = Array.from(root?.querySelectorAll('.forge-report-runtime-chart-panel') || []).find((entry) => (entry.innerText || entry.textContent || '').includes('Channel contribution'));
        const donutLegend = donutPanel?.querySelector('.recharts-legend-wrapper');
        const donutSectors = Array.from(donutPanel?.querySelectorAll('.recharts-pie-sector') || []).map((node) => node.getBoundingClientRect());
        const donutLegendBox = donutLegend?.getBoundingClientRect();
        const donutText = donutLegend?.innerText || donutLegend?.textContent || '';
        const donutGeometryValid = donutSectors.length === 8 && donutLegendBox
          && Math.max(...donutSectors.map((box) => box.bottom)) <= donutLegendBox.top - 4
          && donutText.includes('Category 1') && donutText.includes('Category 8')
          && donutLegendBox.left >= donutPanel.getBoundingClientRect().left
          && donutLegendBox.right <= donutPanel.getBoundingClientRect().right;
        return !!scroller
          && scroller.getAttribute('role') === 'region'
          && scroller.getAttribute('aria-label') === 'Scrollable data table'
          && scroller.scrollWidth > scroller.clientWidth + 300
          && widths.length === 8 && widths.every((width) => width >= 112)
          && scroller.querySelectorAll('tbody tr').length === 8
          && hint && getComputedStyle(hint).display !== 'none'
          && (hint.innerText || hint.textContent || '').includes('Scroll horizontally')
          && categoricalPanel?.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick').length === 4
          && categoricalPanel?.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick').length <= 3
          && categoricalGrid?.getBBox().width >= 110
          && geoLayout && getComputedStyle(geoLayout).gridTemplateColumns.split(' ').length === 1
          && geoLayoutRect.right <= geoPanelRect.right + 1
          && geoTilesRect.right <= geoPanelRect.right + 1
          && lineGeometryValid
          && donutGeometryValid
          && !(root?.innerText || '').includes('Report refresh unavailable');
      })()`,
      timeoutMs: 60000,
    },
    { type: "screenshot", file: "populated-table-scroll-390.png", fullPage: true },
  ],
};
