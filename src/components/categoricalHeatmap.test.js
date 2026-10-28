import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildHeatmap,heatmapSelection,heatmapSvg,normalizeHeatmap} from './categoricalHeatmap.js';
import {normalizeReportBuilderChartSpec,validateReportBuilderChartSpec,buildExplicitReportBuilderChartContainer} from './dashboard/reportBuilderUtils.js';
import {buildReportFillChartPayload} from '../reporting/reportFillChartPayload.js';
import {buildReportPrintChartSvg} from '../reporting/reportPrintChartSvg.js';
import {reportSpecSchema,reportFillSchema} from '../reporting/schema/reportSchemas.js';
import {validateReportSchema} from '../reporting/schema/reportSchemaValidator.js';
const fixture=JSON.parse(fs.readFileSync(new URL('../../doc/examples/categorical-heatmap.json',import.meta.url)));
const {heatmap}=fixture.chartSpec, model=buildHeatmap(heatmap,fixture.rows);
assert.deepEqual(model.cells.map(c=>c.value),[8,12,0,5,null,9,0,7,null]);
assert.equal(model.cells[4].state,'null');assert.equal(model.cells[8].state,'absent');
assert.notEqual(model.cells[2].color,model.cells[4].color);
assert.deepEqual(model.cells.filter(c=>c.value===0).map(c=>c.label),['0','0']);
assert.throws(()=>buildHeatmap(heatmap,[fixture.rows[0],fixture.rows[0]]),/duplicate/);
assert.throws(()=>buildHeatmap(heatmap,[{weekday:'Friday',slot:'Morning',occupiedSeats:1}]),/outside/);
assert.throws(()=>buildHeatmap(heatmap,[{...fixture.rows[0],occupiedSeats:'8'}]),/finite/);
assert.throws(()=>normalizeHeatmap({...heatmap,colorScale:{...heatmap.colorScale,domain:[0,0]}}),/ordered/);
const signed=buildHeatmap(fixture.temperatureDeviation.chartSpec.heatmap,fixture.temperatureDeviation.rows);
assert.deepEqual(signed.cells.map(c=>c.color),['#2166ac','#f7f7f7','#d58891','#b2182b']);
const allNull=buildHeatmap(heatmap,[]);assert.ok(allNull.cells.every(c=>c.state==='absent'));
const one=buildHeatmap({...heatmap,rowCategories:['Monday'],columnCategories:['Morning']},[fixture.rows[0]]);assert.equal(one.cells.length,1);
const uneven=buildHeatmap({...heatmap,columnCategories:['Morning']},[]);assert.equal(uneven.cells.length,3);
const long=buildHeatmap({...heatmap,rowCategories:['A very long synthetic row label that stays complete']},[]);assert.ok(heatmapSvg(long).svg.replace(/<[^>]*>/g,'').includes(long.config.rowCategories[0]));
const selection=heatmapSelection(model.config,model.cells[2]);assert.equal(selection.rowDataKey,'weekday');assert.equal(selection.rowValue,'Monday');assert.equal(selection.columnDataKey,'slot');assert.equal(selection.columnValue,'Evening');assert.equal(selection.row.occupiedSeats,0);assert.equal(heatmapSelection(model.config,model.cells[4]),null);
const normalized=normalizeReportBuilderChartSpec(fixture.chartSpec);assert.equal(normalized.xField,'weekday');assert.deepEqual(normalized.yFields,['occupiedSeats']);
const fields=[{key:'weekday',kind:'dimension'},{key:'slot',kind:'dimension'},{key:'occupiedSeats',kind:'measure'}];
assert.equal(validateReportBuilderChartSpec({},normalized,fields).valid,true);assert.equal(validateReportBuilderChartSpec({},normalized,fields.filter(f=>f.key!=='slot')).valid,false);
const chart=buildExplicitReportBuilderChartContainer({}, {}, {}, normalized).chart;
const payload=buildReportFillChartPayload(chart,fixture.rows);assert.deepEqual(payload.rows,fixture.rows);
assert.deepEqual(buildReportPrintChartSvg({chartModel:chart,resolvedChart:payload}),heatmapSvg(model));
assert.equal(buildReportFillChartPayload(chart,[]).rows.length,0);
for(const [schema,name,value] of [[reportSpecSchema,'chartSpec',normalized],[reportSpecSchema,'chartModel',chart],[reportFillSchema,'resolvedChart',payload]]) {
 const result=validateReportSchema({...schema,$ref:`#/$defs/${name}`},JSON.parse(JSON.stringify(value)));
 assert.equal(result.valid,true,JSON.stringify(result));
}
console.log('PASS categorical heatmap model, null/zero/absent, diverging scale, coordinates, validation, serialization and shared print geometry');

// Exercise the authored report -> projection -> fill -> print contract.
const {buildReportBuilderReportDocument,lowerReportDocumentToReportSpec}=await import('../reporting/reportDocumentModel.js');
const {buildReportFillFromReportSpec}=await import('../reporting/reportFillModel.js');
const {buildReportPrintFromReportFill}=await import('../reporting/reportPrintModel.js');
const {validateReportSpec,validateReportFill,validateReportPrint}=await import('../reporting/schema/reportSchemas.js');
const config={dataSourceRef:'synthetic',dimensions:['weekday','slot'].map(id=>({id,key:id,label:id,paramPath:`dimensions.${id}`})),measures:[{id:'occupiedSeats',key:'occupiedSeats',label:'Occupied seats',paramPath:'measures.occupiedSeats'}]};
const block={id:'occupancy',kind:'chartBlock',datasetRef:'primary',chartSpec:fixture.chartSpec};
const document=buildReportBuilderReportDocument({container:{id:'synthetic-heatmap',dataSourceRef:'synthetic'},config,state:{selectedDimensions:['weekday','slot'],selectedMeasures:['occupiedSeats'],reportDocumentBlocks:[block]}});
const spec=lowerReportDocumentToReportSpec(JSON.parse(JSON.stringify(document)));
assert.equal(validateReportSpec(spec).valid,true,JSON.stringify(validateReportSpec(spec)));
assert.equal(spec.blocks.find(b=>b.id==='occupancy').chartModel.type,'heatmap');
const fill=buildReportFillFromReportSpec(spec,{primary:{rows:fixture.rows}});
assert.equal(validateReportFill(fill).valid,true,JSON.stringify(validateReportFill(fill)));
assert.deepEqual(fill.blocks.find(b=>b.id==='occupancy').content.resolvedChart.rows,fixture.rows);
const print=buildReportPrintFromReportFill({reportSpec:spec,reportFill:fill});
assert.equal(validateReportPrint(print).valid,true,JSON.stringify(validateReportPrint(print)));
assert.match(JSON.stringify(print),/No data/);
console.log('PASS authored categorical heatmap report pipeline');
const {resolveReportRuntimeChartActionFields}=await import('./dashboard/reportRuntimeModel.js');
const {resolveReportRuntimeChartInteractionSupport}=await import('./dashboard/reportRuntimeChartInteractions.js');
const {resolveReportRuntimeChartSelectionSummary}=await import('./dashboard/reportRuntimeChartActionModel.js');
const actionFields=resolveReportRuntimeChartActionFields(spec,spec.blocks.find(b=>b.id==='occupancy'));
assert.deepEqual(actionFields.map(f=>f.valueKey),['weekday','slot']);
assert.equal(resolveReportRuntimeChartInteractionSupport(normalized).enabled,true);
assert.equal(resolveReportRuntimeChartSelectionSummary({selection}),'Monday • Evening');
const {resolveReportBuilderChartDependencies}=await import('./dashboard/reportBuilderUtils.js');
assert.deepEqual(resolveReportBuilderChartDependencies(config,fixture.chartSpec).dimensionIds,['weekday','slot']);
// Ordinary filtered source data keeps the fixed axes/domain and raw evidence.
const filteredRows=fixture.rows.filter(row=>row.weekday==='Tuesday');
const filteredFill=buildReportFillFromReportSpec(spec,{primary:{rows:filteredRows}});
const filteredPayload=filteredFill.blocks.find(b=>b.id==='occupancy').content.resolvedChart;
assert.deepEqual(filteredPayload.rows,filteredRows);
assert.deepEqual(buildHeatmap(heatmap,filteredPayload.rows).cells.map(c=>c.value),[null,null,null,5,null,9,null,null,null]);
assert.equal(buildHeatmap(heatmap,filteredRows).cells[3].color,model.cells[3].color);
const explicitNull=buildHeatmap(heatmap,fixture.rows.map(row=>({...row,occupiedSeats:null})));
assert.equal(explicitNull.cells.filter(cell=>cell.state==='null').length,8);
assert.equal(explicitNull.cells.filter(cell=>cell.state==='absent').length,1);
assert.ok(explicitNull.cells.every(cell=>cell.color==='#eeeeee'));
assert.throws(()=>normalizeHeatmap({...heatmap,rowCategories:['Monday','Monday']}),/unique/);
assert.throws(()=>normalizeHeatmap({...heatmap,colorScale:{...heatmap.colorScale,unknown:1}}),/Invalid/);
const noLabels=heatmapSvg(buildHeatmap({...heatmap,cellLabels:false,legend:false},fixture.rows));
assert.ok(!noLabels.svg.includes('>8</text>'));assert.ok(!noLabels.svg.includes('>No data</text>'));
const evidence=fixture.rows.map((row,index)=>({...row,evidenceId:`synthetic-${index}`}));
assert.deepEqual(buildReportFillChartPayload(chart,evidence).rows,evidence);
const clamped=buildHeatmap(heatmap,[{...fixture.rows[0],occupiedSeats:99}]);assert.equal(clamped.cells[0].color,'#08519c');

// Every accepted finite domain must produce real colors in both rendering paths,
// including spans whose subtraction overflows and the smallest positive span.
for (const [domain,values,expected] of [
 [[-1e308,1e308],[-1e308,0,1e308],['#000000','#808080','#ffffff']],
 [[-Number.MAX_VALUE,Number.MAX_VALUE],[-Number.MAX_VALUE,0,Number.MAX_VALUE],['#000000','#808080','#ffffff']],
 [[0,Number.MIN_VALUE],[0,Number.MIN_VALUE],['#000000','#ffffff']],
 [[-Number.MAX_VALUE,1e308,Number.MAX_VALUE],[-Number.MAX_VALUE,1e308,Number.MAX_VALUE],['#000000','#808080','#ffffff']],
]) {
 const colors=domain.length===3?['#000000','#808080','#ffffff']:['#000000','#ffffff'];
 const extremeConfig={...heatmap,rowCategories:['Monday'],columnCategories:values.map((_,i)=>`Slot ${i}`),colorScale:{type:domain.length===3?'diverging':'sequential',domain,colors}};
 const extremeRows=values.map((value,i)=>({weekday:'Monday',slot:`Slot ${i}`,occupiedSeats:value}));
 const extreme=buildHeatmap(extremeConfig,extremeRows);
 assert.deepEqual(extreme.cells.map(cell=>cell.color),expected);
 const extremeChart={...chart,heatmap:extremeConfig};
 const rendered=[heatmapSvg(extreme,680,{interactive:true}).svg,buildReportPrintChartSvg({chartModel:extremeChart,resolvedChart:buildReportFillChartPayload(extremeChart,extremeRows)}).svg];
 for(const svg of rendered) {
  const fills=[...svg.matchAll(/fill="([^"]+)"/g)].map(match=>match[1]);
  assert.ok(fills.length>0);assert.ok(fills.every(color=>/^#[0-9a-f]{6}$/i.test(color)),JSON.stringify(fills));
 }
}
for(const [key,value] of Object.entries({seriesField:'slot',seriesOptions:{},metricSelection:{primaryField:'occupiedSeats',secondaryField:''},layout:'small-multiples',stacked:false})) {
 assert.throws(()=>normalizeReportBuilderChartSpec({...fixture.chartSpec,[key]:value}),/Heatmap|Small multiples/);
 assert.deepEqual(normalizeReportBuilderChartSpec({...fixture.chartSpec,[key]:null}),normalized,'Legacy sanitizer null remains absent');
}
console.log('PASS extreme finite heatmap colors and unsupported chart-option rejection');
const {heatmapPrintPages}=await import('./categoricalHeatmap.js');
const manyRows=Array.from({length:20},(_,i)=>`Row ${i}`),manyColumns=Array.from({length:6},(_,i)=>`Column ${i}`);
const paginatedConfig={...heatmap,rowCategories:manyRows,columnCategories:manyColumns};
const paginatedRows=manyRows.flatMap((weekday,r)=>manyColumns.map((slot,c)=>({weekday,slot,occupiedSeats:r*6+c})));
const paginatedModel=buildHeatmap(paginatedConfig,paginatedRows);
const tiles=heatmapPrintPages(paginatedModel,{width:540,maxHeight:400,firstMaxHeight:220});
assert.ok(tiles.length>3);
assert.equal(tiles.reduce((count,tile)=>count+(tile.svg.match(/stroke="#ffffff"/g)||[]).length,0),120);
for(const [i,tile] of tiles.entries()) {
 assert.equal(tile.width,540);assert.ok(tile.height<=(i===0?220:400));assert.match(tile.svg,/<g font-size="12"/);assert.match(tile.svg,/>No data</);
}
const moved=heatmapPrintPages(model,{width:540,maxHeight:400,firstMaxHeight:80});
assert.equal(moved[0].startNewPage,true);assert.ok(moved[0].height<=400);
const tooLong=buildHeatmap({...heatmap,rowCategories:['A'.repeat(1000)],columnCategories:['Morning']},[]);
assert.equal(heatmapPrintPages(tooLong,{width:540,maxHeight:200})[0].diagnostics[0].code,'heatmapPrintLayoutDoesNotFit');
assert.equal(heatmapPrintPages(model,{width:200})[0].svg,'');
const emptyFill=buildReportFillFromReportSpec(spec,{primary:{rows:[],hasMore:false,truncated:false,diagnostics:[]}});
const emptyPrint=buildReportPrintFromReportFill({reportSpec:spec,reportFill:emptyFill});
const emptySVG=emptyPrint.pages.flatMap(page=>page.elements).filter(e=>e.kind==='svg').map(e=>e.svg).join('');
assert.equal((emptySVG.match(/stroke="#ffffff"/g)||[]).length,9);
assert.match(emptySVG,/>Monday</);assert.match(emptySVG,/>No data</);
console.log('PASS heatmap print tiling, exact width, height budgets, empty axes and no-fit diagnostic');
for(const schema of [reportSpecSchema,reportFillSchema]) for(const [name,value] of [['chartSpec',normalized],['chartModel',chart]]) {
 const missing={...value};delete missing.heatmap;
 assert.equal(validateReportSchema({...schema,$ref:`#/$defs/${name}`},missing).valid,false,`${name} must require its heatmap config`);
}
