import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {buildReportPrintChartSvg} from './reportPrintChartSvg.js';

// Independently authored amounts and periods. Measure actual browser glyphs,
// since an in-bounds text anchor alone does not prove that a tick fits.
const cases = [
  {name:'left',series:[{value:'amount',label:'Amount',format:'currency2'}],values:{amount:81250}},
  {name:'right',series:[{value:'amount',label:'Amount',format:'currency2',axis:'right'}],values:{amount:81250}},
  {name:'dual',series:[{value:'amount',label:'Amount',format:'currency2'},{value:'other',label:'Other',format:'currency2',axis:'right'}],values:{amount:81250,other:1250000.25}},
  {name:'negative',series:[{value:'amount',label:'Amount',format:'currency2'},{value:'other',label:'Other',format:'currency2',axis:'right'}],values:{amount:-81250,other:-1250000.25}},
];
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try {
  const page=await browser.newPage();
  for(const family of ['Arial','Times New Roman']) for(const width of [140,170,270,540]) for(const fixture of cases) {
    const result=buildReportPrintChartSvg({width,chartModel:{type:'line',xAxis:{dataKey:'period'},series:{values:fixture.series}},resolvedChart:{kind:'directSeries',type:'line',xAxisKey:'period',seriesKeys:fixture.series.map(series=>series.value),rows:[{period:'One',...fixture.values},{period:'Two',...Object.fromEntries(Object.entries(fixture.values).map(([key,value])=>[key,value/2]))}]}});
    assert.deepEqual(result.diagnostics,[]);
    await page.setContent(`<main style="font-family:${family}">${result.svg}</main>`);
    const ticks=await page.locator('svg text[text-anchor="end"],svg text[data-report-print-axis="right"]').evaluateAll(nodes=>nodes.map(node=>({text:node.textContent,x:node.getBBox().x,width:node.getBBox().width,fontSize:Number(node.getAttribute('font-size'))})));
    assert.ok(ticks.length>=4);
    const sign=fixture.name==='negative'?'-':'';
    assert.ok(ticks.some(tick=>tick.text.includes(`${sign}$81,250.00`)),`${fixture.name}: retain full formatted amount`);
    if(fixture.name==='dual'||fixture.name==='negative')assert.ok(ticks.some(tick=>tick.text.includes(`${sign}$1,250,000.25`)));
    for(const tick of ticks) {
      assert.ok(tick.x>=0&&tick.x+tick.width<=width,`${family}/${width}/${fixture.name}: clipped tick ${JSON.stringify(tick)}`);
      assert.ok(tick.fontSize>0&&tick.fontSize<=10);
      if(width===540)assert.equal(tick.fontSize,10,'Ordinary charts retain the print font size');
    }
  }
} finally {await browser.close();}
console.log('print chart tick bounds: full currency labels fit left, right and dual axes in narrow allocations');
