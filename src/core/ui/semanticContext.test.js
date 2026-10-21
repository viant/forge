import assert from 'node:assert/strict';
import {buildSemanticUIContext} from './semanticContext.js';
const window = {viewState:{tabs:{workspace:'properties',nested:'advanced'}},dataSources:{rows:{selection:{selection:[{id:7,name:'Private name',password:'secret'},{id:8}]},input:{page:2,pageSize:25,sort:[{columnId:'name',direction:'asc'}]},filter:{Name:'Example',password:'private',access_token:'private',opaque:'Bearer private'},form:{password:'private'},formStatus:{dirty:true}}},dialogs:[{id:'picker',open:true,args:{token:'private'}}]};
const context = buildSemanticUIContext(window);
assert.deepEqual(context.tabs,[{containerId:'nested',tabId:'advanced'},{containerId:'workspace',tabId:'properties'}]);
assert.deepEqual(context.sources,[{dataSourceRef:'rows',selectedIds:[7,8],filters:{Name:'Example'},sort:[{field:'name',direction:'asc'}],page:2,pageSize:25,dirty:true,changedFields:[]}]);
assert.deepEqual(context.dialogs,[{id:'picker',open:true}]);
assert.ok(!JSON.stringify(context).includes('private'));
window.metadata={view:{controls:[{id:'credentialEditor',dataSourceRef:'rows',dataField:'Name',type:'password'}]}};
assert.equal(buildSemanticUIContext(window).sources[0].filters,undefined);
const oversized={dataSources:Object.fromEntries(Array.from({length:1000},(_,n)=>['rows'+n,{selection:{selection:Array.from({length:100},(_,i)=>({id:'x'.repeat(128)+i}))},filter:{safe:'x'.repeat(128)},formStatus:{dirty:false}}]))};
assert.ok(JSON.stringify(buildSemanticUIContext(oversized)).length < 10000);
console.log('semantic UI context: bounded current selection/tabs/filter/page/dirty; sensitive values excluded');

assert.equal(context.revision,buildSemanticUIContext({...window,metadata:undefined}).revision);

assert.equal(typeof buildSemanticUIContext(window)?.then,'undefined');

const compound=buildSemanticUIContext({dataSources:{rows:{identityFields:['feeTypeId','ownerId'],selection:{selected:{feeTypeId:3,ownerId:7,secret:'private'}}}}});
assert.deepEqual(compound.sources[0].selectedIdentities,[{feeTypeId:3,ownerId:7}]);
assert.notEqual(compound.revision,buildSemanticUIContext({}).revision);

const many={dataSources:{...Object.fromEntries(Array.from({length:50},(_,i)=>['aaa'+i,{}])),properties:{formStatus:{dirty:true},selection:{selected:{id:7}},form:{id:7,name:'Edited'}}}};
assert.equal(buildSemanticUIContext(many).sources[0].dataSourceRef,'properties');
assert.equal(buildSemanticUIContext(many,{focusedDataSourceRef:'aaa9'}).sources[0].dataSourceRef,'aaa9');

for(const credential of ['Basic opaque','https://example.invalid/?api_key=opaque','https://example.invalid/#access_token=opaque'])assert.equal(buildSemanticUIContext({dataSources:{rows:{filter:{Name:credential}}}}).sources[0].filters,undefined);
