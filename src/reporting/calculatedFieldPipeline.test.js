import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildReportFillFromReportSpec} from './reportFillModel.js';

const corpus=JSON.parse(fs.readFileSync(new URL('./fixtures/table-calculation-conformance-fixtures.v1.json',import.meta.url),'utf8'));
const bundled={};
vm.runInNewContext(fs.readFileSync(new URL('../../backend/reporting/materializer/lowerer.bundle.js',import.meta.url),'utf8'),bundled);
for(const fixture of corpus.runtimeCases){
 const fields=fixture.definitions.map(field=>({...field,datasetRef:'primary'}));
 const spec={version:1,kind:'reportSpec',source:{kind:'report',containerId:'synthetic',stateKey:'synthetic',dataSourceRef:'rows'},title:'Calculation pipeline',parameters:{viewMode:'table',pageSize:100},layoutIntent:{kind:'stack',resultPanePosition:'bottom',blockOrder:['evidence']},refinements:[],calculatedFields:fields,datasets:[{id:'primary',dataSourceRef:'rows',request:{}}],blocks:[{id:'evidence',kind:'tableBlock',datasetRef:'primary',title:'Evidence',columns:[{key:fields[0].key||fields[0].id,label:'Computed value'}]}]};
 const input={reportSpec:spec,datasets:{primary:{rows:fixture.rows}}};
 const original=JSON.stringify(input);
 const fill=buildReportFillFromReportSpec(spec,input.datasets);
 assert.deepEqual(fill.datasets[0].rows,fixture.expectedRows,fixture.id+' source fill');
 const trusted=JSON.parse(bundled.ForgeAuthoredLowerer.materializeFill(JSON.stringify(input)));
 assert.deepEqual(trusted.reportFill.datasets[0].rows,fixture.expectedRows,fixture.id+' trusted source bundle');
 assert.equal(JSON.stringify(input),original,'Source inputs stay immutable');
}
console.log('PASS calculation conformance through source fill and trusted embedded bundle');

const cycleEnvelope=JSON.parse(fs.readFileSync(new URL('../../backend/reporting/materializer/testdata/authored-envelope.json',import.meta.url),'utf8'));
cycleEnvelope.builderDefinition.reportBuilder.calculatedFields=[
 {id:'a',expr:'b + 1'},
 {id:'b',compute:{type:'lag',sourceField:'a',orderBy:[{field:'spend',direction:'asc'}]}},
];
cycleEnvelope.state.selectedMeasures=['a'];
assert.throws(()=>bundled.ForgeAuthoredLowerer.lower(JSON.stringify(cycleEnvelope)),/cycle: a, b/,'Trusted authoring rejects invalid dependencies before any dataset fill');

const authoredEnvelope={schemaVersion:1,format:'forge.authoredReport',builderRef:'pipelineBuilder',reportDocument:{version:1,kind:'reportDocument',id:'pipeline',title:'Pipeline',blocks:[{id:'evidence',kind:'tableBlock',datasetRef:'primary',columns:[{key:'label',label:'Label'},{key:'score',label:'Score'}]}]},builderDefinition:{id:'pipelineBuilder',reportBuilder:{dataSourceRef:'rows',dimensions:[{id:'label',key:'label',label:'Label'}],measures:[{id:'value',key:'value',label:'Value'},{id:'capacity',key:'capacity',label:'Capacity'}],calculatedFields:corpus.runtimeCases.find(f=>f.id==='mixed_dependency_order').definitions,result:{defaultMode:'table',pageSize:100}}},state:{viewMode:'table',selectedDimensions:['label'],selectedMeasures:['score']},dataSources:{rows:{id:'rows',cardinality:'collection',backend:{kind:'inline',rows:[]}}}};
const lowered=JSON.parse(bundled.ForgeAuthoredLowerer.lower(JSON.stringify(authoredEnvelope)));
assert.deepEqual(new Set(lowered.calculatedFields.map(field=>field.id)),new Set(['score','previous','peak','normalized']));
const mixed=corpus.runtimeCases.find(f=>f.id==='mixed_dependency_order');
const loweredFill=JSON.parse(bundled.ForgeAuthoredLowerer.materializeFill(JSON.stringify({reportSpec:lowered,datasets:{primary:{rows:mixed.rows}}})));
assert.deepEqual(loweredFill.reportFill.datasets[0].rows,mixed.expectedRows,'Mixed dependency closure survives authored source lowering');
