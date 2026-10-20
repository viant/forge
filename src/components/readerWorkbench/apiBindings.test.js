import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkbenchAPI} from './apiBindings.js';

test('workbench API dispatches only declared datasources, preserves argument zero/false and brackets writes',async()=>{
 const calls=[],pending=[];const context={Context:ref=>({handlers:{dataSource:{fetchRecords:async request=>{calls.push({ref,...request});return {items:[{id:1}]};}}}}),services:{}};
 const api=createWorkbenchAPI(context,{operations:{preview:{dataSourceRef:'preview',parameters:{reportId:{arg:0},'input.limit':{arg:1,default:50},'input.cube':{arg:2,default:false}}},save:{dataSourceRef:'save',mutation:true,parameters:{command:{arg:0}}}},lookups:{types:{dataSourceRef:'types',responseSelector:'items'}},resourceNamespace:'custom'},{onPendingChange:value=>pending.push(value)});
 assert.equal(calls.length,0);await api.preview('reader',0,false);assert.deepEqual(calls[0],{ref:'preview',parameters:{reportId:'reader',input:{limit:0,cube:false}}});await api.save({expectedSourceRevision:3});assert.deepEqual(pending,[1,0]);assert.deepEqual(await api.readLookup('types',{query:'literal'}),[{id:1}]);assert.equal(api.undeclared,undefined);assert.throws(()=>api.readLookup('unknown',{}),/lookup is not configured/);
});
