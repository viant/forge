import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkbenchAPI} from './apiBindings.js';

test('workbench API dispatches only declared datasources, preserves argument zero/false and brackets writes',async()=>{
 const calls=[],pending=[];const context={Context:ref=>({handlers:{dataSource:{fetchRecords:async request=>{calls.push({ref,...request});return {items:[{id:1}]};}}}}),services:{}};
 const api=createWorkbenchAPI(context,{operations:{preview:{dataSourceRef:'preview',parameters:{reportId:{arg:0},'input.limit':{arg:1,default:50},'input.cube':{arg:2,default:false}}},save:{dataSourceRef:'save',mutation:true,parameters:{command:{arg:0}}}},lookups:{types:{dataSourceRef:'types',responseSelector:'items'}},resourceNamespace:'custom'},{onPendingChange:value=>pending.push(value)});
 assert.equal(calls.length,0);await api.preview('reader',0,false);assert.deepEqual(calls[0],{ref:'preview',parameters:{reportId:'reader',input:{limit:0,cube:false}}});await api.save({expectedSourceRevision:3});assert.deepEqual(pending,[1,0]);assert.deepEqual(await api.readLookup('types',{query:'literal'}),[{id:1}]);assert.equal(api.undeclared,undefined);assert.throws(()=>api.readLookup('unknown',{}),/lookup is not configured/);
});

test('optional deletion bindings preserve exact SDK payloads, results and failed mutation lifecycle',async()=>{
 const calls=[],pending=[];let failure;
 const context={Context:ref=>({handlers:{dataSource:{fetchRecords:async request=>{calls.push({ref,...request});if(failure)throw failure;return {rows:[{componentId:'component-a',deletedVersions:1}]};}}}})};
 assert.equal(createWorkbenchAPI(context,{}).deleteVersion,undefined);
 const api=createWorkbenchAPI(context,{operations:{deleteComponent:{dataSourceRef:'components-delete',mutation:true,parameters:{id:{arg:0},'input.etag':{arg:1}}},deleteVersion:{dataSourceRef:'versions-delete',mutation:true,parameters:{reportId:{arg:0},versionNo:{arg:1},expectedSourceRevision:{arg:2}}}}},{onPendingChange:value=>pending.push(value)});
 assert.deepEqual(await api.deleteComponent('component-a',3),{componentId:'component-a',deletedVersions:1});
 await api.deleteVersion('component-a',2,14);
 assert.deepEqual(calls,[{ref:'components-delete',parameters:{id:'component-a',input:{etag:3}}},{ref:'versions-delete',parameters:{reportId:'component-a',versionNo:2,expectedSourceRevision:14}}]);
 failure=Object.assign(new Error('Retained release binding'),{code:'conflict'});
 await assert.rejects(api.deleteVersion('component-a',2,14),error=>error===failure);
 assert.deepEqual(pending,[1,0,1,0,1,0]);assert.equal(calls.length,3);
});
