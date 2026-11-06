import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import DashboardTableContent from './DashboardTableContent.jsx';
import {resolveReportTableCellVisualState} from './reportTableCellVisuals.js';
import {buildReportBuilderReportDocument, lowerReportDocumentToReportSpec} from '../../reporting/reportDocumentModel.js';
import {buildReportFillFromReportSpec} from '../../reporting/reportFillModel.js';
import {buildReportPrintFromReportFill} from '../../reporting/reportPrintModel.js';
import {validateReportSpec, validateReportFill, validateReportPrint} from '../../reporting/schema/reportSchemas.js';
import {normalizeReportTableCellVisual} from '../../reporting/tableVisualSpec.js';
import {renderReportTableCsv} from '../../reporting/reportTableCsv.js';

// Independently authored neutral measurements, shared with the native exporters.
const {column, rows} = JSON.parse(readFileSync(new URL('../../../doc/examples/colored-numeric-tone.json', import.meta.url)));
function specFor(column) {
  return {version: 1, kind: 'reportSpec', title: 'Measurements',
    source: {kind: 'dashboard.reportBuilder', containerId: 'measurements', stateKey: 'measurements', dataSourceRef: 'measurements'},
    parameters: {viewMode:'table', groupBy:'', pageSize:25, orderField:'', orderDir:'asc'},
    layoutIntent:{kind:'single', resultPanePosition:'right', blockOrder:['details'], items:[{blockId:'details'}]},
    refinements:[], calculatedFields:[], datasets:[{id:'primary', dataSourceRef:'measurements', request:{}}],
    blocks:[{id:'details', kind:'tableBlock', title:'Measurements', datasetRef:'primary', columns:[column]}]};
}
function render(row, column) {
  return renderToStaticMarkup(React.createElement(DashboardTableContent, {
    container:{id:'details', dashboard:{table:{columns:[column]}}},
    context:{signals:{collection:{value:[row]}, control:{value:{loading:false,error:null}}, selection:{value:null}}, identity:{dataSourceRef:'measurements'}}
  }));
}
assert.deepEqual(normalizeReportTableCellVisual(column.cellVisual), column.cellVisual);
for (const [row, tone, color] of [[rows[0],'danger','#b42318'],[rows[1],'success','#027a48'],
  [{measurement:123.456,status:'other'},null,null], [{measurement:123.456},null,null],
  [{measurement:123.456,status:null},null,null], [{measurement:null,status:'good'},'success','#027a48']]) {
  const spec = specFor(column);
  const fill = buildReportFillFromReportSpec(spec,{primary:{rows:[row]}});
  const print = buildReportPrintFromReportFill({reportSpec:spec, reportFill:fill});
  for (const [validate, value] of [[validateReportSpec,spec],[validateReportFill,fill],[validateReportPrint,print]]) assert.deepEqual(validate(value),{valid:true,errors:[]});
  const cell = fill.blocks[0].content.resolvedRows[0].cells[0];
  const runtimeState = resolveReportTableCellVisualState(row,column);
  assert.deepEqual(cell.visualState && {...cell.visualState,label:''}, runtimeState);
  assert.equal(cell.value,row.measurement);
  const html = render(row,column);
  const printed = print.pages.flatMap(page=>page.elements);
  const visual = printed.find(element=>element.kind==='tableCellTone');
  if (tone) {
    assert.ok(html.includes(`data-visual-tone="${tone}"`));
    assert.ok(html.includes(`color:${color}`));
    assert.equal(visual.tone,tone);
    assert.equal(visual.textColor,color);
  } else {
    assert.equal(cell.visualState,null);
    assert.equal(visual,undefined);
  }
  if(row.measurement != null) {
    assert.ok(html.includes('123.46'));
    if(visual) assert.equal(visual.label,'123.46');
    assert.equal(renderReportTableCsv(fill.blocks[0]),'Measurement\n123.456\n');
  } else {
    assert.ok(!html.includes('>0<'));
    assert.notEqual(visual.label,'0');
    assert.equal(renderReportTableCsv(fill.blocks[0]),'Measurement\n\n');
  }
}
// Field selectors use the existing dotted-path contract. A literal dotted key
// does not shadow the nested value, and is not a fallback for a missing path.
const nestedColumn = {...column,cellVisual:{...column.cellVisual,colorField:'assessment.status'}};
for (const [row, expectedTone] of [
  [{measurement:123.456,assessment:{status:'good'}},'success'],
  [{measurement:123.456,'assessment.status':'good'},null],
  [{measurement:123.456,assessment:{status:'low'},'assessment.status':'good'},'danger'],
]) {
  const runtimeState = resolveReportTableCellVisualState(row,nestedColumn);
  assert.equal(runtimeState?.tone ?? null,expectedTone);
  const nestedSpec=specFor(nestedColumn);
  const nestedFill=buildReportFillFromReportSpec(nestedSpec,{primary:{rows:[row]}});
  const filledState=nestedFill.blocks[0].content.resolvedRows[0].cells[0].visualState;
  assert.deepEqual(filledState && {...filledState,label:''},runtimeState);
  const html=render(row,nestedColumn);
  assert.ok(html.includes('123.46'));
  assert.equal(html.includes('data-visual-kind="tone"'),expectedTone!=null);
  if(expectedTone) assert.ok(html.includes(`data-visual-tone="${expectedTone}"`));
  const nestedPrint=buildReportPrintFromReportFill({reportSpec:nestedSpec,reportFill:nestedFill});
  const printedTone=nestedPrint.pages.flatMap(page=>page.elements).find(e=>e.kind==='tableCellTone');
  assert.equal(printedTone?.tone ?? null,expectedTone);
  assert.equal(renderReportTableCsv(nestedFill.blocks[0]),'Measurement\n123.456\n');
}
for (const measurement of ['', '   ']) {
  for (const label of [undefined,'Reviewed']) {
    const blankColumn={...column,cellVisual:{...column.cellVisual,rules:[{value:'good',tone:'success',...(label ? {label} : {})}]}};
    const row={measurement,status:'good'};
    const blankSpec=specFor(blankColumn);
    const blankFill=buildReportFillFromReportSpec(blankSpec,{primary:{rows:[row]}});
    assert.deepEqual(validateReportFill(blankFill),{valid:true,errors:[]});
    const cell=blankFill.blocks[0].content.resolvedRows[0].cells[0];
    assert.equal(cell.value,measurement);
    assert.equal(cell.visualState?.label ?? null,label ?? null);
    const html=render(row,blankColumn);
    assert.equal(html.includes('data-visual-kind="tone"'),Boolean(label));
    if(label) assert.ok(html.includes(label));
    assert.deepEqual(resolveReportTableCellVisualState(row,blankColumn),cell.visualState);
    const blankPrint=buildReportPrintFromReportFill({reportSpec:blankSpec,reportFill:blankFill});
    assert.equal(blankPrint.pages.flatMap(page=>page.elements).find(e=>e.kind==='tableCellTone')?.label ?? null,label ?? null);
    assert.equal(renderReportTableCsv(blankFill.blocks[0]),`Measurement\n${measurement}\n`);
  }
}
const override = {...column,cellVisual:{...column.cellVisual,rules:[{value:'good',tone:'success',label:'Reviewed'}]}};
assert.ok(render(rows[1],override).includes('Reviewed'));
const overrideSpec=specFor(override);
const overrideFill=buildReportFillFromReportSpec(overrideSpec,{primary:{rows:[rows[1]]}});
assert.equal(buildReportPrintFromReportFill({reportSpec:overrideSpec,reportFill:overrideFill}).pages.flatMap(page=>page.elements).find(e=>e.kind==='tableCellTone').label,'Reviewed');
assert.equal(renderReportTableCsv(overrideFill.blocks[0]),'Measurement\n123.456\n');
const nullRule={...column,cellVisual:{...column.cellVisual,rules:[{value:null,tone:'warning'}]}};
assert.equal(resolveReportTableCellVisualState({measurement:1,status:null},nullRule).tone,'warning');
assert.equal(resolveReportTableCellVisualState({measurement:1},nullRule),null);
for(const kind of ['badge','delta','rank']) assert.equal(validateReportSpec(specFor({...column,cellVisual:{...column.cellVisual,kind}})).valid,false);
for(const kind of ['tone','badge']) {
  const legacy={key:'measurement',cellVisual:{kind,rules:[{value:123.456,tone:'warning'}]}};
  assert.deepEqual(resolveReportTableCellVisualState(rows[0],legacy),{kind,tone:'warning',label:'123.456'});
  assert.ok(render(rows[0],legacy).includes('123.456'));
  const labeled = {...legacy,cellVisual:{...legacy.cellVisual,rules:[{value:123.456,tone:'warning',label:'Needs review'}]}};
  assert.equal(resolveReportTableCellVisualState(rows[0],labeled).label,'Needs review');
  const legacySpec=specFor({...labeled,label:'Measurement'});
  assert.equal(buildReportFillFromReportSpec(legacySpec,{primary:{rows:[rows[0]]}}).blocks[0].content.resolvedRows[0].cells[0].visualState.label,'Needs review');
}

// colorField is the only reference to this calculation. Its rank/expression
// dependencies must survive lowering while unrelated catalog fields stay out.
const calculatedExample=JSON.parse(readFileSync(new URL('../../../doc/examples/calculated-numeric-tone.json',import.meta.url)));
const calculatedDocument=buildReportBuilderReportDocument({
  container:{id:'measurements',stateKey:'measurements',dataSourceRef:'measurements'},
  config:calculatedExample.config,state:calculatedExample.state,
  additionalBlocks:[{id:'calculatedDetails',kind:'tableBlock',title:'Calculated measurements',datasetRef:'primary',columns:[calculatedExample.column]}],
});
const calculatedSpec=lowerReportDocumentToReportSpec(calculatedDocument,{includePrimaryBlocks:false});
assert.deepEqual(calculatedSpec.calculatedFields.map(field=>field.key).sort(),['calculatedTone','sampleRank','sampleSort']);
assert.deepEqual(calculatedSpec.datasets[0].request.measures,{measurement:true});
assert.deepEqual(calculatedSpec.datasets[0].request.dimensions,{sampleCode:true,status:true});
const calculatedFill=buildReportFillFromReportSpec(calculatedSpec,{primary:{rows:calculatedExample.rows,hasMore:false}});
const calculatedTable=calculatedFill.blocks.find(block=>block.id==='calculatedDetails');
assert.deepEqual(calculatedTable.content.resolvedRows.map(row=>row.cells[0].visualState.tone),['danger','success']);
const calculatedPrint=buildReportPrintFromReportFill({reportSpec:calculatedSpec,reportFill:calculatedFill});
assert.deepEqual(calculatedPrint.pages.flatMap(page=>page.elements).filter(e=>e.kind==='tableCellTone').map(e=>e.label),['123.46','123.46']);
assert.equal(renderReportTableCsv(calculatedTable),'Measurement\n123.456\n123.456\n');
for(const row of calculatedFill.datasets[0].rows) {
  const html=render(row,calculatedExample.column);
  assert.ok(html.includes('123.46'));
  assert.ok(html.includes(`data-visual-tone="${row.status==='good'?'success':'danger'}"`));
}
console.log('Numeric tone lowering, runtime, schema, fill, CSV and canonical print checks passed.');
