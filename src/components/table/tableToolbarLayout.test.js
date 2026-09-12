import assert from 'node:assert/strict';
import {tablePrimaryToolbarItems} from './tableToolbarLayout.js';
const items=[{id:'pagination',placement:'footer'},{id:'customPager',type:'pagination',align:'left'},{id:'export',placement:'bottom',icon:'export'},{id:'filterList',align:'right'}];
assert.deepEqual(tablePrimaryToolbarItems(items),[{id:'export',icon:'export',align:'left'},{id:'filterList',align:'right'}]);
assert.equal(items[2].placement,'bottom');
console.log('Legacy/custom pagination deduplicated; other actions retained.');
