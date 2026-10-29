import assert from 'node:assert/strict';
import {calculateKpiSecondaryValue, normalizeKpiSecondaryCalculation} from './reportKpiComparisonModel.js';
import {buildReportBuilderReportDocument, lowerReportDocumentToReportSpec} from './reportDocumentModel.js';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';
import {validateReportSpec, validateReportFill, validateReportPrint} from './schema/reportSchemas.js';

assert.equal(calculateKpiSecondaryValue(80,100,'relativeChange'),-.2);
assert.equal(calculateKpiSecondaryValue(0,100,'relativeChange'),-1);
assert.equal(calculateKpiSecondaryValue(100,100,'relativeChange'),0);
assert.equal(calculateKpiSecondaryValue(0,0,'relativeChange'),null);
assert.equal(calculateKpiSecondaryValue(4,0,'difference'),4);
assert.equal(calculateKpiSecondaryValue('80','100','relativeChange'),-.2);
assert.equal(calculateKpiSecondaryValue(1,'previous label'), 'previous label');
for(const missing of [null,undefined,'', ' ', true, false, NaN, Infinity,{},[]]) {
 assert.equal(calculateKpiSecondaryValue(missing,100,'relativeChange'),null);
 assert.equal(calculateKpiSecondaryValue(100,missing,'relativeChange'),null);
}
assert.throws(()=>normalizeKpiSecondaryCalculation('eval'),/Unknown KPI/);
const config={dataSourceRef:'authorized',measures:[{id:'amount',key:'amount',label:'Amount',paramPath:'measures.amount',default:true}],
 dataSources:[{id:'previous',dataSourceRef:'authorized',measures:[{id:'amount',key:'amount',label:'Amount',paramPath:'measures.amount'}],request:{measures:{},filters:{},limit:1}}]};
const delta={id:'movement',kind:'kpiBlock',title:'Amount',datasetRef:'primary',valueField:'amount',secondaryDatasetRef:'previous',secondaryField:'amount',secondaryCalculation:'relativeChange',secondaryLabel:'Change vs prior period',secondaryFormat:'percentFraction',secondaryTrend:true};
const document=buildReportBuilderReportDocument({container:{id:'comparison',dataSourceRef:'authorized'},config,state:{selectedMeasures:['amount'],selectedDimensions:[],reportDocumentBlocks:[delta]},additionalBlocks:[delta]});
const spec=lowerReportDocumentToReportSpec(document);
assert.ok(spec.datasets.some(d=>d.id==='previous'),'Secondary dataset was pruned');
assert.equal(spec.datasets.find(d=>d.id==='previous').request.measures.amount,true,'Secondary field not projected');
assert.equal(spec.blocks.find(b=>b.id==='movement').secondaryDatasetRef,'previous');
const validation=validateReportSpec(spec);assert.equal(validation.valid,true,JSON.stringify(validation));
const fill=buildReportFillFromReportSpec(spec,{primary:{rows:[{amount:80}]},previous:{rows:[{amount:100}]}});
const content=fill.blocks.find(b=>b.id==='movement').content;
assert.equal(content.value,80);assert.equal(content.secondaryValue,-.2);
const fillValidation=validateReportFill(fill);assert.equal(fillValidation.valid,true,JSON.stringify(fillValidation));
const print=buildReportPrintFromReportFill({reportSpec:spec,reportFill:fill});
const printValidation=validateReportPrint(print);assert.equal(printValidation.valid,true,JSON.stringify(printValidation));
assert.match(JSON.stringify(print), /-20(?:\.0+)?%/,'Print lost shared comparison value');
// Numeric precision is an existing formatter capability and must survive the
// authored contract, fill validation and canonical print without rounding data.
const preciseSpec=structuredClone(spec);
const preciseBlock=preciseSpec.blocks.find(b=>b.id==='movement');
preciseBlock.valueFormat='number2';preciseBlock.secondaryFormat='number2';
assert.equal(validateReportSpec(preciseSpec).valid,true);
const preciseFill=buildReportFillFromReportSpec(preciseSpec,{primary:{rows:[{amount:1.2345}]},previous:{rows:[{amount:2}]}});
assert.equal(validateReportFill(preciseFill).valid,true);
assert.equal(preciseFill.blocks.find(b=>b.id==='movement').content.value,1.2345);
const precisePrint=buildReportPrintFromReportFill({reportSpec:preciseSpec,reportFill:preciseFill});
assert.equal(validateReportPrint(precisePrint).valid,true);
assert.match(JSON.stringify(precisePrint),/1\.23/);
assert.match(JSON.stringify(precisePrint),/-0\.38/);
for(const previous of [[],[{amount:null}],[{amount:0}]]) {
 const empty=buildReportFillFromReportSpec(spec,{primary:{rows:[{amount:80}]},previous:{rows:previous}});
 assert.equal(empty.blocks.find(b=>b.id==='movement').content.secondaryValue,null);
}
assert.throws(()=>buildReportFillFromReportSpec({...spec,datasets:spec.datasets.filter(d=>d.id!=='previous')},{primary:{rows:[{amount:80}]}}),/secondary dataset/);
console.log('reportKpiComparisonModel ✓ authorized dataset closure, nullable ratios, shared fill and print');
