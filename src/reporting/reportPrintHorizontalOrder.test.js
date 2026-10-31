import assert from 'node:assert/strict';
import {buildReportPrintChartPages, buildReportPrintChartSvg} from './reportPrintChartSvg.js';
const rows=[{category:'Cedar',amount:4},{category:'Maple',amount:9},{category:'Birch',amount:6},{category:'Willow',amount:30}];
const before=JSON.stringify(rows);
for(const type of ['horizontal_bar','funnel_bar'])for(const preserveCategoryOrder of [false,true]){
 const chartModel={type,preserveCategoryOrder,xAxis:{dataKey:'category'},series:{values:[{value:'amount',type:'horizontal_bar'}]}};
 const resolvedChart={type,kind:'directSeries',xAxisKey:'category',seriesKeys:['amount'],rows};
 const want=preserveCategoryOrder?['Cedar','Maple','Birch']:['Maple','Birch','Cedar'];
 for(const svg of [buildReportPrintChartSvg({chartModel,resolvedChart,rowLimit:3}).svg,buildReportPrintChartPages({chartModel,resolvedChart,rowLimit:3,maxHeight:170}).map(p=>p.svg).join('')]){
  assert.ok(svg.indexOf(want[0])<svg.indexOf(want[1]) && svg.indexOf(want[1])<svg.indexOf(want[2]),`${type}: expected display order ${want}`);
  assert.ok(!svg.includes('Willow'),'limit must retain the original category cohort');
 }
}
assert.equal(JSON.stringify(rows),before);
console.log('PASS horizontal print display order, limited cohort, pagination, source order and immutability');
