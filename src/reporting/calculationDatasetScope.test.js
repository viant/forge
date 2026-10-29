import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildReportBuilderReportDocument, lowerReportDocumentToReportSpec} from './reportDocumentModel.js';
import {buildReportBuilderReportSpec} from './reportSpecModel.js';
import {buildCreateReportDocumentPayload} from './reportDocumentStore.js';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';
import {validateReportSpec} from './schema/reportSchemas.js';
import {applyReportCalculatedFields, validateReportCalculatedFieldDependencies} from './calculatedFieldModel.js';

// Independently authored, domain-neutral fixture: logical datasets share transport and output key.
const config = {dataSourceRef:'rows', measures:[{id:'input',key:'input',label:'Input'}], calculatedFields:[
  {id:'forecastAdjusted',key:'adjusted',datasetRef:'forecast',expr:'input * 2'},
  {id:'observedAdjusted',key:'adjusted',datasetRef:'observed',expr:'input * 3'},
], dataSources:['forecast','observed'].map(id=>({id,dataSourceRef:'rows',request:{measures:{input:true}}}))};
const blocks = ['forecast','observed'].map(datasetRef=>({id:datasetRef+'Table',kind:'tableBlock',datasetRef,title:datasetRef,columns:[{key:'input',label:'Input'},{key:'adjusted',label:'Adjusted'}]}));
const state = {selectedMeasures:['input'],reportDocumentBlocks:blocks};
const document = buildReportBuilderReportDocument({container:{id:'scope',dataSourceRef:'rows'},config,state,additionalBlocks:blocks});
const initialSpec = lowerReportDocumentToReportSpec(document);
const saved = buildCreateReportDocumentPayload({document,reportSpec:initialSpec});
const serialized = JSON.stringify(saved);
assert.ok(serialized.includes('forecastAdjusted'));
const spec = lowerReportDocumentToReportSpec(JSON.parse(serialized).document);
assert.equal(validateReportSpec(spec).valid,true);
assert.deepEqual(spec.calculatedFields.map(({id,key,datasetRef,expr})=>({id,key,datasetRef,expr})),config.calculatedFields);
const datasets = {forecast:{rows:[{input:10}]},observed:{rows:[{input:10}]}};
const fill = buildReportFillFromReportSpec(spec,datasets);
for (const [id,expected] of [['forecast',20],['observed',30]]) assert.equal(fill.datasets.find(d=>d.id===id).rows[0].adjusted,expected);
const print = buildReportPrintFromReportFill({reportSpec:spec,reportFill:fill});
assert.ok(print.pages.flatMap(p=>p.elements).some(e=>e.text==='30'));
const bundled = {};
vm.runInNewContext(fs.readFileSync(new URL('../../backend/reporting/materializer/lowerer.bundle.js',import.meta.url),'utf8'),bundled);
const envelope = {schemaVersion:1,format:'forge.authoredReport',builderRef:'scope',builderDefinition:{id:'scope',reportBuilder:config},reportDocument:{version:1,kind:'reportDocument',id:'scope',title:'Dataset calculations',blocks},state,dataSources:{rows:{id:'rows',cardinality:'collection',backend:{kind:'inline',rows:[]}}}};
const nativeSpec = JSON.parse(bundled.ForgeAuthoredLowerer.lower(JSON.stringify(envelope)));
assert.deepEqual(nativeSpec.calculatedFields,spec.calculatedFields);
const native = JSON.parse(bundled.ForgeAuthoredLowerer.materialize(JSON.stringify({reportSpec:nativeSpec,datasets})));
assert.equal(native.reportFill.datasets.find(d=>d.id==='observed').rows[0].adjusted,30);
assert.ok(native.reportPrint.pages.flatMap(p=>p.elements).some(e=>e.text==='30'));

// IDs and keys are aliases in one dataset; identical aliases in distinct datasets remain valid.
const fields = [
 {id:'result',key:'result',datasetRef:'forecast',expr:'adjusted + 1',dependencies:['forecastAdjusted']},
 {id:'result',key:'result',datasetRef:'observed',expr:'adjusted + 2',dependencies:['observedAdjusted']},
 ...config.calculatedFields,
];
validateReportCalculatedFieldDependencies(fields);
assert.equal(applyReportCalculatedFields([{input:10}],fields,{datasetRef:'forecast'})[0].result,21);
assert.equal(applyReportCalculatedFields([{input:10}],fields,{datasetRef:'observed'})[0].result,32);
for (const duplicate of [
 {id:'other',key:'adjusted',datasetRef:'forecast',expr:'input'},
 {id:'forecastAdjusted',key:'other',datasetRef:'forecast',expr:'input'},
 {id:'adjusted',key:'other',datasetRef:'forecast',expr:'input'},
 {id:'other',key:'adjusted',expr:'input'},
]) {
 const invalid = [...config.calculatedFields,duplicate];
 assert.throws(()=>validateReportCalculatedFieldDependencies(invalid),/Ambiguous calculated field alias/);
 assert.throws(()=>applyReportCalculatedFields([{input:10}],invalid,{datasetRef:'forecast'}),/Ambiguous calculated field alias/);
 assert.equal(validateReportSpec({...spec,calculatedFields:invalid}).valid,false);
 const invalidEnvelope = JSON.parse(JSON.stringify(envelope));
 invalidEnvelope.builderDefinition.reportBuilder.calculatedFields = invalid;
 assert.throws(()=>bundled.ForgeAuthoredLowerer.lower(JSON.stringify(invalidEnvelope)),/Ambiguous calculated field alias/);
}
assert.throws(()=>buildReportBuilderReportSpec({config,state:{selectedMeasures:['adjusted']}}),/Ambiguous calculated field reference/);
const selected = buildReportBuilderReportSpec({config,state:{selectedMeasures:['observedAdjusted']}});
assert.equal(selected.calculatedFields[0].expr,'input * 3');
const duplicateIds = config.calculatedFields.map(field=>({...field,id:'sharedId'}));
validateReportCalculatedFieldDependencies(duplicateIds);
assert.throws(()=>buildReportBuilderReportSpec({config:{...config,calculatedFields:duplicateIds},state:{selectedMeasures:['sharedId']}}),/Ambiguous calculated field reference/);
// Foreign dataset aliases never supply a local dependency or cause a false cycle.
validateReportCalculatedFieldDependencies([{id:'a',datasetRef:'forecast',expr:'b + 1'},{id:'b',datasetRef:'observed',expr:'a + 1'}]);
assert.deepEqual(applyReportCalculatedFields([{input:5}],[{id:'double',expr:'input * 2'}]),[{input:5,double:10}]);
console.log('PASS calculation dataset scopes through builder, save JSON, lower, fill, print and embedded bundle');

// Scope and field IDs are unrestricted strings; delimiters cannot encode identity.
const colonFields = [
 {id:'x',key:'first',datasetRef:'a:b',expr:'input * 2'},
 {id:'b:x',key:'second',datasetRef:'a',expr:'input * 3'},
];
const colonConfig = {...config,calculatedFields:colonFields,dataSources:['a:b','a'].map(id=>({id,dataSourceRef:'rows',request:{measures:{input:true}}}))};
const colonBlocks = colonFields.map(field=>({id:field.key+'Table',kind:'tableBlock',datasetRef:field.datasetRef,columns:[{key:field.key,label:field.key}]}));
for (const selectedMeasures of [['x','b:x'], ['input']]) {
 const colonState = {selectedMeasures,reportDocumentBlocks:colonBlocks};
 if (selectedMeasures[0]==='x') assert.equal(buildReportBuilderReportSpec({config:colonConfig,state:colonState}).calculatedFields.length,2);
 const colonDocument = buildReportBuilderReportDocument({container:{id:'colonScope',dataSourceRef:'rows'},config:colonConfig,state:colonState,additionalBlocks:colonBlocks});
 const colonSpec = lowerReportDocumentToReportSpec(colonDocument);
 assert.equal(validateReportSpec(colonSpec).valid,true);
 const colonSaved = JSON.parse(JSON.stringify(buildCreateReportDocumentPayload({document:colonDocument,reportSpec:colonSpec})));
 const reloaded = lowerReportDocumentToReportSpec(colonSaved.document);
 assert.deepEqual(reloaded.calculatedFields.map(field=>[field.datasetRef,field.id,field.key]),colonFields.map(field=>[field.datasetRef,field.id,field.key]));
 const colonEnvelope = {...envelope,builderDefinition:{id:'scope',reportBuilder:colonConfig},reportDocument:{...envelope.reportDocument,blocks:colonBlocks},state:colonState};
 const colonNative = JSON.parse(bundled.ForgeAuthoredLowerer.lower(JSON.stringify(colonEnvelope)));
 assert.deepEqual(colonNative.calculatedFields,reloaded.calculatedFields);
 const colonFill = JSON.parse(bundled.ForgeAuthoredLowerer.materializeFill(JSON.stringify({reportSpec:colonNative,datasets:{'a:b':{rows:[{input:10}]},a:{rows:[{input:10}]}}})));
 assert.equal(colonFill.reportFill.datasets.find(dataset=>dataset.id==='a:b').rows[0].first,20);
 assert.equal(colonFill.reportFill.datasets.find(dataset=>dataset.id==='a').rows[0].second,30);
}
console.log('PASS delimiter-safe calculation scope identity through selected and block-driven save/lower');
