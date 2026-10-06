import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildReportFillFromReportSpec} from '../reportFillModel.js';
import {buildReportPrintFromReportFill} from '../reportPrintModel.js';
import {buildDraftReportExportRequest} from '../reportExportRequestModel.js';
import {reportSpecSchema,reportFillSchema,validateReportSpec,validateReportFill,validateReportPrint,validateReportExportRequest} from './reportSchemas.js';
import {validateReportSchema} from './reportSchemaValidator.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const fixtures=JSON.parse(readFileSync(new URL('../fixtures/performance-report-fixtures.v1.json',import.meta.url)));
const spec=clone(fixtures.raw.reportSpec);
const datasetRef=spec.datasets[0].id;
const nativeChart={...clone(spec.blocks.find(block=>block.kind==='chartBlock')),id:'direct',chartModel:{...clone(spec.blocks.find(block=>block.kind==='chartBlock').chartModel),series:{valueKey:'value',values:[{value:'totalSpend',label:'Amount',type:'line'}]}}};
spec.title='Synthetic compatibility report';
spec.subtitle='Known optional subtitle';
spec.blocks=[
 {id:'filters',kind:'filterBarBlock',title:'Filters',mode:'unified'},
 {id:'section',kind:'sectionBlock',title:'Summary',navigationLabel:'Summary',blockIds:['note','metric','badges','direct','table','info','callout']},
 {id:'note',kind:'markdownBlock',title:'Note',markdown:'Synthetic report content'},
 {id:'metric',kind:'kpiBlock',title:'Amount',datasetRef,valueField:'totalSpend',valueLabel:'Amount',valueFormat:'currency'},
 {id:'badges',kind:'badgesBlock',title:'Coverage',datasetRef,items:[{label:'Amount',valueField:'totalSpend',format:'currency'}]},
 nativeChart,
 {...clone(spec.blocks.find(block=>block.kind==='tableBlock')),id:'table'},
 {id:'info',kind:'infoPanelBlock',title:'Information',body:'Synthetic information'},
 {id:'callout',kind:'calloutBlock',title:'Finding',body:'Synthetic finding'},
 {id:'tabs',kind:'tabGroupBlock',title:'Sections',sectionIds:['section']},
];
spec.layoutIntent.blockOrder=spec.blocks.map(block=>block.id);
spec.layoutIntent.items=spec.blocks.map(block=>({blockId:block.id,size:block.kind==='kpiBlock'?'quarter':'full'}));
const payloads=Object.fromEntries(fixtures.raw.reportFill.datasets.map(dataset=>[dataset.id,{rows:clone(dataset.rows)}]));
const fill=buildReportFillFromReportSpec(spec,payloads);
const print=buildReportPrintFromReportFill({reportSpec:spec,reportFill:fill});
const reportDocument={id:'synthetic',title:spec.title};
for(const [name,value,validate] of [['Spec',spec,validateReportSpec],['Fill',fill,validateReportFill],['Print',print,validateReportPrint]]){
 const result=validate(value);assert.equal(result.valid,true,`${name}: ${JSON.stringify(result.errors)}`);
}
const before=JSON.stringify({spec,fill,print});
const request=buildDraftReportExportRequest({reportDocument,reportSpec:spec,reportFill:fill,reportPrint:print});
assert.equal(validateReportExportRequest(request).valid,true);
assert.equal(JSON.stringify({spec,fill,print}),before,'validation/export must not mutate artifacts or hashes');
assert.deepEqual(request.reportSpec,spec);assert.deepEqual(request.reportFill,fill);assert.deepEqual(request.reportPrint,print);

const validateDefinition=(schema,kind,value)=>validateReportSchema({...schema.$defs[kind],$defs:schema.$defs},value).valid;
const nullableFields={sectionBlock:['subtitle','description'],kpiBlock:['description','suffix','secondaryLabel','secondaryFormat','secondaryTrend'],infoPanelBlock:['eyebrow','description','tone','bodyFormat'],calloutBlock:['icon','description','tone','badges','bodyFormat'],tabGroupBlock:['defaultSectionId']};
for(const [kind,fields] of Object.entries(nullableFields)){
 const block=clone(fill.blocks.find(block=>block.kind===kind));
 for(const field of fields)block.content[field]=null;
 assert.equal(validateDefinition(reportFillSchema,kind,block),true,kind+' native optional nulls');
 block.content.extra=true;
 assert.equal(validateDefinition(reportFillSchema,kind,block),false,kind+' unknown property');
 delete block.content.extra;
 block.content[fields[0]]={};
 assert.equal(validateDefinition(reportFillSchema,kind,block),false,kind+' incorrect optional type');
}
for(const schema of [reportSpecSchema,reportFillSchema]){
 assert.equal(validateDefinition(schema,'badgeItem',{label:'Amount',valueField:'amount'}),true);
 assert.equal(validateDefinition(schema,'badgeItem',{id:'legacy',value:'label'}),true);
 for(const bad of [{},{label:'Amount'},{label:'',valueField:'amount'},{label:'Amount',valueField:''},{label:'Amount',valueField:'amount',extra:true}])assert.equal(validateDefinition(schema,'badgeItem',bad),false);
 assert.equal(validateDefinition(schema,'chartSeriesNativeDirect',{valueKey:'value',values:[{value:'amount',label:'Amount',type:'line'}]}),true);
 for(const bad of [{valueKey:'value',values:[]},{valueKey:'value',values:[{value:'amount',label:'Amount',type:'line',color:3}]},{valueKey:'value',values:[{value:'amount',label:'Amount',type:'line'}],sourceNameKey:'unbound'},{valueKey:'value',values:[{value:'amount',label:'Amount',type:'line'}],extra:true}])assert.equal(validateDefinition(schema,'chartSeriesNativeDirect',bad),false);
 assert.equal(validateDefinition(schema,'chartSeriesGrouped',{valueKey:'value',values:[{value:'amount',label:'Amount',type:'line',color:'#123456'}],palette:[]}),false,'grouped nameKey remains mandatory');
}
const direct={kind:'directSeries',type:'line',xAxisKey:'date',nameKey:'name',valueKey:'value',seriesKeys:['amount'],rows:[]};
assert.equal(validateDefinition(reportFillSchema,'resolvedChart',direct),true);
assert.equal(validateDefinition(reportFillSchema,'resolvedChart',{...direct,nameKey:3}),false);
assert.equal(validateDefinition(reportFillSchema,'resolvedChart',{...direct,kind:'arbitrary'}),false);
for(const mutate of [value=>value.reportSpec.extra=true,value=>value.reportPrint.subtitle={},value=>value.reportSpec.layoutIntent.items[0].size='giant',value=>value.reportFill.blocks[0].kind='arbitrary',value=>value.reportPrint.specHash='different']){
 const bad=clone(request);mutate(bad);assert.equal(validateReportExportRequest(bad).valid,false,'invalid/unknown/hash-mismatched request accepted');
}
assert.equal(validateReportSchema({type:'string',minLength:2},'😀').valid,false,'minLength counts code points');
assert.equal(validateReportSchema({type:'string',minLength:2},'😀a').valid,true);
console.log('reportNativeArtifactCompatibility ✓ ten producer-generated block kinds, exact artifacts/hashes, explicit nullable/direct/badge shapes, and strict negative cases');
