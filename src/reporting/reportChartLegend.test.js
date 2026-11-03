import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeReportBuilderChartSpec } from "../components/dashboard/reportBuilderUtils.js";
import { buildReportBuilderReportSpec } from "./reportSpecModel.js";
import { buildReportBuilderReportDocument, buildReportDocumentChartBlock, lowerReportDocumentToReportSpec } from "./reportDocumentModel.js";
import { buildReportFillFromReportSpec } from "./reportFillModel.js";
import { buildReportPrintChartPages } from "./reportPrintChartSvg.js";
import { validateReportSpec, validateReportFill } from "./schema/reportSchemas.js";

// Independent inventory rows exercise authored lowering, serialization and print.
const fixture = JSON.parse(readFileSync(new URL("../../doc/examples/chart-axis-labels.json", import.meta.url)));
const config = structuredClone(fixture.config);
config.result.supportedChartTypes.push("pie", "donut");
const container = {id: "inventory", dataSourceRef: config.dataSourceRef};
const rows = [{item: "Bracket", netChange: 7}, {item: "Washer", netChange: 4}];

for (const type of ["bar", "horizontal_bar", "line", "area", "pie", "donut"]) {
  let defaultSVG;
  for (const showLegend of [undefined, true, false]) {
    const chartSpec = {type, xField: "item", yFields: ["netChange"], ...(showLegend === undefined ? {} : {showLegend})};
    const spec = JSON.parse(JSON.stringify(buildReportBuilderReportSpec({container, config,
      state: {viewMode: "chart", selectedDimensions: ["item"], selectedMeasures: ["netChange"], chartSpec}})));
    assert.deepEqual(validateReportSpec(spec), {valid: true, errors: []});
    const block = spec.blocks.find(entry => entry.kind === "chartBlock");
    assert.equal(block.chartSpec.showLegend, showLegend);
    assert.equal(block.chartModel.showLegend, showLegend);
    const fill = JSON.parse(JSON.stringify(buildReportFillFromReportSpec(spec, {primary: {rows}})));
    assert.deepEqual(validateReportFill(fill), {valid: true, errors: []});
    const content = fill.blocks.find(entry => entry.id === block.id).content;
    assert.equal(content.chartModel.showLegend, showLegend);
    assert.deepEqual(fill.datasets[0].rows, rows);
    const pages = buildReportPrintChartPages({...content, width: 320, maxHeight: 280});
    const svg = pages.map(page => page.svg).join("");
    if (showLegend === undefined) defaultSVG = svg;
    if (showLegend === true) assert.equal(svg, defaultSVG, `${type} true preserves the default`);
    // Category legends identify slices; cartesian legends identify series.
    const legendText = ["pie", "donut"].includes(type) ? "Bracket" : "Quantity added";
    assert.equal(svg.includes(legendText), showLegend !== false, `${type} legend visibility`);
    for (const invalid of [null, "false", 0, {}]) {
      assert.throws(() => normalizeReportBuilderChartSpec({...chartSpec, showLegend: invalid}), /showLegend must be boolean/);
      const invalidSpec = structuredClone(spec);
      invalidSpec.blocks.find(entry => entry.id === block.id).chartSpec.showLegend = invalid;
      assert.equal(validateReportSpec(invalidSpec).valid, false);
    }
  }
}
for (const showLegend of [true, false]) {
  const block = buildReportDocumentChartBlock({id: "inventoryChart", chartSpec: {type: "bar", xField: "item", yFields: ["netChange"], showLegend}});
  const document = buildReportBuilderReportDocument({container, config,
    state: {viewMode: "chart", selectedDimensions: ["item"], selectedMeasures: ["netChange"]}, additionalBlocks: [block]});
  const spec = lowerReportDocumentToReportSpec(JSON.parse(JSON.stringify(document)), {includePrimaryBlocks: false});
  assert.deepEqual(validateReportSpec(spec), {valid: true, errors: []});
  assert.equal(spec.blocks.find(entry => entry.id === "inventoryChart").chartModel.showLegend, showLegend);
  const fill = JSON.parse(JSON.stringify(buildReportFillFromReportSpec(spec, {primary: {rows}})));
  assert.deepEqual(validateReportFill(fill), {valid: true, errors: []});
  assert.equal(fill.blocks.find(entry => entry.id === "inventoryChart").content.chartModel.showLegend, showLegend);
}
console.log("Authored chart legend defaults, booleans, serialized fill and print passed.");
