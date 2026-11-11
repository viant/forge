import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildReportBuilderRuntimePreview,buildReportBuilderRuntimePreviewArtifacts} from './reportBuilderRuntimePreview.js';
import {fetchReportRuntimePreviewDatasetPayloadResult} from './useReportRuntimePreviewDatasetPayloads.js';
import {buildReportBuilderAuthoredRuntimePreviewState} from './reportBuilderResultFrame.js';
import {buildReportFillFromReportSpec} from '../../reporting/reportFillModel.js';

// Independent neutral fixture also exercises the strict server/export boundary.
const fixture=JSON.parse(readFileSync(new URL('../../../backend/reporting/materializer/testdata/empty-chart-report.json',import.meta.url)));
const model={reportSpec:fixture.reportSpec,document:{version:1,kind:'reportDocument',id:'examplePreview',title:'Example preview',blocks:[]}};
const input={model,rows:fixture.datasets.primary.rows,datasetPayloads:fixture.datasets};
assert.equal(buildReportBuilderRuntimePreviewArtifacts({...input,datasetPayloads:{}}),null,'missing auxiliary input is pending, not completed empty');
assert.equal(buildReportBuilderRuntimePreviewArtifacts({...input,loading:true}),null,'pending rows must not create executable or export artifacts');
assert.equal(buildReportBuilderRuntimePreviewArtifacts({...input,error:new Error('Source request failed.')}),null,'failed reads must not create export artifacts');
assert.throws(()=>buildReportBuilderRuntimePreviewArtifacts({...input,datasetPayloads:{...fixture.datasets,empty:{rows:[],diagnostics:[{severity:'error',code:'source_failed',message:'Source request failed.'}]}}}),/requires complete empty dataset/);
const complete=buildReportBuilderRuntimePreviewArtifacts(input);
assert.ok(complete?.reportFill);assert.ok(complete?.reportPrint);
assert.deepEqual(complete.reportFill.blocks.find(block=>block.id===fixture.reportSpec.blocks[1].id).content.resolvedChart.rows,[],'explicitly completed empty source remains ordinary no-data');
assert.throws(()=>buildReportFillFromReportSpec(fixture.reportSpec,{primary:fixture.datasets.primary}),/requires complete empty dataset/,'strict materialization must still reject missing input');
assert.throws(()=>buildReportFillFromReportSpec(fixture.reportSpec,{...fixture.datasets,empty:{rows:[],hasMore:true}}),/requires complete empty dataset/,'partial empty source is not complete');
console.log('Report builder waits for dataset readiness without weakening materialization.');

const loadingState=buildReportBuilderAuthoredRuntimePreviewState({runtimePreviewEnabled:true,canRunReport:true,runtimePreviewArtifact:null,runtimePreviewDatasetState:{loading:true}});
assert.ok(loadingState.loadingState);assert.equal(loadingState.canRenderRuntime,false);
const errorState=buildReportBuilderAuthoredRuntimePreviewState({runtimePreviewEnabled:true,canRunReport:true,runtimePreviewArtifact:null,runtimePreviewRowsSource:{error:new Error('Source request failed.')},runtimePreviewErrorDescription:'Source request failed. Retry loading the data.'});
assert.equal(errorState.errorState.description,'Source request failed. Retry loading the data.');assert.equal(errorState.canRenderRuntime,false);
const legacyModel={...model,reportSpec:{...model.reportSpec,datasets:[model.reportSpec.datasets[0]],blocks:model.reportSpec.blocks.filter(block=>block.datasetRef==='primary')}};
const legacy=buildReportBuilderRuntimePreviewArtifacts({model:legacyModel,rows:fixture.datasets.primary.rows});
assert.ok(legacy?.reportFill);assert.equal(legacy.reportFill.datasets[0].rows.length,2);

const failedRead=await fetchReportRuntimePreviewDatasetPayloadResult({builderContext:{Context(){throw new Error('Source request failed.');}},datasets:[{id:'auxiliary',dataSourceRef:'auxiliaryReader',request:{}}]});
assert.equal(failedRead.error.code,'runtimePreviewDatasetFetchFailed');
assert.deepEqual(failedRead.freshDatasetIds,[],'a failed read is not a fresh completed dataset');
assert.deepEqual(failedRead.payloads.auxiliary.rows,[]);

for(const payload of [{rows:[],hasMore:true},{rows:[],diagnostics:[{severity:'warning',code:'incomplete',message:'Result incomplete.'}]},{}]){
 const completed={...input,datasetPayloads:{...fixture.datasets,empty:payload}};
 assert.throws(()=>buildReportBuilderRuntimePreviewArtifacts(completed),/requires complete empty dataset/);
 const rejected=buildReportBuilderRuntimePreview(completed);
 assert.ok(rejected.error);assert.equal(rejected.reportFill,undefined);assert.equal(rejected.reportPrint,undefined);assert.equal(rejected.exportRequest,undefined);
 const rejectedState=buildReportBuilderAuthoredRuntimePreviewState({runtimePreviewEnabled:true,canRunReport:true,runtimePreviewArtifact:rejected,runtimePreviewErrorDescription:'Completed result could not be materialized. Retry the data source.'});
 assert.ok(rejectedState.errorState);assert.equal(rejectedState.canRenderRuntime,false);assert.equal(rejectedState.loadingState,null);
 const reportState=buildReportBuilderAuthoredRuntimePreviewState({runtimePreviewEnabled:true,canRunReport:true,runtimePreviewArtifact:rejected,presentationMode:'report'});
 assert.match(reportState.errorState.description,/requires complete empty dataset/,'report presentation must retain the materialization failure cause');
 assert.doesNotMatch(reportState.errorState.description,/authorized scope/);
}
