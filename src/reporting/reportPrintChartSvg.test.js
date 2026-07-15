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

const labeledDirectBar = buildReportPrintChartSvg({
  chartModel: {
    type: "bar",
    series: {
      values: [
        { value: "totalSpend", label: "Spend", color: "#137cbd", type: "bar", dataLabels: "always" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "bar",
    xAxisKey: "eventDate",
    seriesKeys: ["totalSpend"],
    rows: [
      { eventDate: "2026-05-01", totalSpend: 74700 },
      { eventDate: "2026-05-02", totalSpend: 81000 },
    ],
  },
  width: 640,
});

assert.equal(labeledDirectBar.diagnostics.length, 0);
assert.match(labeledDirectBar.svg, />74,700</);
assert.match(labeledDirectBar.svg, />81,000</);

const signColoredDirectBar = buildReportPrintChartSvg({
  chartModel: {
    type: "bar",
    series: {
      values: [
        { value: "delta", label: "Delta", color: "#137cbd", type: "bar", pointColorMode: "bySign" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "bar",
    xAxisKey: "eventDate",
    seriesKeys: ["delta"],
    rows: [
      { eventDate: "2026-05-01", delta: -3 },
      { eventDate: "2026-05-02", delta: 5 },
    ],
  },
  width: 640,
});

assert.equal(signColoredDirectBar.diagnostics.length, 0);
assert.match(signColoredDirectBar.svg, /fill="#db3737"/);
assert.match(signColoredDirectBar.svg, /fill="#0f9960"/);

const horizontalBar = buildReportPrintChartSvg({
  chartModel: {
    type: "horizontal_bar",
    series: {
      values: [
        { value: "avails", label: "Available Impressions", color: "#137cbd", type: "horizontal_bar", format: "compactNumber" },
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
assert.match(horizontalBar.svg, /158 400/);
assert.match(horizontalBar.svg, /Available Impressions/);

const hiddenHorizontalLabels = buildReportPrintChartSvg({
  chartModel: {
    type: "horizontal_bar",
    series: {
      values: [
        { value: "avails", label: "Available Impressions", color: "#137cbd", type: "horizontal_bar", format: "compactNumber", dataLabels: "none" },
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

assert.equal(hiddenHorizontalLabels.diagnostics.length, 0);
assert.doesNotMatch(hiddenHorizontalLabels.svg, /158 400/);

const funnelBar = buildReportPrintChartSvg({
  chartModel: {
    type: "funnel_bar",
    series: {
      values: [
        { value: "avails", label: "Available Impressions", color: "#137cbd", type: "funnel_bar", format: "compactNumber" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "funnel_bar",
    xAxisKey: "channelV2",
    seriesKeys: ["avails"],
    rows: [
      { channelV2: "Display", avails: 158400 },
      { channelV2: "CTV", avails: 138200 },
    ],
  },
  width: 640,
});

assert.equal(funnelBar.diagnostics.length, 0);
assert.ok(funnelBar.height > 120);
assert.match(funnelBar.svg, /<rect/);
assert.match(funnelBar.svg, /Display/);
assert.match(funnelBar.svg, /CTV/);
assert.match(funnelBar.svg, /158.4K/);
assert.match(funnelBar.svg, /158 400/);
assert.match(funnelBar.svg, /Available Impressions/);

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
assert.match(donut.svg, /<path d="M/);
assert.doesNotMatch(donut.svg, /\sA[0-9.,\s-]/);
assert.match(donut.svg, /Display/);
assert.match(donut.svg, /CTV/);

const annotatedCartesian = buildReportPrintChartSvg({
  chartModel: {
    type: "line",
    annotations: {
      verticalMarkers: [
        { value: "2026-05-02", label: "Launch", color: "#d9822b", lineStyle: "dashed" },
      ],
      referenceLines: [
        { axis: "y", value: 38000, label: "Goal", color: "#7a46d8" },
      ],
      bands: [
        { axis: "x", from: "2026-05-01", to: "2026-05-02", label: "Window", color: "#137cbd", opacity: 0.18 },
      ],
      notes: [
        { x: "2026-05-02", y: 35500, label: "Peak", color: "#0f9960" },
      ],
    },
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

assert.equal(annotatedCartesian.diagnostics.length, 0);
assert.match(annotatedCartesian.svg, /Launch/);
assert.match(annotatedCartesian.svg, /Goal/);
assert.match(annotatedCartesian.svg, /Window/);
assert.match(annotatedCartesian.svg, /Peak/);
assert.match(annotatedCartesian.svg, /stroke-dasharray="6 4"/);
assert.match(annotatedCartesian.svg, /fill-opacity="0.18"/);
assert.match(annotatedCartesian.svg, /<circle/);

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
