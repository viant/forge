import assert from 'node:assert/strict';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildAnalyticalRuntimeTableRows} from './reportRuntimeTableRows.js';
import {renderReportTableCsv} from './reportTableCsv.js';

// Independently authored synthetic records: first-seen categories differ from
// alphabetical order, and filtering removes the first category entirely.
const rows=[
 {location:'North',category:'Zinc',amount:7},
 {location:'North',category:'Copper',amount:0},
 {location:'South',category:'Copper',amount:4},
 {location:'South',category:'Iron',amount:null},
];
const block={id:'observations',kind:'tableBlock',datasetRef:'primary',columns:['location','category','amount'].map(key=>({key,label:key})),pivot:{rowFields:['location'],columnField:'category',columnDomain:'observed',values:[{field:'amount',label:'Amount',aggregate:'sum'}]}};
const spec={version:1,kind:'reportSpec',title:'Synthetic observations',parameters:{viewMode:'table',pageSize:1},datasets:[{id:'primary',request:{}}],blocks:[block]};
const payload={primary:{rows,hasMore:false}};
const before=JSON.stringify({spec,payload});
const fill=buildReportFillFromReportSpec(spec,payload);
const table=fill.blocks[0];
const [zincKey,copperKey,ironKey]=table.content.columnGroups.slice(1).map(group=>group.columns[0]);
const expectedColumns=['location',zincKey,copperKey,ironKey];
assert.deepEqual(table.content.columns.map(column=>column.key),expectedColumns);
assert.deepEqual(table.content.columnGroups.map(group=>group.label),['Rows','Zinc','Copper','Iron']);
const selected=rows.filter(row=>row.category==='Copper');
assert.deepEqual(buildAnalyticalRuntimeTableRows(table,rows,selected),[
 {location:'North',[zincKey]:null,[copperKey]:0,[ironKey]:null},
 {location:'South',[zincKey]:null,[copperKey]:4,[ironKey]:null},
]);
assert.deepEqual(buildAnalyticalRuntimeTableRows(table,rows,[]),[]);

for(const mode of ['filter','selection']){
 const scoped=structuredClone(spec);
 const authored=scoped.blocks[0];
 if(mode==='filter'){
  scoped.scope={params:[{id:'chosenCategory',kind:'value',label:'Category',value:'Copper'}]};
  authored.runtime={filterBindings:{chosenCategory:'category'}};
 }else authored.runtime={selectionBindings:{chosenCategory:'category'}};
 const options={...(mode==='selection'?{runtimeSelection:{chosenCategory:'Copper'}}:{}),tablePresentations:{observations:{sort:{key:copperKey,direction:'desc'}}}};
 const filtered=buildReportFillFromReportSpec(scoped,payload,options).blocks[0];
 assert.deepEqual(filtered.content.columns.map(column=>column.key),expectedColumns,mode+' must preserve the complete domain');
 assert.deepEqual(filtered.content.resolvedRows.map(row=>row.cells.map(cell=>cell.value)),[['South',null,4,null],['North',null,0,null]]);
 assert.equal(renderReportTableCsv(filtered),'Rows / location,Zinc / Amount,Copper / Amount,Iron / Amount\nSouth,,4,\nNorth,,0,\n');
 if(mode==='filter'){
  scoped.scope.params[0].value='Absent';
  const empty=buildReportFillFromReportSpec(scoped,payload).blocks[0];
  assert.deepEqual(empty.content.columns.map(column=>column.key),expectedColumns);
  assert.equal(empty.content.rowCount,0);
 }
}
// A new complete execution may remove or reorder categories. A remembered
// sort must continue to identify the same category, and a removed category
// must fail actual-column validation instead of targeting its old position.
const renewed=buildReportFillFromReportSpec(spec,{primary:{rows:selected,hasMore:false}},{tablePresentations:{observations:{sort:{key:copperKey,direction:'desc'}}}}).blocks[0];
assert.deepEqual(renewed.content.columns.map(column=>column.key),['location',copperKey]);
assert.equal(renewed.content.columnGroups[1].label,'Copper');
assert.deepEqual(renewed.content.resolvedRows.map(row=>row.cells.map(cell=>cell.value)),[['South',4],['North',0]]);
assert.throws(()=>buildReportFillFromReportSpec(spec,{primary:{rows:selected,hasMore:false}},{tablePresentations:{observations:{sort:{key:zincKey,direction:'asc'}}}}),/Unknown sort column/);
const reordered=buildReportFillFromReportSpec(spec,{primary:{rows:[rows[1],rows[0],rows[2],rows[3]],hasMore:false}}).blocks[0];
assert.deepEqual(reordered.content.columnGroups.slice(1).map(group=>group.columns[0]),[copperKey,zincKey,ironKey]);
assert.deepEqual(buildAnalyticalRuntimeTableRows(renewed,selected,selected),[
 {location:'South',[copperKey]:4},{location:'North',[copperKey]:0},
]);

const unicode=buildReportFillFromReportSpec(spec,{primary:{rows:[{location:'North',category:'😀',amount:1},{location:'North',category:'😁',amount:2}],hasMore:false}}).blocks[0];
assert.equal(new Set(unicode.content.columns.map(column=>column.key)).size,3,'supplementary Unicode categories have distinct safe field keys');
assert.deepEqual(unicode.content.resolvedRows[0].cells.map(cell=>cell.value),['North',1,2]);

for(const partial of [{hasMore:true},{truncated:true},{provenance:{hasMore:true}},{provenance:{truncated:true}}]){
 assert.throws(()=>buildReportFillFromReportSpec(spec,{primary:{rows,...partial}}),/complete admitted dataset/);
}
const offsetSpec=structuredClone(spec);offsetSpec.datasets[0].request.offset=1;
assert.throws(()=>buildReportFillFromReportSpec(offsetSpec,payload),/complete admitted dataset/);
assert.equal(JSON.stringify({spec,payload}),before,'source rows and authored metadata remain immutable');
console.log('PASS observed pivot runtime filters preserve complete-source category coordinates');
