import assert from "node:assert/strict";

import { buildReportPrintChartSvg, buildReportPrintChartPages } from "./reportPrintChartSvg.js";

const groupedLine = buildReportPrintChartSvg({
  chartModel: {
    type: "line",
    xAxis: { dataKey: "eventDate", tickFormat: "MMM d", valueMode: "civil" },
    series: {
      palette: ["#137cbd", "#0f9960"],
    },
  },
  resolvedChart: {
    kind: "groupedSeries",
    type: "line",
    xAxisKey: "eventDate",
    seriesKeys: ["Display", "CTV"],
    rows: [
      { eventDate: "2026-05-01", Display: 40400, CTV: 34300 },
      { eventDate: "2026-05-02", Display: 42000, CTV: 35500 },
      { eventDate: "2026-05-03", Display: 38000, CTV: 33200 },
    ],
  },
  width: 640,
});

assert.equal(groupedLine.diagnostics.length, 0);
assert.ok(groupedLine.height > 200);
assert.match(groupedLine.svg, /<svg/);
assert.match(groupedLine.svg, /<path d="M/);
assert.match(groupedLine.svg, / C/);
assert.match(groupedLine.svg, /stroke-linecap="round"/);
assert.doesNotMatch(groupedLine.svg, /stroke-dasharray=/);
assert.match(groupedLine.svg, /Display/);
assert.match(groupedLine.svg, /CTV/);
assert.match(groupedLine.svg, />eventDate</);
assert.match(groupedLine.svg, /May 1/);
assert.doesNotMatch(groupedLine.svg, /2026-05-01/);

const lineWithEmptySeries = buildReportPrintChartSvg({
  chartModel: {
    type: "line",
    series: {
      values: [
        { value: "overall", label: "Overall", color: "#137cbd", type: "line" },
        { value: "location", label: "Location", color: "#b65b05", type: "line" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "line",
    xAxisKey: "date",
    seriesKeys: ["overall", "location"],
    rows: [
      { date: "2026-07-20", location: 104000000000 },
      { date: "2026-07-21", location: 104500000000 },
      { date: "2026-07-22", location: 55000000000 },
    ],
  },
  width: 640,
});

assert.equal(lineWithEmptySeries.diagnostics.length, 0);
assert.doesNotMatch(lineWithEmptySeries.svg, />Overall</);
assert.match(lineWithEmptySeries.svg, />Location</);
assert.match(lineWithEmptySeries.svg, / C/);

const directBar = buildReportPrintChartSvg({
  chartModel: {
    type: "bar",
    xAxis: {
      label: "Date",
    },
    series: {
      values: [
        { value: "totalSpend", label: "Spend", color: "#137cbd", type: "bar" },
        { value: "impressions", label: "Impressions", color: "#d9822b", type: "bar" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "bar",
    xAxisKey: "eventDate",
    seriesKeys: ["totalSpend", "impressions"],
    rows: [
      { eventDate: "2026-05-01", totalSpend: 74700, impressions: 31200 },
      { eventDate: "2026-05-02", totalSpend: 81000, impressions: 33000 },
    ],
  },
  width: 640,
});

assert.equal(directBar.diagnostics.length, 0);
assert.match(directBar.svg, /<rect/);
assert.match(directBar.svg, /Spend/);
assert.match(directBar.svg, /Impressions/);
assert.match(directBar.svg, />Date</);

const labeledDirectBar = buildReportPrintChartSvg({
  chartModel: {
    type: "bar",
    series: {
      values: [
        { value: "totalSpend", label: "Spend", color: "#137cbd", type: "bar", dataLabels: "always" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "bar",
    xAxisKey: "eventDate",
    seriesKeys: ["totalSpend"],
    rows: [
      { eventDate: "2026-05-01", totalSpend: 74700 },
      { eventDate: "2026-05-02", totalSpend: 81000 },
    ],
  },
  width: 640,
});

assert.equal(labeledDirectBar.diagnostics.length, 0);
assert.match(labeledDirectBar.svg, />74,700</);
assert.match(labeledDirectBar.svg, />81,000</);

const signColoredDirectBar = buildReportPrintChartSvg({
  chartModel: {
    type: "bar",
    series: {
      values: [
        { value: "delta", label: "Delta", color: "#137cbd", type: "bar", pointColorMode: "bySign" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "bar",
    xAxisKey: "eventDate",
    seriesKeys: ["delta"],
    rows: [
      { eventDate: "2026-05-01", delta: -3 },
      { eventDate: "2026-05-02", delta: 5 },
    ],
  },
  width: 640,
});

assert.equal(signColoredDirectBar.diagnostics.length, 0);
assert.match(signColoredDirectBar.svg, /fill="#db3737"/);
assert.match(signColoredDirectBar.svg, /fill="#0f9960"/);

const horizontalBar = buildReportPrintChartSvg({
  chartModel: {
    type: "horizontal_bar",
    xAxis: { dataKey: "channelV2", categoryLabel: { lines: 2, maxCharacters: 36 } },
    series: {
      values: [
        { value: "avails", label: "Available Impressions", color: "#137cbd", type: "horizontal_bar", format: "compactNumber", dataLabels: "always" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "horizontal_bar",
    xAxisKey: "channelV2",
    seriesKeys: ["avails"],
    rows: [
      { channelV2: "Display", avails: 158400 },
      { channelV2: "CTV", avails: 138200 },
      { channelV2: "Delivery - Leave Checked", avails: 121000 },
    ],
  },
  width: 640,
});

// A narrow dashboard column must not pack fractional count ticks together.
const narrowBarInput = {
  chartModel: { type: "horizontal_bar", xAxis: { dataKey: "campaign" }, series: { values: [{ value: "impressions", label: "Impressions", type: "horizontal_bar" }] } },
  resolvedChart: { kind: "directSeries", type: "horizontal_bar", xAxisKey: "campaign", seriesKeys: ["impressions"], rows: [{ campaign: "Campaign", impressions: 922 }] },
};
const narrowBar = buildReportPrintChartSvg({ ...narrowBarInput, width: 280 });
assert.deepEqual(narrowBar.diagnostics, []);
assert.match(narrowBar.svg, />461<\/text>/);
assert.doesNotMatch(narrowBar.svg, />307\.33<\/text>/);
assert.match(narrowBar.svg, />922<\/text>/);
const wideBar = buildReportPrintChartSvg({ ...narrowBarInput, width: 680 });
assert.match(wideBar.svg, />307\.33<\/text>/);
assert.match(wideBar.svg, />614\.67<\/text>/);

assert.equal(horizontalBar.diagnostics.length, 0);
assert.ok(horizontalBar.height > 120);
assert.match(horizontalBar.svg, /<rect/);
assert.match(horizontalBar.svg, /Display/);
assert.match(horizontalBar.svg, /CTV/);
assert.match(horizontalBar.svg, /Delivery -/);
assert.match(horizontalBar.svg, /Leave Checked/);
assert.match(horizontalBar.svg, /<tspan/);
assert.match(horizontalBar.svg, /158.4K/);
assert.match(horizontalBar.svg, />158K</);
assert.match(horizontalBar.svg, /Available Impressions/);

const hiddenHorizontalLabels = buildReportPrintChartSvg({
  chartModel: {
    type: "horizontal_bar",
    series: {
      values: [
        { value: "avails", label: "Available Impressions", color: "#137cbd", type: "horizontal_bar", format: "compactNumber", dataLabels: "none" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "horizontal_bar",
    xAxisKey: "channelV2",
    seriesKeys: ["avails"],
    rows: [
      { channelV2: "Display", avails: 158400 },
      { channelV2: "CTV", avails: 138200 },
    ],
  },
  width: 640,
});

assert.equal(hiddenHorizontalLabels.diagnostics.length, 0);
assert.doesNotMatch(hiddenHorizontalLabels.svg, /158 400/);

const defaultHorizontalLabels = buildReportPrintChartSvg({
  chartModel: {
    type: "horizontal_bar",
    series: {
      values: [
        { value: "avails", label: "Available Impressions", color: "#137cbd", type: "horizontal_bar", format: "compactNumber" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "horizontal_bar",
    xAxisKey: "channelV2",
    seriesKeys: ["avails"],
    rows: [
      { channelV2: "Display", avails: 158400 },
      { channelV2: "CTV", avails: 138200 },
    ],
  },
  width: 640,
});

assert.equal(defaultHorizontalLabels.diagnostics.length, 0);
assert.doesNotMatch(defaultHorizontalLabels.svg, /158 400/);

const nestedCategoryHorizontal = buildReportPrintChartSvg({
  chartModel: {
    type: "horizontal_bar",
    series: {
      values: [
        { value: "avails", label: "Available Impressions", color: "#137cbd", type: "horizontal_bar" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "horizontal_bar",
    xAxisKey: "channel.channel",
    seriesKeys: ["avails"],
    rows: [
      { channel: { channel: "Display" }, avails: 158400 },
      { channel: { channel: "CTV" }, avails: 138200 },
    ],
  },
  width: 640,
});

assert.equal(nestedCategoryHorizontal.diagnostics.length, 0);
assert.match(nestedCategoryHorizontal.svg, /Display/);
assert.match(nestedCategoryHorizontal.svg, /CTV/);

const funnelBar = buildReportPrintChartSvg({
  chartModel: {
    type: "funnel_bar",
    series: {
      values: [
        { value: "avails", label: "Available Impressions", color: "#137cbd", type: "funnel_bar", format: "compactNumber", dataLabels: "always" },
      ],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "funnel_bar",
    xAxisKey: "channelV2",
    seriesKeys: ["avails"],
    rows: [
      { channelV2: "Display", avails: 158400 },
      { channelV2: "CTV", avails: 138200 },
    ],
  },
  width: 640,
});

assert.equal(funnelBar.diagnostics.length, 0);
assert.ok(funnelBar.height > 120);
assert.match(funnelBar.svg, /<rect/);
assert.match(funnelBar.svg, /Display/);
assert.match(funnelBar.svg, /CTV/);
assert.match(funnelBar.svg, /158.4K/);
assert.match(funnelBar.svg, />158K</);
assert.match(funnelBar.svg, /Available Impressions/);

const donut = buildReportPrintChartSvg({
  chartModel: {
    type: "donut",
    series: {
      palette: ["#137cbd", "#0f9960"],
    },
  },
  resolvedChart: {
    kind: "category",
    type: "donut",
    seriesKeys: ["Display", "CTV"],
    rows: [
      { name: "Display", value: 40400 },
      { name: "CTV", value: 34300 },
    ],
  },
  width: 640,
});

assert.equal(donut.diagnostics.length, 0);
assert.match(donut.svg, /<circle/);
assert.match(donut.svg, /<path d="M/);
assert.doesNotMatch(donut.svg, /\sA[0-9.,\s-]/);
assert.match(donut.svg, /Display/);
assert.match(donut.svg, /CTV/);

const annotatedCartesian = buildReportPrintChartSvg({
  chartModel: {
    type: "line",
    annotations: {
      verticalMarkers: [
        { value: "2026-05-02", label: "Launch", color: "#d9822b", lineStyle: "dashed" },
      ],
      referenceLines: [
        { axis: "y", value: 38000, label: "Goal", color: "#7a46d8" },
      ],
      bands: [
        { axis: "x", from: "2026-05-01", to: "2026-05-02", label: "Window", color: "#137cbd", opacity: 0.18 },
      ],
      notes: [
        { x: "2026-05-02", y: 35500, label: "Peak", color: "#0f9960" },
      ],
    },
    series: {
      palette: ["#137cbd", "#0f9960"],
    },
  },
  resolvedChart: {
    kind: "groupedSeries",
    type: "line",
    xAxisKey: "eventDate",
    seriesKeys: ["Display", "CTV"],
    rows: [
      { eventDate: "2026-05-01", Display: 40400, CTV: 34300 },
      { eventDate: "2026-05-02", Display: 42000, CTV: 35500 },
    ],
  },
  width: 640,
});

assert.equal(annotatedCartesian.diagnostics.length, 0);
assert.match(annotatedCartesian.svg, /Launch/);
assert.match(annotatedCartesian.svg, /Goal/);
assert.match(annotatedCartesian.svg, /Window/);
assert.match(annotatedCartesian.svg, /Peak/);
assert.match(annotatedCartesian.svg, /stroke-dasharray="6 4"/);
assert.match(annotatedCartesian.svg, /fill-opacity="0.18"/);
assert.match(annotatedCartesian.svg, /<circle/);

const unsupported = buildReportPrintChartSvg({
  chartModel: {
    type: "radar",
    series: {
      values: [{ value: "totalSpend", label: "Spend", type: "radar" }],
    },
  },
  resolvedChart: {
    kind: "directSeries",
    type: "radar",
    xAxisKey: "eventDate",
    seriesKeys: ["totalSpend"],
    rows: [
      { eventDate: "2026-05-01", totalSpend: 40400 },
    ],
  },
});

assert.equal(unsupported.svg, "");
assert.deepEqual(unsupported.diagnostics, [
  {
    code: "unsupportedReportPrintChartType",
    severity: "warning",
    message: "ReportPrint chart lowering does not yet support series types: radar.",
  },
]);

console.log("reportPrintChartSvg ✓ lowers grouped, direct, and category chart payloads into deterministic SVG output");

const spoColors = {
  Direct: "var(--example-spo-direct, #1f77b4)",
  "Preferred - Primary": "var(--example-spo-primary, #1a873d)",
  "Preferred - Secondary": "var(--example-spo-secondary, #b65b05)",
  unknown: "var(--example-spo-unknown, #d62728)",
};
for (const names of [
  ["Direct", "Preferred - Primary", "Preferred - Secondary", "unknown"],
  ["unknown", "Preferred - Secondary", "Direct", "Preferred - Primary"],
]) {
  const result = buildReportPrintChartSvg({
    chartModel: {type: "donut", series: {palette: ["#000000"], categoryColors: spoColors}},
    resolvedChart: {kind: "category", type: "donut", rows: names.map((name) => ({name, value: 10}))},
  });
  for (const [name, color] of Object.entries({Direct: "#1f77b4", "Preferred - Primary": "#1a873d", "Preferred - Secondary": "#b65b05", unknown: "#d62728"})) {
    const legend = result.svg.match(new RegExp(`<rect[^>]+fill="([^"]+)"[^>]* />\\s*<text[^>]+>${name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")} —`));
    assert.equal(legend?.[1], color, `${name} keeps its color when reordered`);
  }
}

const dualChart=buildReportPrintChartSvg({chartModel:{type:'line',xAxis:{dataKey:'date'},series:{values:[{value:'spend',label:'Spend',format:'currency2',axis:'left'},{value:'rate',label:'Rate',format:'percentFraction2',axis:'right'}]}},resolvedChart:{kind:'directSeries',type:'line',xAxisKey:'date',seriesKeys:['spend','rate'],rows:[{date:'one',spend:1000,rate:.01},{date:'two',spend:2000,rate:.02}]}});
assert.deepEqual([...dualChart.svg.matchAll(/<circle[^>]+cy="([^"]+)"/g)].map(m=>Number(m[1])),[106,16,106,16],'Both axes need independent bounds');
assert.match(dualChart.svg,/data-report-print-axis="right"/);
assert.match(dualChart.svg,/2.00%/);
const missingLine=buildReportPrintChartSvg({chartModel:{type:'line',xAxis:{dataKey:'date'},series:{values:[{value:'value',label:'Value'}]}},resolvedChart:{kind:'directSeries',type:'line',xAxisKey:'date',seriesKeys:['value'],rows:[{date:'one',value:1},{date:'two',value:null},{date:'three',value:2}]}});
assert.match(missingLine.svg,/<path d="M[^\"]* M/,'Missing values must break printed lines');
const nullLine=buildReportPrintChartSvg({chartModel:{type:'line',series:{values:[{value:'value',label:'Value'}]}},resolvedChart:{kind:'directSeries',seriesKeys:['value'],rows:[{value:null}]}});
assert.equal(nullLine.svg,'','Missing observations must not print as zero');

// A three-column letter-page dashboard gives each chart roughly 170 points.
// Geometry must obey that allocation rather than extending into the next tile.
for (const width of [140, 170, 210, 680]) {
  const output = buildReportPrintChartSvg({
    width,
    chartModel: {type:'bar',xAxis:{dataKey:'campaignId'},yAxis:{format:'currency2'},series:{values:[{value:'spend',label:'Spend',format:'currency2',type:'bar'}]}},
    resolvedChart: {kind:'directSeries',type:'bar',xAxisKey:'campaignId',seriesKeys:['spend'],rows:[{campaignId:'101',spend:67.75}]},
  });
  assert.equal(output.diagnostics.length,0);
  const xCoordinates = [...output.svg.matchAll(/\b(?:x1|x2)="([\d.-]+)"/g)].map(match=>Number(match[1]));
  assert.ok(xCoordinates.length>0);
  assert.ok(xCoordinates.every(x=>x>=0&&x<=width),`Chart geometry escapes ${width}-point allocation: ${Math.max(...xCoordinates)}`);
  for(const match of output.svg.matchAll(/<rect\b[^>]*\bx="([\d.-]+)"[^>]*\bwidth="([\d.-]+)"/g)) {
    assert.ok(Number(match[1])+Number(match[2])<=width,`Bar escapes ${width}-point allocation`);
  }
}

// A forced final date tick must not collide with the preceding periodic tick.
for (const count of [20, 30]) {
  for (const width of [170, 270, 680]) {
    const output = buildReportPrintChartSvg({
      width,
      chartModel: {type:'line',xAxis:{dataKey:'date',tickFormat:'MMM d',valueMode:'civil'},series:{values:[{value:'value',label:'Value'}]}},
      resolvedChart: {kind:'directSeries',type:'line',xAxisKey:'date',seriesKeys:['value'],rows:Array.from({length:count},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,value:i+1}))},
    });
    const ticks=[...output.svg.matchAll(/<text x="([\d.-]+)" y="214"[^>]*><tspan>(Oct \d+)<\/tspan><\/text>/g)].map(m=>({x:Number(m[1]),label:m[2]}));
    assert.equal(ticks[0]?.label,'Oct 1');
    assert.equal(ticks.at(-1)?.label,`Oct ${count}`);
    for(let i=1;i<ticks.length;i++) {
      const needed=(ticks[i-1].label.length+ticks[i].label.length)*2.8+8;
      assert.ok(ticks[i].x-ticks[i-1].x>=needed,`Date labels overlap at width ${width}: ${JSON.stringify(ticks)}`);
    }
  }
}

// Campaign shares retain their published unit after grouped-series lowering.
// Multiple categories and many series must fit inside category bands, including
// the first and last groups on a narrow dashboard tile.
for(const [format,expected] of [['percentFraction',/>84\.8%</],['currency2',/>\$0\.85</]]) {
 for(const width of [140,270,640]) for(const seriesCount of [2,8]) {
  const seriesKeys=Array.from({length:seriesCount},(_,i)=>String(101+i));
  const rows=['top 1-10','top 11-25','top 26-50'].map((bucket,i)=>({bucket,...Object.fromEntries(seriesKeys.map((key,j)=>[key,i===0&&j===1?.848:.681/(i+1)]))}));
  const output=buildReportPrintChartSvg({width,chartModel:{type:'bar',xAxis:{dataKey:'bucket'},yAxis:{format}},resolvedChart:{kind:'groupedSeries',type:'bar',xAxisKey:'bucket',seriesKeys,rows}});
  assert.equal(output.diagnostics.length,0);
  assert.match(output.svg,expected,'Grouped series must inherit the measure axis format');
  const bars=[...output.svg.matchAll(/<path class="forge-chart-bar" d="([^"]+)"/g)];
  assert.equal(bars.length,rows.length*seriesCount);
  for(const [,path] of bars){
   const coords=path.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi).map(Number);
   const xs=coords.filter((_,i)=>i%2===0);
   assert.ok(Math.max(...xs)>Math.min(...xs),'Dense grouped bars must retain positive width');
   assert.ok(Math.min(...xs)>=52,'First category bars must not cover the y-axis or its labels');
   assert.ok(Math.max(...xs)<=width-16,'Last category bars must remain inside the plot');
  }
 }
}

const tinyAudienceCost=buildReportPrintChartSvg({width:640,chartModel:{type:'horizontal_bar',series:{values:[{value:'cost',label:'Cost per published reach (USD)',type:'horizontal_bar',format:'number5'}]}},resolvedChart:{kind:'directSeries',type:'horizontal_bar',xAxisKey:'publisher',seriesKeys:['cost'],rows:[{publisher:'One',cost:.00123}]}});
assert.match(tinyAudienceCost.svg,/>0\.00123</,'Printed cost labels must retain small authored values');


// Preserve accepted page geometry and complete categories while fitting pages
// without repeatedly drawing rejected prefixes. Includes signed values, missing
// points, wrapped labels, multiple series and a smaller first-page allocation.
const pageRows=Array.from({length:37},(_,index)=>({category:`Synthetic category ${index+1}`,amount:index%3===0?-(index+1)*123.456:(index+1)*123.456,rate:index%5===0?null:(index+1)/101}));
const pageInput={chartModel:{type:'horizontal_bar',series:{values:[{value:'amount',label:'Amount',type:'horizontal_bar',format:'currency2',dataLabels:'auto'}]}},resolvedChart:{kind:'directSeries',type:'horizontal_bar',xAxisKey:'category',seriesKeys:['amount'],rows:pageRows},width:270,maxHeight:448,firstMaxHeight:247};
const paginated=buildReportPrintChartPages(pageInput);
assert.deepEqual(paginated.map(page=>page.height),[236,428,428,396]);
assert.equal(paginated.reduce((count,page)=>count+(page.svg.match(/class="forge-chart-bar"/g)||[]).length,0),37);
const pageText=paginated.map(page=>page.svg.replace(/<[^>]*>/g,' ').replace(/\s+/g,' '));
for(const row of pageRows)assert.ok(pageText.some(text=>text.includes(row.category+' ')),`${row.category} remains printable`);
const multiPages=buildReportPrintChartPages({...pageInput,width:140,chartModel:{type:'horizontal_bar',series:{values:[{value:'amount',label:'Amount',type:'horizontal_bar',format:'currency2',dataLabels:'always'},{value:'rate',label:'Rate',type:'horizontal_bar',format:'percentFraction2',dataLabels:'always'}]}},resolvedChart:{...pageInput.resolvedChart,seriesKeys:['amount','rate']}});
assert.deepEqual(multiPages.map(page=>page.height),[226,446,446,446,446,182]);
assert.equal(multiPages.reduce((count,page)=>count+(page.svg.match(/class="forge-chart-bar"/g)||[]).length,0),66,'Only missing numeric points omit their own bars');
const longPageRows=pageRows.map((row,index)=>({...row,category:`Synthetic exceptionally long category ${index+1} with complete pathway -> context -> details -> printable sequence`}));
const longPages=buildReportPrintChartPages({...pageInput,resolvedChart:{...pageInput.resolvedChart,rows:longPageRows}});
assert.deepEqual(longPages.map(page=>page.height),paginated.map(page=>page.height));
assert.equal(longPages.reduce((count,page)=>count+page.labelDetails.length,0),37);
for(const [index,row] of longPageRows.entries())assert.ok(longPages.some(page=>page.labelDetails.includes(`Category ${index+1}: ${row.category}`)));
const tinyFirst=buildReportPrintChartPages({...pageInput,firstMaxHeight:1});
assert.deepEqual(tinyFirst.map(page=>page.height),[164,428,428,428,172]);
for(const height of [1,-1,NaN]) {
 const pages=buildReportPrintChartPages({...pageInput,maxHeight:height,firstMaxHeight:height});
 assert.equal(pages.length,37,'An undersized allocation retains the one-row fallback');
 assert.ok(pages.every(page=>page.height===164));
}
assert.equal(buildReportPrintChartPages({...pageInput,maxHeight:Infinity,firstMaxHeight:Infinity}).length,1);
for(const [input,code] of [
 [{...pageInput,chartModel:{type:'horizontal_bar',series:{values:[{value:'amount',label:'Unsupported',type:'line'}]}}},'unsupportedReportPrintChartType'],
 [{...pageInput,resolvedChart:{...pageInput.resolvedChart,rows:pageRows.map(row=>({...row,amount:null}))}},'emptyReportPrintChart'],
]) {
 const pages=buildReportPrintChartPages(input);
 assert.equal(pages.length,1);assert.equal(pages[0].height,0);assert.equal(pages[0].svg,'');assert.equal(pages[0].diagnostics[0].code,code);
}

// Counting actual Intl formatting operations catches the old quadratic SVG
// probe loop without a timing threshold or an implementation-specific call count.
const numberFormatProperty=Object.getOwnPropertyDescriptor(Intl.NumberFormat.prototype,'format');
let axisFormats=0;
Object.defineProperty(Intl.NumberFormat.prototype,'format',{...numberFormatProperty,get(){const format=numberFormatProperty.get.call(this);return value=>{axisFormats++;return format(value);};}});
try {
 const rows=Array.from({length:134},(_,index)=>({category:`Synthetic ${index+1}`,amount:index*123.456}));
 const pages=buildReportPrintChartPages({...pageInput,chartModel:{type:'horizontal_bar',series:{values:[{value:'amount',label:'Amount',type:'horizontal_bar',format:'currency2',dataLabels:'none'}]}},resolvedChart:{...pageInput.resolvedChart,rows}});
 assert.equal(pages.reduce((count,page)=>count+(page.svg.match(/class="forge-chart-bar"/g)||[]).length,0),134);
 assert.ok(axisFormats<512,`Page fitting must not repeatedly format discarded SVG axes: ${axisFormats}`);
} finally {Object.defineProperty(Intl.NumberFormat.prototype,'format',numberFormatProperty);}
console.log('reportPrintChartSvg ✓ paginates complete horizontal charts without repeated SVG probes');

// Compare the complete SVG/page/diagnostic payload with an independently frozen
// renderer. This is optional for ordinary consumers and required by port proofs.
if (process.env.FORGE_CHART_PAGINATION_BASELINE_ROOT) {
  const {pathToFileURL} = await import('node:url');
  const old = await import(pathToFileURL(`${process.env.FORGE_CHART_PAGINATION_BASELINE_ROOT}/src/reporting/reportPrintChartSvg.js`));
  const annotations = {referenceLines:[{axis:'x',value:0,label:'Zero',color:'#137cbd'}],bands:[{axis:'y',from:'Synthetic category 1',to:'Synthetic category 3',label:'Window',color:'#137cbd',opacity:.18}],notes:[{x:0,y:'Synthetic category 1',label:'Note',color:'#0f9960'}]};
  const multiple = {...pageInput, chartModel:{...pageInput.chartModel,annotations,series:{values:Array.from({length:9},(_,i)=>({value:`value${i}`,label:`Series ${i} complete legend`,type:'horizontal_bar',format:i%2?'percentFraction2':'number5',dataLabels:'always'}))}},resolvedChart:{...pageInput.resolvedChart,seriesKeys:Array.from({length:9},(_,i)=>`value${i}`),rows:pageRows.map((row,index)=>({...row,...Object.fromEntries(Array.from({length:9},(_,i)=>[`value${i}`,index%5===0?null:(index-i)/101]))}))}};
  const grouped = {...multiple,chartModel:{...multiple.chartModel,yAxis:{format:'number5'}},resolvedChart:{...multiple.resolvedChart,kind:'groupedSeries'}};
  const cases = [
    pageInput, multiple, grouped,
    {...pageInput,chartModel:{...pageInput.chartModel,type:'funnel_bar',series:{values:[{value:'amount',type:'funnel_bar',format:'currency2'}]}}},
    {...pageInput,resolvedChart:{...pageInput.resolvedChart,rows:longPageRows}},
    {...pageInput,resolvedChart:{...pageInput.resolvedChart,rows:[]}},
    {...pageInput,resolvedChart:{...pageInput.resolvedChart,seriesKeys:[]}},
    {...pageInput,resolvedChart:{...pageInput.resolvedChart,rows:pageRows.map(row=>({...row,amount:null}))}},
    {...pageInput,chartModel:{...pageInput.chartModel,series:{values:[{value:'amount',type:'line'}]}}},
    ...[0,-1,1,164,172,235,236,237,NaN,Infinity].map(height=>({...pageInput,maxHeight:height,firstMaxHeight:height})),
    ...[1,139,160,319,320,700].map(width=>({...multiple,width})),
    ...[false,true].map(negative=>({...pageInput,resolvedChart:{...pageInput.resolvedChart,rows:pageRows.map((row,i)=>({...row,amount:negative?-i:0}))}})),
  ];
  for (const [index,input] of cases.entries()) {
    const snapshot=JSON.stringify(input);
    assert.deepEqual(buildReportPrintChartPages(input),old.buildReportPrintChartPages(input),`independent old/new complete page parity, case ${index}`);
    assert.equal(JSON.stringify(input),snapshot,'pagination preserves input rows, chart metadata and annotations');
  }
  console.log(`reportPrintChartSvg ✓ ${cases.length} independent old/new edge cases (complete SVGs, ticks, labels, diagnostics and heights)`);
}
