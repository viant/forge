import assert from "node:assert/strict";
import {test} from "node:test";
import {buildReportPrintSvgElement} from "./reportPrintModel.js";
import {buildReportPrintChartPages} from "./reportPrintChartSvg.js";

test("print chart pages retain exact source slices without mutating data",()=>{
  const rows=Array.from({length:40},(_,index)=>({period:`Period ${index+1}`,value:index+0.25}));
  const resolvedChart={kind:"directSeries",type:"horizontal_bar",xAxisKey:"period",seriesKeys:["value"],rows};
  const chartModel={type:"horizontal_bar",xAxis:{dataKey:"period"},series:{values:[{value:"value",type:"horizontal_bar"}]}};
  const before=JSON.stringify(resolvedChart);
  const pages=buildReportPrintChartPages({chartModel,resolvedChart,width:540,maxHeight:400});
  assert.ok(pages.length>1);
  let offset=0;
  for(const page of pages){assert.equal(page.sourceRowOffset,offset);assert.ok(page.sourceRowCount>0);offset+=page.sourceRowCount;assert.deepEqual(page.sourceValueBounds,{minValue:0,maxValue:39.25});}
  assert.equal(offset,rows.length);assert.equal(JSON.stringify(resolvedChart),before);
});

test("chart source bindings are normalized and invalid slices rejected",()=>{
  const base={id:"chart__svg",kind:"svg",box:{x:0,y:0,width:100,height:100},svg:'<svg width="100" height="100"></svg>'};
  assert.deepEqual(buildReportPrintSvgElement({...base,chartSource:{blockId:" chart ",rowOffset:4,rowCount:2,extra:"ignored"}}).chartSource,{blockId:"chart",rowOffset:4,rowCount:2});
  for(const patch of [{rowOffset:-1},{rowCount:0},{rowCount:1.5},{minValue:NaN},{minValue:10,maxValue:2}])assert.equal(buildReportPrintSvgElement({...base,chartSource:{blockId:"chart",rowOffset:0,rowCount:1,...patch}}),null);
  assert.equal(buildReportPrintSvgElement(base).chartSource,undefined);
});
