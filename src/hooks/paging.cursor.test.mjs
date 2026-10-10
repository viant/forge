import test from 'node:test';
import assert from 'node:assert/strict';
import {createCursorPagingSession,resolvePagingValues,withPagingInputs} from './paging.js';
import {withFetchedPageInfo} from '../components/dataSourceFetchState.js';
import {buildDatasourceFetchInputs} from './datasourceRequest.js';
import {createTransportConnector} from './connectorTransport.js';
import {extractData} from '../components/dataSourceExtract.js';
import {canNavigateNext,resolvePaginationState} from '../components/table/basic/PaginationState.js';
const paging={enabled:true,mode:'cursor',size:1,parameters:{page:'resumeToken',size:'batchSize'},dataInfoSelectors:{hasMore:'remaining',nextCursor:'nextToken'}};
const association={window:'window://generic/one',target:{device:'phone'},alias:'rows',filter:{q:'a'},inputs:{account:7},sort:['name']};
test('existing connector and Table controls use opaque cursor pages and disable next at end',async()=>{
 const session=createCursorPagingSession(),calls=[];
 const connector=createTransportConnector({id:'rows',paging},{transport:async r=>{calls.push(r.options.inputParameters);return {reply:{widgets:[{id:calls.length}]},nav:calls.length===1?{remaining:true,nextToken:'opaque+/=😎'}:{remaining:false}};}});
 let request=session.begin(1,association);
 let payload=await connector.get({page:request.page,cursor:request.cursor,inputParameters:{term:'a'}});
 let {info}=extractData({data:'reply.widgets',dataInfo:'nav'},paging,payload);
 info=session.finish(request,info);
 assert.equal(canNavigateNext(resolvePaginationState({info})),true);
 assert.deepEqual(calls[0],{term:'a',batchSize:1});
 request=session.begin(2,association);
 payload=await connector.get({page:request.page,cursor:request.cursor,inputParameters:{term:'a'}});
 info=session.finish(request,extractData({data:'reply.widgets',dataInfo:'nav'},paging,payload).info);
 assert.deepEqual(calls[1],{term:'a',resumeToken:'opaque+/=😎',batchSize:1});
 assert.equal(canNavigateNext(resolvePaginationState({info})),false);
 assert.throws(()=>session.begin(3,association),/no admitted/);
 assert.equal(session.begin(1,association).cursor,undefined);
 assert.deepEqual(withPagingInputs({resumeToken:'stale'},resolvePagingValues(1,{...paging,parameters:{page:'resumeToken'}})),{});
});
test('each full input or window/target association change resets token history for same alias',()=>{
 for(const changed of [{...association,window:'window://generic/two'},{...association,target:{device:'desktop'}},{...association,filter:{q:'b'}},{...association,inputs:{account:8}},{...association,sort:['id']}]){
  const session=createCursorPagingSession();let r=session.begin(1,association);
  session.finish(r,{hasMore:true,nextCursor:'only-window-one'});
  assert.equal(session.begin(2,association).cursor,'only-window-one');
  const reset=session.begin(2,changed);
  assert.equal(reset.page,1);assert.equal(reset.cursor,undefined);
 }
});
test('invalid, repeated and stale continuations never admit another page',()=>{
 const session=createCursorPagingSession();let r=session.begin(1,association);
 assert.throws(()=>session.finish(r,{hasMore:'true',nextCursor:'a'}),/boolean/);
 assert.throws(()=>session.finish(r,{hasMore:true}),/missing/);
 session.finish(r,{hasMore:true,nextCursor:'a'});
 r=session.begin(2,association);
 assert.throws(()=>session.finish(r,{hasMore:true,nextCursor:'a'}),/repeated/);
 assert.throws(()=>session.begin(3,association),/no admitted/);
 const stale=r;session.begin(2,{...association,window:'other'});
 assert.equal(session.finish(stale,{hasMore:true,nextCursor:'leak'}),null);
});

test('cursor token ownership survives datasource HTTP filter/input merging',()=>{
 const first=resolvePagingValues(1,paging);
 assert.deepEqual(buildDatasourceFetchInputs({inputParameters:{term:'q',resumeToken:'stale'},filter:{resumeToken:'other'},pagingValues:first}),{term:'q',batchSize:1});
 const next=resolvePagingValues(2,paging,'exact');
 assert.equal(buildDatasourceFetchInputs({filter:{resumeToken:'wrong'},pagingValues:next}).resumeToken,'exact');
});

test('explicit page/offset boolean EOF wins over a full final page and counts; empty mode unchanged',()=>{
 for(const mode of ['page','offset']){
  const config={enabled:true,mode,size:2,dataInfoSelectors:{hasMore:'remaining'}};
  const extracted=extractData({data:'rows',dataInfo:'nav'},config,{rows:[{id:1},{id:2}],nav:{remaining:false}});
  const info=withFetchedPageInfo(extracted.info,1,true,{returnedCount:2,pageSize:2,mode,hasMoreSelector:'remaining'});
  assert.equal(info.hasMore,false);assert.equal(canNavigateNext(resolvePaginationState({info})),false);
  const inconsistent=withFetchedPageInfo({hasMore:false,pageCount:3},1,true,{returnedCount:2,pageSize:2,mode,hasMoreSelector:'remaining'});
  assert.equal(canNavigateNext(resolvePaginationState({info:inconsistent})),false);
  assert.throws(()=>extractData({data:'rows',dataInfo:'nav'},config,{rows:[{id:1}],nav:{remaining:'false'}}),/boolean/);
 }
 const legacy=withFetchedPageInfo({hasMore:false},1,true,{returnedCount:2,pageSize:2,mode:'',hasMoreSelector:'remaining'});
 assert.equal(legacy.hasMore,true);
});

test('browser refuses all numeric/object cursor parts without original JSON precision',async()=>{
 const decoded=await new Response('{"scalar":1.00000000000000001,"object":{"ordinal":1.00000000000000001}}').json();
 assert.equal(decoded.scalar,1);
 for(const token of [9223372036854775807,{ordinal:9223372036854775807},0.12345,42,decoded.scalar,decoded.object]){
  const session=createCursorPagingSession();const request=session.begin(1,association);
  assert.throws(()=>session.finish(request,{hasMore:true,nextCursor:token}),/lossless transport/);
  assert.throws(()=>session.begin(2,association),/no admitted/);
 }
});

test('browser cursor accepts strings booleans and objects without numeric parts',()=>{
 for(const token of ['opaque',true,{key:'opaque',valid:true,nested:['tag',false]}]) {
  const session=createCursorPagingSession();const request=session.begin(1,association);
  session.finish(request,{hasMore:true,nextCursor:token});
  assert.deepEqual(session.begin(2,association).cursor,token);
 }
});
