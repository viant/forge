import assert from 'node:assert/strict';
import {dialogDataSourceRefs} from './dialogDataSourceRefs.js';
import {executeCommand} from './primitives/commandExecutor.js';

// Independently authored generic metadata; no private application fixtures.
const definitions={draft:{},writer:{},properties:{dataSourceRef:'record'},record:{},options:{},expression:{},mapped:{}};
const submit={dataSourceRef:'writer',refresh:[{dataSourceRef:'properties',bypassCache:true}]};
const dialog={content:{dataSourceRef:'draft',draftForm:{submit},items:[
 {dataSourceRef:'expression',visibleWhen:{source:'collection',dataSourceRef:'expression',selector:'0.enabled'}},
 {optionsDataSourceRef:'options'},
 {dataSourceRefs:{selected:'mapped'}},
]}};
assert.deepEqual(dialogDataSourceRefs(dialog,definitions,'draft',['properties','record']),['writer','expression','options','mapped']);
assert.deepEqual(dialogDataSourceRefs(dialog,definitions,'draft'),['writer','properties','expression','options','mapped','record'],'a refresh-only unmounted target retains its signal consumer');
assert.deepEqual(submit.refresh,[{dataSourceRef:'properties',bypassCache:true}]);
const visibleReader={content:{items:[{dataSourceRef:'properties'}],draftForm:{submit}}};
assert.deepEqual(dialogDataSourceRefs(visibleReader,definitions,'draft'),['properties','writer','record'],'a real field dependency still mounts the same reader and its parent');
const unrelated={content:{items:[{optionsDataSourceRef:'properties'}],mutationCommand:{dataSourceRef:'writer',refresh:[{dataSourceRef:'expression'}]}}};
assert.deepEqual(dialogDataSourceRefs(unrelated,definitions,'draft'),['properties','writer','expression','record'],'option dependencies remain independent from post-success refresh targets');

let refreshed=0;let written=0;
const state={value:{loading:false,error:null},peek(){return this.value;},subscribe(callback){this.callback=callback;callback(this.value);return()=>{};}};
const writer={signals:{control:state,collection:{peek:()=>[{id:1}]}},handlers:{dataSource:{setInputParameters(){},fetchCollection(){written++;state.value={loading:true,error:null};state.callback?.(state.value);queueMicrotask(()=>{state.value={loading:false,error:null};state.callback?.(state.value);});}}}};
const properties={handlers:{dataSource:{fetchCollection(options){refreshed++;assert.equal(options.cache.bypassCache,true);return Promise.resolve([{id:1}]);}}}};
const context={Context:ref=>({writer,properties}[ref])};
assert.equal(refreshed,0,'dialog dependency discovery does not execute a refresh');
const result=await executeCommand(context,submit);
assert.equal(result.status,'succeeded');assert.equal(written,1);assert.equal(refreshed,1,'successful command still refreshes its exact declared target');
console.log('dialogDataSourceRefs ✓ active dependencies mount; post-success refresh stays command-owned');
