import assert from 'node:assert/strict';
import {reconcileMultiSelection} from './dataSourceSelection.js';
const key=row=>String(row.id),selected={selection:[{id:1,name:'old'},{id:26,name:'old26'}]};
assert.deepEqual(reconcileMultiSelection(selected,[{id:26,name:'fresh'}],key).selection,[{id:26,name:'fresh'}]);
assert.deepEqual(reconcileMultiSelection(selected,[{id:26,name:'fresh'}],key,{preserveOffPage:true,pageChanged:true}).selection,[{id:1,name:'old'},{id:26,name:'fresh'}]);
assert.deepEqual(reconcileMultiSelection(selected,[],key,{preserveOffPage:true,pageChanged:false,previousRecords:[{id:26}]}).selection,[{id:1,name:'old'}]);
assert.deepEqual(reconcileMultiSelection({selection:[]},[{id:26}],key,{preserveOffPage:false}).selection,[]);
console.log('Cross-page reconciliation preserves off-page IDs, refreshes visible rows and removes deleted page rows');
