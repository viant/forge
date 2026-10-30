import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveDonutCenter,normalizeDonutCenter,layoutDonutCenter} from './donutCenter.js';
import {normalizeReportBuilderChartSpec,buildExplicitReportBuilderChartContainer,resolveReportBuilderChartDependencies,validateReportBuilderChartSpec} from './dashboard/reportBuilderUtils.js';
import {buildReportFillChartPayload} from '../reporting/reportFillChartPayload.js';
import {buildReportPrintChartSvg} from '../reporting/reportPrintChartSvg.js';
const fixture=JSON.parse(fs.readFileSync(new URL('../../doc/examples/donut-center.json',import.meta.url)));
const center=fixture.chartSpec.center;
assert.equal(resolveDonutCenter(center,fixture.rows).value,500);
assert.equal(resolveDonutCenter(fixture.occupancy,fixture.rows).formattedValue,'72.5%');
assert.equal(resolveDonutCenter(fixture.occupancy,fixture.zeroRows).formattedValue,'0.0%');
assert.equal(resolveDonutCenter(fixture.occupancy,fixture.nullRows).value,null);
assert.equal(resolveDonutCenter(center,[]).formattedValue,'Unavailable');
assert.equal(resolveDonutCenter(center,[{items:null},{items:3}]).value,3);
assert.equal(resolveDonutCenter({...fixture.occupancy,format:'number2'},[{occupancyRate:1.236}]).formattedValue,'1.24');
assert.equal(resolveDonutCenter({...fixture.occupancy,format:'percentfraction'},[{occupancyRate:.725}]).formattedValue,'72.5%');
assert.throws(()=>resolveDonutCenter(fixture.occupancy,[{occupancyRate:1},{occupancyRate:2}]),/agree/);
assert.throws(()=>resolveDonutCenter(center,[{items:'2'}]),/finite/);
assert.throws(()=>normalizeDonutCenter(center,'pie'),/only on donut/);
assert.equal(layoutDonutCenter({...resolveDonutCenter(center,fixture.rows),label:fixture.longLabel},20).needsDetails,true);
const config={dataSourceRef:'synthetic',dimensions:[{id:'category',key:'category',label:'Category',paramPath:'dimensions.category'}],measures:['items','occupancyRate'].map(id=>({id,key:id,label:id,paramPath:`measures.${id}`}))};
const occupancySpec={...fixture.chartSpec,center:fixture.occupancy};
const chart=buildExplicitReportBuilderChartContainer({},config,{},occupancySpec).chart;
assert.deepEqual(chart.center,fixture.occupancy);
assert.deepEqual(resolveReportBuilderChartDependencies(config,occupancySpec).measureIds,['items','occupancyRate']);
assert.equal(validateReportBuilderChartSpec(config,occupancySpec,[{key:'category',kind:'dimension'},{key:'items',kind:'measure'}]).valid,false);
const payload=buildReportFillChartPayload(chart,fixture.rows);
assert.equal(payload.center.value,72.5);assert.equal(payload.rows.reduce((sum,row)=>sum+row.value,0),500);
assert.match(buildReportPrintChartSvg({chartModel:chart,resolvedChart:payload}).svg,/72.5%/);
const {buildReportBuilderReportDocument,lowerReportDocumentToReportSpec}=await import('../reporting/reportDocumentModel.js');
const {buildReportFillFromReportSpec}=await import('../reporting/reportFillModel.js');
const {buildReportPrintFromReportFill}=await import('../reporting/reportPrintModel.js');
const {validateReportSpec,validateReportFill,validateReportPrint}=await import('../reporting/schema/reportSchemas.js');
const document=buildReportBuilderReportDocument({container:{id:'synthetic-donut',dataSourceRef:'synthetic'},config,state:{selectedDimensions:['category'],selectedMeasures:['items'],reportDocumentBlocks:[{id:'collection',kind:'chartBlock',datasetRef:'primary',chartSpec:occupancySpec}]}});
const spec=lowerReportDocumentToReportSpec(JSON.parse(JSON.stringify(document)));
assert.equal(validateReportSpec(spec).valid,true,JSON.stringify(validateReportSpec(spec)));
assert.ok(JSON.stringify(spec.datasets).includes('occupancyRate'));
for(const rows of [fixture.rows,fixture.zeroRows,fixture.nullRows,[]]) {
 const fill=buildReportFillFromReportSpec(spec,{primary:{rows}});
 assert.equal(validateReportFill(fill).valid,true,JSON.stringify(validateReportFill(fill)));
 const resolved=fill.blocks.find(b=>b.id==='collection').content.resolvedChart;
 assert.deepEqual(resolved.center,resolveDonutCenter(fixture.occupancy,rows));
 const print=buildReportPrintFromReportFill({reportSpec:spec,reportFill:fill});
 assert.equal(validateReportPrint(print).valid,true,JSON.stringify(validateReportPrint(print)));
 assert.match(JSON.stringify(print),new RegExp(resolved.center.formattedValue.replace('.','\\.')));
}
const longChart={...chart,center:{...center,label:fixture.longLabel}};
const long=buildReportPrintChartSvg({chartModel:longChart,resolvedChart:buildReportFillChartPayload(longChart,fixture.rows),width:360});
assert.ok(long.labelDetails.some(line=>line.includes(fixture.longLabel)&&line.includes('500')));
assert.deepEqual(normalizeReportBuilderChartSpec(JSON.parse(JSON.stringify(occupancySpec))).center,fixture.occupancy);
console.log('donut center explicit sources, scalar consistency, formats, dependencies, schema/fill/print and fallback passed');
assert.deepEqual(payload.rows,buildReportFillChartPayload({...chart,center:undefined},fixture.rows).rows);
assert.equal(buildReportFillChartPayload({...chart,rowLimit:1},fixture.rows).center.value,72.5);
const limited=buildReportPrintChartSvg({chartModel:chart,resolvedChart:payload,rowLimit:1});
assert.match(limited.svg,/72.5%/);
const wrongType=JSON.parse(JSON.stringify(spec));wrongType.blocks.find(b=>b.id==='collection').chartSpec.type='pie';
assert.equal(validateReportSpec(wrongType).valid,false);
// Uncompiled authored chart blocks historically have null models. Neither the
// center resolver nor the tooltip wrapper may turn that absence into a failure.
for(const absentChart of [null,undefined,{}]) {
 assert.equal(buildReportFillChartPayload(absentChart,fixture.rows),null);
 assert.equal(buildReportFillChartPayload(absentChart,[]),null);
}
// Exact line contents preserve words; a word that cannot fit moves outside.
const libraryCenter=resolveDonutCenter(center,fixture.rows),occupancyCenter=resolveDonutCenter(fixture.occupancy,fixture.rows);
for(const value of [libraryCenter,occupancyCenter]) {
 assert.deepEqual(layoutDonutCenter(value,55).labelLines,[]); // empty-ring radius
 assert.equal(layoutDonutCenter(value,55).needsDetails,true);
 assert.deepEqual(layoutDonutCenter(value,80).labelLines,value.label.split(' '));
 assert.equal(layoutDonutCenter(value,80).needsDetails,false);
}
assert.deepEqual(layoutDonutCenter(libraryCenter,240*.36*.7).labelLines,[]); // default print radius
assert.equal(layoutDonutCenter(libraryCenter,240*.36*.7).needsDetails,true);
assert.deepEqual(layoutDonutCenter(occupancyCenter,240*.36*.7).labelLines,['Occupancy','rate']);
assert.deepEqual(layoutDonutCenter(occupancyCenter,226*.36*.7).labelLines,[]); // Letter content width
assert.deepEqual(layoutDonutCenter({...occupancyCenter,label:'  Occupancy  \n rate  '},80).labelLines,['Occupancy','rate']);
assert.equal(layoutDonutCenter({...libraryCenter,label:'indivisiblelonglabel'},55).needsDetails,true);
const noSlicePrint=buildReportPrintChartSvg({chartModel:chart,resolvedChart:buildReportFillChartPayload(chart,[])});
assert.ok(noSlicePrint.labelDetails.includes('No slice data.'));
const printWords=buildReportPrintChartSvg({chartModel:chart,resolvedChart:payload,width:680});
assert.match(printWords.svg,/>Occupancy<\/text>/);assert.match(printWords.svg,/>rate<\/text>/);
assert.doesNotMatch(printWords.svg,/>Occupanc<\/text>|>y rate<\/text>/);
const printLibrary=buildReportPrintChartSvg({chartModel:{...chart,center},resolvedChart:buildReportFillChartPayload({...chart,center},fixture.rows),width:680});
assert.ok(printLibrary.labelDetails.some(line=>line.includes('Catalogued items')));
assert.doesNotMatch(printLibrary.svg,/>Catalogue<\/text>|>d items<\/text>/);
// Independent scalar producers preserve ratios and zero through conditional formats.
const independent={label:'Selected metric',datasetRef:'summary',alternatives:[{field:'ratio',operation:'scalar',format:'percentfraction2'},{field:'count',operation:'scalar',format:'number'}]};
const independentChart={...chart,center:independent};
const independentRows=[{ratio:.125,count:null}];
assert.equal(buildReportFillChartPayload(independentChart,fixture.rows,independentRows).center.formattedValue,'12.50%');
assert.equal(resolveDonutCenter(independent,fixture.rows,'donut',[{ratio:null,count:0}]).value,0);
assert.equal(resolveDonutCenter(independent,fixture.rows,'donut',[{ratio:null,count:null}]).value,null);
assert.throws(()=>resolveDonutCenter(independent,fixture.rows,'donut',[{ratio:.2,count:0}]),/mutually exclusive/);
assert.throws(()=>resolveDonutCenter(independent,fixture.rows),/dataset is unavailable/);
assert.deepEqual(resolveReportBuilderChartDependencies(config,{...occupancySpec,center:independent}).measureIds,['items']);
const independentSpec=JSON.parse(JSON.stringify(spec));
independentSpec.datasets.push({...independentSpec.datasets[0],id:'summary',request:{dimensions:{},measures:{ratio:true,count:true}}});
const independentBlock=independentSpec.blocks.find(b=>b.id==='collection');
independentBlock.chartSpec.center=independent;independentBlock.chartModel.center=independent;
assert.equal(validateReportSpec(independentSpec).valid,true,JSON.stringify(validateReportSpec(independentSpec)));
const independentFill=buildReportFillFromReportSpec(independentSpec,{primary:{rows:fixture.rows},summary:{rows:independentRows,hasMore:false}});
assert.equal(independentFill.blocks.find(b=>b.id==='collection').content.resolvedChart.center.formattedValue,'12.50%');
assert.equal(validateReportFill(independentFill).valid,true,JSON.stringify(validateReportFill(independentFill)));
assert.match(JSON.stringify(buildReportPrintFromReportFill({reportSpec:independentSpec,reportFill:independentFill})),/12.50%/);
assert.throws(()=>resolveDonutCenter(independent,fixture.rows,'donut',[{ratio:null}]),/absent/);
assert.throws(()=>resolveDonutCenter(independent,fixture.rows,'donut',[{ratio:null,count:1},{ratio:null,count:1}]),/one scalar row/);
for(const flags of [{hasMore:true},{truncated:true}]) {
 assert.throws(()=>buildReportFillFromReportSpec(independentSpec,{primary:{rows:fixture.rows},summary:{rows:independentRows,hasMore:false,...flags}}),/complete scalar/);
}
const absentCenter=structuredClone(independentSpec);absentCenter.datasets=absentCenter.datasets.filter(d=>d.id!=='summary');
assert.equal(validateReportSpec(absentCenter).valid,false);
const unboundCenter=structuredClone(independentSpec);unboundCenter.datasets.find(d=>d.id==='summary').request.measures={ratio:true};
assert.equal(validateReportSpec(unboundCenter).valid,false);
const currencyCenter={...independent,alternatives:[{field:'count',operation:'scalar',label:'Selected charge',format:{prefix:'$',decimals:0,grouping:true,negativeStyle:'parentheses'}}]};
assert.equal(resolveDonutCenter(currencyCenter,[],'donut',[{count:-1234}]).formattedValue,'($1,234)');
assert.equal(resolveDonutCenter(currencyCenter,[],'donut',[{count:0}]).label,'Selected charge');
const parameterCenter={...independent,labelInput:{path:'metric',labels:[{value:1,label:'Capacity'},{value:2,label:'Share'}]}};
for(const rows of [[],[{ratio:null,count:null}]])assert.equal(resolveDonutCenter(parameterCenter,[],'donut',rows,{metric:2}).label,'Share');
assert.equal(resolveDonutCenter(parameterCenter,[],'donut',[{ratio:null,count:0}],{metric:1}).label,'Capacity');
assert.throws(()=>resolveDonutCenter(parameterCenter,[],'donut',[],{metric:'1'}),/declared label/);
assert.throws(()=>resolveDonutCenter(parameterCenter,[],'donut',[],{}),/missing/);
assert.throws(()=>normalizeDonutCenter({...parameterCenter,labelInput:{...parameterCenter.labelInput,path:'__proto__.metric'}}),/safe filter path/);
for(const selection of [1,2]){
 const labelled=structuredClone(independentSpec);const block=labelled.blocks.find(b=>b.id==='collection');block.chartSpec.center=parameterCenter;block.chartModel.center=parameterCenter;labelled.datasets.find(d=>d.id==='summary').request.filters={metric:selection};
 const fill=buildReportFillFromReportSpec(labelled,{primary:{rows:[]},summary:{rows:[],hasMore:false}});
 const label=selection===1?'Capacity':'Share';assert.equal(fill.blocks.find(b=>b.id==='collection').content.resolvedChart.center.label,label);
 assert.ok(JSON.stringify(buildReportPrintFromReportFill({reportSpec:labelled,reportFill:fill})).includes(label));
}
assert.throws(()=>buildReportFillFromReportSpec(independentSpec,{primary:{rows:[]},summary:{rows:independentRows}}),/explicitly complete/);

const fixedChart={...chart,paletteMode:'declared',center:fixture.independent.center,sliceLabel:fixture.independent.sliceLabel,series:{nameKey:'category',valueKey:'items',palette:fixture.independent.palette,categoryColors:fixture.independent.categoryColors}};
const subset=[fixture.independent.sliceRows[2],fixture.independent.sliceRows[0]];
const fixedPayload=buildReportFillChartPayload(fixedChart,subset,fixture.independent.rows,fixture.independent.inputs);
const fixedPrint=buildReportPrintChartSvg({chartModel:fixedChart,resolvedChart:fixedPayload});
assert.ok(fixedPrint.svg.indexOf('fill="#72577c"')<fixedPrint.svg.indexOf('fill="#426b85"'));
assert.ok(!fixedPrint.svg.includes('fill="#8a7644"'));
assert.ok(fixedPrint.svg.includes('20.0%')&&fixedPrint.svg.includes('48.0%'));
const emphatic={...fixture.occupancy,valueRole:'body',valueEmphasis:'bold italic',labelEmphasis:'italic'};
const emphaticResult=resolveDonutCenter(emphatic,fixture.rows);
assert.equal(emphaticResult.valueRole,'body');assert.equal(emphaticResult.valueEmphasis,'bold italic');
assert.throws(()=>normalizeDonutCenter({...emphatic,valueRole:'display'}),/role/);
assert.throws(()=>normalizeDonutCenter({...emphatic,valueEmphasis:'font-size:30'}),/emphasis/);
const emphaticChart={...chart,center:emphatic};const emphaticPayload=buildReportFillChartPayload(emphaticChart,fixture.rows);
const emphaticSvg=buildReportPrintChartSvg({chartModel:emphaticChart,resolvedChart:emphaticPayload,width:680});
assert.ok(emphaticSvg.svg.includes('font-weight="bold"')&&emphaticSvg.svg.includes('font-style="italic"'));
const emphaticSpec=structuredClone(spec);emphaticSpec.blocks.find(b=>b.id==='collection').chartSpec.center=emphatic;emphaticSpec.blocks.find(b=>b.id==='collection').chartModel.center=emphatic;
const emphaticFill=buildReportFillFromReportSpec(emphaticSpec,{primary:{rows:fixture.rows}});
assert.equal(validateReportFill(emphaticFill).valid,true,JSON.stringify(validateReportFill(emphaticFill)));
assert.equal(validateReportPrint(buildReportPrintFromReportFill({reportSpec:emphaticSpec,reportFill:emphaticFill})).valid,true);

// The shared portable estimate preserves the original center-layout default.
const {measureChartText}=await import('./chartTextMeasure.js');
for(const label of ['Simple label','WW@% wide 漢字','line with emphasis']) for(const emphasis of [undefined,'bold','italic','bold italic']) {
 const original=(text,size,role,weight)=>[...text].reduce((sum,char)=>sum+size*(/[WM@%]|[^\x00-\x7F]/u.test(char)?1:.65),0)*(weight?.includes('bold')?1.1:1);
 assert.equal(measureChartText(label,12,'label',emphasis),original(label,12,'label',emphasis));
 const center={label,formattedValue:'123456',labelEmphasis:emphasis,valueEmphasis:emphasis};
 assert.deepEqual(layoutDonutCenter(center,80),layoutDonutCenter(center,80,{measure:original}));
}
