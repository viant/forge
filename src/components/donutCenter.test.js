import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveDonutCenter,normalizeDonutCenter,layoutDonutCenter} from './donutCenter.js';
import {normalizeReportBuilderChartSpec,buildExplicitReportBuilderChartContainer,resolveReportBuilderChartDependencies,validateReportBuilderChartSpec} from './dashboard/reportBuilderUtils.js';
import {buildReportFillChartPayload} from '../reporting/reportFillChartPayload.js';
import {buildReportPrintChartSvg} from '../reporting/reportPrintChartSvg.js';
const fixture=JSON.parse(fs.readFileSync(new URL('../../doc/examples/donut-center.json',import.meta.url)));
const center=fixture.chartSpec.center;
assert.equal(resolveDonutCenter(center,fixture.rows).value,500);
assert.equal(resolveDonutCenter(fixture.occupancy,fixture.rows).formattedValue,'72.5%');
assert.equal(resolveDonutCenter(fixture.occupancy,fixture.zeroRows).formattedValue,'0.0%');
assert.equal(resolveDonutCenter(fixture.occupancy,fixture.nullRows).value,null);
assert.equal(resolveDonutCenter(center,[]).formattedValue,'Unavailable');
assert.equal(resolveDonutCenter(center,[{items:null},{items:3}]).value,3);
assert.equal(resolveDonutCenter({...fixture.occupancy,format:'number2'},[{occupancyRate:1.236}]).formattedValue,'1.24');
assert.equal(resolveDonutCenter({...fixture.occupancy,format:'percentfraction'},[{occupancyRate:.725}]).formattedValue,'72.5%');
assert.throws(()=>resolveDonutCenter(fixture.occupancy,[{occupancyRate:1},{occupancyRate:2}]),/agree/);
assert.throws(()=>resolveDonutCenter(center,[{items:'2'}]),/finite/);
assert.throws(()=>normalizeDonutCenter(center,'pie'),/only on donut/);
assert.equal(layoutDonutCenter({...resolveDonutCenter(center,fixture.rows),label:fixture.longLabel},20).needsDetails,true);
const config={dataSourceRef:'synthetic',dimensions:[{id:'category',key:'category',label:'Category',paramPath:'dimensions.category'}],measures:['items','occupancyRate'].map(id=>({id,key:id,label:id,paramPath:`measures.${id}`}))};
const occupancySpec={...fixture.chartSpec,center:fixture.occupancy};
const chart=buildExplicitReportBuilderChartContainer({},config,{},occupancySpec).chart;
assert.deepEqual(chart.center,fixture.occupancy);
assert.deepEqual(resolveReportBuilderChartDependencies(config,occupancySpec).measureIds,['items','occupancyRate']);
assert.equal(validateReportBuilderChartSpec(config,occupancySpec,[{key:'category',kind:'dimension'},{key:'items',kind:'measure'}]).valid,false);
const payload=buildReportFillChartPayload(chart,fixture.rows);
assert.equal(payload.center.value,72.5);assert.equal(payload.rows.reduce((sum,row)=>sum+row.value,0),500);
assert.match(buildReportPrintChartSvg({chartModel:chart,resolvedChart:payload}).svg,/72.5%/);
const {buildReportBuilderReportDocument,lowerReportDocumentToReportSpec}=await import('../reporting/reportDocumentModel.js');
const {buildReportFillFromReportSpec}=await import('../reporting/reportFillModel.js');
const {buildReportPrintFromReportFill}=await import('../reporting/reportPrintModel.js');
const {validateReportSpec,validateReportFill,validateReportPrint}=await import('../reporting/schema/reportSchemas.js');
const document=buildReportBuilderReportDocument({container:{id:'synthetic-donut',dataSourceRef:'synthetic'},config,state:{selectedDimensions:['category'],selectedMeasures:['items'],reportDocumentBlocks:[{id:'collection',kind:'chartBlock',datasetRef:'primary',chartSpec:occupancySpec}]}});
const spec=lowerReportDocumentToReportSpec(JSON.parse(JSON.stringify(document)));
assert.equal(validateReportSpec(spec).valid,true,JSON.stringify(validateReportSpec(spec)));
assert.ok(JSON.stringify(spec.datasets).includes('occupancyRate'));
for(const rows of [fixture.rows,fixture.zeroRows,fixture.nullRows,[]]) {
 const fill=buildReportFillFromReportSpec(spec,{primary:{rows}});
 assert.equal(validateReportFill(fill).valid,true,JSON.stringify(validateReportFill(fill)));
 const resolved=fill.blocks.find(b=>b.id==='collection').content.resolvedChart;
 assert.deepEqual(resolved.center,resolveDonutCenter(fixture.occupancy,rows));
 const print=buildReportPrintFromReportFill({reportSpec:spec,reportFill:fill});
 assert.equal(validateReportPrint(print).valid,true,JSON.stringify(validateReportPrint(print)));
 assert.match(JSON.stringify(print),new RegExp(resolved.center.formattedValue.replace('.','\\.')));
}
const longChart={...chart,center:{...center,label:fixture.longLabel}};
const long=buildReportPrintChartSvg({chartModel:longChart,resolvedChart:buildReportFillChartPayload(longChart,fixture.rows),width:360});
assert.ok(long.labelDetails.some(line=>line.includes(fixture.longLabel)&&line.includes('500')));
assert.deepEqual(normalizeReportBuilderChartSpec(JSON.parse(JSON.stringify(occupancySpec))).center,fixture.occupancy);
console.log('donut center explicit sources, scalar consistency, formats, dependencies, schema/fill/print and fallback passed');
assert.deepEqual(payload.rows,buildReportFillChartPayload({...chart,center:undefined},fixture.rows).rows);
assert.equal(buildReportFillChartPayload({...chart,rowLimit:1},fixture.rows).center.value,72.5);
const limited=buildReportPrintChartSvg({chartModel:chart,resolvedChart:payload,rowLimit:1});
assert.match(limited.svg,/72.5%/);
const wrongType=JSON.parse(JSON.stringify(spec));wrongType.blocks.find(b=>b.id==='collection').chartSpec.type='pie';
assert.equal(validateReportSpec(wrongType).valid,false);
// Uncompiled authored chart blocks historically have null models. Neither the
// center resolver nor the tooltip wrapper may turn that absence into a failure.
for(const absentChart of [null,undefined,{}]) {
 assert.equal(buildReportFillChartPayload(absentChart,fixture.rows),null);
 assert.equal(buildReportFillChartPayload(absentChart,[]),null);
}
// Exact line contents preserve words; a word that cannot fit moves outside.
const libraryCenter=resolveDonutCenter(center,fixture.rows),occupancyCenter=resolveDonutCenter(fixture.occupancy,fixture.rows);
for(const value of [libraryCenter,occupancyCenter]) {
 assert.deepEqual(layoutDonutCenter(value,55).labelLines,[]); // empty-ring radius
 assert.equal(layoutDonutCenter(value,55).needsDetails,true);
 assert.deepEqual(layoutDonutCenter(value,80).labelLines,value.label.split(' '));
 assert.equal(layoutDonutCenter(value,80).needsDetails,false);
}
assert.deepEqual(layoutDonutCenter(libraryCenter,240*.36*.7).labelLines,[]); // default print radius
assert.equal(layoutDonutCenter(libraryCenter,240*.36*.7).needsDetails,true);
assert.deepEqual(layoutDonutCenter(occupancyCenter,240*.36*.7).labelLines,['Occupancy','rate']);
assert.deepEqual(layoutDonutCenter(occupancyCenter,226*.36*.7).labelLines,[]); // Letter content width
assert.deepEqual(layoutDonutCenter({...occupancyCenter,label:'  Occupancy  \n rate  '},80).labelLines,['Occupancy','rate']);
assert.equal(layoutDonutCenter({...libraryCenter,label:'indivisiblelonglabel'},55).needsDetails,true);
const noSlicePrint=buildReportPrintChartSvg({chartModel:chart,resolvedChart:buildReportFillChartPayload(chart,[])});
assert.ok(noSlicePrint.labelDetails.includes('No slice data.'));
const printWords=buildReportPrintChartSvg({chartModel:chart,resolvedChart:payload,width:680});
assert.match(printWords.svg,/>Occupancy<\/text>/);assert.match(printWords.svg,/>rate<\/text>/);
assert.doesNotMatch(printWords.svg,/>Occupanc<\/text>|>y rate<\/text>/);
const printLibrary=buildReportPrintChartSvg({chartModel:{...chart,center},resolvedChart:buildReportFillChartPayload({...chart,center},fixture.rows),width:680});
assert.ok(printLibrary.labelDetails.some(line=>line.includes('Catalogued items')));
assert.doesNotMatch(printLibrary.svg,/>Catalogue<\/text>|>d items<\/text>/);
