import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportFillChartPayload} from './reportFillChartPayload.js';
import {buildReportPrintChartSvg} from './reportPrintChartSvg.js';

// Independently invented public fixture shared with the embedded Goja/export test.
const fixture = JSON.parse(readFileSync(new URL('../../backend/reporting/materializer/testdata/empty-chart-report.json', import.meta.url)));
const original = JSON.stringify(fixture);
const fill = buildReportFillFromReportSpec(fixture.reportSpec, fixture.datasets);
assert.deepEqual(fill.blocks[1].content.resolvedChart, {
  kind: 'directSeries', type: 'horizontal_bar', xAxisKey: 'category', seriesKeys: ['amount'], rows: [],
});
assert.equal(fill.blocks[1].content.rowCount, 0);
assert.equal(fill.blocks[2].content.rowCount, 2);
assert.deepEqual(fill.blocks[2].content.resolvedChart.rows, fixture.datasets.primary.rows);
const emptyPrint = buildReportPrintChartSvg(fill.blocks[1].content);
assert.equal(emptyPrint.svg, '');
assert.equal(emptyPrint.diagnostics[0].code, 'emptyReportPrintChart');
assert.equal(buildReportFillChartPayload(null, []), null);
assert.equal(buildReportFillChartPayload({type:'horizontal_bar',series:{values:[{value:'amount'}]}}, []), null);
for (const payload of [
  undefined, {}, {rows:[],hasMore:true}, {rows:[],hasMore:false,truncated:true},
  {rows:[],hasMore:false,provenance:{truncated:true}},
  {rows:[],hasMore:false,diagnostics:[{severity:'error',code:'source_failed'}]},
  {rows:[],hasMore:false,diagnostics:[{severity:'warning',code:'incomplete_dataset'}]},
]) {
  assert.throws(() => buildReportFillFromReportSpec(fixture.reportSpec, {...fixture.datasets,empty:payload}), /requires complete empty dataset/);
}
const paged = structuredClone(fixture.reportSpec);
paged.datasets[1].request.offset = 10;
assert.throws(() => buildReportFillFromReportSpec(paged, fixture.datasets), /requires complete empty dataset/);
assert.deepEqual(buildReportFillFromReportSpec(fixture.reportSpec, {...fixture.datasets,empty:{rows:[]}}).blocks[1].content.resolvedChart,
  fill.blocks[1].content.resolvedChart);
// Reuse the canonical resolver's implicit single-dataset and primary fallback
// identities; an omitted authored reference does not make admitted rows missing.
for (const single of [false, true]) {
  const implicit = structuredClone(fixture.reportSpec);
  implicit.blocks = [implicit.blocks[1]];
  delete implicit.blocks[0].datasetRef;
  if (single) implicit.datasets = [implicit.datasets[1]];
  const payloads = single ? {empty:{rows:[]}} : {...fixture.datasets,primary:{rows:[]}};
  assert.deepEqual(buildReportFillFromReportSpec(implicit, payloads).blocks[0].content.resolvedChart,
    fill.blocks[1].content.resolvedChart);
  assert.throws(() => buildReportFillFromReportSpec(implicit, {}), /requires complete empty dataset/);
}
for (const model of [
  {type:'pie',series:{nameKey:'category',valueKey:'amount'}},
  {type:'donut',series:{nameKey:'category',valueKey:'amount'}},
  {type:'line',xAxis:{dataKey:'period'},series:{nameKey:'category',valueKey:'amount'}},
]) {
  const spec = structuredClone(fixture.reportSpec);
  spec.blocks[1].chartModel = model;
  const empty = buildReportFillFromReportSpec(spec, fixture.datasets).blocks[1].content;
  assert.deepEqual(empty.resolvedChart.rows, []);
  assert.deepEqual(empty.resolvedChart.seriesKeys, []);
  assert.equal(buildReportPrintChartSvg(empty).diagnostics[0].code, 'emptyReportPrintChart');
}
const truncated = buildReportFillFromReportSpec(fixture.reportSpec, {
  ...fixture.datasets, primary: {...fixture.datasets.primary, truncated:true},
});
assert.equal(truncated.datasets[0].provenance.truncated, true);
const filteredSpec = structuredClone(fixture.reportSpec);
filteredSpec.blocks[1].datasetRef = 'primary';
filteredSpec.blocks[1].runtime = {rowVisibility:{exclude:[{field:'category',values:['Reference','Science']}]} };
const filteredFill = buildReportFillFromReportSpec(filteredSpec, fixture.datasets);
assert.deepEqual(filteredFill.blocks[1].content.resolvedChart.rows, []);
assert.equal(filteredFill.datasets[0].provenance.rowCount, 2);
assert.throws(() => buildReportFillFromReportSpec(filteredSpec, {
  ...fixture.datasets,primary:{...fixture.datasets.primary,hasMore:true},
}), /requires complete empty dataset/);
assert.equal(JSON.stringify(fixture), original);
console.log('reportEmptyChart ✓ complete empty charts retain canonical typed payloads');
