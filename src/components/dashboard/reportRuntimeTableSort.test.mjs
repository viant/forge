import assert from 'node:assert/strict';
import {boundReportDatasetSortHandler, reportDatasetSortField, primaryReportOrder} from './reportRuntimeTableSort.js';
const universe=[40,30,1,99,2,98]; // independently invented inventory counts
let parameters={actor:'fixed',query:{filters:{region:'east'},limit:2,offset:2,orderBy:['count asc']},other:{offset:70}};
let page=2,loading=false,result;
const source={handlers:{dataSource:{setSort:({parameter,value})=>{parameters={...parameters,[parameter]:value};page=1;source.handlers.dataSource.fetchCollection();},peekInput:()=>({parameters}),setInputParameters:next=>{parameters=next;},setPage:next=>{page=next;},setLoading:next=>{loading=next;},setError:()=>{},fetchCollection:()=>{
 const descending=parameters.query.orderBy[0].endsWith('desc');
 result=[...universe].sort((a,b)=>descending?b-a:a-b).slice(parameters.query.offset,parameters.query.offset+parameters.query.limit);
}}}};
const config={datasetBindings:{records:{dataSourceRef:'reader',queryPath:'query'}},reportSpec:{datasets:[{id:'records'}],blocks:[{id:'inventory',kind:'tableBlock',datasetRef:'records',columns:[{key:'amount',sourceKey:'count'}]}]}};
const handler=boundReportDatasetSortHandler(config,{Context:id=>{assert.equal(id,'reader');return source;}});
for(const [direction,expected] of [['asc',[1,2]],['desc',[99,98]]]){
 handler({datasetId:'records',blockId:'inventory',sort:{key:'amount',direction}});
 assert.deepEqual(result,expected);assert.equal(page,1);assert.equal(parameters.query.offset,0);assert.equal(parameters.query.limit,2);
 assert.deepEqual(parameters.query.filters,{region:'east'});assert.deepEqual(parameters.other,{offset:70});assert.equal(parameters.actor,'fixed');
}
assert.throws(()=>handler({datasetId:'records',blockId:'inventory',sort:{key:'injected',direction:'asc'}}),/Invalid/);
console.log('Bound report global server sorting and request preservation passed.');

assert.deepEqual(primaryReportOrder(['count desc', 'id asc', 'label desc'], 'count', 'asc'), ['count asc', 'id asc', 'label desc']);
for (const column of [
 {key:'owner',sourceKey:'ownerId',displayKey:'owner.name'}, {key:'owner',dataType:'object'},
 {key:'owner.name'}, {key:'count',displayValueMap:{1:'One'}}, {key:'doubled'},
]) {
 const spec={...config.reportSpec,calculatedFields:[{id:'doubled',datasetRef:'records',expr:'count * 2'}]};
 const block={...spec.blocks[0],columns:[column]};spec.blocks=[block];
 assert.equal(reportDatasetSortField(spec,block,column),null);
 const rejected=boundReportDatasetSortHandler({...config,reportSpec:spec},{Context:()=>source});
 const before=JSON.stringify(parameters);
 assert.throws(()=>rejected({datasetId:'records',blockId:'inventory',sort:{key:column.key,direction:'asc'}}),/complete data/);
 assert.equal(JSON.stringify(parameters),before,'unsupported presentation fields never reach producer inputs');
}

// Different primary choices never accumulate historical viewer sorts. Only the
// immutable admitted secondary order remains, while current scope stays intact.
const repeatedConfig={...config,reportSpec:{datasets:[{id:'records',request:{orderBy:['id asc']}}],blocks:[{id:'inventory',kind:'tableBlock',datasetRef:'records',columns:[{key:'count'},{key:'size'},{key:'weight'}]}]}};
let repeated={query:{filters:{region:'west'},limit:2,offset:4,orderBy:['id asc']},other:{offset:70}};
const setSortCalls=[];
const repeatedHandler=boundReportDatasetSortHandler(repeatedConfig,{Context:()=>({handlers:{dataSource:{
 peekInput:()=>({parameters:repeated}),setSort:input=>{setSortCalls.push(input);repeated={...repeated,[input.parameter]:input.value};},
}}})});
for(const key of ['count','size','weight','count','size']){
 repeatedHandler({datasetId:'records',blockId:'inventory',sort:{key,direction:'desc'}});
 assert.deepEqual(repeated.query.orderBy,[`${key} desc`,'id asc']);
 assert.deepEqual(repeated.query.filters,{region:'west'});assert.deepEqual(repeated.other,{offset:70});assert.equal(repeated.query.offset,0);
}
assert.equal(setSortCalls.length,5);

// No authored ordering: capture initial source ties once before viewer mutation.
let fallbackInput={query:{filters:{region:'north'},limit:2,offset:2,orderBy:['id asc']}};
const fallbackSource={handlers:{dataSource:{peekInput:()=>({parameters:fallbackInput}),setSort:({parameter,value})=>{fallbackInput={...fallbackInput,[parameter]:value};}}}};
const fallbackConfig={...repeatedConfig,reportSpec:{...repeatedConfig.reportSpec,datasets:[{id:'records'}]}};
const fallbackOrders=new Map();
for (const key of ['count','size','weight','count']) {
 // Recreating the adapter during host renders must retain the same tie snapshot.
 const invoke=boundReportDatasetSortHandler(fallbackConfig,{Context:()=>fallbackSource},fallbackOrders);
 invoke({datasetId:'records',blockId:'inventory',sort:{key,direction:'asc'}});
 assert.deepEqual(fallbackInput.query.orderBy,[`${key} asc`,'id asc']);
 assert.deepEqual(fallbackInput.query.filters,{region:'north'});
}
