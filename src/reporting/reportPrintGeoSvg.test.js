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
    shape: "unsupported",
    regions: [{ key: "US", label: "United States", rawValue: 1, displayValue: "1", color: "#2563eb" }],
  },
});

assert.equal(unsupportedShape.svg, "");
assert.deepEqual(unsupportedShape.diagnostics, [
  {
    code: "unsupportedReportPrintGeoShape",
    severity: "warning",
    message: "ReportPrint geo lowering does not support shape unsupported.",
  },
]);

const world = buildReportPrintGeoSvg({resolvedGeo:{shape:'world',regions:[{key:'USA',displayValue:'$12',color:'#123456'},{key:'GU',displayValue:'$3',color:'#abcdef'}]}});
assert.deepEqual(world.diagnostics,[]);
assert.match(world.svg, /United States of America: \$12/);
assert.match(world.svg, /Guam: \$3/);
assert.match(world.svg, /<circle/);

// Independently invented facility identifiers and labels exercise paper layout.
const rankingRows = [
  {key: "FACILITY_NORTHWEST_MATERIALS_RECEIVING_ANNEX", label: "North annex", rawValue: 9876543210123, displayValue: "$9,876,543,210,123"},
  {key: "REGION_WITH_A_COMPLETE_UNBROKEN_IDENTIFIER", label: "", rawValue: 7654321098765, displayValue: "$7,654,321,098,765"},
  {key: "EA", label: "Eastern collection and distribution facility", rawValue: 6543210987654, displayValue: "$6,543,210,987,654"},
  {key: "", label: "", rawValue: 5432109876543, displayValue: "$5,432,109,876,543"},
  {key: "SW", label: "Riverbend", rawValue: 4321098765432, displayValue: "$4,321,098,765,432"},
];
const rankingGeo = {shape: "us-states", regions: rankingRows, ranking: rankingRows};
const beforeRanking = structuredClone(rankingGeo);
for (const largeValues of [true, false]) {
  const rowsForPrint = rankingRows.map((region, index) => ({...region, displayValue: largeValues ? region.displayValue : String(index + 1)}));
  for (const width of [680, 520]) {
    const geoForPrint = {...rankingGeo, regions: rowsForPrint, ranking: rowsForPrint};
    const beforePrint = structuredClone(geoForPrint);
    const printed = buildReportPrintGeoSvg({resolvedGeo: geoForPrint, width});
    assert.deepEqual(geoForPrint, beforePrint, "print layout never mutates UI data");
    assert.match(printed.svg, />Riverbend<\/text>/, "a friendly single-word label stays intact when the panel can fit it");
    const rows = [...printed.svg.matchAll(/(<rect class="forge-geo-ranking-track"[\s\S]*?)(?=<rect class="forge-geo-ranking-track"|<\/svg>)/g)];
    assert.equal(rows.length, 5, "all five ranked rows remain visible");
    let previousBottom = 0;
    let rankingBarWidth;
    for (const [, row] of rows) {
      const texts = [...row.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)<\/text>/g)];
      const tracks = [...row.matchAll(/<rect(?: class="forge-geo-ranking-track")? x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/g)];
      const track = tracks[0].slice(1).map(Number);
      assert.ok(track[0] + track[2] <= width, "bar stays inside SVG");
      rankingBarWidth ??= track[2];
      assert.equal(track[2], rankingBarWidth, "all ranking rows share one value scale");
      const top = Math.min(...texts.map(text => Number(text[2]) - 10), track[1]);
      const bottom = Math.max(...texts.map(text => Number(text[2])), track[1] + 8);
      assert.ok(top >= previousBottom, "ranking rows do not overlap");
      previousBottom = bottom;
      for (const [, x, y, value] of texts) {
        const right = Number(x) + value.length * 10;
        assert.ok(right <= width + .01, `complete text stays in SVG: ${value}`);
        if (Number(y) >= track[1] && Number(y) - 10 < track[1] + 8) {
          assert.ok(right <= track[0] || Number(x) >= track[0] + track[2], "text does not overlap bars");
        }
      }
      assert.ok(bottom < printed.height, "ranking fits declared height");
    }
    const text = rows.map(row => [...row[1].matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(match => match[1]).join("")).join("");
    for (const region of rowsForPrint) {
      assert.ok(text.replace(/\s/g, "").includes((region.label || region.key || "-").replace(/\s/g, "")), "complete labels or key fallbacks remain readable");
      assert.ok(text.replace(/\s/g, "").includes(region.displayValue), "exact values remain complete");
    }
  }
}
assert.deepEqual(rankingGeo, beforeRanking, "print layout never mutates UI data");

console.log("reportPrintGeoSvg ✓ lowers resolved geo payloads with bounded complete ranking labels and values");
