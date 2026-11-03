import assert from 'node:assert/strict';
import fs from 'node:fs';
import {materializeAnalyticalTable,normalizeTableAnalytics,pivotColumnKey,tableAnalyticsFields} from './reportTableAnalytics.js';
import {buildReportBuilderReportDocument,lowerReportDocumentToReportSpec} from './reportDocumentModel.js';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';
import {buildRuntimeTableRows,buildAnalyticalRuntimeTableRows} from './reportRuntimeTableRows.js';
import {renderReportTableCsv} from './reportTableCsv.js';
import {validateReportSpec,validateReportFill,validateReportPrint} from './schema/reportSchemas.js';

const fixture=JSON.parse(fs.readFileSync(new URL('../../doc/examples/library-static-pivot.json',import.meta.url)));
const {block,rows}=fixture;
const clone=structuredClone;
const spec={version:1,kind:'reportSpec',title:'Library visits',source:{kind:'report',containerId:'library',stateKey:'library',dataSourceRef:'library'},parameters:{viewMode:'table',groupBy:'',pageSize:1,orderField:'',orderDir:'asc'},layoutIntent:{kind:'single',resultPanePosition:'bottom',blockOrder:['visits']},refinements:[],calculatedFields:[],datasets:[{id:'primary',dataSourceRef:'library',request:{}}],blocks:[block]};
const payload={primary:{rows,hasMore:false}};
const before=JSON.stringify({spec,payload});
const categories=['March','January','February'];
const dynamicKeys=categories.map((category,index)=>pivotColumnKey(block.pivot,category,index,0));
const expectedKeys=['branchId','branch','registeredMembers','balance',...dynamicKeys];
const expectedRows=[
 [10,'North',120,-2.5,8,0,null],
 [20,'South',0,0,null,-3,null],
 [30,'West',null,null,null,null,null],
 [40,'East',null,null,null,null,4],
];
const fill=buildReportFillFromReportSpec(spec,payload);
const table=fill.blocks[0];
assert.equal(validateReportSpec(spec).valid,true,JSON.stringify(validateReportSpec(spec)));
assert.equal(validateReportFill(fill).valid,true,JSON.stringify(validateReportFill(fill)));
assert.deepEqual(table.content.columns.map(column=>column.key),expectedKeys);
assert.deepEqual(table.content.columns.filter(column=>column.rowIdentity).map(column=>column.key),block.pivot.rowFields);
assert.deepEqual(table.content.resolvedRows.map(row=>row.cells.map(cell=>cell.value)),expectedRows);
assert.equal(table.content.columns[2].format,'integer');
assert.equal(table.content.columns[3].format,'decimal');
assert.deepEqual(table.content.columnGroups.map(group=>group.label),['Rows',...categories]);
assert.equal(table.content.columnGroups.some(group=>group.columns.includes('registeredMembers')),false);
assert.deepEqual(buildRuntimeTableRows(table,fill.datasets[0]).map(row=>expectedKeys.map(key=>row[key])),expectedRows);
assert.match(renderReportTableCsv(table),/Rows \/ Branch ID,Rows \/ Branch,Members,Balance,March \/ Circulation,January \/ Circulation,February \/ Circulation\n10,North,120,-2.5,8,0,\n20,South,0,0,,-3,\n30,West,,,,,\n40,East,,,,,4\n/);
const printed=buildReportPrintFromReportFill({reportSpec:spec,reportFill:fill});
assert.equal(validateReportPrint(printed).valid,true,JSON.stringify(validateReportPrint(printed)));
assert.match(JSON.stringify(printed),/Members/);
assert.match(JSON.stringify(printed),/February \/ Circulation/);

const selected=rows.filter(row=>row.month==='January');
assert.deepEqual(buildAnalyticalRuntimeTableRows(table,rows,selected).map(row=>expectedKeys.map(key=>row[key])),[
 [10,'North',120,-2.5,null,0,null],
 [20,'South',0,0,null,-3,null],
]);
for(const domain of ['observed','fixed']){
 const configured=clone(block);
 if(domain==='fixed'){delete configured.pivot.columnDomain;configured.pivot.columnCategories=categories;}
 const baseline=clone(configured);delete baseline.pivot.staticFields;
 const original=materializeAnalyticalTable(baseline,rows);
 const extended=materializeAnalyticalTable(configured,rows);
 assert.deepEqual(original.columns.map(column=>column.key),extended.columns.filter(column=>!block.pivot.staticFields.includes(column.key)).map(column=>column.key));
 assert.deepEqual(original.rows,extended.rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!block.pivot.staticFields.includes(key)))));
 assert.deepEqual(original.columnGroups,extended.columnGroups);
 assert.equal(materializeAnalyticalTable(configured,[]).rows.length,0);
 const multiple=clone(configured);multiple.columns.push({key:'renewals',label:'Renewals'});multiple.pivot.values.push({field:'renewals',label:'Renewals',aggregate:'sum'});
 const output=materializeAnalyticalTable(multiple,rows.map(row=>({...row,renewals:2})));
 assert.equal(output.columns.length,10);
 assert.deepEqual(output.columnGroups.slice(1).map(group=>group.columns.length),[2,2,2]);
 assert.equal(output.rows[0].registeredMembers,120);
 const duplicate=clone(configured);duplicate.pivot.values[0].aggregate='sum';
 assert.equal(materializeAnalyticalTable(duplicate,[...rows,rows[0]]).rows[0].registeredMembers,120);
 assert.equal(materializeAnalyticalTable(duplicate,[...rows,rows[0]]).rows[0][output.columnGroups[1].columns[0]],16);
 assert.throws(()=>materializeAnalyticalTable(configured,[...rows,rows[0]]),/duplicate coordinates/);
 const collision=clone(configured);const generated=pivotColumnKey(configured.pivot,'March',0,0);collision.columns.push({key:generated});collision.pivot.staticFields=[generated];
 assert.throws(()=>materializeAnalyticalTable(collision,rows),/collides/);
}
for(const value of ['120',true,{},Infinity,NaN]){
 assert.throws(()=>materializeAnalyticalTable(block,[{...rows[0],registeredMembers:value}]),/finite numbers or null/);
}
for(const value of [121,null,undefined]){
 const inconsistent=[rows[0],{...rows[1],registeredMembers:value}];
 assert.throws(()=>materializeAnalyticalTable(block,inconsistent),/static field registeredMembers has inconsistent values for row tuple \[10,"North"\]/);
 assert.throws(()=>buildReportFillFromReportSpec(spec,{primary:{rows:inconsistent}}),/inconsistent/);
 const filtered=clone(spec);filtered.scope={params:[{id:'month',kind:'value',label:'Month',value:'March'}]};filtered.blocks[0].runtime={filterBindings:{month:'month'}};
 assert.throws(()=>buildReportFillFromReportSpec(filtered,{primary:{rows:inconsistent}}),/inconsistent/);
 assert.throws(()=>buildAnalyticalRuntimeTableRows(table,inconsistent,[inconsistent[0]]),/inconsistent/);
}
const typed=materializeAnalyticalTable(block,[rows[0],{...rows[0],branchId:'10',registeredMembers:5},{...rows[0],branchId:-1},{...rows[0],branchId:0}]);
assert.deepEqual(typed.rows.map(row=>row.branchId),[10,'10',-1,0]);
for(const value of [null,undefined,true,NaN,Infinity,'  '])assert.throws(()=>materializeAnalyticalTable(block,[{...rows[0],branchId:value}]),/row dimensions/);
const reordered=clone(block);reordered.pivot.staticFields.reverse();
assert.deepEqual(materializeAnalyticalTable(reordered,rows).columns.slice(2,4).map(column=>column.key),['balance','registeredMembers']);
for(const fields of [[],['registeredMembers','registeredMembers'],['unknown'],['branchId'],['month'],['circulation'],[7],null]){
 const invalid=clone(spec);invalid.blocks[0].pivot.staticFields=fields;
 if(!Array.isArray(fields)||fields.length===0||fields.some(field=>typeof field!=='string'))assert.equal(validateReportSpec(invalid).valid,false,JSON.stringify(fields));
 assert.throws(()=>normalizeTableAnalytics(invalid.blocks[0]));
 assert.throws(()=>buildReportFillFromReportSpec(invalid,payload));
 const invalidFill=clone(fill);invalidFill.blocks[0].pivot.staticFields=fields;
 if(!Array.isArray(fields)||fields.length===0||fields.some(field=>typeof field!=='string'))assert.equal(validateReportFill(invalidFill).valid,false,JSON.stringify(fields));
}
for(const partial of [{hasMore:true},{truncated:true},{provenance:{hasMore:true}},{provenance:{truncated:true}}])assert.throws(()=>buildReportFillFromReportSpec(spec,{primary:{rows,...partial}}),/complete admitted dataset/);
const offset=clone(spec);offset.datasets[0].request.offset=1;
assert.throws(()=>buildReportFillFromReportSpec(offset,payload),/complete admitted dataset/);
const sorted=buildReportFillFromReportSpec(spec,payload,{tablePresentations:{visits:{sort:{key:'registeredMembers',direction:'asc'}}}});
assert.deepEqual(sorted.blocks[0].content.resolvedRows.map(row=>row.cells[0].value),[20,10,30,40]);
const numericSorted=buildReportFillFromReportSpec(spec,{primary:{rows:[...rows,{...rows[0],branchId:50,branch:'Annex',registeredMembers:2}]}},{tablePresentations:{visits:{sort:{key:'registeredMembers',direction:'asc'}}}});
assert.deepEqual(numericSorted.blocks[0].content.resolvedRows.map(row=>row.cells[0].value),[20,50,10,30,40]);
const dimensions=['branchId','branch','month'].map(id=>({id,key:id,label:id,paramPath:`dimensions.${id}`}));
const measures=['circulation','registeredMembers','balance'].map(id=>({id,key:id,label:id,paramPath:`measures.${id}`}));
const config={dataSourceRef:'library',dimensions,measures};
const document=buildReportBuilderReportDocument({container:{id:'library',dataSourceRef:'library'},config,state:{selectedDimensions:['branch'],selectedMeasures:['circulation'],reportDocumentBlocks:[block]}});
const lowered=lowerReportDocumentToReportSpec(document);
assert.deepEqual(lowered.blocks.find(entry=>entry.id==='visits').pivot.staticFields,block.pivot.staticFields);
for(const field of block.pivot.staticFields)assert.equal(lowered.datasets[0].request.measures[field],true);
assert.equal(tableAnalyticsFields(block).includes('registeredMembers'),true);
const markedStatic=clone(block);markedStatic.columns.find(column=>column.key==='registeredMembers').rowIdentity=true;
assert.deepEqual(materializeAnalyticalTable(markedStatic,rows).columns.filter(column=>column.rowIdentity).map(column=>column.key),block.pivot.rowFields);
assert.throws(()=>materializeAnalyticalTable(block,[rows[0],{...rows[1],balance:0}]),/static field balance has inconsistent values/);
assert.equal(JSON.stringify({spec,payload}),before);
console.log('PASS static pivot schema, typed identities, consistency, native catalog projection, defaults, runtime, CSV and print');
