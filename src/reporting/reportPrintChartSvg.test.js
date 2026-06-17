import assert from "node:assert/strict";

import { buildReportPrintChartSvg } from "./reportPrintChartSvg.js";

const groupedLine = buildReportPrintChartSvg({
  chartModel: {
    type: "line",
    series: {
      palette: ["#137cbd", "#0f9960"],
    },
  },
  resolvedChart: {
    kind: "groupedSeries",
    type: "line",
    xAxisKey: "eventDate",
    seriesKeys: ["Display", "CTV"],
    rows: [
      { eventDate: "2026-05-01", Display: 40400, CTV: 34300 },
      { eventDate: "2026-05-02", Display: 42000, CTV: 35500 },
    ],
  },
  width: 640,
});

assert.equal(groupedLine.diagnostics.length, 0);
assert.ok(groupedLine.height > 200);
assert.match(groupedLine.svg, /<svg/);
assert.match(groupedLine.svg, /<path d="M/);
assert.match(groupedLine.svg, /Display/);
assert.match(groupedLine.svg, /CTV/);

const directBar = buildReportPrintChartSvg({
  chartModel: {
    type: "bar",
    series: {
      values: [
        { value: "totalSpend", label: "Spend", color: "#137cbd", type: "bar" },
        { value: "impressions", label: "Impressions", color: "#d9822b", type: "bar" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "bar",
    xAxisKey: "eventDate",
    seriesKeys: ["totalSpend", "impressions"],
    rows: [
      { eventDate: "2026-05-01", totalSpend: 74700, impressions: 31200 },
      { eventDate: "2026-05-02", totalSpend: 81000, impressions: 33000 },
    ],
  },
  width: 640,
});

assert.equal(directBar.diagnostics.length, 0);
assert.match(directBar.svg, /<rect/);
assert.match(directBar.svg, /Spend/);
assert.match(directBar.svg, /Impressions/);

const horizontalBar = buildReportPrintChartSvg({
  chartModel: {
    type: "horizontal_bar",
    series: {
      values: [
        { value: "avails", label: "Available Impressions", color: "#137cbd", type: "horizontal_bar" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "horizontal_bar",
    xAxisKey: "channelV2",
    seriesKeys: ["avails"],
    rows: [
      { channelV2: "Display", avails: 158400 },
      { channelV2: "CTV", avails: 138200 },
    ],
  },
  width: 640,
});

assert.equal(horizontalBar.diagnostics.length, 0);
assert.ok(horizontalBar.height > 120);
assert.match(horizontalBar.svg, /<rect/);
assert.match(horizontalBar.svg, /Display/);
assert.match(horizontalBar.svg, /CTV/);
assert.match(horizontalBar.svg, /158.4K/);
assert.match(horizontalBar.svg, /Available Impressions/);

const donut = buildReportPrintChartSvg({
  chartModel: {
    type: "donut",
    series: {
      palette: ["#137cbd", "#0f9960"],
    },
  },
  resolvedChart: {
    kind: "category",
    type: "donut",
    seriesKeys: ["Display", "CTV"],
    rows: [
      { name: "Display", value: 40400 },
      { name: "CTV", value: 34300 },
    ],
  },
  width: 640,
});

assert.equal(donut.diagnostics.length, 0);
assert.match(donut.svg, /<circle/);
assert.match(donut.svg, /Display/);
assert.match(donut.svg, /CTV/);

const unsupported = buildReportPrintChartSvg({
  chartModel: {
    type: "radar",
    series: {
      values: [{ value: "totalSpend", label: "Spend", type: "radar" }],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "radar",
    xAxisKey: "eventDate",
    seriesKeys: ["totalSpend"],
    rows: [
      { eventDate: "2026-05-01", totalSpend: 40400 },
    ],
  },
});

assert.equal(unsupported.svg, "");
assert.deepEqual(unsupported.diagnostics, [
  {
    code: "unsupportedReportPrintChartType",
    severity: "warning",
    message: "ReportPrint chart lowering does not yet support series types: radar.",
  },
]);

console.log("reportPrintChartSvg ✓ lowers grouped, direct, and category chart payloads into deterministic SVG output");
