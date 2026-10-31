import assert from "node:assert/strict";
import { buildReportSpecHash } from "./reportFillModel.js";
import { buildReportPrintFromReportFill } from "./reportPrintModel.js";
import { buildReportPrintChartPages } from "./reportPrintChartSvg.js";
import { compactReportPrintSequence } from "./reportPrintLabels.js";

export function buildPairingPrintFixture() {
  const chartModel = { type: "horizontal_bar", series: { values: [{ value: "revenue", label: "Revenue", type: "horizontal_bar" }] } };
  const rows = Array.from({ length: 20 }, (_, i) => ({ pathway: Array(i + 1).fill("Smart Phone (Display)").join(" -> "), revenue: 2000 - i * 80 }));
  const chart = { id: "revenue", kind: "chartBlock", title: "Top pathways", runtime: { visibleWhen: { source: "filters", field: "distribution", equals: "Revenue" } }, content: { chartModel, resolvedChart: { kind: "directSeries", type: "horizontal_bar", xAxisKey: "pathway", seriesKeys: ["revenue"], rows } } };
  const columns = [{ key: "pathway", label: "Pathway", kind: "dimension" }, ...Array.from({ length: 9 }, (_, i) => ({ key: `metric${i}`, label: `Evidence metric ${i}`, kind: "measure" }))];
  const blocks = [
    { id: "intro", kind: "markdownBlock", title: "Overview", content: { markdown: "Summary of the selected reporting window." } },
    { id: "section", kind: "sectionBlock", title: "Conversion Pathways" },
    { ...chart, id: "conversions", title: "Wrong branch", runtime: { visibleWhen: { source: "filters", field: "distribution", equals: "Conversions" } } },
    chart,
    { id: "evidence", kind: "tableBlock", title: "Pathway evidence", content: { columns, resolvedRows: rows.map((row, rowIndex) => ({ rowIndex, cells: columns.map((column, i) => ({ key: column.key, value: i ? row.revenue + i : row.pathway })) })) } },
    { id: "options", kind: "filterBarBlock", title: "Report options", content: { params: [{ id: "distribution", value: "Revenue" }, { id: "legacyView", value: "Device" }] } },
    { id: "hiddenGroup", kind: "compositeBlock", title: "Hidden group", runtime: { visibleWhen: { source: "filters", field: "legacyView", equals: "Channel" } }, content: { childBlockIds: ["hiddenChild"] } },
    { id: "hiddenChild", kind: "markdownBlock", title: "Private child", content: { markdown: "Must not leak" } },
  ];
  const source = { kind: "reportBuilder", containerId: "pairing", stateKey: "pairing", dataSourceRef: "primary" };
  const reportSpec = { version: 1, kind: "reportSpec", title: "MTA print regression", source, scope: { params: [{ id: "distribution", value: "Conversions" }, { id: "legacyView", value: "Device", presentation: "hidden" }] }, blocks, layoutIntent: { blockOrder: blocks.map((block) => block.id) } };
  const reportFill = { version: 1, kind: "reportFill", specVersion: 1, specHash: buildReportSpecHash(reportSpec), source, blocks, datasets: [] };
  return { reportSpec, reportFill };
}

const fixture = buildPairingPrintFixture();
const original = JSON.stringify(fixture);
const result = buildReportPrintFromReportFill(fixture);
assert.ok(result);
assert.equal(JSON.stringify(fixture), original, "printing must not modify canonical inputs");
assert.deepEqual(buildReportPrintFromReportFill(fixture), result, "pagination is deterministic");
const elements = result.pages.flatMap((page) => page.elements);
const repeated = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
assert.deepEqual(repeated(elements.map((element) => element.id)), [], "continued print elements need unique IDs across pages");
assert.deepEqual(repeated(result.bookmarks.map((bookmark) => bookmark.id)), [], "continued print titles must not duplicate bookmarks");
const text = elements.map((element) => element.text || element.svg || "").join("\n");
assert.doesNotMatch(text, /Wrong branch|legacyView|Private child|Must not leak|Hidden group/);
assert.match(text, /distribution: Revenue/);
assert.match(text, /\[x20\]/);
assert.match(text, /20 touchpoints/);
assert.match(text, /Pathway evidence \(1\/2\)/);
assert.match(text, /Pathway evidence \(2\/2\)/);
const emptyWideFixture = buildPairingPrintFixture();
const emptyWideTable = {
  ...emptyWideFixture.reportFill.blocks.find((block) => block.id === "evidence"),
  content: {
    ...emptyWideFixture.reportFill.blocks.find((block) => block.id === "evidence").content,
    columns: Array.from({ length: 20 }, (_, index) => ({ key: `field${index}`, label: `Measurement${index}` })),
    resolvedRows: [],
  },
};
emptyWideFixture.reportSpec.blocks = [emptyWideTable];
emptyWideFixture.reportSpec.layoutIntent.blockOrder = [emptyWideTable.id];
emptyWideFixture.reportFill.blocks = [emptyWideTable];
emptyWideFixture.reportFill.specHash = buildReportSpecHash(emptyWideFixture.reportSpec);
const emptyWidePrint = buildReportPrintFromReportFill(emptyWideFixture);
const emptyWideText = emptyWidePrint.pages.flatMap((page) => page.elements).map((element) => element.text || "").join("\n");
assert.equal((emptyWideText.match(/No rows are available for print\./g) || []).length, 1,
  "An empty wide table has one empty state, not one per column partition");
assert.doesNotMatch(emptyWideText, /Pathway evidence \(\d+\/\d+\)/);
for (let i = 0; i < 9; i += 1) assert.match(text, new RegExp(`Evidence metric ${i}`));
for (const page of result.pages) {
  for (const element of page.elements) {
    assert.ok(element.box.y + element.box.height <= 724.01, `${element.id} exceeds printable page bottom`);
    assert.ok(element.box.x + element.box.width <= 576.01, `${element.id} exceeds printable page width`);
  }
  if (page.elements.some((element) => element.id.startsWith("section__title"))) {
    assert.ok(page.elements.some((element) => element.id.startsWith("revenue__svg")), "section and first chart chunk share a page");
  }
  if (page.elements.some((element) => element.id.includes("__header_bg__"))) {
    assert.ok(page.elements.some((element) => element.id.includes("evidence") && element.id.includes("__title")), "table continuation repeats its title");
  }
}
assert.ok(elements.filter((element) => element.id.startsWith("revenue__svg")).length >= 2, "all 20 bars are paginated");
const chart = fixture.reportFill.blocks.find((block) => block.id === "revenue");
const pages = buildReportPrintChartPages({ ...chart.content, width: 540, maxHeight: 500 });
assert.ok(pages.length > 1);
assert.ok(pages.every((page) => page.height <= 500));
assert.equal(pages.reduce((count, page) => count + (page.svg.match(/<rect /g) || []).length - 1 + (page.svg.match(/<path /g) || []).length, 0), 20, "every source bar is retained once");
assert.ok(pages.every((page) => page.svg.includes('>2K</text>')), "chart chunks share their value axis");
assert.equal(compactReportPrintSequence("A -> A -> B -> A"), "A [x2] -> B -> A (4 touchpoints)");
assert.equal(compactReportPrintSequence("A -> B -> A"), "A -> B -> A");

assert.equal(result.pages.find((page) => page.elements.some((element) => element.id.startsWith("revenue__svg")))?.number, 1, "chart uses the space after a short introduction");
const labelPages = buildReportPrintChartPages({
  chartModel: chart.content.chartModel,
  resolvedChart: { ...chart.content.resolvedChart, rows: [
    { pathway: "Personal Computer | Smart Phone | Tablet", revenue: 2 },
    { pathway: "Personal Computer | Smart Phone | Connected TV", revenue: 1 },
    { pathway: "A very long first member -> A very long second member -> Distinct final touchpoint", revenue: 3 },
  ] },
  width: 540,
});
const labelOutput = labelPages.map((page) => page.svg + (page.labelDetails || []).join("\n")).join("\n");
assert.doesNotMatch(labelOutput, /…/);
assert.match(labelOutput, /Tablet/);
assert.match(labelOutput, /Connected TV/);
assert.match(labelOutput, /Distinct final touchpoint/);
const longPath = "A very long first member -> A very long second member -> Distinct final touchpoint";
assert.deepEqual(labelPages.flatMap(page => page.labelDetails || []), [`Category 1: ${longPath}`],
  "The long path has the first displayed category reference after descending revenue ordering");
assert.match(labelPages[0].svg, /<tspan>Category 1<\/tspan>/,
  "The plotted label uses the same reference as its full detail");
assert.ok(labelPages[0].svg.indexOf("Category 1") < labelPages[0].svg.indexOf("Tablet"),
  "The largest revenue category appears before the lower revenue pathways");
// Explicit line positions survive the backend's SVG subset, unlike relative dy.
assert.doesNotMatch(labelOutput, /dy=/);

console.log("MTA print pairing regressions passed");

// Short context sections move together; long ones repeat their heading on each page.
function textSectionPrint(blocks, datasets = []) {
  const source = { kind: 'reportBuilder', containerId: 'text-pagination', stateKey: 'text-pagination', dataSourceRef: 'primary' };
  const reportSpec = { version: 1, kind: 'reportSpec', title: 'Context pagination', source, blocks, datasets: datasets.map(dataset=>({id:dataset.id,dataSourceRef:'fixture'})), layoutIntent: { blockOrder: blocks.map(block => block.id) } };
  const reportFill = { version: 1, kind: 'reportFill', specVersion: 1, specHash: buildReportSpecHash(reportSpec), source, blocks, datasets };
  return buildReportPrintFromReportFill({ reportSpec, reportFill });
}
const contextBlocks = [
  { id: 'introText', kind: 'markdownBlock', title: 'Introduction', content: { markdown: Array.from({length: 31}, (_, i) => `Introduction line ${i}`).join('\n') } },
  { id: 'shortOptions', kind: 'filterBarBlock', title: 'Selected report options', content: { params: Array.from({length: 7}, (_, i) => ({id:`option${i}`, value:`Selected ${i}`})) } },
];
const shortContext = textSectionPrint(contextBlocks);
const shortPages = shortContext.pages.filter(page => page.elements.some(element => element.id.startsWith('shortOptions__')));
assert.equal(shortPages.length, 1, 'an options section that fits on a fresh page must stay together');
assert.equal(shortPages[0].number, 2);
const longContext = textSectionPrint([{ id: 'longOptions', kind: 'filterBarBlock', title: 'Selected report options', content: { params: Array.from({length: 90}, (_, i) => ({id:`option${i}`, value:`Selected ${i}`})) } }]);
assert.ok(longContext.pages.length >= 3);
for (const page of longContext.pages) {
  assert.ok(page.elements.some(element => element.id.startsWith('longOptions__title')), 'continued options must retain their heading');
  assert.ok(page.elements.every(element => element.box.y + element.box.height <= 724.01), 'context stays inside printable page');
}
assert.equal(longContext.bookmarks.length, 1, 'continuation headings do not duplicate bookmarks');
const longElements = longContext.pages.flatMap(page=>page.elements);
assert.equal(new Set(longElements.map(element=>element.id)).size, longElements.length);
for (let i=0;i<90;i++) assert.equal(longElements.filter(element=>element.text===`option${i}: Selected ${i}`).length,1,'every option retained exactly once');
console.log('Text context pagination regressions passed');


const emptyChart = { id:'emptyChart',kind:'chartBlock',title:'Daily amount',datasetRef:'measurements',content:{rowCount:0,resolvedChart:null,chartModel:{type:'horizontal_bar',series:{values:[{value:'amount',label:'Amount'}]}}} };
const emptyDataset = { id:'measurements',provenance:{rowCount:0,hasMore:false,truncated:false,diagnostics:[]},rows:[] };
const emptyPrint=textSectionPrint([emptyChart],[emptyDataset]);
const emptyText=emptyPrint.pages.flatMap(page=>page.elements).map(element=>element.text||'').join(' ');
assert.match(emptyText,/No data for the selected scope/,'A complete empty dataset is a normal no-data state');
assert.doesNotMatch(emptyText,/ReportPrint block/);
for(const bad of [[],[{...emptyDataset,provenance:{...emptyDataset.provenance,hasMore:true}}],[{...emptyDataset,provenance:{...emptyDataset.provenance,diagnostics:[{code:'sourceFailure',severity:'error',message:'Fixture source failed'}]}}]]) {
 const rejected=textSectionPrint([emptyChart],bad);
 assert.doesNotMatch(rejected.pages.flatMap(page=>page.elements).map(element=>element.text||'').join(' '),/No data for the selected scope/,'Missing/incomplete/failed datasets must not become ordinary no-data');
 assert.ok(rejected.diagnostics.some(d=>d.code==='unsupportedReportPrintChartPayload'));
}
const contextBeforeChart=textSectionPrint([
 {id:'preceding',kind:'markdownBlock',title:'Preceding analysis',content:{markdown:Array.from({length:21},(_,i)=>`Evidence line ${i}`).join('\n')}},
 {id:'dailySection',kind:'sectionBlock',title:'Daily trends'},
 {id:'dailyContext',kind:'markdownBlock',title:'Trend context',content:{markdown:'Compare the reported daily observations in the selected period.'}},
 {...chart,id:'dailyChart',title:'Daily observations',runtime:{},content:{...chart.content,resolvedChart:{...chart.content.resolvedChart,rows:[{pathway:'A',revenue:5},{pathway:'B',revenue:3}]}}},
]);
const dailySectionPage=contextBeforeChart.pages.find(page=>page.elements.some(element=>element.id.startsWith('dailySection__title')));
assert.ok(dailySectionPage.elements.some(element=>element.id.startsWith('dailyChart__svg')),'A section and its short context stay with the first analytical block');
console.log('Empty chart and section-introduction pagination regressions passed');
