import assert from "node:assert/strict";
import { buildReportFillFromReportSpec } from "./reportFillModel.js";

import {
  compileInlineReport,
  compileInlineReportDefinition,
  materializeInlineReport,
  applyInlineReportTableSelections,
  normalizeInlineReportAssemblyDataSources,
} from "./inlineReportCompiler.js";

const dashboard = compileInlineReport({
  reportId: "campaign:delivery",
  grammar: "dashboard-v1",
  source: {
    title: "Delivery Brief",
    blocks: [{
      id: "deliveryTable",
      kind: "dashboard.table",
      title: "Delivery",
      dataSourceRef: "delivery_rows",
      columns: [
        { key: "channel", label: "Channel" },
        { key: "spend", label: "Spend", format: "currency" },
      ],
    }],
  },
  dataSources: {
    delivery_rows: { rows: [{ channel: "CTV", spend: 125 }] },
  },
});

assert.equal(dashboard.reportDocument.kind, "reportDocument");
assert.equal(dashboard.reportSpec.kind, "reportSpec");
assert.equal(dashboard.reportFill.kind, "reportFill");
assert.equal(dashboard.reportPrint.kind, "reportPrint");
assert.equal(dashboard.reportFill.datasets.find((entry) => entry.id === "delivery_rows")?.rows[0]?.spend, 125);
assert.ok(dashboard.reportSpec.blocks.some((entry) => entry.kind === "tableBlock"));
assert.equal(dashboard.promotion.eligible, true);
assert.equal(dashboard.promotion.mode, "snapshot");
assert.deepEqual(dashboard.promotion.materializedDatasetIds, ["delivery_rows"]);

const zeroSummary = compileInlineReport({
  reportId: "zero-summary",
  grammar: "dashboard-v1",
  source: {
    title: "Zero Summary",
    blocks: [{
      id: "summary",
      kind: "dashboard.summary",
      dataSourceRef: "forecast_summary",
      metrics: [{ id: "avails", label: "Avails", selector: "0.total_avails" }],
    }],
  },
  dataSources: { forecast_summary: { rows: [{ total_avails: 0 }] } },
});
assert.equal(zeroSummary.reportSpec.blocks[0]?.valueField, "total_avails");
assert.equal(zeroSummary.reportFill.blocks[0]?.content?.value, 0);

const canonical = compileInlineReport({
  reportId: "canonical-brief",
  grammar: "report-document-v1",
  source: {
    title: "Canonical Brief",
    blocks: [
      { id: "intro", kind: "markdownBlock", title: "Overview", markdown: "## Overview\nCurrent delivery." },
      { id: "detail", kind: "tableBlock", title: "Detail", datasetRef: "rows", columns: [{ key: "market", label: "Market" }] },
    ],
  },
  dataSources: { rows: { rows: [{ market: "US" }] } },
});

assert.deepEqual(canonical.reportSpec.blocks.map((entry) => entry.id), ["intro", "detail"]);
assert.equal(canonical.reportFill.datasets.find((entry) => entry.id === "rows")?.rows[0]?.market, "US");

const metricLabels = compileInlineReport({
  reportId: "metric-labels",
  grammar: "report-document-v1",
  source: {
    title: "Metric label defaults",
    viewer: { appearance: "document" },
    blocks: [
      { id: "records", kind: "kpiBlock", title: "Observed records", datasetRef: "readings", valueField: "recordCount", valueFormat: "number" },
      { id: "temperature", kind: "kpiBlock", title: "Temperature", valueLabel: "Degrees Celsius", datasetRef: "readings", valueField: "readingValue", valueFormat: "number2" },
    ],
  },
  dataSources: { readings: { rows: [{ recordCount: 0, readingValue: 21.2345 }] } },
});
for (const [id, label, value] of [["records", "Observed records", 0], ["temperature", "Degrees Celsius", 21.2345]]) {
  assert.equal(metricLabels.reportSpec.blocks.find(block => block.id === id).valueLabel, label);
  const content = metricLabels.reportFill.blocks.find(block => block.id === id).content;
  assert.equal(content.valueLabel, label);
  assert.equal(content.value, value, "Label defaults must not round or coerce source values");
}
const metricPrintText = metricLabels.reportPrint.pages.flatMap(page => page.elements.map(element => element.text)).join("\n");
assert.match(metricPrintText, /OBSERVED RECORDS/);
assert.match(metricPrintText, /DEGREES CELSIUS/);
assert.doesNotMatch(metricPrintText, /recordCount|readingValue/);
const nativeMetricFill = buildReportFillFromReportSpec({
  ...metricLabels.reportSpec,
  blocks: metricLabels.reportSpec.blocks.map(block => block.id === "records" ? { ...block, valueLabel: undefined } : block),
}, metricLabels.datasetPayloads);
assert.equal(nativeMetricFill.blocks.find(block => block.id === "records").content.valueLabel, "Observed records", "Native specs use the same missing-label default");

const diagnosticOverview = compileInlineReport({
  reportId: "order-2672373-troubleshoot",
  grammar: "report-document-v1",
  source: {
    title: "Diagnostic Overview",
    blocks: [
      {
        id: "pacing",
        kind: "badgesBlock",
        title: "Delivery posture",
        datasetRef: "order_2672373_troubleshoot_pacing",
        items: [
          { labelField: "dailyPacingStatus", tone: "warning" },
          { labelField: "flightPacingStatus", tone: "warning" },
        ],
      },
      {
        id: "bidPotential",
        kind: "kpiBlock",
        title: "Bid potential",
        datasetRef: "order_2672373_troubleshoot_setup",
        valueField: "bidPotential",
        format: "number5",
        suffix: "x",
      },
      {
        id: "changes",
        kind: "timelineBlock",
        title: "Recent changes",
        datasetRef: "order_2672373_troubleshoot_changes",
        timeField: "changeTs",
        titleField: "eventLabel",
        descriptionField: "changeDetail",
      },
    ],
  },
  dataSources: {
    "order_2672373_troubleshoot_pacing": {
      rows: [{ dailyPacingStatus: "behind", flightPacingStatus: "behind" }],
    },
    "order_2672373_troubleshoot_setup": {
      rows: [{ bidPotential: 0.003671280903755624 }],
    },
    "order_2672373_troubleshoot_changes": {
      rows: [{
        changeTs: "2026-07-07T16:27:25Z",
        eventLabel: "General configuration change",
        changeDetail: "Goal Mode changed from 2 to 1.",
      }],
    },
  },
});
assert.deepEqual(
  diagnosticOverview.reportFill.blocks.find((entry) => entry.id === "pacing")?.content?.items
    .map((item) => ({ label: item.label, value: item.value })),
  [
    { label: "Daily Pacing Status", value: "behind" },
    { label: "Flight Pacing Status", value: "behind" },
  ],
);
assert.equal(
  diagnosticOverview.reportFill.blocks.find((entry) => entry.id === "bidPotential")?.content?.valueFormat,
  "number5",
);
assert.equal(
  diagnosticOverview.reportFill.blocks.find((entry) => entry.id === "bidPotential")?.content?.value,
  0.003671280903755624,
);
assert.equal(
  diagnosticOverview.reportFill.blocks.find((entry) => entry.id === "bidPotential")?.content?.suffix,
  "x",
);
assert.deepEqual(
  diagnosticOverview.reportFill.blocks.find((entry) => entry.id === "changes")?.content?.events,
  [{
    id: "event_1",
    date: "2026-07-07T16:27:25Z",
    title: "General configuration change",
    body: "Goal Mode changed from 2 to 1.",
  }],
);

const narrativeOnly = compileInlineReport({
  reportId: "order_2678042_order_2678042_troubleshoot",
  grammar: "report-document-v1",
  source: {
    title: "Delivery troubleshooting",
    blocks: [
      { id: "primary_read", kind: "markdownBlock", title: "Primary read", markdown: "Delivery was behind." },
    ],
  },
});
assert.deepEqual(
  narrativeOnly.reportSpec.datasets,
  [],
  "narrative-only reports must not invent the report id as a workspace datasource",
);
assert.deepEqual(narrativeOnly.promotion.reusableDataSourceRefs, []);

const live = compileInlineReport({
  reportId: "live-brief",
  grammar: "report-document-v1",
  source: {
    title: "Live Brief",
    datasets: [{ id: "delivery", kind: "workspaceRef", dataSourceRef: "metrics_delivery", request: { orderId: 2680567 } }],
    blocks: [{ id: "deliveryTable", kind: "tableBlock", title: "Delivery", datasetRef: "delivery", columns: [{ key: "spend", label: "Spend" }] }],
  },
});

assert.equal(live.workspaceDatasetRequests.length, 1);
assert.equal(live.promotion.eligible, true);
assert.equal(live.promotion.mode, "reusable");
assert.deepEqual(live.promotion.reusableDataSourceRefs, ["metrics_delivery"]);
const materialized = await materializeInlineReport(live, {
  fetchDataset: async (request) => {
    assert.equal(request.dataSourceRef, "metrics_delivery");
    assert.equal(request.request.orderId, 2680567);
    return { rows: [{ spend: 404 }] };
  },
});
assert.equal(materialized.reportFill.datasets.find((entry) => entry.id === "delivery")?.rows[0]?.spend, 404);
assert.equal(materialized.reportPrint.kind, "reportPrint");

assert.equal(canonical.promotion.eligible, true);
assert.equal(canonical.promotion.mode, "snapshot");
assert.deepEqual(canonical.promotion.materializedDatasetIds, ["rows"]);

assert.throws(() => compileInlineReport({
  source: {
    blocks: [{ id: "table", kind: "dashboard.table", dataSourceRef: "camelCaseRows", columns: [{ key: "value" }] }],
  },
  dataSources: { camelCaseRows: { rows: [{ value: 1 }] } },
}), /must use canonical lowercase/i);

const assembled = compileInlineReportDefinition({
  scope: "campaign",
  id: "delivery",
  grammar: "dashboard-v1",
  status: "committed",
  source: {
    title: "Assembled delivery",
    blocks: [{
      id: "summary",
      kind: "dashboard.summary",
      dataSourceRef: "summary_rows",
      metrics: [{ id: "spend", label: "Spend", selector: "0.spend" }],
    }],
  },
  dataSources: {
    summary_rows: {
      id: "summary_rows",
      format: "json",
      payload: [{ spend: 125 }],
    },
  },
});
assert.equal(assembled.reportDocument.id, "campaign_delivery");
assert.equal(assembled.reportDocument.title, "Assembled delivery");
assert.equal(assembled.reportFill.datasets.find((entry) => entry.id === "summary_rows")?.rows[0]?.spend, 125);
assert.deepEqual(normalizeInlineReportAssemblyDataSources({
  csv_rows: { format: "csv", payload: "channel,spend\nCTV,42" },
}).csv_rows.rows, [{ channel: "CTV", spend: 42 }]);
assert.deepEqual(normalizeInlineReportAssemblyDataSources({
  summary: { format: "json", payload: { spend: 42 } },
}).summary.rows, [{ spend: 42 }]);
assert.throws(() => compileInlineReportDefinition({
  id: "pending",
  status: "incomplete",
  source: { blocks: [] },
}), /incomplete and cannot be opened/i);

console.log("inlineReportCompiler ✓ compiles dashboard and canonical inline reports with static and live datasets");

const formattedStatic=compileInlineReport({reportId:'formatted_static',grammar:'report-document-v1',source:{viewer:{appearance:'document'},blocks:[
 {id:'cost',kind:'chartBlock',datasetRef:'records',chartSpec:{appearance:'document',type:'horizontal_bar',xField:'group',yFields:['amount']}},
 {id:'share',kind:'chartBlock',datasetRef:'records',chartSpec:{appearance:'document',type:'line',xField:'group',yFields:['share']}},
]},dataSources:{records:{columns:[{key:'group',kind:'dimension',label:'Group'},{key:'amount',kind:'measure',label:'Amount',format:'currency'},{key:'share',kind:'measure',label:'Share',format:'percentFraction'}],rows:[{group:'A',amount:22000.75,share:.45}]}}});
assert.equal(formattedStatic.reportSpec.blocks.find(block=>block.id==='cost').chartModel.yAxis.format,'currency');
assert.equal(formattedStatic.reportSpec.blocks.find(block=>block.id==='share').chartModel.yAxis.format,'percentFraction');
assert.equal(formattedStatic.reportFill.datasets.find(dataset=>dataset.id==='records').rows[0].share,.45,'Formatting must not change underlying values');

const recordSource={viewer:{appearance:'document'},blocks:[{id:'review',kind:'tableBlock',title:'Candidate review',description:'Bounded coverage: all returned rows displayed',datasetRef:'candidates',recordTitleField:'name',columns:[{key:'name',label:'Name',flex:true,minWidth:240},{key:'selected',label:'Selected',width:96,align:'right',displayValueMap:{false:'Not selected',true:'Selected'}}]}]};
const recordReport=compileInlineReport({reportId:'record_review',grammar:'report-document-v1',source:recordSource,dataSources:{candidates:{rows:[{name:'First record',selected:false}]}}});
assert.equal(recordReport.reportSpec.blocks[0].recordTitleField,'name');
assert.equal(recordReport.reportFill.blocks[0].recordTitleField,'name');
assert.equal(recordReport.reportSpec.blocks[0].columns[0].minWidth,240);
assert.equal(recordReport.reportFill.blocks[0].columns[1].width,96);
assert.equal(recordReport.reportFill.blocks[0].content.resolvedRows[0].cells[1].displayValue,'Not selected');
assert.equal(recordReport.reportFill.datasets[0].rows[0].selected,false);
const {validateReportSpec:validateRecordSpec,validateReportFill:validateRecordFill}=await import('./schema/reportSchemas.js');
assert.equal(validateRecordSpec(recordReport.reportSpec).valid,true);
assert.equal(validateRecordFill(recordReport.reportFill).valid,true);
assert.throws(()=>compileInlineReport({reportId:'invalid_records',grammar:'report-document-v1',source:{...recordSource,blocks:[{...recordSource.blocks[0],recordTitleField:'missing'}]},dataSources:{candidates:{rows:[]}}}),/existing table column/);

const sparklineSource={viewer:{appearance:'document'},blocks:[{id:'metric',kind:'kpiBlock',title:'Count',datasetRef:'points',valueField:'count',valueLabel:'Count',sparkline:{datasetRef:'points',valueField:'count',categoryField:'day'}}]};
const sparklineReport=compileInlineReport({reportId:'static_sparkline',grammar:'report-document-v1',source:sparklineSource,dataSources:{points:{rows:[{day:'2026-01-01',count:12},{day:'2026-01-02',count:15}]}}});
assert.deepEqual(sparklineReport.reportFill.blocks[0].content.sparkline.values,[12,15]);
assert.deepEqual(sparklineReport.reportSpec.datasets[0].request,{kind:'staticJson',format:'json',rowCount:2,columnKeys:['day','count']},'Materialized snapshots must not gain backend query fields');
assert.throws(()=>compileInlineReport({reportId:'invalid_sparkline',grammar:'report-document-v1',source:{...sparklineSource,blocks:[{...sparklineSource.blocks[0],sparkline:{...sparklineSource.blocks[0].sparkline,valueField:'missing'}}]},dataSources:{points:{rows:[{day:'2026-01-01',count:12}]}}}),/fields must be declared/);

assert.equal(recordReport.reportSpec.blocks[0].description,'Bounded coverage: all returned rows displayed');
assert.equal(recordReport.reportFill.blocks[0].description,'Bounded coverage: all returned rows displayed');
assert.ok(JSON.stringify(recordReport.reportPrint).includes('Bounded coverage: all returned rows displayed'));

// Review choices remain local; matching site IDs must not merge distinct paths.
const reviewReport = compileInlineReport({reportId:'review-choices',grammar:'report-document-v1',
  source:{viewer:{appearance:'document'},blocks:[{id:'choices',kind:'tableBlock',datasetRef:'paths',selection:{mode:'checkbox',field:'selected'},columns:[{key:'site',label:'Site'},{key:'path',label:'Path'}]}]},
  dataSources:{paths:{rows:[{site:101,path:'direct',selected:true,cost:7},{site:101,path:'reseller',selected:true,cost:12}]}}});
const reviewed = applyInlineReportTableSelections(reviewReport,{choices:[true,false]});
assert.deepEqual(reviewed.datasetPayloads.paths.rows,[{site:101,path:'direct',selected:true,cost:7},{site:101,path:'reseller',selected:false,cost:12}]);
assert.equal(reviewReport.datasetPayloads.paths.rows[1].selected,true);
assert.match(JSON.stringify(reviewed.reportPrint),/Selected/);
assert.match(JSON.stringify(reviewed.reportPrint),/false/);
assert.throws(()=>applyInlineReportTableSelections(reviewReport,{choices:[true]}),/one boolean per source row/);
assert.throws(()=>applyInlineReportTableSelections(reviewReport,{choices:[true,'false']}),/one boolean per source row/);
assert.throws(()=>applyInlineReportTableSelections(reviewReport,{missing:[true,false]}),/does not support review selection/);
const legacyReview = compileInlineReport({grammar:'dashboard-v1',source:{blocks:[{id:'old',kind:'dashboard.table',dataSourceRef:'paths',selection:{mode:'checkbox',field:'selected'},columns:[{key:'site',label:'Site'}]}]},dataSources:{paths:{rows:[{site:101,selected:true}]}}});
assert.ok(legacyReview.reportSpec.blocks.some(block=>block.selection?.field==='selected'),'Dashboard compatibility retains checkbox selection');

const {mergeReportTableSelections} = await import('./tableVisualSpec.js');
const allChoices = [{site:101,path:'direct',selected:true},{site:101,path:'reseller',selected:true},{site:102,path:'direct',selected:false}];
assert.deepEqual(mergeReportTableSelections(allChoices,[allChoices[1]],[{...allChoices[1],selected:false}],'selected'),[true,false,false],'Filtered review cannot deselect hidden rows or merge same-site paths');

// The reserved primary ref must retain its explicit static field catalog too.
for (const rows of [[{group:'First',count:12}],[]]) {
  const primaryChart = compileInlineReport({grammar:'report-document-v1',source:{viewer:{appearance:'document'},blocks:[
    {id:'primary-chart',kind:'chartBlock',title:'Primary chart',datasetRef:'primary',chartSpec:{type:'bar',xField:'group',yFields:['count']}},
  ]},dataSources:{primary:{rows,columns:[{key:'group',kind:'dimension',label:'Group'},{key:'count',kind:'measure',label:'Count'}]}}});
  assert.ok(primaryChart.reportSpec.blocks.find(block=>block.id==='primary-chart').chartModel,'Primary static charts retain the real fields, including empty rows');
  assert.deepEqual(primaryChart.datasetPayloads.primary.rows,rows);
}
