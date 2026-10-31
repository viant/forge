import assert from 'node:assert/strict';
import {buildHeatmap,heatmapSelection,heatmapSvg,heatmapPrintPages,normalizeHeatmap,heatmapSchema} from './categoricalHeatmap.js';
import {numericDisplayFormatSchema} from './categoryRange.js';
import {normalizeReportBuilderChartSpec} from './dashboard/reportBuilderUtils.js';
import {reportSpecSchema} from '../reporting/schema/reportSchemas.js';
import {validateReportSchema} from '../reporting/schema/reportSchemaValidator.js';
// Independently invented neutral quantities. Formatting must never change evidence.
const config={rowField:'row',columnField:'column',valueField:'value',rowCategories:['A'],columnCategories:['X','Y','Z','N','M'],colorScale:{type:'sequential',domain:'auto',colors:['#000000','#ffffff']},format:{decimals:2}};
const rows=[8/3,2.671,0,null].map((value,i)=>({row:'A',column:config.columnCategories[i],value,evidence:i}));
const precise={...config,columnCategories:['X','Y']};
const model=buildHeatmap(precise,rows.slice(0,2));
assert.equal(heatmapSchema.properties.format,numericDisplayFormatSchema);
assert.deepEqual(model.cells.map(cell=>cell.label),['2.67','2.67']);
assert.deepEqual(model.cells.map(cell=>cell.value),[8/3,2.671]);
assert.deepEqual(model.cells.map(cell=>cell.color),['#000000','#ffffff']);
assert.deepEqual(model.scale.domain,[8/3,2.671]);
for(const [i,cell] of model.cells.entries())assert.deepEqual(heatmapSelection(model.config,cell).row,rows[i]);
const svg=heatmapSvg(model,390,{interactive:true}).svg;
assert.match(svg,/aria-label="A, X: 2.67"/);
assert.equal((svg.match(/>2\.67<\/text>/g)||[]).length,4,'Cells and both legend stops share format');
assert.ok(!svg.includes(String(8/3)));
const fixedConfig={...precise,colorScale:{...precise.colorScale,domain:[2.666,2.672]}};
assert.deepEqual(buildHeatmap(fixedConfig,rows.slice(0,2)).cells.map(cell=>cell.color),buildHeatmap({...fixedConfig,format:undefined},rows.slice(0,2)).cells.map(cell=>cell.color));
const constant=buildHeatmap(precise,rows.slice(0,2).map(row=>({...row,value:-2.671})));
assert.deepEqual(constant.cells.map(cell=>cell.label),['-2.67','-2.67']);
assert.ok(constant.cells.every(cell=>cell.color==='#808080'));
assert.equal((heatmapSvg(constant).svg.match(/>-2\.67<\/text>/g)||[]).length,3);
const legacy=buildHeatmap({...precise,format:undefined},rows.slice(0,2));
assert.equal(legacy.cells[0].label,String(8/3));
assert.ok(heatmapSvg(legacy).svg.replace(/<[^>]*>/g,'').includes(String(8/3)));
const states=buildHeatmap(config,rows);
assert.deepEqual(states.cells.map(cell=>cell.label),['2.67','2.67','0.00','No data','No data']);
assert.deepEqual(states.cells.slice(3).map(cell=>cell.state),['null','absent']);
assert.equal(heatmapSelection(config,states.cells[3]),null);
for(const [format,value,label] of [[{scale:100,decimals:2,suffix:'%'},.02671,'2.67%'],[{prefix:'$',decimals:2,grouping:true,negativeStyle:'parentheses'},-1234.5,'($1,234.50)'],[{prefix:'<',suffix:'&"',decimals:2},0,'<0.00&"']]){
 const formatted=buildHeatmap({...precise,format},[{row:'A',column:'X',value}]);
 assert.equal(formatted.cells[0].label,label);
 assert.equal(formatted.cells[0].value,value);
 if(format.prefix==='<'){
  const rendered=heatmapSvg(formatted,390,{interactive:true}).svg;
  assert.match(rendered,/&lt;0.00&amp;&quot;/);
  assert.ok(!rendered.includes('<0.00'));
 }
}
for(const format of [null,[],{decimals:11},{decimals:1.5},{scale:Infinity},{prefix:2},{suffix:2},{grouping:'yes'},{negativeStyle:'red'},{unknown:true}])assert.throws(()=>normalizeHeatmap({...config,format}));
const chart=normalizeReportBuilderChartSpec({type:'heatmap',heatmap:config});
const validated=validateReportSchema({...reportSpecSchema,$ref:'#/$defs/chartSpec'},chart);
assert.equal(validated.valid,true,JSON.stringify(validated));
assert.deepEqual(JSON.parse(JSON.stringify(chart)).heatmap.format,config.format);
const tiledConfig={...config,rowCategories:['A','B','C','D'],columnCategories:['X','Y','Z','W']};
const tiledRows=tiledConfig.rowCategories.flatMap(row=>tiledConfig.columnCategories.map((column,i)=>({row,column,value:i%2?2.671:8/3})));
const tiled=buildHeatmap(tiledConfig,tiledRows),pages=heatmapPrintPages(tiled,{width:180,maxHeight:220,firstMaxHeight:80});
assert.ok(pages.length>1);
assert.ok(pages[0].startNewPage);
assert.equal(pages.reduce((count,page)=>count+(page.svg.match(/stroke="#ffffff"/g)||[]).length,0),16);
for(const page of pages){
 assert.deepEqual(page.diagnostics,[]);
 assert.ok(page.height<=220);
 assert.ok(!page.svg.includes(String(8/3)));
 assert.match(page.svg,/>2.67<\/text>/);
 assert.match(page.svg,/fill="#000000"/);
 assert.match(page.svg,/fill="#ffffff"/);
}
assert.deepEqual(tiledRows,tiled.cells.map(cell=>cell.row));
console.log('PASS heatmap numeric presentation, raw precision/colors/selection, legacy labels, shared schema, units, no-data, escaping and print tiles');
