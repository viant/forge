import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverViewColumns,sqlInspection} from './readerColumnDiscovery.js';

test('requests native SQL discovery once and resolves exact views, including expressions',async()=>{
 const calls=[];
 const root={name:'Root',namespace:'summary',columns:[{name:'TotalRows',source:'total_rows',type:{name:'int'}}],relations:[{view:{name:'Detail',namespace:'details',columns:[{name:'Calculated',source:'calculated'}]}}]};
 const api={getTable(){throw new Error('table catalog must not be used');},async inspectVersion(...args){calls.push(args);return {version:{sourceRevision:4},structure:{component:{rootView:root}}};}};
 const inspect=sqlInspection(api,{reportId:'report',versionNo:2,sourceRevision:4});
 const [summary,detail]=await Promise.all([discoverViewColumns({namespace:'summary'},inspect),discoverViewColumns({name:'Detail'},inspect)]);
 assert.equal(summary.columns[0].source,'total_rows');
 assert.equal(detail.columns[0].source,'calculated');
 assert.deepEqual(calls,[['report',2,{discoverColumns:true}]]);
});

test('rejects stale discovery and native discovery diagnostics',async()=>{
 await assert.rejects(sqlInspection({inspectVersion:async()=>({version:{sourceRevision:5}})},{reportId:'report',versionNo:1,sourceRevision:4})(),/component changed/);
 await assert.rejects(sqlInspection({inspectVersion:async()=>({diagnostics:[{code:'column_inspection_unavailable'}]})},{reportId:'report',versionNo:1})(),/SQL column discovery is unavailable/);
});

test('does not substitute another view or physical table columns',async()=>{
 await assert.rejects(discoverViewColumns({name:'absent'},async()=>({name:'other',columns:[{name:'ID'}]})),/no columns for this view/);
});
