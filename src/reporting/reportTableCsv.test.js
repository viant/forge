import assert from 'node:assert/strict';
import {authoredReportCsvTables, renderReportTableCsv} from './reportTableCsv.js';
import {buildReportFillFromReportSpec} from './reportFillModel.js';

const columns = [{key:'campaign',label:'Campaign ID',format:'id'}, {key:'spend',label:'Spend',format:'currency2'}];
const rows = Array.from({length:32}, (_,i) => ({cells:[{key:'spend',value:i+0.25,displayValue:i+0.25},{key:'campaign',value:String(i),displayValue:i===31?'9007199254740993':String(i)}]}));
const table = {id:'evidence',kind:'tableBlock',datasetRef:'primary',content:{columns,resolvedRows:rows}};
const doc = {blocks:[{id:'evidence',kind:'tableBlock',title:'Evidence'}]};
const fill = {blocks:[table],datasets:[{id:'primary',provenance:{hasMore:false,truncated:false,rowCount:32}}]};
const before = JSON.stringify({doc,fill});
const options = authoredReportCsvTables(doc,fill);
assert.equal(options.length,1); assert.equal(options[0].unavailable,'');
const csv = renderReportTableCsv(options[0].table);
assert.equal(csv.split('\n')[0],'Campaign ID,Spend');
assert.equal(csv.trimEnd().split('\n').length,33,'all rows, including beyond visible page, are exported');
assert.ok(csv.includes('9007199254740993,31.25\n'),'IDs and raw decimals are preserved, not locale formatted');
assert.equal(JSON.stringify({doc,fill}),before);
const other = structuredClone(table);other.id='second';
assert.deepEqual(authoredReportCsvTables({blocks:[...doc.blocks,{id:'second',kind:'tableBlock',title:'Second'}]}, {...fill,blocks:[table,other]}).map(item=>item.id),['evidence','second']);
for (const flag of ['hasMore','truncated']) {
  const partial=structuredClone(fill);partial.datasets[0].provenance[flag]=true;
  assert.match(authoredReportCsvTables(doc,partial)[0].unavailable,/Complete table data/);
}
assert.match(authoredReportCsvTables(doc,{...fill,datasets:[]})[0].unavailable,/Complete table data/);
const empty=structuredClone(table);empty.content.resolvedRows=[];
assert.equal(renderReportTableCsv(empty),'Campaign ID,Spend\n');
const values=structuredClone(table);values.content.resolvedRows=[{cells:[{key:'campaign',displayValue:'a,"b"\nc'},{key:'spend',displayValue:null}]}];
assert.equal(renderReportTableCsv(values),'Campaign ID,Spend\n"a,""b""\nc",\n');
values.content.resolvedRows[0].cells.pop();assert.throws(()=>renderReportTableCsv(values),/missing a cell/);
values.content.resolvedRows[0].cells=[{key:'campaign',displayValue:9007199254740992},{key:'spend',displayValue:1}];
assert.throws(()=>renderReportTableCsv(values),/losing precision/);
// Exercise the real fill builder, so labels, aliases and raw numbers are not
// merely a hand-constructed serialization fixture.
const spec={version:1,kind:'reportSpec',title:'Delivery evidence',source:{kind:'report',containerId:'delivery',stateKey:'delivery',dataSourceRef:'source'},parameters:{viewMode:'table',groupBy:'',pageSize:25,orderField:'',orderDir:'asc'},layoutIntent:{kind:'stack',resultPanePosition:'bottom',blockOrder:['evidence']},refinements:[],calculatedFields:[],datasets:[{id:'primary',dataSourceRef:'source',request:{}}],blocks:[{id:'evidence',kind:'tableBlock',datasetRef:'primary',columns}]};
const sourceRows=Array.from({length:32},(_,i)=>({campaign:`campaign-${i}`,spend:i+0.25}));
const actualFill=buildReportFillFromReportSpec(spec,{primary:{rows:sourceRows,hasMore:false}});
const resolved=authoredReportCsvTables(doc,actualFill)[0];
assert.equal(resolved.unavailable,'');
assert.equal(renderReportTableCsv(resolved.table),'Campaign ID,Spend\n'+sourceRows.map(row=>`${row.campaign},${row.spend}`).join('\n')+'\n');
const incomplete=buildReportFillFromReportSpec(spec,{primary:{rows:sourceRows.slice(0,25),hasMore:true}});
assert.match(authoredReportCsvTables(doc,incomplete)[0].unavailable,/Complete table data/);
console.log('Authored table CSV: complete rows, column order/labels, raw values, escaping, empty and incomplete cases passed.');
