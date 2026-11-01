import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildExplicitReportBuilderChartContainer, normalizeReportBuilderChartSpec } from "../components/dashboard/reportBuilderUtils.js";
import { applyChartMetricSelection } from "../components/chartMetricSelection.js";
import { buildReportBuilderReportSpec } from "./reportSpecModel.js";
import { buildReportBuilderReportDocument, buildReportDocumentChartBlock, lowerReportDocumentToReportSpec } from "./reportDocumentModel.js";
import { buildReportFillFromReportSpec } from "./reportFillModel.js";
import { buildReportPrintFromReportFill } from "./reportPrintModel.js";
import { validateReportSpec, validateReportFill, validateReportPrint } from "./schema/reportSchemas.js";

const fixture = JSON.parse(readFileSync(new URL("../../doc/examples/chart-axis-labels.json", import.meta.url), "utf8"));
const container = { id: "inventory", dataSourceRef: fixture.config.dataSourceRef };
const state = { viewMode: "chart", selectedDimensions: ["item"], selectedMeasures: ["netChange"] };

function assertAxes(block, chartSpec) {
  assert.deepEqual(block.chartSpec.xAxis, chartSpec.xAxis);
  assert.deepEqual(block.chartSpec.yAxis, chartSpec.yAxis);
  assert.equal(block.chartModel.xAxis.label, "Item");
  assert.equal(block.chartModel.xAxis.dataKey, "item");
  assert.deepEqual(block.chartModel.yAxis, { format: "number", label: "Net quantity change" });
  assert.equal(block.chartModel.series.values[0].label, "Quantity added");
  assert.equal(block.chartModel.series.values[0].value, "netChange");
}

for (const type of ["bar", "horizontal_bar", "line", "area"]) {
  const chartSpec = { ...fixture.chartSpec, type };
  const builderSpec = buildReportBuilderReportSpec({ container, config: fixture.config, state: { ...state, chartSpec } });
  const baselineChartSpec = { ...chartSpec };
  delete baselineChartSpec.xAxis;
  delete baselineChartSpec.yAxis;
  const baselineBuilder = buildReportBuilderReportSpec({ container, config: fixture.config, state: { ...state, chartSpec: baselineChartSpec } });
  assert.deepEqual(builderSpec.datasets, baselineBuilder.datasets);
  const authoredBlock = buildReportDocumentChartBlock({ id: "changes", chartSpec, chartModel: { yAxis: { label: "Ignored resolved override" } } });
  assert.equal(authoredBlock.chartModel, undefined);
  const document = buildReportBuilderReportDocument({ container, config: fixture.config, state, additionalBlocks: [authoredBlock] });
  const documentSpec = lowerReportDocumentToReportSpec(JSON.parse(JSON.stringify(document)), { includePrimaryBlocks: false });
  for (const reportSpec of [builderSpec, documentSpec]) {
    assert.deepEqual(validateReportSpec(reportSpec), { valid: true, errors: [] });
    const block = reportSpec.blocks.find(entry => entry.kind === "chartBlock");
    assert.ok(block, `${type} must lower a chart`);
    assertAxes(block, chartSpec);
    const unlabeled = structuredClone(reportSpec);
    const unlabeledBlock = unlabeled.blocks.find(entry => entry.kind === "chartBlock");
    delete unlabeledBlock.chartSpec.xAxis;
    delete unlabeledBlock.chartSpec.yAxis;
    unlabeledBlock.chartModel.xAxis.label = "Stock item";
    delete unlabeledBlock.chartModel.yAxis.label;
    for (const { rows } of fixture.cases) {
      const fill = buildReportFillFromReportSpec(reportSpec, { primary: { rows } });
      assert.deepEqual(validateReportFill(fill), { valid: true, errors: [] });
      const filled = fill.blocks.find(entry => entry.id === block.id);
      assertAxes(filled.content, chartSpec);
      assert.deepEqual(fill.datasets[0].rows, rows);
      const baseline = buildReportFillFromReportSpec(unlabeled, { primary: { rows } });
      assert.deepEqual(filled.content.resolvedChart, baseline.blocks.find(entry => entry.id === block.id).content.resolvedChart);
      const print = buildReportPrintFromReportFill({ reportSpec, reportFill: fill });
      assert.deepEqual(validateReportPrint(print), { valid: true, errors: [] });
      assert.ok(print.pages.length > 0);
    }
    for (const axis of ["xAxis", "yAxis"]) {
      for (const invalid of [null, 5, [], "Title", { label: 5 }, { label: {} }, { label: "Title", dataKey: "other" }]) {
        const invalidSpec = structuredClone(reportSpec);
        invalidSpec.blocks.find(entry => entry.id === block.id).chartSpec[axis] = invalid;
        assert.equal(validateReportSpec(invalidSpec).valid, false, JSON.stringify(invalid));
      }
    }
  }
}

for (const axis of ["xAxis", "yAxis"]) {
  for (const invalid of [null, 5, [], "Title", { label: 5 }, { label: {} }, { label: true }, { label: "  " }]) {
    const normalized = normalizeReportBuilderChartSpec({ ...fixture.chartSpec, [axis]: invalid });
    assert.equal(normalized[axis], undefined);
  }
  const normalized = normalizeReportBuilderChartSpec({ ...fixture.chartSpec, [axis]: { label: "  Plain <text>  ", dataKey: "other", format: "currency" } });
  assert.deepEqual(normalized[axis], { label: "Plain <text>" });
}

const noLabels = { ...fixture.chartSpec };
delete noLabels.xAxis;
delete noLabels.yAxis;
const legacy = buildExplicitReportBuilderChartContainer(container, fixture.config, state, noLabels).chart;
assert.equal(legacy.xAxis.label, "Stock item");
assert.deepEqual(legacy.yAxis, { format: "number" });
const grouped = buildExplicitReportBuilderChartContainer(container, { ...fixture.config, dimensions: [...fixture.config.dimensions, { id: "location", key: "location" }] }, state, { ...fixture.chartSpec, type: "bar", seriesField: "location" }).chart;
assert.equal(grouped.xAxis.label, "Item");
assert.equal(grouped.yAxis.label, "Net quantity change");
assert.equal(grouped.series.nameKey, "location");

for (const type of ["bar", "horizontal_bar"]) {
  const metricConfig = { ...fixture.config, measures: [...fixture.config.measures, { id: "adjustment", key: "adjustment", label: "Adjustment", format: "compactNumber" }] };
  const selected = buildExplicitReportBuilderChartContainer(container, metricConfig, state, {
    ...fixture.chartSpec,
    type,
    yFields: ["netChange", "adjustment"],
    metricSelection: { primaryField: "netChange", secondaryField: "" },
  }).chart;
  assert.equal(selected.axes.left.label, "Net quantity change");
  const switched = applyChartMetricSelection(selected, { primaryField: "adjustment", secondaryField: "" });
  assert.deepEqual(switched.axes.left, { format: "compactNumber", label: "Net quantity change" });
  assert.equal(switched.series.values[0].label, "Adjustment");
  const defaultSelection = buildExplicitReportBuilderChartContainer(container, metricConfig, state, {
    ...noLabels,
    type,
    yFields: ["netChange", "adjustment"],
    metricSelection: { primaryField: "netChange", secondaryField: "" },
  }).chart;
  assert.equal(defaultSelection.axes.left.label, "Quantity added");
  assert.equal(applyChartMetricSelection(defaultSelection, { primaryField: "adjustment", secondaryField: "" }).axes.left.label, "Adjustment");
}

const dualMetricConfig = { ...fixture.config, measures: [...fixture.config.measures, { id: "adjustment", key: "adjustment", label: "Adjustment", format: "compactNumber" }] };
const dualMetricChart = buildExplicitReportBuilderChartContainer(container, dualMetricConfig, state, {
  ...fixture.chartSpec,
  type: "line",
  yFields: ["netChange", "adjustment"],
  metricSelection: { primaryField: "netChange", secondaryField: "adjustment" },
}).chart;
assert.deepEqual(dualMetricChart.axes, { left: { format: "number", label: "Net quantity change" }, right: { format: "compactNumber", label: "Adjustment" } });
const dualMetricSwitched = applyChartMetricSelection(dualMetricChart, { primaryField: "adjustment", secondaryField: "netChange" });
assert.deepEqual(dualMetricSwitched.axes, { left: { format: "compactNumber", label: "Net quantity change" }, right: { format: "number", label: "Quantity added" } });

console.log("reportChartAxisLabels ✓ authored builder/document labels, unchanged values, defaults and safe strings");
