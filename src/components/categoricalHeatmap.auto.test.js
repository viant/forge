import assert from 'node:assert/strict';
import {buildHeatmap,normalizeHeatmap,heatmapSvg,heatmapPrintPages} from './categoricalHeatmap.js';

// Independently authored synthetic occupancy values; no application data.
const config={rowField:'room',columnField:'slot',valueField:'value',
  rowCategories:['North','South'],columnCategories:['A','B','C','D'],
  colorScale:{type:'sequential',domain:'auto',colors:['#000000','#ffffff']}};
const rows=config.rowCategories.flatMap((room,r)=>config.columnCategories.map((slot,c)=>({room,slot,value:r*4+c})));
const model=buildHeatmap(config,rows);
assert.deepEqual(model.scale.domain,[0,7]);
assert.equal(model.cells[0].color,'#000000');
assert.equal(model.cells[7].color,'#ffffff');
assert.deepEqual(config.colorScale.domain,'auto');
assert.equal(model.config.colorScale.domain,'auto');
const changed=buildHeatmap(config,rows.map(row=>({...row,value:row.value+100})));
assert.deepEqual(changed.scale.domain,[100,107]);
assert.deepEqual(changed.cells.map(cell=>cell.color),model.cells.map(cell=>cell.color));

const pages=heatmapPrintPages(model,{width:180,maxHeight:400});
assert.ok(pages.length>1);
const rendered=pages.map(page=>page.svg).join('');
for(const cell of model.cells)assert.ok(rendered.includes(`fill="${cell.color}"`),'All tiles use the full matrix scale');
for(const page of pages)assert.ok(!page.svg.includes('NaN')&&!page.svg.includes('Infinity'));

const constant=buildHeatmap(config,rows.map(row=>({...row,value:0})));
assert.deepEqual(constant.scale.domain,[0,0]);
assert.ok(constant.cells.every(cell=>cell.color==='#808080'));
assert.ok(!heatmapSvg(constant).svg.includes('NaN'));
assert.ok(heatmapPrintPages(constant,{width:180}).every(page=>!page.svg.includes('NaN')));
const empty=buildHeatmap(config,[{room:'North',slot:'A',value:null}]);
assert.deepEqual(empty.scale.domain,[]);
assert.ok(empty.cells.every(cell=>cell.color==='#eeeeee'));
assert.ok(!heatmapSvg(empty).svg.includes('Infinity'));
assert.ok(heatmapPrintPages(empty,{width:180}).every(page=>!page.svg.includes('Infinity')));
const extremes=buildHeatmap(config,[{room:'North',slot:'A',value:-Number.MAX_VALUE},{room:'South',slot:'D',value:Number.MAX_VALUE}]);
assert.equal(extremes.cells[0].color,'#000000');
assert.equal(extremes.cells[7].color,'#ffffff');
assert.throws(()=>normalizeHeatmap({...config,colorScale:{type:'diverging',domain:'auto',colors:['#000000','#888888','#ffffff']}}),/auto requires/);
assert.throws(()=>normalizeHeatmap({...config,colorScale:{...config.colorScale,domain:[0,0]}}),/ordered/);
console.log('PASS automatic sequential heatmap domains, constant/missing values, and shared print-tile scale');
