import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {buildReportDocumentTableBlock, buildReportBuilderReportDocument, lowerReportDocumentToReportSpec} from './reportDocumentModel.js';
import {normalizeReportTableBlockColumn} from './tableVisualSpec.js';
import {buildReportBuilderColumns} from '../components/dashboard/reportBuilderUtils.js';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportPrintFromReportFill, DEFAULT_REPORT_PRINT_PAGE_GEOMETRY} from './reportPrintModel.js';
import {validateReportFill, validateReportPrint, validateReportSpec} from './schema/reportSchemas.js';

function specFor(columns) {
  return {version:1,kind:'reportSpec',source:{kind:'dashboard.reportBuilder',containerId:'identity',stateKey:'identity',dataSourceRef:'rows'},title:'Composite identity',parameters:{viewMode:'table',groupBy:'',pageSize:100,orderField:'',orderDir:'asc'},layoutIntent:{kind:'stack',resultPanePosition:'bottom',blockOrder:['evidence']},refinements:[],calculatedFields:[],datasets:[{id:'primary',dataSourceRef:'rows',request:{}}],blocks:[{id:'evidence',kind:'tableBlock',datasetRef:'primary',columns}]};
}
function artifacts(columns, rows, pageGeometry) {
  const spec=specFor(columns), before=JSON.stringify({spec,rows});
  const fill=buildReportFillFromReportSpec(spec,{primary:{rows}});
  const print=buildReportPrintFromReportFill({reportSpec:spec,reportFill:fill,...(pageGeometry?{pageGeometry:{...DEFAULT_REPORT_PRINT_PAGE_GEOMETRY,...pageGeometry}}:{})});
  assert.equal(JSON.stringify({spec,rows}),before,'printing must not mutate source');
  assert.equal(validateReportSpec(spec).valid,true);
  assert.equal(validateReportFill(fill).valid,true);
  assert.equal(validateReportPrint(print).valid,true,JSON.stringify(validateReportPrint(print).errors));
  return {spec,fill,print};
}
function checkCoverage(print, columns, rows) {
  const identity=columns.filter(c=>c.rowIdentity===true);
  const anchors=identity.length?identity:[columns[0]];
  const bands=new Map();
  for(const page of print.pages) {
    const cells=page.elements.filter(e=>e.kind==='tableCellText');
    const pageRows=new Map();
    for(const cell of cells) {
      const band=cell.id.match(/^evidence(?:__columns_\d+)?/)[0];
      if(!bands.has(band))bands.set(band,[]);
      bands.get(band).push(cell);
      if(!pageRows.has(cell.rowKey))pageRows.set(cell.rowKey,new Set());
      pageRows.get(cell.rowKey).add(cell.columnKey);
      assert.equal(cell.fontSize,9);
      assert.ok(cell.box.x>=print.pageGeometry.marginLeft);
      assert.ok(cell.box.x+cell.box.width<=print.pageGeometry.width-print.pageGeometry.marginRight+.01);
      assert.ok(cell.box.y+cell.box.height<=print.pageGeometry.height-print.pageGeometry.marginBottom-print.pageGeometry.footerHeight+.01,'full wrapped cells fit on page');
    }
    for(const keys of pageRows.values())for(const anchor of anchors)assert.ok(keys.has(anchor.key),'every vertical continuation retains the complete identity');
  }
  for(const [band,cells] of bands) {
    for(const anchor of anchors) {
      const found=cells.filter(e=>e.columnKey===anchor.key);
      assert.equal(found.length,rows.length,`${band} repeats every identity row`);
      for(let i=0;i<rows.length;i++) {
        const cell=found.find(e=>e.rowKey===`row_${i+1}`);
        assert.ok(cell);
        assert.equal(cell.text,rows[i][anchor.key]===null?'—':String(rows[i][anchor.key]));
      }
    }
  }
  const all=[...bands.values()].flat();
  for(const column of columns.filter(c=>!anchors.includes(c))) {
    const found=all.filter(e=>e.columnKey===column.key);
    assert.equal(found.length,rows.length,`${column.key} payload appears exactly once per source row`);
    for(let i=0;i<rows.length;i++)assert.ok(found.some(e=>e.rowKey===`row_${i+1}`),'no source row is dropped');
  }
  return bands;
}

const identity=[{key:'campaign',label:'Campaign',format:'id',rowIdentity:true},{key:'label',label:'Entity label',rowIdentity:true}];
const payload=Array.from({length:10},(_,i)=>({key:`value${i}`,label:`Value ${i}`}));
const columns=[...identity,...payload];
const rows=Array.from({length:60},(_,i)=>({campaign:i%2?22:21,label:`Entity ${String(Math.floor(i/2)).padStart(3,'0')}`,...Object.fromEntries(payload.map((c,j)=>[c.key,`Complete payload ${j} for source row ${i}`]))}));
const compound=artifacts(columns,rows);
assert.ok(checkCoverage(compound.print,columns,rows).size>1);
assert.ok(compound.print.pages.length>2);
assert.deepEqual(compound.fill.blocks[0].content.columns.filter(c=>c.rowIdentity).map(c=>c.key),['campaign','label']);

const triple=[...identity,{key:'account',label:'Account',format:'id',rowIdentity:true},...payload.slice(0,3)];
const tripleRows=[0,'000123','9007199254740993'].map((v,i)=>({campaign:v,label:i===2?null:'A long complete identity label with wrapping and Unicode Ω',account:i===0?0:String(i),...Object.fromEntries(payload.slice(0,3).map(c=>[c.key,'Long complete payload with unchanged text and null formatting']))}));
const narrow=artifacts(triple,tripleRows,{width:220,height:792,marginLeft:36,marginRight:36});
assert.equal(checkCoverage(narrow.print,triple,tripleRows).size,3,'an oversized identity set admits one payload per band without rebanding');
const allIdentity=triple.slice(0,3);
assert.equal(checkCoverage(artifacts(allIdentity,tripleRows,{width:220,height:792,marginLeft:36,marginRight:36}).print,allIdentity,tripleRows).size,1,'all-identity tables render once');

// Flags are strict optional booleans, preserved through source normalization.
assert.equal(normalizeReportTableBlockColumn({key:'a',rowIdentity:true}).rowIdentity,true);
for(const value of [false,'true',1,null])assert.equal('rowIdentity' in normalizeReportTableBlockColumn({key:'a',rowIdentity:value}),false);
assert.equal(validateReportSpec(specFor([{key:'a',label:'A',rowIdentity:'true'}])).valid,false);
const block=buildReportDocumentTableBlock({id:'evidence',datasetRef:'primary',columns});
assert.deepEqual(block.columns.filter(c=>c.rowIdentity).map(c=>c.key),['campaign','label']);
const config={dimensions:[{id:'campaign',key:'campaign',label:'Campaign',rowIdentity:true},{id:'label',key:'label',label:'Entity label',rowIdentity:true}],measures:[{id:'value0',key:'value0',label:'Value'}],result:{defaultMode:'table'}};
const state={selectedDimensions:['campaign','label'],selectedMeasures:['value0'],viewMode:'table'};
assert.deepEqual(buildReportBuilderColumns(config,state).filter(c=>c.rowIdentity).map(c=>c.key),['campaign','label']);
assert.equal(buildReportBuilderColumns(config,{...state,activeTablePreset:{columns:[{key:'value0',rowIdentity:true}]}}).find(c=>c.key==='value0').rowIdentity,true);
const document=buildReportBuilderReportDocument({container:{id:'identity',dataSourceRef:'rows'},config,state,additionalBlocks:[block]});
const lowered=lowerReportDocumentToReportSpec(document);
assert.deepEqual(lowered.blocks.find(b=>b.id==='evidence').columns.filter(c=>c.rowIdentity).map(c=>c.key),['campaign','label']);
assert.deepEqual(lowered.blocks.find(b=>b.id==='identity__table')?.columns?.filter(c=>c.rowIdentity).map(c=>c.key)||lowered.blocks.find(b=>b.kind==='tableBlock'&&b.id!=='evidence').columns.filter(c=>c.rowIdentity).map(c=>c.key),['campaign','label']);

const legacyColumns=[{key:'day',label:'Date',format:'date'},...payload];
const legacyRows=rows.slice(0,4).map((r,i)=>({...r,day:`2026-01-0${i+1}`}));
const legacy=artifacts(legacyColumns,legacyRows);
const explicitlyFalse=artifacts(legacyColumns.map(c=>normalizeReportTableBlockColumn({...c,rowIdentity:false})),legacyRows);
// Normalization does not introduce flags or change their absent-column metadata.
assert.equal(legacy.print.pages.flatMap(p=>p.elements).filter(e=>e.kind==='tableCellText'&&e.columnKey==='day').every(e=>e.text.includes('2026')),true);
assert.equal(explicitlyFalse.fill.blocks[0].content.columns.some(c=>'rowIdentity' in c),false);
if(process.env.FORGE_ROW_IDENTITY_BASELINE_ROOT) {
  const base=process.env.FORGE_ROW_IDENTITY_BASELINE_ROOT;
  const oldFill=await import(pathToFileURL(`${base}/src/reporting/reportFillModel.js`));
  const oldPrint=await import(pathToFileURL(`${base}/src/reporting/reportPrintModel.js`));
  for(const [name,c,r,g] of [['legacy-date',legacyColumns,legacyRows],['legacy-wide',columns.map(({rowIdentity,...c})=>c),rows],['legacy-compact',legacyColumns.slice(0,3),legacyRows]]) {
    const current=artifacts(c,r,g);
    const fill=oldFill.buildReportFillFromReportSpec(current.spec,{primary:{rows:r}});
    const print=oldPrint.buildReportPrintFromReportFill({reportSpec:current.spec,reportFill:fill,...(g?{pageGeometry:g}:{})});
    assert.deepEqual(current.fill,fill);
    assert.deepEqual(current.print,print,`${name} must retain exact legacy output`);
    console.log(name,createHash('sha256').update(JSON.stringify(print)).digest('hex'));
  }
}
console.log('rowIdentity ✓ composite anchors, complete cells, normalization, narrow layout and unchanged legacy behavior');
