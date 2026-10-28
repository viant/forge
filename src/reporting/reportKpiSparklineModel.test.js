import assert from'node:assert/strict';
import{materializeKpiSparkline,kpiSparklineGeometry,buildKpiSparklineSvg,normalizeKpiSparkline}from'./reportKpiSparklineModel.js';
import{buildReportBuilderReportDocument,lowerReportDocumentToReportSpec}from'./reportDocumentModel.js';
import{buildReportFillFromReportSpec}from'./reportFillModel.js';import{buildReportPrintFromReportFill}from'./reportPrintModel.js';import{validateReportSpec,validateReportFill,validateReportPrint}from'./schema/reportSchemas.js';
const declaration={datasetRef:'daily',categoryField:'day',valueField:'amount',comparisonDatasetRef:'priorDaily'};
const content=materializeKpiSparkline(declaration,ref=>({rows:ref==='daily'?[{day:'2026-10-03',amount:0},{day:'2026-10-01',amount:3},{day:'2026-10-02',amount:null}]:[{day:'2026-09-01',amount:2},{day:'2026-09-02',amount:4}]}));
assert.deepEqual(content,{labels:['2026-10-01','2026-10-02','2026-10-03'],values:[3,null,0],comparisonValues:[2,4]});
const geometry=kpiSparklineGeometry(content);assert.equal((geometry.paths[0].match(/M/g)||[]).length,2);assert.ok(geometry.paths[0].endsWith('158.00 34.00'));assert.match(buildKpiSparklineSvg(content),/stroke-dasharray/);
assert.equal(kpiSparklineGeometry({values:[null,null]}),null);assert.ok(kpiSparklineGeometry({values:[0,0]}));assert.match(buildKpiSparklineSvg({values:[0]}),/<circle/);assert.throws(()=>normalizeKpiSparkline({...declaration,eval:'unsafe'}));assert.throws(()=>materializeKpiSparkline(declaration,()=>null),/unavailable/);assert.throws(()=>materializeKpiSparkline(declaration,()=>({rows:[{day:'same',amount:1},{day:'same',amount:2}]})),/one row per category/);
const amount={id:'amount',key:'amount',label:'Amount',paramPath:'measures.amount'},day={id:'day',key:'day',label:'Day',paramPath:'dimensions.day'};
const config={dataSourceRef:'authorized',measures:[amount],dataSources:['daily','priorDaily'].map(id=>({id,dataSourceRef:'authorized',dimensions:[day],measures:[amount],request:{dimensions:{},measures:{},filters:{}}}))};
const kpi={id:'total',kind:'kpiBlock',title:'Total',datasetRef:'primary',valueField:'amount',sparkline:declaration};
const document=buildReportBuilderReportDocument({container:{id:'sparkline',dataSourceRef:'authorized'},config,state:{selectedMeasures:['amount'],reportDocumentBlocks:[kpi]},additionalBlocks:[kpi]});const spec=lowerReportDocumentToReportSpec(document);
assert.equal(spec.datasets.length,3,'Trend-only datasets must survive pruning');for(const d of spec.datasets.filter(d=>d.id!=='primary')){assert.equal(d.request.dimensions.day,true);assert.equal(d.request.measures.amount,true);}
const specValidation=validateReportSpec(spec);assert.equal(specValidation.valid,true,JSON.stringify(specValidation));
const fill=buildReportFillFromReportSpec(spec,{primary:{rows:[{amount:3}]},daily:{rows:[{day:'2026-10-01',amount:3},{day:'2026-10-02',amount:null}]},priorDaily:{rows:[{day:'2026-09-01',amount:2}]}});assert.deepEqual(fill.blocks.find(b=>b.id==='total').content.sparkline.values,[3,null]);assert.equal(validateReportFill(fill).valid,true,JSON.stringify(validateReportFill(fill)));
const print=buildReportPrintFromReportFill({reportSpec:spec,reportFill:fill});assert.equal(validateReportPrint(print).valid,true,JSON.stringify(validateReportPrint(print)));assert.match(JSON.stringify(print),/total__sparkline/);
console.log('KPI sparkline ✓ retained datasets and projections, null gaps, real zero, shared screen/print geometry');

const dated=materializeKpiSparkline({...declaration,comparisonDatasetRef:undefined,periodStartPath:'filters.from',periodEndPath:'filters.to'},()=>({request:{filters:{from:'2026-10-01',to:'2026-10-04'}},rows:[{day:'2026-10-01',amount:2},{day:'2026-10-03',amount:0}]}));
assert.deepEqual(dated.values,[2,null,0,null]);assert.deepEqual(dated.labels,['2026-10-01','2026-10-02','2026-10-03','2026-10-04']);
assert.throws(()=>materializeKpiSparkline({...declaration,comparisonDatasetRef:undefined,periodStartPath:'filters.from',periodEndPath:'filters.to'},()=>({request:{filters:{from:'2026-02-30',to:'2026-10-04'}},rows:[]})),/valid civil dates/);

assert.throws(()=>lowerReportDocumentToReportSpec({...document,blocks:document.blocks.map(b=>b.id==='total'?{...b,sparkline:{...declaration,valueField:'notApproved'}}:b)}),/fields must be declared/);

// Explicit quantitative colors share browser geometry and printable SVG.
const colorConfig={field:'amount',colors:['#000000','#808080','#ffffff'],domain:{mode:'extent'},opacity:.6};
const colorDeclaration={datasetRef:'daily',categoryField:'day',valueField:'amount',valueColor:colorConfig};
const colorDataset={hasMore:false,rows:[{day:'1',amount:0},{day:'2',amount:100},{day:'3',amount:null},{day:'4',amount:50}]};
const colorContent=materializeKpiSparkline(colorDeclaration,()=>colorDataset);
assert.deepEqual(colorContent.valueColor.domain,[0,100]);
const colorSvg=buildKpiSparklineSvg(colorContent);
assert.match(colorSvg,/stroke-opacity="0.6"/);assert.match(colorSvg,/fill-opacity="0.6" fill="#808080"/);
assert.doesNotMatch(colorSvg,/linearGradient|NaN/);
assert.throws(()=>materializeKpiSparkline(colorDeclaration,()=>({...colorDataset,hasMore:true})),/complete dataset/);
assert.throws(()=>materializeKpiSparkline(colorDeclaration,()=>({...colorDataset,request:{offset:1}})),/complete dataset/);
assert.throws(()=>normalizeKpiSparkline({...colorDeclaration,valueColor:{...colorConfig,field:'other'}}),/plotted measure/);

const coloredSpec=JSON.parse(JSON.stringify(spec));coloredSpec.blocks.find(b=>b.id==='total').sparkline={...declaration,valueColor:colorConfig};
const coloredPayload={primary:{rows:[{amount:1}]},daily:{rows:[{day:'1',amount:1}]},priorDaily:{rows:[{day:'1',amount:2}]}};
assert.throws(()=>buildReportFillFromReportSpec(coloredSpec,coloredPayload),/explicitly complete/);
assert.throws(()=>buildReportFillFromReportSpec(coloredSpec,{...coloredPayload,daily:{...coloredPayload.daily,provenance:{hasMore:false}}}),/explicitly complete/);
assert.doesNotThrow(()=>buildReportFillFromReportSpec(coloredSpec,{...coloredPayload,daily:{...coloredPayload.daily,hasMore:false}}));
