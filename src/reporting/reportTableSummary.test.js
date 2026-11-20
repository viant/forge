import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';
import {renderReportTableCsv,authoredReportCsvTables} from './reportTableCsv.js';
import {getReportBlockDatasetRefs} from './reportDatasetRefModel.js';
import {buildReportBuilderReportDocument,lowerReportDocumentToReportSpec} from './reportDocumentModel.js';
import {normalizeReportDocumentTableBlock} from './tableVisualSpec.js';
const fixture=JSON.parse(fs.readFileSync(new URL('../../doc/examples/report-table-summary.json',import.meta.url)));
const {spec,datasets}=fixture,before=JSON.stringify(fixture);
assert.deepEqual(getReportBlockDatasetRefs(spec.blocks[0]),['primary','summary']);
assert.equal(normalizeReportDocumentTableBlock(spec.blocks[0]).summaryRow.label,'Grand Total');
assert.throws(()=>normalizeReportDocumentTableBlock({...spec.blocks[0],summaryRow:{label:'Total'}}),/datasetRef/);
const fill=buildReportFillFromReportSpec(spec,datasets),table=fill.blocks[0];
assert.equal(table.content.rowCount,2);assert.equal(table.content.resolvedRows.length,2);
assert.deepEqual(table.content.summaryRow.cells.map(c=>c.value),['Grand Total',40,0,null]);
assert.equal(renderReportTableCsv(table),'Observation date,Count,Rate,Optional\n2026-01-01,2,0.2,5\n2026-01-02,3,0.3,\nGrand Total,40,0,\n');
assert.equal(JSON.stringify(fixture),before);
const presented=buildReportFillFromReportSpec(spec,datasets,{tablePresentations:{details:{filter:'2026-01-02',sort:{key:'count',direction:'desc'}}}});
assert.equal(presented.blocks[0].content.resolvedRows.length,1);assert.deepEqual(presented.blocks[0].content.summaryRow,table.content.summaryRow);assert.deepEqual(presented.datasets,fill.datasets);
for (const payload of [undefined,{rows:[],hasMore:false},{rows:[{},{}],hasMore:false},{rows:[{}],hasMore:true},{rows:[{}],hasMore:false,truncated:true},{rows:[{}],hasMore:false,diagnostics:[{code:'dependency',severity:'error',message:'Source unavailable'}]}]) {
 const actual=buildReportFillFromReportSpec(spec,{primary:datasets.primary,...(payload?{summary:payload}:{})});
 assert.equal(actual.blocks[0].content.summaryRow,undefined);assert.equal(actual.blocks[0].content.resolvedRows.length,2);
 assert(actual.diagnostics.some(d=>d.blockId==='details'&&d.code.startsWith('table_summary_')));
 if(payload?.diagnostics)assert(actual.diagnostics.some(d=>d.message==='Source unavailable'));
}
const unlabeled=structuredClone(spec);delete unlabeled.blocks[0].summaryRow.label;
assert.equal(buildReportFillFromReportSpec(unlabeled,datasets).blocks[0].content.summaryRow.cells[0].value,null);
const ordinary=structuredClone(spec);delete ordinary.blocks[0].summaryRow;
assert.equal(buildReportFillFromReportSpec(ordinary,datasets).blocks[0].content.summaryRow,undefined);
const paged=structuredClone(spec);paged.datasets[0].request.offset=50;
const pagedFill=buildReportFillFromReportSpec(paged,{...datasets,primary:{rows:datasets.primary.rows.slice(0,1),hasMore:true}});
assert.equal(pagedFill.blocks[0].content.summaryRow.cells[1].value,40,'full-scope summary is independent of the detail page');
const long=structuredClone(datasets);long.primary.rows=Array.from({length:65},(_,i)=>({...datasets.primary.rows[0],day:`Observation ${i}: multi-line\nLong descriptive text`,count:i}));
const print=buildReportPrintFromReportFill({reportSpec:spec,reportFill:buildReportFillFromReportSpec(spec,long)});
assert(print.pages.length>1); const printIDs=print.pages.flatMap(p=>p.elements).map(e=>e.id);assert.equal(new Set(printIDs).size,printIDs.length,'detail and summary print element IDs must be distinct');assert.equal(print.pages.flatMap(p=>p.elements).filter(e=>e.text==='Grand Total').length,2,'one summary at end of each table across pages');
console.log('PASS typed bound summaries, scopes, paging/sorting, zero/null, scoped failures, CSV and multipage print.');

// A non-primary detail table may bind the existing primary summary. The normal
// primary omission optimization must retain that explicitly declared dependency.
const dimensions=[{id:'day',key:'day',label:'Day',default:true,paramPath:'dimensions.day'}];
const measures=[{id:'count',key:'count',label:'Count',default:true,paramPath:'measures.count'}];
const config={dataSourceRef:'source',dimensions,measures,dataSources:[{id:'details',dataSourceRef:'source',dimensions,measures,request:{limit:50,offset:0}}],result:{chart:false,table:true}};
const state={selectedDimensions:['day'],selectedMeasures:['count'],reportDocumentBlocks:[{...spec.blocks[0],datasetRef:'details',summaryRow:{datasetRef:'primary',label:'Grand Total'}}]};
const document=buildReportBuilderReportDocument({container:{id:'observations',kind:'dashboard.reportBuilder',dataSourceRef:'source'},config,state});
const lowered=lowerReportDocumentToReportSpec(document,{includePrimaryBlocks:false});
assert(lowered.datasets.some(d=>d.id==='primary'));assert(lowered.datasets.some(d=>d.id==='details'));
