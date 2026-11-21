import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizePieSliceLabel,resolvePieSliceLabel} from './pieSliceLabel.js';
import {normalizeReportBuilderChartSpec,buildExplicitReportBuilderChartContainer,resolveReportBuilderChartDependencies} from './dashboard/reportBuilderUtils.js';
import {buildReportFillChartPayload} from '../reporting/reportFillChartPayload.js';
import {buildReportPrintChartSvg} from '../reporting/reportPrintChartSvg.js';
const fixture=JSON.parse(fs.readFileSync(new URL('../../doc/examples/donut-center-ratio.json',import.meta.url)));
const {chartSpec,rows,summaryRows,expectedLabels}=fixture;
const label=normalizePieSliceLabel(chartSpec.sliceLabel,'donut');
assert.deepEqual(label,chartSpec.sliceLabel);
for(const denominator of [4.004,0,null]) {
 const center={value:denominator};
 assert.deepEqual(rows.map(row=>resolvePieSliceLabel(label,[row],center)),denominator===4.004?expectedLabels:rows.map(()=>null));
}
assert.equal(resolvePieSliceLabel({...label,hideExactOne:false},[{numerator:4.004}],{value:4.004}),'100.0%');
assert.equal(resolvePieSliceLabel(label,[{numerator:2}],{value:-4}),'-50.0%');
assert.throws(()=>resolvePieSliceLabel(label,[{numerator:1}]),/resolved donut center/);
assert.throws(()=>resolvePieSliceLabel(label,[{numerator:Number.MAX_VALUE}],{value:Number.MIN_VALUE}),/finite numeric range/);
assert.throws(()=>resolvePieSliceLabel(label,[{numerator:1},{numerator:2}],{value:4}),/agree/);
assert.throws(()=>resolvePieSliceLabel(label,[{}],{value:4}),/finite numbers/);
for(const input of [{...label,divideBy:'sum'},{...label,hideExactOne:'true'},{field:'numerator',format:label.format,hideExactOne:true}])assert.throws(()=>normalizePieSliceLabel(input,'donut'));
assert.throws(()=>normalizePieSliceLabel(label,'pie'),/resolved center/);
assert.throws(()=>normalizeReportBuilderChartSpec({...chartSpec,center:undefined}),/declared donut center/);
const config={dimensions:[{id:'category',key:'category'}],measures:['items','numerator'].map(id=>({id,key:id}))};
const chart=buildExplicitReportBuilderChartContainer({},config,{},chartSpec).chart;
const payload=buildReportFillChartPayload(chart,rows,summaryRows);
assert.equal(payload.center.value,4.004);assert.equal(payload.center.formattedValue,'4');
assert.deepEqual(payload.rows.map(row=>row.sliceLabel),expectedLabels);
const print=buildReportPrintChartSvg({chartModel:chart,resolvedChart:payload});
for(const text of ['50.0%','0.0%','150.0%','100.0%'])assert.ok(print.svg.includes(text));
assert.ok(!print.svg.includes('Elm —'));assert.ok(print.svg.includes('Ash — 100.0%'));
const dependencies=resolveReportBuilderChartDependencies(config,chartSpec), baselineDependencies=resolveReportBuilderChartDependencies(config,{...chartSpec,sliceLabel:{field:'numerator',format:label.format}});
for(const key of ['dimensionIds','measureIds'])assert.deepEqual(dependencies[key],baselineDependencies[key]);
// Without the opt-in, the existing field label is formatted directly.
const baseline={...label};delete baseline.divideBy;delete baseline.hideExactOne;
assert.equal(resolvePieSliceLabel(baseline,[{numerator:1}]),'100.0%');
assert.equal(resolvePieSliceLabel(baseline,[{numerator:0}]),'0.0%');
assert.equal(resolvePieSliceLabel(baseline,[{numerator:null}]),null);

// The ordinary authored boundary keeps the identical producer request graph.
const {buildReportBuilderReportSpec}=await import('../reporting/reportSpecModel.js');
const {buildReportFillFromReportSpec}=await import('../reporting/reportFillModel.js');
const {validateReportSpec,validateReportFill}=await import('../reporting/schema/reportSchemas.js');
const sharedCenter={...chartSpec.center};delete sharedCenter.datasetRef;
const make=optIn=>buildReportBuilderReportSpec({container:{id:'capacity',dataSourceRef:'capacityRows'},
 config:{...config,measures:[...config.measures,{id:'capacity',key:'capacity'}]},
 state:{viewMode:'chart',selectedDimensions:['category'],selectedMeasures:['items','numerator','capacity'],chartSpec:{title:'Capacity share',...chartSpec,center:sharedCenter,sliceLabel:optIn?label:baseline}}});
const ordinarySpec=make(false),ratioSpec=make(true);
assert.deepEqual(ratioSpec.datasets,ordinarySpec.datasets);
assert.equal(validateReportSpec(ratioSpec).valid,true,JSON.stringify({validation:validateReportSpec(ratioSpec),blocks:ratioSpec.blocks}));
const sameFrameRows=rows.map(row=>({...row,capacity:4.004}));
const filled=buildReportFillFromReportSpec(ratioSpec,{primary:{rows:sameFrameRows}});
assert.equal(validateReportFill(filled).valid,true);
assert.deepEqual(filled.datasets[0].rows,sameFrameRows);
assert.deepEqual(filled.blocks.find(block=>block.kind==='chartBlock').content.resolvedChart.rows.map(row=>row.sliceLabel),expectedLabels);

console.log('pieSliceLabel ✓ raw resolved-center ratios, null/zero/exact-one/over-one, unchanged dependencies and print');
