import assert from "node:assert/strict";
import {test} from "node:test";
import {buildReportPrintChartPages} from "./reportPrintChartSvg.js";
import {buildReportPrintFromReportFill} from "./reportPrintModel.js";
import {buildReportSpecHash} from "./reportFillModel.js";

const rows = Array.from({length: 10}, (_, index) => ({
  category: `Specimen ${index + 1}`,
  amount: (index % 3 === 0 ? -1 : 1) * (index + 1) * 10,
}));
const chartModel = {
  type: "horizontal_bar", preserveCategoryOrder: true,
  series: {values: [{value: "amount", label: "Change", type: "horizontal_bar", dataLabels: "none", pointColorMode: "bySign"}]},
};
const resolvedChart = {kind: "directSeries", type: "horizontal_bar", xAxisKey: "category", seriesKeys: ["amount"], rows};
const input = {chartModel, resolvedChart, width: 540, maxHeight: 620};
const barCount = page => (page.svg.match(/class="forge-chart-bar"/g) || []).length;

for (const [firstMaxHeight, formerSplit] of [[364, [9, 1]], [172, [3, 7]]]) {
  test(`a ten-category chart avoids a ${formerSplit.join("+")} orphan split`, () => {
    const before = JSON.stringify(input);
    const pages = buildReportPrintChartPages({...input, firstMaxHeight});
    assert.equal(pages.length, 1, "The complete chart fits on a fresh page");
    assert.equal(pages[0].startNewPage, true);
    assert.equal(pages[0].sourceRowOffset, 0);
    assert.equal(pages[0].sourceRowCount, 10);
    assert.equal(barCount(pages[0]), 10);
    assert.ok(pages[0].height <= input.maxHeight);
    for (const row of rows) assert.ok(pages[0].svg.includes(row.category));
    assert.deepEqual(pages[0].sourceValueBounds, {minValue: -100, maxValue: 90});
    assert.equal(JSON.stringify(input), before, "Rows, order, values and styles remain unchanged");
  });
}

test("a chart that fits the remaining height stays on the current page", () => {
  const [page] = buildReportPrintChartPages({...input, firstMaxHeight: 396});
  assert.equal(page.startNewPage, undefined);
  assert.equal(page.sourceRowCount, 10);
  assert.equal(barCount(page), 10);
});

test("a chart taller than a full page still paginates without losing categories", () => {
  const pages = buildReportPrintChartPages({...input, maxHeight: 395, firstMaxHeight: 172});
  assert.ok(pages.length > 1);
  assert.equal(pages[0].startNewPage, undefined);
  let offset = 0;
  for (const page of pages) {
    assert.equal(page.sourceRowOffset, offset);
    assert.equal(barCount(page), page.sourceRowCount);
    assert.ok(page.height <= 395);
    assert.deepEqual(page.sourceValueBounds, {minValue: -100, maxValue: 90});
    offset += page.sourceRowCount;
  }
  assert.equal(offset, 10);
});

test("multiple series include the complete wrapped legend in the page-fit boundary", () => {
  const multiple = {
    ...input, width: 270, maxHeight: 2000, firstMaxHeight: 2000,
    chartModel: {...chartModel, series: {values: [
      {...chartModel.series.values[0], label: "Observed change with complete measurement context"},
      {value: "reference", label: "Reference change with complete measurement context", type: "horizontal_bar"},
    ]}},
    resolvedChart: {...resolvedChart, seriesKeys: ["amount", "reference"], rows: rows.map(row => ({...row, reference: 20}))},
  };
  const [complete] = buildReportPrintChartPages(multiple);
  const moved = buildReportPrintChartPages({...multiple, maxHeight: complete.height, firstMaxHeight: complete.height - 1});
  assert.equal(moved.length, 1);
  assert.equal(moved[0].startNewPage, true);
  assert.equal(moved[0].height, complete.height);
  assert.equal(barCount(moved[0]), 20);
  assert.equal(moved[0].svg, complete.svg, "The whole legend and both series survive the page move");
  const oversized = buildReportPrintChartPages({...multiple, maxHeight: complete.height - 1, firstMaxHeight: complete.height - 1});
  assert.ok(oversized.length > 1);
  assert.equal(oversized.reduce((sum, page) => sum + page.sourceRowCount, 0), 10);
  assert.equal(oversized.reduce((sum, page) => sum + barCount(page), 0), 20);
});

test("ReportPrint places a complete chart after occupied page space", () => {
  const blocks = [
    {id: "preceding", kind: "compositeBlock", runtime: {spacerHeight: 390}, content: {layout: "stack", childBlockIds: []}},
    {id: "comparison", kind: "chartBlock", title: "Specimen changes", content: {chartModel, resolvedChart}},
  ];
  const source = {kind: "reportBuilder", containerId: "specimens", stateKey: "specimens", dataSourceRef: "primary"};
  const reportSpec = {version: 1, kind: "reportSpec", title: "Specimen measurements", source, scope: {params: []}, blocks, layoutIntent: {blockOrder: blocks.map(block => block.id)}};
  const reportFill = {version: 1, kind: "reportFill", specVersion: 1, specHash: buildReportSpecHash(reportSpec), source, blocks, datasets: []};
  const result = buildReportPrintFromReportFill({reportSpec, reportFill});
  const charts = result.pages.flatMap(page => page.elements.filter(element => element.id.startsWith("comparison__svg")).map(element => ({page: page.number, element})));
  assert.equal(charts.length, 1);
  assert.equal(charts[0].page, 2);
  assert.equal(barCount(charts[0].element), 10);
  for (const row of rows) assert.ok(charts[0].element.svg.includes(row.category));
  assert.ok(charts[0].element.box.y + charts[0].element.box.height <= 724.01);
});
