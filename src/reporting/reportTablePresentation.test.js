import assert from 'node:assert/strict';
import {applyReportTablePresentations} from './reportTablePresentation.js';
import {renderReportTableCsv} from './reportTableCsv.js';

const columns = [{key:'id',label:'ID'}, {key:'name',label:'Name'}, {key:'value',label:'Value',type:'number'}];
const row = (id, name, value) => ({cells:[{key:'id',value:id,displayValue:id},{key:'name',value:name,displayValue:name},{key:'value',value,displayValue:value}]});
const rows = [row('9007199254740993','Cedar',null),row('9007199254740992','Cedar',0),...Array.from({length:30},(_,i)=>row(String(i),'Birch',i))];
const fill = {datasets:[{id:'primary',rows:[{original:true}]}],blocks:[
 {id:'detail',kind:'tableBlock',content:{columns,rowCount:rows.length,resolvedRows:rows}},
 {id:'other',kind:'tableBlock',content:{columns,rowCount:rows.length,resolvedRows:rows}},
 {id:'chart',kind:'chartBlock',content:{total:123}},
]};
const before = JSON.stringify(fill);
const result = applyReportTablePresentations(fill,{detail:{filter:'cedar',sort:{key:'id',direction:'asc'}}});
assert.deepEqual(result.blocks[0].content.resolvedRows.map(r=>r.cells[0].value),['9007199254740992','9007199254740993']);
assert.equal(result.blocks[0].content.rowCount,2);
assert.equal(result.datasets,fill.datasets);
assert.equal(result.blocks[1],fill.blocks[1]);
assert.equal(result.blocks[2],fill.blocks[2]);
assert.equal(JSON.stringify(fill),before);
assert.match(renderReportTableCsv(result.blocks[0]),/9007199254740992,Cedar,0\n9007199254740993,Cedar,\n$/);
const complete = applyReportTablePresentations(fill,{detail:{sort:{key:'value',direction:'desc'}}});
assert.equal(complete.blocks[0].content.resolvedRows.length,32,'no display-page truncation');
assert.equal(complete.blocks[0].content.resolvedRows.at(-1).cells[2].value,null);
assert.equal(applyReportTablePresentations(fill,{detail:{filter:'no match'}}).blocks[0].content.rowCount,0);
for (const invalid of [{missing:{}},{chart:{}},{detail:{rows:[]}},{detail:{filter:1}},{detail:{filter:'a'.repeat(4097)}},{detail:{sort:{key:'missing',direction:'asc'}}},{detail:{sort:{key:'id',direction:'sideways'}}},{detail:{sort:{key:'id',direction:'asc',expression:'evil'}}}]) assert.throws(()=>applyReportTablePresentations(fill,invalid));
assert.equal(applyReportTablePresentations(fill),fill);
const linked = {datasets:[],blocks:[{id:'links',kind:'tableBlock',content:{columns:[{key:'link',label:'Link'}],resolvedRows:[
 {cells:[{key:'link',value:{href:'/a',label:'Alpha'}}]},
 {cells:[{key:'link',value:{href:'/z',label:'Zeta'}}]},
]}}]};
assert.equal(applyReportTablePresentations(linked,{links:{filter:'Alpha'}}).blocks[0].content.rowCount,1);
assert.equal(applyReportTablePresentations(linked,{links:{sort:{key:'link',direction:'desc'}}}).blocks[0].content.resolvedRows[0].cells[0].value.label,'Zeta');
const relations = {datasets:[],blocks:[{id:'relations',kind:'tableBlock',content:{columns:[{key:'items',label:'Items',format:'relationCount',link:{kind:'dialog',dialogId:'items'}}],resolvedRows:[
 {cells:[{key:'items',value:[{id:1}]}]},
 {cells:[{key:'items',value:[{id:2},{id:3}]}]},
]}}]};
assert.equal(applyReportTablePresentations(relations,{relations:{filter:'2 items'}}).blocks[0].content.rowCount,1);
console.log('Report table presentation: complete rows, exact IDs, nulls, isolation and invalid inputs passed.');
