import assert from "node:assert/strict";

import { buildReportFillChartPayload } from "./reportFillChartPayload.js";

const groupedPayload = buildReportFillChartPayload({
  type: "line",
  xAxis: {
    dataKey: "eventDate",
  },
  series: {
    nameKey: "channelId",
    valueKey: "totalSpend",
  },
}, [
  { eventDate: "2026-05-01", channelId: "Display", totalSpend: 40400 },
  { eventDate: "2026-05-01", channelId: "CTV", totalSpend: 34300 },
]);

assert.deepEqual(groupedPayload, {
  kind: "groupedSeries",
  type: "line",
  xAxisKey: "eventDate",
  nameKey: "channelId",
  valueKey: "totalSpend",
  rows: [
    {
      eventDate: "2026-05-01",
      Display: 40400,
      CTV: 34300,
    },
  ],
  seriesKeys: ["Display", "CTV"],
});

const directPayload = buildReportFillChartPayload({
  type: "line",
  xAxis: {
    dataKey: "eventDate",
  },
  series: {
    values: [
      { value: "totalSpend", label: "Spend" },
      { value: "impressions", label: "Impressions" },
    ],
  },
}, [
  { eventDate: "2026-05-01", totalSpend: 40400, impressions: 16500 },
  { eventDate: "2026-05-01", totalSpend: 34300, impressions: 14700 },
]);

assert.deepEqual(directPayload, {
  kind: "directSeries",
  type: "line",
  xAxisKey: "eventDate",
  seriesKeys: ["totalSpend", "impressions"],
  rows: [
    {
      eventDate: "2026-05-01",
      totalSpend: 74700,
      impressions: 31200,
    },
  ],
});

const categoryPayload = buildReportFillChartPayload({
  type: "donut",
  series: {
    nameKey: "channelId",
    valueKey: "totalSpend",
  },
}, [
  { channelId: "Display", totalSpend: 40400 },
  { channelId: "CTV", totalSpend: 34300 },
]);

assert.deepEqual(categoryPayload, {
  kind: "category",
  type: "donut",
  nameKey: "channelId",
  valueKey: "totalSpend",
  rows: [
    { name: "Display", value: 40400 },
    { name: "CTV", value: 34300 },
  ],
  seriesKeys: ["Display", "CTV"],
});

assert.equal(buildReportFillChartPayload({}, []), null);

console.log("reportFillChartPayload ✓ builds grouped, direct, and category chart payloads for ReportFill");
