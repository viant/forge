import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';

// Independently invented observations; the narrative must not imply missing evidence exists.
function fixture(mode, rows, emptyLabel = 'No observations selected.') {
  const reportSpec = {version:1,kind:'reportSpec',title:'Observation summary',source:{kind:'report',containerId:'observations',stateKey:'observations',dataSourceRef:'readings'},
    parameters:{viewMode:'table',pageSize:25,orderDir:'asc',orderField:'',groupBy:''},refinements:[],calculatedFields:[],
    datasets:[{id:'primary',dataSourceRef:'readings',request:{limit:1,offset:0}}],layoutIntent:{kind:'stack',resultPanePosition:'bottom',blockOrder:['reading']},
    blocks:[{id:'reading',kind:'kpiBlock',title:'Reading',datasetRef:'primary',valueField:'amount',valueLabel:'Amount',valueFormat:'number0',presentationMode:mode,
      bodyTemplate:'Observed amount: ${value}.',...(emptyLabel ? {emptyLabel} : {})}]};
  const datasets = {primary:{rows,diagnostics:[{code:'observation_note',severity:'info',message:'Synthetic observation note.'}]}};
  return {reportSpec,datasets};
}
const text = print => print.pages.flatMap(page=>page.elements).map(element=>element.text || '').join('\n');
function verify(reportSpec, reportFill, reportPrint, empty, label) {
  const printed=text(reportPrint);
  assert.match(printed,/Reading/);
  if (empty) {
    assert.ok(printed.includes(label),printed);
    assert.ok(!printed.includes('Observed amount:'),printed);
    assert.ok(!reportPrint.pages.flatMap(page=>page.elements).some(element=>element.id==='reading__card'));
  } else assert.ok(printed.includes('Observed amount:'),printed);
}
for (const mode of ['body','both']) {
  for (const rows of [[],[{amount:null}],[{amount:null},{amount:null}],[{amount:0}],[{amount:7}]]) {
    const input=fixture(mode,rows),before=JSON.stringify(input),reportFill=buildReportFillFromReportSpec(input.reportSpec,input.datasets),filled=JSON.stringify(reportFill);
    verify(input.reportSpec,reportFill,buildReportPrintFromReportFill({reportSpec:input.reportSpec,reportFill}),rows.length===0||rows.every(row=>row.amount==null),'No observations selected.');
    assert.equal(JSON.stringify(input),before);assert.equal(JSON.stringify(reportFill),filled);
    assert.equal(reportFill.datasets[0].provenance.diagnostics[0].code,'observation_note');
  }
  for (const value of [0,7]) {
    const input=fixture(mode,[{amount:value}]),reportFill=buildReportFillFromReportSpec(input.reportSpec,input.datasets);
    delete reportFill.blocks[0].content.rowCount;
    verify(input.reportSpec,reportFill,buildReportPrintFromReportFill({reportSpec:input.reportSpec,reportFill}),false);
    reportFill.blocks[0].content.rowCount=0;
    verify(input.reportSpec,reportFill,buildReportPrintFromReportFill({reportSpec:input.reportSpec,reportFill}),true,'No observations selected.');
  }
  const input=fixture(mode,[],''),reportFill=buildReportFillFromReportSpec(input.reportSpec,input.datasets);
  verify(input.reportSpec,reportFill,buildReportPrintFromReportFill({reportSpec:input.reportSpec,reportFill}),true,'No KPI value available.');
}
// Card-only persisted output keeps its established numeric placeholder and card geometry.
for(const rows of [[],[{amount:null}],[{amount:0}]]){
  const input=fixture('card',rows),reportFill=buildReportFillFromReportSpec(input.reportSpec,input.datasets),print=buildReportPrintFromReportFill({reportSpec:input.reportSpec,reportFill});
  assert.ok(print.pages.flatMap(page=>page.elements).some(element=>element.id==='reading__card'));
  assert.ok(!text(print).includes('No observations selected.'));
}
const bundle={};vm.runInNewContext(fs.readFileSync(new URL('../../backend/reporting/materializer/lowerer.bundle.js',import.meta.url),'utf8'),bundle);
for(const mode of ['body','both'])for(const rows of [[],[{amount:null}],[{amount:0}],[{amount:7}]]){
  const input=fixture(mode,rows),before=JSON.stringify(input),native=JSON.parse(bundle.ForgeAuthoredLowerer.materialize(JSON.stringify(input)));
  verify(input.reportSpec,native.reportFill,native.reportPrint,rows.length===0||rows[0].amount===null,'No observations selected.');assert.equal(JSON.stringify(input),before);
}
console.log('PASS KPI body/both print emptiness, zero, legacy filled blocks, card compatibility, diagnostics and native bundle.');
