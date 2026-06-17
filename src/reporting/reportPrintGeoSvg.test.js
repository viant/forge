import assert from "node:assert/strict";

import { buildReportPrintGeoSvg } from "./reportPrintGeoSvg.js";

const supported = buildReportPrintGeoSvg({
  resolvedGeo: {
    shape: "us-states",
    metricLabel: "Spend",
    summary: {
      regionCount: 2,
      totalValue: "$220",
      topKey: "CA",
    },
    regions: [
      {
        key: "CA",
        label: "California",
        rawValue: 140,
        displayValue: "$140",
        color: "#db3737",
        statusColor: "#db3737",
        statusLabel: "Critical",
        rowCount: 2,
      },
      {
        key: "WA",
        label: "Washington",
        rawValue: 80,
        displayValue: "$80",
        color: "#d9f0ea",
        statusColor: "",
        statusLabel: "",
        rowCount: 1,
      },
    ],
    ranking: [
      {
        key: "CA",
        label: "California",
        rawValue: 140,
        displayValue: "$140",
        color: "#db3737",
        statusColor: "#db3737",
        statusLabel: "Critical",
        rowCount: 2,
      },
      {
        key: "WA",
        label: "Washington",
        rawValue: 80,
        displayValue: "$80",
        color: "#d9f0ea",
        statusColor: "",
        statusLabel: "",
        rowCount: 1,
      },
    ],
    activeRegion: {
      key: "CA",
      label: "California",
      rawValue: 140,
      displayValue: "$140",
      color: "#db3737",
      statusColor: "#db3737",
      statusLabel: "Critical",
      rowCount: 2,
    },
    legend: {
      rules: [
        {
          color: "#db3737",
          label: "Critical",
        },
      ],
    },
  },
  width: 640,
});

assert.equal(supported.diagnostics.length, 0);
assert.ok(supported.height > 150);
assert.match(supported.svg, /<svg/);
assert.match(supported.svg, /California/);
assert.match(supported.svg, /Critical/);
assert.match(supported.svg, /Top Regions/);
assert.match(supported.svg, />CA</);
assert.match(supported.svg, />WA</);

const unsupportedShape = buildReportPrintGeoSvg({
  resolvedGeo: {
    shape: "world",
    regions: [{ key: "US", label: "United States", rawValue: 1, displayValue: "1", color: "#2563eb" }],
  },
});

assert.equal(unsupportedShape.svg, "");
assert.deepEqual(unsupportedShape.diagnostics, [
  {
    code: "unsupportedReportPrintGeoShape",
    severity: "warning",
    message: "ReportPrint geo lowering does not support shape world.",
  },
]);

console.log("reportPrintGeoSvg ✓ lowers resolved geo payloads into deterministic SVG output");
