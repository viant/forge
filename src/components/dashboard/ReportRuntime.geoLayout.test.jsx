import assert from "node:assert/strict";
import React from "react";
import {JSDOM} from "jsdom";
import {renderToStaticMarkup} from "react-dom/server";
import ReportRuntime from "./ReportRuntime.jsx";

// Widget sizing must retain the complete map, selected value and ranking.
const syntheticMapRegions = [
  {key: "WA", label: "West sample", rawValue: 11, displayValue: "11", color: "#6699aa"},
  {key: "NY", label: "East sample", rawValue: 7, displayValue: "7", color: "#ddbb88"},
];
const renderSyntheticMap = (resolvedGeo) => renderToStaticMarkup(React.createElement(ReportRuntime, {
  reportSpec: {blocks: [], datasets: []},
  reportFill: {blocks: [{id: "sampleMap", kind: "geoMapBlock", title: "Synthetic regions", content: {resolvedGeo}}], datasets: []},
}));
const syntheticMapHtml = renderSyntheticMap({
  shape: "us-states", metricLabel: "Sample count", regions: syntheticMapRegions,
  ranking: syntheticMapRegions, activeRegion: syntheticMapRegions[0],
  summary: {regionCount: 2, totalValue: "18", topKey: "WA"},
});
assert.match(syntheticMapHtml, /forge-report-runtime-geo-responsive/);
assert.equal((syntheticMapHtml.match(/role="listitem"/g) || []).length, 51);
assert.match(syntheticMapHtml, /West sample \(WA\)/);
const syntheticMapDOM = new JSDOM(syntheticMapHtml).window.document;
assert.ok(syntheticMapDOM.querySelector(".forge-report-runtime-geo-details").textContent.includes("Sample count: 11"));
assert.match(syntheticMapHtml, /Top Regions/);
assert.match(syntheticMapHtml, /East sample \(NY\): 7/);
assert.match(renderSyntheticMap({shape: "us-states", regions: [], ranking: []}), /No geo data\./);
assert.match(renderSyntheticMap({shape: "unsupported", regions: [], ranking: []}), /Unsupported geo shape: unsupported/);

console.log("PASS responsive map content, selection, ranking, empty and unsupported states");
