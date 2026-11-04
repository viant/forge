import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {buildReportPrintChartSvg,buildReportPrintChartPages} from './reportPrintChartSvg.js';

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
  // Independently invented comparisons exercise complete signed currency labels
  // beside wrapped categories, through the same SVG/page path used by PDF.
  const rows = [
    {category:'Reference collection',amount:-1250000.25},
    {category:'Experimental collection',amount:987654.32},
    {category:'Zero observation',amount:0},
    {category:'Small negative observation',amount:-12.5},
    {category:'Small positive observation',amount:23.75},
  ];
  const chartModel = {type:'horizontal_bar',showLegend:false,series:{values:[{value:'amount',label:'Amount',format:'currency2',dataLabels:'always'}]}};
  for(const family of ['Arial','Times New Roman']) for(const width of [270,540,680]) for(const values of [rows,rows.map(row=>({...row,amount:Math.abs(row.amount)})),rows.map(row=>({...row,amount:row.amount===0?0:-Math.abs(row.amount)}))]) {
    const resolvedChart = {kind:'directSeries',type:'horizontal_bar',xAxisKey:'category',seriesKeys:['amount'],rows:values};
    const pages = buildReportPrintChartPages({width,chartModel,resolvedChart,maxHeight:180,firstMaxHeight:150});
    assert.equal(pages.length,2,'Label fitting retains existing row pagination');
    assert.equal(pages.reduce((count,page)=>count+(page.svg.match(/class="forge-chart-bar"/g)||[]).length,0),rows.length);
    const categoryText=pages.map(result=>(result.svg.replace(/<[^>]*>/g,'')+(result.labelDetails||[]).join('')).replace(/\s/g,'')).join('');
    for(const row of rows)assert.ok(categoryText.includes(row.category.replace(/\s/g,'')),'Keep complete wrapped categories or their printable details');
    const printedValues=[];
    for(const result of pages) {
      assert.deepEqual(result.diagnostics,[]);
      await page.setContent(`<main style="font-family:${family}">${result.svg}</main>`);
      const plotBottom=Number(await page.locator('svg line[stroke="#eaecf0"]').first().getAttribute('y2'));
      const boxes=await page.locator('svg text').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBBox();return {text:node.textContent,x:box.x,right:box.x+box.width,y:box.y,bottom:box.y+box.height,baseline:Number(node.getAttribute('y')),fill:node.getAttribute('fill'),anchor:node.getAttribute('text-anchor'),size:Number(node.getAttribute('font-size'))};}));
      const categoryBoxes=boxes.filter(box=>box.fill==='#344054');
      const valueBoxes=boxes.filter(box=>box.fill==='#667085'&&box.baseline<=plotBottom);
      const tickBoxes=boxes.filter(box=>box.fill==='#667085'&&box.baseline>plotBottom);
      const bars=await page.locator('.forge-chart-bar').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBBox();return {x:box.x,right:box.x+box.width,y:box.y,bottom:box.y+box.height};}));
      for(const [index,box] of tickBoxes.entries()) {
        assert.ok(box.x>=0&&box.right<=width,'Tick labels fit the allocation');
        if(index)assert.ok(tickBoxes[index-1].right<=box.x,'Numeric tick labels remain separate');
      }
      assert.equal(categoryBoxes.length>0,true);
      for(const box of valueBoxes) {
        printedValues.push(box.text);
        assert.ok(box.x>=0&&box.right<=width,`${family}/${width}: complete value fits ${JSON.stringify(box)}`);
        assert.ok(box.size>=6,`${family}/${width}: values retain readable print size`);
        for(const category of categoryBoxes)assert.ok(box.right<=category.x||box.x>=category.right||box.bottom<=category.y||box.y>=category.bottom,`${family}/${width}: value overlaps category ${JSON.stringify({box,category})}`);
        for(const bar of bars)assert.ok(box.right<=bar.x||box.x>=bar.right||box.bottom<=bar.y||box.y>=bar.bottom,'Value labels remain outside colored bars');
      }
      const plot=await page.locator('svg line[stroke="#eaecf0"]').evaluateAll(nodes=>nodes.map(node=>Number(node.getAttribute('x1'))));
      assert.ok(Math.max(...plot)-Math.min(...plot)>=24-1e-8,'Retain plotting width inside each allocation');
    }
    assert.deepEqual(printedValues.sort(),values.map(row=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(row.amount)).sort(),'Keep every exact formatted signed value');
  }
  // A short positive label already fits the existing lane; retain its geometry.
  const ordinary=buildReportPrintChartSvg({width:680,chartModel,resolvedChart:{kind:'directSeries',type:'horizontal_bar',xAxisKey:'category',seriesKeys:['amount'],rows:[{category:'Short',amount:12}]}});
  assert.match(ordinary.svg,/<text x="620"[^>]*font-size="10"[^>]*>\$12\.00<\/text>/);
} finally {await browser.close();}
console.log('print chart bounds: full numeric axes and signed comparison labels fit their allocations without category collisions');
