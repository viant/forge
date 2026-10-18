import test from 'node:test';
import assert from 'node:assert/strict';
import {createTransportConnector} from './connectorTransport.js';
test('injected transport handles every operation without HTTP fallback',async()=>{
 const calls=[];const connector=createTransportConnector({id:'orders',service:{uri:'https://must-not-run.invalid'}},{transport:async request=>{calls.push(request);return {rows:[]};}});
 for(const operation of ['get','post','patch','put','del'])assert.deepEqual(await connector[operation]({inputParameters:{account:'opaque'}}),{rows:[]});
 assert.equal(await connector.request({}),'{"rows":[]}');
 assert.deepEqual(calls.map(call=>call.operation),['get','post','patch','put','delete','request']);
 assert.equal(calls[0].options.inputParameters.account,'opaque');
});
test('denial and cancellation never downgrade transport',async()=>{
 const denied=createTransportConnector({id:'orders'},{transport:async()=>{throw new Error('denied');}});
 await assert.rejects(denied.get({}),/denied/);
 let called=false;const controller=new AbortController();controller.abort();
 const connector=createTransportConnector({id:'orders'},{transport:async()=>{called=true;}});
 await assert.rejects(connector.get({signal:controller.signal}),/aborted/);assert.equal(called,false);
 assert.throws(()=>createTransportConnector({}, {transport:null}),/Invalid/);
});
test('transport keeps the window attachment identity independently of descriptor fields',async()=>{
 let captured;
 const connector=createTransportConnector({service:{uri:'/unused'}},{dataSourceRef:'attachedRows',transport:async request=>{captured=request;return {data:[]};}});
 await connector.get({});
 assert.equal(captured.dataSourceRef,'attachedRows');
 assert.equal(captured.dataSource.id,undefined);
});

test('transport preserves authored paging inputs and target without enabling pagination implicitly',async()=>{
 const requests=[]; const targetContext={actorRef:'actor-opaque',provider:'provider-opaque',surface:'hosted'};
 const runtime={targetContext,transport:async request=>{requests.push(request);return {data:[]};}};
 const unpaged=createTransportConnector({id:'unpaged'},runtime);
 await unpaged.get({page:2,inputParameters:{request:{filter:'opaque'}}});
 assert.deepEqual(requests.at(-1).options.inputParameters,{request:{filter:'opaque'}});
 const offset=createTransportConnector({id:'offset',paging:{mode:'offset',size:25,parameters:{page:'skip',size:'take'}}},runtime);
 await offset.get({page:3,inputParameters:{request:{filter:'opaque'}}});
 assert.deepEqual(requests.at(-1).options.inputParameters,{request:{filter:'opaque'},skip:50,take:25});
 const cursor=createTransportConnector({id:'cursor',paging:{mode:'cursor',parameters:{page:'continuation'}}},runtime);
 await cursor.get({page:2,cursor:{opaque:'token'},inputParameters:{request:{filter:'opaque'}}});
 assert.deepEqual(requests.at(-1).options.inputParameters,{request:{filter:'opaque'},continuation:{opaque:'token'}});
 assert.equal(requests.at(-1).targetContext,targetContext);
});

test('transport maps an exact-ID quick filter into the cube body before offset paging',async()=>{
 const requests=[];
 const dataSource={id:'exchange',paging:{enabled:true,mode:'offset',size:10,parameters:{page:'offset',size:'limit'}},
  parameters:[{name:'filters.publisherIds',in:'filter',location:'Id',codec:{name:'int[]'}}]};
 const connector=createTransportConnector(dataSource,{transport:async request=>{requests.push(request);return {data:[]};}});
 const filter={Id:'174',Status:'active'};
 await connector.get({page:3,filter,inputParameters:{filters:{audienceIds:[11],orderIds:[22],period:'month'},orderBy:['total_spend:desc']}});
 assert.deepEqual(requests[0].options.filter,{Status:'active'});
 assert.deepEqual(requests[0].options.inputParameters,{filters:{audienceIds:[11],orderIds:[22],period:'month',publisherIds:[174]},
  orderBy:['total_spend:desc'],offset:20,limit:10});
 assert.deepEqual(filter,{Id:'174',Status:'active'},'caller filter is immutable');
});
