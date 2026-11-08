import assert from 'node:assert/strict';
import {projectCurrentReport, registerReportWindowActions, invokeReportWindowAction} from './reportActions.js';

const source = {
  ok: true, windowId: 'example', reportId: 'example-report', status: 'ready',
  request: {parameters: {from: '2026-01-01'}}, draftParameters: {from: '2026-01-02'},
  hasCompletedRun: true,
  reportSpec: {title: 'Example', scope: {params: [{id: 'from'}]}, datasets: [{id:'values'}], blocks: [{id:'tabs',kind:'tabGroupBlock'}, {id:'chart',kind:'chartBlock'}]},
  reportFill: {datasets: [{id:'values',rows:[{value:42}]}], blocks:[{id:'chart',kind:'chartBlock',content:{value:42}}]},
};
const original = structuredClone(source);
assert.equal(projectCurrentReport(source), source);
assert.equal(projectCurrentReport(source, {raw:true,state:true}), source);
const state = projectCurrentReport(source,{state:true});
assert.equal(state.status,'ready');
assert.deepEqual(state.request,source.request);
assert.deepEqual(state.draftParameters,source.draftParameters);
assert.equal(state.reportFill,undefined);
assert.equal(state.reportSpec,undefined);
assert.deepEqual(projectCurrentReport(source,{inputs:true}).reportSpec,{scope:source.reportSpec.scope});
assert.deepEqual(projectCurrentReport(source,{tabs:true}).reportSpec.blocks,[source.reportSpec.blocks[0]]);
assert.deepEqual(projectCurrentReport(source,{tabs:true,visuals:true}).reportSpec.blocks,source.reportSpec.blocks);
assert.deepEqual(projectCurrentReport(source,{data:true}).reportFill,source.reportFill);
assert.equal(projectCurrentReport(source,{data:true}).reportSpec,undefined);
assert.deepEqual(projectCurrentReport(source,{sources:true}).reportSpec,{datasets:source.reportSpec.datasets});
assert.deepEqual(projectCurrentReport(source,{description:true}).reportSpec,{title:'Example'});
assert.deepEqual(source,original);
const dispose=registerReportWindowActions('example',{getCurrent:()=>source});
assert.deepEqual(await invokeReportWindowAction('example','getCurrent',{include:{state:true}}),state);
assert.deepEqual(await invokeReportWindowAction('example','getCurrent',{}),source);
const fullSnapshot = await invokeReportWindowAction('example','getCurrent',{});
assert.notEqual(fullSnapshot.reportFill, source.reportFill);
const stateSnapshot = await invokeReportWindowAction('example','getCurrent',{include:{state:true}});
assert.notEqual(stateSnapshot.draftParameters, source.draftParameters);
dispose();

const release = registerReportWindowActions('state-only', {getCurrent: () => ({
  ok: true, status: 'ready', get reportFill() { throw Error('unexpected data read'); }
})});
assert.equal((await invokeReportWindowAction('state-only','getCurrent',{include:{state:true}})).status,'ready');
release();
console.log('Report projection checks passed');
