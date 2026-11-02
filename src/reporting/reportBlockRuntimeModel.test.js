import assert from "node:assert/strict";

import {
  buildReportRuntimeHostExecution,
  buildReportRuntimeSelection,
  isReportRuntimeBlockVisible,
  normalizeReportRuntimeCondition,
  resolveReportRuntimeBlockRows,
  resolveReportRuntimeFilterValues,
  resolveReportRuntimeHostActions,
  resolveReportRuntimeExternalSelectionLink,
  resolveReportRuntimeSelectionActions,
} from "./reportBlockRuntimeModel.js";
import { normalizeReportBuilderDocumentBlocks } from "./reportDocumentModel.js";
import { buildReportFillFromReportSpec } from "./reportFillModel.js";

assert.deepEqual(normalizeReportRuntimeCondition({ selector: "dashboard.selection.entityKey", notEmpty: true }), {
  selector: "entityKey",
  source: "selection",
  notEmpty: true,
});
assert.deepEqual(resolveReportRuntimeFilterValues([{ id: "region", value: ["NA"] }]), { region: ["NA"] });

const block = {
  id: "marketChart",
  runtime: {
    filterBindings: { region: "region" },
    selectionBindings: { entityKey: "market" },
    visibleWhen: { selector: "dashboard.selection.entityKey", notEmpty: true },
    actions: [
      { id: "selectMarket", event: "onSelect", kind: "select", dimension: "market" },
      { id: "openMarket", event: "onSelect", kind: "host", handler: "openMarket", arguments: { mode: "detail" } },
    ],
  },
};
const rows = [
  { region: "NA", market: "US", spend: 10 },
  { region: "NA", market: "CA", spend: 5 },
  { region: "EMEA", market: "DE", spend: 7 },
];
assert.deepEqual(resolveReportRuntimeBlockRows(block, rows, {
  filters: { region: ["NA"] },
  selection: { entityKey: "US" },
}), [rows[0]]);
assert.equal(isReportRuntimeBlockVisible(block, { selection: {} }), false);
assert.equal(isReportRuntimeBlockVisible(block, { selection: { entityKey: "US" } }), true);
assert.equal(resolveReportRuntimeSelectionActions(block).length, 1);
assert.equal(resolveReportRuntimeHostActions(block).length, 1);
assert.deepEqual(buildReportRuntimeHostExecution(block.runtime.actions[1], rows[0], block.id), {
  id: "openMarket",
  kind: "host",
  label: "openMarket",
  handler: "openMarket",
  arguments: { mode: "detail" },
  item: rows[0],
  sourceBlockId: "marketChart",
});
assert.deepEqual(buildReportRuntimeSelection(block.runtime.actions[0], rows[0], block.id), {
  dimension: "market",
  entityKey: "US",
  selected: rows[0],
  sourceBlockId: "marketChart",
});

const normalizedBlock = normalizeReportBuilderDocumentBlocks([{
  id: "marketTable",
  kind: "tableBlock",
  datasetRef: "markets",
  columns: [{ key: "market", label: "Market" }, { key: "spend", label: "Spend" }],
  runtime: block.runtime,
}])[0];
assert.deepEqual(normalizedBlock.runtime, block.runtime);

const reportFill = buildReportFillFromReportSpec({
  version: 1,
  kind: "reportSpec",
  source: { kind: "test", containerId: "test", stateKey: "test", dataSourceRef: "markets" },
  title: "Runtime contract",
  parameters: { viewMode: "table", pageSize: 50 },
  layoutIntent: { kind: "grid", blockOrder: ["marketTable"] },
  scope: { params: [{ id: "region", kind: "multiSelect", label: "Region", value: ["NA"] }] },
  refinements: [],
  calculatedFields: [],
  datasets: [{ id: "markets", dataSourceRef: "markets", request: {} }],
  blocks: [normalizedBlock],
}, {
  markets: { rows },
});
assert.deepEqual(reportFill.blocks[0].runtime, block.runtime);
assert.equal(reportFill.blocks[0].content.rowCount, 2);
assert.deepEqual(reportFill.blocks[0].content.resolvedRows.map((entry) => entry.cells[0].value), ["US", "CA"]);

const selectedReportFill = buildReportFillFromReportSpec({
  version: 1,
  kind: "reportSpec",
  source: { kind: "test", containerId: "test", stateKey: "test", dataSourceRef: "markets" },
  title: "Runtime selection contract",
  parameters: { viewMode: "table", pageSize: 50 },
  layoutIntent: { kind: "grid", blockOrder: ["marketTable", "marketKpi"] },
  scope: { params: [{ id: "region", kind: "multiSelect", label: "Region", value: ["NA"] }] },
  refinements: [],
  calculatedFields: [],
  datasets: [{ id: "markets", dataSourceRef: "markets", request: {} }],
  blocks: [
    normalizedBlock,
    {
      id: "marketKpi",
      kind: "kpiBlock",
      datasetRef: "markets",
      valueField: "spend",
      valueLabel: "Spend",
      runtime: { selectionBindings: { entityKey: "market" } },
    },
  ],
}, {
  markets: { rows },
}, {
  runtimeSelection: { entityKey: "CA" },
});
assert.equal(selectedReportFill.blocks[0].content.rowCount, 1);
assert.equal(selectedReportFill.blocks[0].content.resolvedRows[0].cells[0].value, "CA");
assert.equal(selectedReportFill.blocks[1].content.value, 5);

console.log("reportBlockRuntimeModel ✓ executes adapted visibility, filter, selection, and selection-action contracts");

// URL selection follows the report table policy and the originating dataset.
const linkBlock = {runtime:{actions:[{kind:'external',urlField:'detailUrl'}]}};
const safe = {category:'Alpha',amount:4,detailUrl:'https://example.invalid/records/17'};
const safeOther = {...safe,category:'Beta',detailUrl:'https://example.invalid/records/18'};
const selectedLink = (selectedRows, rows=selectedRows, block=linkBlock) => resolveReportRuntimeExternalSelectionLink({block,rows,selection:{source:'cartesian',selectionRows:selectedRows}});
assert.equal(selectedLink([safe]).href, safe.detailUrl);
assert.equal(selectedLink([safe,{...safe,amount:7}]).href, safe.detailUrl);
assert.equal(selectedLink([safe,safeOther]), null, 'aggregated mark with different targets is ambiguous');
assert.equal(selectedLink([safe], [safeOther]), null, 'a different dataset cannot supply the selected row');
for (const detailUrl of [null, undefined, '', 'javascript:alert(1)', 'data:text/html,<b>x</b>', '/relative', 'file:///tmp/record']) {
  assert.equal(selectedLink([{...safe,detailUrl}]), null);
}
assert.equal(selectedLink([safe], [safe], {runtime:{actions:[{kind:'external',urlField:'missing'}]}}), null);
assert.equal(selectedLink([safe], [safe], {runtime:{actions:[{kind:'external',urlField:'detailUrl',event:'onHover'}]}}), null);
assert.equal(resolveReportRuntimeExternalSelectionLink({block:linkBlock,rows:[safe],selection:{source:'legend',selectionRows:[safe]}}), null);
assert.equal(selectedLink([safe], [safe], {runtime:{actions:[...linkBlock.runtime.actions,...linkBlock.runtime.actions]}}), null);
