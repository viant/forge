import assert from "node:assert/strict";
import { buildReportSpecHash } from "./reportFillModel.js";
import { buildReportPrintFromReportFill } from "./reportPrintModel.js";
import { buildReportPrintChartPages } from "./reportPrintChartSvg.js";
import { compactReportPrintSequence } from "./reportPrintLabels.js";

export function buildPairingPrintFixture() {
  const chartModel = { type: "horizontal_bar", series: { values: [{ value: "revenue", label: "Revenue", type: "horizontal_bar" }] } };
  const rows = Array.from({ length: 20 }, (_, i) => ({ pathway: Array(i + 1).fill("Smart Phone (Display)").join(" -> "), revenue: 2000 - i * 80 }));
  const chart = { id: "revenue", kind: "chartBlock", title: "Top pathways", runtime: { visibleWhen: { source: "filters", field: "distribution", equals: "Revenue" } }, content: { chartModel, resolvedChart: { kind: "directSeries", type: "horizontal_bar", xAxisKey: "pathway", seriesKeys: ["revenue"], rows } } };
  const columns = [{ key: "pathway", label: "Pathway", kind: "dimension" }, ...Array.from({ length: 9 }, (_, i) => ({ key: `metric${i}`, label: `Evidence metric ${i}`, kind: "measure" }))];
  const blocks = [
    { id: "intro", kind: "markdownBlock", title: "Overview", content: { markdown: "Summary of the selected reporting window." } },
    { id: "section", kind: "sectionBlock", title: "Conversion Pathways" },
    { ...chart, id: "conversions", title: "Wrong branch", runtime: { visibleWhen: { source: "filters", field: "distribution", equals: "Conversions" } } },
    chart,
    { id: "evidence", kind: "tableBlock", title: "Pathway evidence", content: { columns, resolvedRows: rows.map((row, rowIndex) => ({ rowIndex, cells: columns.map((column, i) => ({ key: column.key, value: i ? row.revenue + i : row.pathway })) })) } },
    { id: "options", kind: "filterBarBlock", title: "Report options", content: { params: [{ id: "distribution", value: "Revenue" }, { id: "legacyView", value: "Device" }] } },
    { id: "hiddenGroup", kind: "compositeBlock", title: "Hidden group", runtime: { visibleWhen: { source: "filters", field: "legacyView", equals: "Channel" } }, content: { childBlockIds: ["hiddenChild"] } },
    { id: "hiddenChild", kind: "markdownBlock", title: "Private child", content: { markdown: "Must not leak" } },
  ];
  const source = { kind: "reportBuilder", containerId: "pairing", stateKey: "pairing", dataSourceRef: "primary" };
  const reportSpec = { version: 1, kind: "reportSpec", title: "MTA print regression", source, scope: { params: [{ id: "distribution", value: "Conversions" }, { id: "legacyView", value: "Device", presentation: "hidden" }] }, blocks, layoutIntent: { blockOrder: blocks.map((block) => block.id) } };
  const reportFill = { version: 1, kind: "reportFill", specVersion: 1, specHash: buildReportSpecHash(reportSpec), source, blocks, datasets: [] };
  return { reportSpec, reportFill };
}

const fixture = buildPairingPrintFixture();
const original = JSON.stringify(fixture);
const result = buildReportPrintFromReportFill(fixture);
assert.ok(result);
assert.equal(JSON.stringify(fixture), original, "printing must not modify canonical inputs");
assert.deepEqual(buildReportPrintFromReportFill(fixture), result, "pagination is deterministic");
const elements = result.pages.flatMap((page) => page.elements);
const text = elements.map((element) => element.text || element.svg || "").join("\n");
assert.doesNotMatch(text, /Wrong branch|legacyView|Private child|Must not leak|Hidden group/);
assert.match(text, /distribution: Revenue/);
assert.match(text, /\[x20\]/);
assert.match(text, /20 touchpoints/);
assert.match(text, /Pathway evidence \(1\/2\)/);
assert.match(text, /Pathway evidence \(2\/2\)/);
for (let i = 0; i < 9; i += 1) assert.match(text, new RegExp(`Evidence metric ${i}`));
for (const page of result.pages) {
  for (const element of page.elements) {
    assert.ok(element.box.y + element.box.height <= 724.01, `${element.id} exceeds printable page bottom`);
    assert.ok(element.box.x + element.box.width <= 576.01, `${element.id} exceeds printable page width`);
  }
  if (page.elements.some((element) => element.id.startsWith("section__title"))) {
    assert.ok(page.elements.some((element) => element.id.startsWith("revenue__svg")), "section and first chart chunk share a page");
  }
  if (page.elements.some((element) => element.id.includes("__header_bg__"))) {
    assert.ok(page.elements.some((element) => element.id.includes("evidence") && element.id.includes("__title")), "table continuation repeats its title");
  }
}
assert.ok(elements.filter((element) => element.id.startsWith("revenue__svg")).length >= 2, "all 20 bars are paginated");
const chart = fixture.reportFill.blocks.find((block) => block.id === "revenue");
const pages = buildReportPrintChartPages({ ...chart.content, width: 540, maxHeight: 500 });
assert.ok(pages.length > 1);
assert.ok(pages.every((page) => page.height <= 500));
assert.equal(pages.reduce((count, page) => count + (page.svg.match(/<rect /g) || []).length - 1, 0), 20, "every source bar is retained once");
assert.ok(pages.every((page) => page.svg.includes('>2K</text>')), "chart chunks share their value axis");
assert.equal(compactReportPrintSequence("A -> A -> B -> A"), "A [x2] -> B -> A (4 touchpoints)");
assert.equal(compactReportPrintSequence("A -> B -> A"), "A -> B -> A");

assert.equal(result.pages.find((page) => page.elements.some((element) => element.id.startsWith("revenue__svg")))?.number, 1, "chart uses the space after a short introduction");
const labelPages = buildReportPrintChartPages({
  chartModel: chart.content.chartModel,
  resolvedChart: { ...chart.content.resolvedChart, rows: [
    { pathway: "Personal Computer | Smart Phone | Tablet", revenue: 2 },
    { pathway: "Personal Computer | Smart Phone | Connected TV", revenue: 1 },
    { pathway: "A very long first member -> A very long second member -> Distinct final touchpoint", revenue: 3 },
  ] },
  width: 540,
});
const labelOutput = labelPages.map((page) => page.svg + (page.labelDetails || []).join("\n")).join("\n");
assert.doesNotMatch(labelOutput, /…/);
assert.match(labelOutput, /Tablet/);
assert.match(labelOutput, /Connected TV/);
assert.match(labelOutput, /Distinct final touchpoint/);
assert.match(labelOutput, /Category 3/);
// Explicit line positions survive the backend's SVG subset, unlike relative dy.
assert.doesNotMatch(labelOutput, /dy=/);

console.log("MTA print pairing regressions passed");
