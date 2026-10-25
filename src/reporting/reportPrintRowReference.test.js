import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';
import {buildReportDocumentTableBlock,buildReportBuilderReportDocument,lowerReportDocumentToReportSpec,normalizeReportBlockRuntime} from './reportDocumentModel.js';
import {validateReportPrint} from './schema/reportSchemas.js';
const prefix='__forge_print_row_reference';
const columns=[
  {key:'campaign',label:'Campaign ID',format:'id',rowIdentity:true},
  {key:'publisher',label:'Publisher',rowIdentity:true},
  {key:'platform',label:'Platform'}, {key:'country',label:'Country'}, {key:'channel',label:'Channel'},
  {key:'currentPeriod',label:'Current period'},{key:'priorPeriod',label:'Prior period'},
  ...Array.from({length:7},(_,i)=>({key:`metric${i}`,label:`Metric ${i}`,format:'number5'})),
  {key:prefix,label:'Original column'}, {key:prefix+'_1',label:'Another original'},
  {key:'audit',sourceKey:prefix+'_2',displayKey:prefix+'_3',label:'Aliased original'},
];
// Many rows deliberately share both readable anchors. Complete keys differ.
const rows=Array.from({length:60},(_,i)=>({campaign:[0,'000123','9007199254740993',21][i%4],publisher:'Shared publisher',platform:`platform-${i}.invalid`,country:i%2?'US':'CA',channel:i%2?'Video':'Display',currentPeriod:'2026-09-01 - 2026-09-30',priorPeriod:'2026-08-01 - 2026-08-31',...Object.fromEntries(Array.from({length:7},(_,j)=>[`metric${j}`,i+j/10])),[prefix]:`original ${i}`,[prefix+'_1']:`second ${i}`,[prefix+'_2']:`alias ${i}`,[prefix+'_3']:`display alias ${i}`})).reverse();
function specFor(option,filter=false) {
  return {version:1,kind:'reportSpec',title:'Row references',source:{kind:'dashboard.reportBuilder',containerId:'references',stateKey:'references',dataSourceRef:'rows'},parameters:{viewMode:'table',groupBy:'',pageSize:100,orderField:'',orderDir:'asc'},layoutIntent:{kind:'stack',resultPanePosition:'bottom',blockOrder:['evidence']},refinements:[],calculatedFields:[],datasets:[{id:'primary',dataSourceRef:'rows',request:{limit:100,offset:0}}],...(filter?{scope:{params:[{id:'selectedChannel',kind:'value',label:'Channel',value:'Video'}]}}:{}),blocks:[{id:'evidence',kind:'tableBlock',datasetRef:'primary',columns,runtime:{...(option===undefined?{}:{printRowReference:option}),...(filter?{filterBindings:{selectedChannel:'channel'}}:{})}}]};
}
function materialize(option,filter=false) {
  const spec=specFor(option,filter),fill=buildReportFillFromReportSpec(spec,{primary:{rows}});
  fill.blocks[0].content.resolvedRows.forEach((row,i)=>row.rowIndex=900-i);
  const before=JSON.stringify({spec,fill,rows});
  const print=buildReportPrintFromReportFill({reportSpec:spec,reportFill:fill});
  assert.equal(JSON.stringify({spec,fill,rows}),before,'print references must not mutate source/fill, including row provenance');
  assert.equal(validateReportPrint(print).valid,true);
  return {spec,fill,print};
}
function verifyReferenceBijection(reference,control) {
  const sourceColumns=reference.fill.blocks[0].content.columns;
  const sourceRows=reference.fill.blocks[0].content.resolvedRows;
  const originalKeys=new Set(sourceColumns.map(c=>c.key));
  const all=reference.print.pages.flatMap(p=>p.elements).filter(e=>e.kind==='tableCellText');
  const generatedKeys=[...new Set(all.filter(e=>!originalKeys.has(e.columnKey)).map(e=>e.columnKey))];
  assert.equal(generatedKeys.length,1);const generated=generatedKeys[0];
  for(let i=0;i<4;i++)assert.notEqual(generated,prefix+(i?`_${i}`:''),'generated key must not collide with source aliases or cells');
  assert.ok(reference.print.pages.flatMap(p=>p.elements).some(e=>e.text==='Row (print)'));
  const expected=new Map();
  for(const cell of control.print.pages.flatMap(p=>p.elements).filter(e=>e.kind==='tableCellText'))expected.set(cell.rowKey+'|'+cell.columnKey,cell.text);
  const bands=new Map(),joined=new Map();
  for(const cell of all) {
    const band=cell.id.split('__row_')[0];if(!bands.has(band))bands.set(band,[]);bands.get(band).push(cell);
    assert.equal(cell.fontSize,9);
    assert.ok(cell.box.x>=36&&cell.box.x+cell.box.width<=576.01&&cell.box.y+cell.box.height<=732.01);
  }
  for(const cells of bands.values()) {
    const refs=cells.filter(e=>e.columnKey===generated);
    assert.deepEqual(refs.map(e=>e.text),sourceRows.map((_,i)=>String(i+1)),'references are allocated once, not per band or page');
    for(const ref of refs) {
      const ordinal=Number(ref.text);assert.equal(ref.rowKey,`row_${ordinal}`);
      const rowCells=cells.filter(e=>e.rowKey===ref.rowKey);
      for(const anchor of ['campaign','publisher'])assert.equal(rowCells.filter(e=>e.columnKey===anchor).length,1);
      if(!joined.has(ordinal))joined.set(ordinal,new Map());
      const sourceKey=`row_${sourceRows[ordinal-1].rowIndex+1}`;
      for(const cell of rowCells.filter(e=>e.columnKey!==generated)) {
        assert.equal(cell.text,expected.get(sourceKey+'|'+cell.columnKey),'reference must resolve to the unchanged full source tuple/value');
        joined.get(ordinal).set(cell.columnKey,cell.text);
      }
    }
  }
  assert.equal(joined.size,sourceRows.length);
  for(const tuple of joined.values())assert.equal(tuple.size,sourceColumns.length,'the reference joins every original key field and payload');
  for(const c of sourceColumns)assert.equal(all.filter(e=>e.columnKey===c.key).length,sourceRows.length*(['campaign','publisher'].includes(c.key)?bands.size:1),'all original non-anchor cells appear exactly once');
  assert.ok(reference.print.pages.some(p=>{const refs=p.elements.filter(e=>e.kind==='tableCellText'&&e.columnKey===generated);return refs.length&&Number(refs[0].text)>1;}),'vertical pages must continue numbering');
  return {generated,bands:bands.size};
}
const compact=materialize(true),control=materialize(false);
assert.ok(verifyReferenceBijection(compact,control).bands>1);
assert.equal(compact.fill.blocks[0].content.columns.length,columns.length);
assert.equal(compact.fill.blocks[0].content.columns.some(c=>c.label==='Row (print)'),false);
const filtered=materialize(true,true),filteredControl=materialize(false,true);
assert.equal(filtered.fill.blocks[0].content.resolvedRows.length,30);
verifyReferenceBijection(filtered,filteredControl);

const helper=buildReportDocumentTableBlock({id:'evidence',datasetRef:'primary',columns,runtime:{printRowReference:true,filterBindings:{selectedChannel:'channel'}}});
assert.equal(helper.runtime.printRowReference,true);assert.deepEqual(helper.runtime.filterBindings,{selectedChannel:'channel'});
for(const invalid of [undefined,false,'true',1])assert.equal(normalizeReportBlockRuntime({printRowReference:invalid})?.printRowReference,undefined);
const doc=buildReportBuilderReportDocument({container:{id:'references',dataSourceRef:'rows'},config:{dimensions:[{id:'campaign',label:'Campaign'}],measures:[{id:'metric0',label:'Metric'}]},state:{selectedDimensions:['campaign'],selectedMeasures:['metric0'],viewMode:'table'},additionalBlocks:[helper]});
assert.equal(lowerReportDocumentToReportSpec(doc).blocks.find(b=>b.id==='evidence').runtime.printRowReference,true);

// The number belongs to each table, never the whole document.
const resetSpec=specFor(true);resetSpec.blocks.push({...resetSpec.blocks[0],id:'second'});resetSpec.layoutIntent.blockOrder.push('second');
const resetFill=buildReportFillFromReportSpec(resetSpec,{primary:{rows:rows.slice(0,3)}});
const reset=buildReportPrintFromReportFill({reportSpec:resetSpec,reportFill:resetFill});
for(const id of ['evidence','second']) {
 const refs=reset.pages.flatMap(p=>p.elements).filter(e=>e.kind==='tableCellText'&&e.id.startsWith(id+'__')&&!columns.some(c=>c.key===e.columnKey));
 assert.ok(refs.length);assert.equal(Math.min(...refs.map(e=>Number(e.text))),1);assert.equal(Math.max(...refs.map(e=>Number(e.text))),3);
}
// Opt-in without marked anchors retains the legacy first-column anchor.
const fallbackSpec=specFor(true);fallbackSpec.blocks[0].columns=columns.map(({rowIdentity,...column})=>column);
const fallbackFill=buildReportFillFromReportSpec(fallbackSpec,{primary:{rows:rows.slice(0,3)}});
const fallback=buildReportPrintFromReportFill({reportSpec:fallbackSpec,reportFill:fallbackFill});
const fallbackCells=fallback.pages.flatMap(p=>p.elements).filter(e=>e.kind==='tableCellText');
const fallbackBands=[...new Set(fallbackCells.map(e=>e.id.split('__row_')[0]))];
for(const band of fallbackBands)assert.equal(fallbackCells.filter(e=>e.id.startsWith(band+'__row_')&&e.columnKey==='campaign').length,3);
assert.equal(fallbackCells.filter(e=>e.columnKey==='publisher').length,3,'unmarked publisher remains payload, not an inferred anchor');
assert.equal(fallbackFill.blocks[0].content.columns.some(c=>c.rowIdentity===true),false);
const emptyFill=buildReportFillFromReportSpec(fallbackSpec,{primary:{rows:[]}});
const empty=buildReportPrintFromReportFill({reportSpec:fallbackSpec,reportFill:emptyFill});
assert.equal(empty.pages.flatMap(p=>p.elements).some(e=>e.text==='Row (print)'),false);

if(process.env.FORGE_ROW_REFERENCE_BASELINE_ROOT) {
 const root=process.env.FORGE_ROW_REFERENCE_BASELINE_ROOT;
 const previous=await import(pathToFileURL(`${root}/src/reporting/reportPrintModel.js`));
 for(const option of [undefined,false,'true',1]) {
  const current=materialize(option);
  assert.deepEqual(current.print,previous.buildReportPrintFromReportFill({reportSpec:current.spec,reportFill:current.fill}),'absent/nontrue flag keeps exact legacy output');
 }
}
console.log('printRowReference ✓ full-key bijection, filtered order, stable page/band references, collisions, per-table reset and immutable source/fill');
