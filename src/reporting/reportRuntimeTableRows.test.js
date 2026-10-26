import assert from 'node:assert/strict';
import {buildRuntimeTableRows} from './reportRuntimeTableRows.js';
import {applyReportTablePresentations} from './reportTablePresentation.js';

const dataset={id:'primary',rows:[{id:1,title:'Alpha',target:'first'},{id:2,title:'Zeta',target:'second'}]};
assert.deepEqual(buildRuntimeTableRows({content:{resolvedRows:[]}},dataset),[],'zero matches must not restore source rows');
assert.equal(buildRuntimeTableRows({},dataset),dataset.rows,'legacy unresolved fills retain the source fallback');
const columns=[{key:'id',label:'ID',link:{kind:'dialog',dialogId:'details',textSelector:'title'}}];
const block={id:'table',kind:'tableBlock',datasetRef:'primary',content:{columns,resolvedRows:[{rowIndex:1,cells:[{key:'id',value:2,displayValue:2}]},{rowIndex:0,cells:[{key:'id',value:1,displayValue:1}]}]}};
assert.deepEqual(buildRuntimeTableRows(block,dataset).map(row=>[row.id,row.target]),[[2,'second'],[1,'first']]);
const fill={datasets:[dataset],blocks:[block]};
const selected=applyReportTablePresentations(fill,{table:{filter:'Alpha',sort:{key:'id',direction:'desc'}}});
assert.equal(selected.blocks[0].content.rowCount,1);
assert.equal(selected.blocks[0].content.resolvedRows[0].rowIndex,0);
assert.equal(buildRuntimeTableRows(selected.blocks[0],dataset)[0].target,'first');
console.log('Runtime table rows: empty results, original metadata and row-selected link labels passed.');
