import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyReportRowVisibility,normalizeReportRowVisibility} from './reportRowVisibility.js';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';
import {resolveReportRuntimeBlockRows} from './reportBlockRuntimeModel.js';
import {buildReportBuilderReportDocument,lowerReportDocumentToReportSpec,normalizeReportBlockRuntime} from './reportDocumentModel.js';
const visibility={exclude:[{field:'category',values:['Unknown']}]};
const rows=[{category:'A',amount:20},{category:'Unknown',amount:80},{category:null,amount:0}];
assert.deepEqual(applyReportRowVisibility(rows,visibility).map(row=>row.category),['A',null]);assert.equal(rows.length,3);
assert.throws(()=>applyReportRowVisibility([{}],visibility),/missing/);
assert.throws(()=>normalizeReportRowVisibility({exclude:[{field:'category',values:[{}]}]}),/typed scalars/);
const spec=JSON.parse(fs.readFileSync(new URL('../../doc/examples/donut-conversion-preview.json',import.meta.url))).reportSpec;
spec.datasets=[{...spec.datasets[0],id:'primary',request:{dimensions:{category:true},measures:{amount:true},limit:100,offset:0}}];
spec.calculatedFields=[{id:'share',key:'share',kind:'tableCalc',label:'Share',dataType:'number',datasetRef:'primary',dependencies:['amount'],compute:{type:'percentOfTotal',sourceField:'amount',scale:1,partitionBy:[],nullPolicy:'null',requireComplete:true}}];
spec.blocks=[{id:'chart',kind:'chartBlock',title:'Visible categories',datasetRef:'primary',runtime:{rowVisibility:visibility},chartSpec:{type:'bar',xField:'category',yFields:['share']},chartModel:{type:'bar',xAxis:{dataKey:'category'},yAxis:{format:'percentFraction2'},series:{values:[{value:'share',label:'Share',type:'bar',format:'percentFraction2'}]}}}];spec.layoutIntent.blockOrder=['chart'];
const fill=buildReportFillFromReportSpec(spec,{primary:{rows,hasMore:false}});
assert.equal(fill.datasets[0].rows.length,3);assert.equal(fill.datasets[0].rows[0].share,.2);
assert.deepEqual(fill.blocks[0].content.resolvedChart.rows.map(row=>[row.category,row.share]),[['A',.2]]);
assert.equal(resolveReportRuntimeBlockRows(spec.blocks[0],fill.datasets[0].rows)[0].share,.2);
const print=buildReportPrintFromReportFill({reportSpec:spec,reportFill:fill});assert.ok(JSON.stringify(print).includes('20.00%'));assert.ok(!JSON.stringify(print).includes('Unknown'));
console.log('presentation-only hide retains complete calculation denominator and typed null identity in fill/runtime/print');

assert.throws(()=>buildReportFillFromReportSpec({...spec,blocks:[{...spec.blocks[0],chartSpec:{...spec.blocks[0].chartSpec,type:'pie'}}]},{primary:{rows,hasMore:false}}),/hidden-angle geometry/);

// Authoring/save/reopen must preserve exclusions without moving them ahead of
// table calculations. The hidden row must still contribute to the denominator.
const declaredVisibility=structuredClone(visibility);
const authoredBlock={...spec.blocks[0],runtime:{requireCompleteDataset:true,rowVisibility:declaredVisibility}};
const config={dataSourceRef:'records',dimensions:[{id:'category',key:'category',label:'Category',paramPath:'dimensions.category'}],measures:[{id:'amount',key:'amount',label:'Amount',paramPath:'measures.amount'}],calculatedFields:spec.calculatedFields.map(field=>({...field,format:'percentFraction2'}))};
const document=buildReportBuilderReportDocument({container:{id:'summary',dataSourceRef:'records'},config,state:{selectedDimensions:['category'],selectedMeasures:['amount'],reportDocumentBlocks:[authoredBlock]},additionalBlocks:[authoredBlock]});
declaredVisibility.exclude[0].values[0]='A';
const lowered=lowerReportDocumentToReportSpec(JSON.parse(JSON.stringify(document)));
const retained=lowered.blocks.find(block=>block.id==='chart');
assert.deepEqual(retained.runtime.rowVisibility,visibility);
assert.equal(retained.runtime.requireCompleteDataset,true);
const authoredFill=buildReportFillFromReportSpec(lowered,{primary:{rows,hasMore:false}});
assert.equal(authoredFill.datasets.find(dataset=>dataset.id==='primary').rows.length,3);
assert.deepEqual(authoredFill.blocks.find(block=>block.id==='chart').content.resolvedChart.rows.map(row=>[row.category,row.share]),[['A',.2]]);
const authoredPrint=buildReportPrintFromReportFill({reportSpec:lowered,reportFill:authoredFill});
const chartElements=authoredPrint.pages.flatMap(page=>page.elements).filter(element=>element.id==='chart'||String(element.id).startsWith('chart__'));
assert.ok(chartElements.length>0);
assert.ok(JSON.stringify(chartElements).includes('20.00%'));
assert.ok(!JSON.stringify(chartElements).includes('Unknown'));
for(const invalid of [null,[],{exclude:[]},{exclude:[{field:'category',values:[{}]}]}]){
 assert.throws(()=>normalizeReportBlockRuntime({rowVisibility:invalid}),/visibility/);
}
assert.equal(normalizeReportBlockRuntime({unrecognized:true}),null);
console.log('authored row visibility survives JSON/lowering and remains post-calculation in fill and print');
