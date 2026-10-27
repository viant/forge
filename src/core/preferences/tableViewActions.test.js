import test from 'node:test';
import assert from 'node:assert/strict';
import {createTableViewActionAdapter} from './tableViewActions.js';
import {createTableViewSession} from './tableViews.js';

test('authored view operations preserve payloads and resolve the current context handler',async()=>{
 const calls=[];let rows=[];
 const handlers={
  'views.list':({context,key})=>{calls.push(['list',context,key]);return rows;},
  'views.save':({context,key,input})=>{calls.push(['save',context,key,input]);rows=[{...input,id:input.id??7}];},
  'views.remove':({context,key,id})=>{calls.push(['remove',context,key,id]);rows=[];},
 };
 const context={lookupHandler:name=>handlers[name]};
 const adapter=createTableViewActionAdapter(context,{list:'views.list',save:'views.save',remove:'views.remove'});
 let state;const session=createTableViewSession(adapter,'grid',next=>state=next);
 const input={name:'View',preferences:{version:1,columns:[{id:'a',visible:false,width:120}]}};
 assert.equal(await session.save(input),true);assert.equal(state.views[0].id,7);
 assert.deepEqual(calls[0],['save',context,'grid',input]);assert.equal(Object.hasOwn(calls[0][3],'id'),false);
 await session.remove(7);assert.deepEqual(state.views,[]);
 handlers['views.list']=()=>[{id:9,...input}];await session.load();assert.equal(state.views[0].id,9);
 const raw={name:'Wire input',preferences:{width:0,flag:false,value:null}};await adapter.save('grid',raw);assert.deepEqual(calls.at(-1)[3],raw);
});

test('unconfigured mutations stay unavailable and lookup errors remain visible',async()=>{
 const context={lookupHandler:()=>{throw new Error('Action unavailable');}};
 const adapter=createTableViewActionAdapter(context,{list:'views.list'});
 assert.equal(adapter.save,undefined);assert.equal(adapter.remove,undefined);
 let state;const session=createTableViewSession(adapter,'grid',next=>state=next);
 assert.equal(await session.load(),false);assert.match(state.error.message,/Action unavailable/);
 assert.equal(createTableViewActionAdapter(context,null),null);
 assert.equal(createTableViewActionAdapter(context,[]),null);
});
