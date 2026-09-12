import assert from 'node:assert/strict';
import {compileInlineReport, applyInlineReportFilterValues} from './inlineReportCompiler.js';
const source = compileInlineReport({reportId:'filter-test',grammar:'dashboard-v1',source:{blocks:[
  {id:'filter',kind:'dashboard.filters',items:[{id:'week',field:'week',label:'Week',options:[{label:'One',value:'one'},{label:'Two',value:'two'}]}]},
  {id:'table',kind:'dashboard.table',dataSourceRef:'rows',filterBindings:{week:'week'},columns:[{key:'week',label:'Week'},{key:'count',label:'Count'}]},
  {id:'chart',kind:'dashboard.timeline',dataSourceRef:'rows',filterBindings:{week:'week'},chart:{type:'line',xAxis:{dataKey:'week'},series:{valueKey:'count'}}},
]},dataSources:{rows:{rows:[{week:'one',count:3},{week:'two',count:7}]}}});
const filtered=applyInlineReportFilterValues(source,{week:'two'});
assert.equal(filtered.reportSpec.scope.params.find(p=>p.id==='week').value,'two');
assert.equal(source.reportSpec.scope.params.find(p=>p.id==='week').value == null,true);
const table=filtered.reportFill.blocks.find(b=>b.kind==='tableBlock');
assert.equal(table.content.resolvedRows.length,1);
assert.equal(table.content.resolvedRows[0].cells[0].value,'two');
assert.equal(filtered.reportFill.blocks.find(b=>b.kind==='chartBlock').content.rowCount,1);
assert.ok(filtered.reportPrint);
const cleared=applyInlineReportFilterValues(source,{week:null});
assert.equal(cleared.reportFill.blocks.find(b=>b.kind==='tableBlock').content.resolvedRows.length,2);
console.log('inline report filter scope, rows, reset and immutable source passed');
