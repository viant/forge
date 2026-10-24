import assert from "node:assert/strict";
import { buildReportFillFromReportSpec } from "./reportFillModel.js";
import { buildReportPrintFromReportFill } from "./reportPrintModel.js";
import { formatExportValue } from "./reportExportValueFormatter.js";

const columns = [
  { key: "amount", format: "currency2" },
  { key: "precision", format: "number5" },
  { key: "fraction", format: "percentFraction2" },
  { key: "compact", format: "compactNumber" },
  { key: "id", format: "id" },
  { key: "date", format: "date" },
  { key: "missing", format: "number2" },
].map(column => ({ ...column, label: column.key }));
const spec = {
  version: 1, kind: "reportSpec", title: "Cell formatting parity",
  source: { kind: "report", containerId: "cells", stateKey: "cells", dataSourceRef: "source" },
  parameters: {}, refinements: [], calculatedFields: [],
  datasets: [{ id: "primary", dataSourceRef: "source", request: {} }],
  blocks: [{ id: "evidence", kind: "tableBlock", datasetRef: "primary", columns }],
  layoutIntent: { kind: "stack", resultPanePosition: "bottom", blockOrder: ["evidence"] },
};
const values = { amount: -1234.567, precision: 0.123456789, fraction: 0.123456, compact: 1234567, id: "0009007199254740993", date: "2026-01-01T00:00:00Z", missing: null };
const fill = buildReportFillFromReportSpec(spec, { primary: { rows: Array.from({ length: 70 }, () => ({ ...values })) } });
const cells = print => print.pages.flatMap(page => page.elements).filter(element => element.kind === "tableCellText");
const first = buildReportPrintFromReportFill({ reportSpec: spec, reportFill: fill });
for (const column of columns) {
  const printed = cells(first).filter(cell => cell.columnKey === column.key);
  assert.equal(printed.length, 70);
  for (const cell of printed) assert.equal(cell.text, formatExportValue(values[column.key], column.format));
}
// Same cell identity and a changed display value must be fresh on the next build.
const amount = fill.blocks[0].content.resolvedRows[0].cells.find(cell => cell.key === "amount");
amount.displayValue = 987.654;
assert.ok(cells(buildReportPrintFromReportFill({ reportSpec: spec, reportFill: fill })).some(cell => cell.columnKey === "amount" && cell.text === "$987.65"));

// Equal primitive values under different formats must retain their own text.
const sharedValueFill = buildReportFillFromReportSpec(spec, { primary: { rows: [{ ...values, amount: 12.34, precision: 12.34, id: 12.34 }] } });
const sharedValuePrint = cells(buildReportPrintFromReportFill({ reportSpec: spec, reportFill: sharedValueFill }));
for (const key of ["amount", "precision", "id"]) {
  const column = columns.find(column => column.key === key);
  assert.equal(sharedValuePrint.find(cell => cell.columnKey === key).text, formatExportValue(12.34, column.format));
}

const smallSpec = { ...spec, blocks: [{ ...spec.blocks[0], columns: [{ key: "amount", label: "Amount", format: "currency2" }] }] };
const smallFill = buildReportFillFromReportSpec(smallSpec, { primary: { rows: Array.from({ length: 100 }, () => ({ amount: 12.34 })) } });
// Pathway compaction creates replacement cells after measuring the source;
// the memo must use the replacement display text and preserve detail text.
const pathway = Array.from({ length: 16 }, (_, index) => `Touchpoint ${index + 1}`).join(" -> ");
const pathwaySpec = { ...smallSpec, blocks: [{ ...smallSpec.blocks[0], columns: [{ key: "amount", label: "Pathway", format: "text" }] }] };
const pathwayFill = buildReportFillFromReportSpec(pathwaySpec, { primary: { rows: [{ amount: pathway }] } });
const pathwayPrint = buildReportPrintFromReportFill({ reportSpec: pathwaySpec, reportFill: pathwayFill });
assert.match(cells(pathwayPrint)[0].text, /^Pathway 1 \(16 touchpoints; see details\)$/);
assert.ok(pathwayPrint.pages.flatMap(page => page.elements).some(element => element.text?.includes("Touchpoint 16")), "full pathway detail remains in print");

const numberFormat = Object.getOwnPropertyDescriptor(Intl.NumberFormat.prototype, "format");
let calls = 0;
Object.defineProperty(Intl.NumberFormat.prototype, "format", {
  ...numberFormat,
  get() { const format = numberFormat.get.call(this); return value => { calls += 1; return format(value); }; },
});
try {
  const print = buildReportPrintFromReportFill({ reportSpec: smallSpec, reportFill: smallFill });
  assert.equal(cells(print).length, 100);
  assert.equal(calls, 1, "one formatting operation per repeated primitive value within a print build");
  buildReportPrintFromReportFill({ reportSpec: smallSpec, reportFill: smallFill });
  assert.equal(calls, 2, "each build receives a fresh memo");
  const rows = smallFill.blocks[0].content.resolvedRows;
  rows[0].cells[0].value = -0; rows[0].cells[0].displayValue = -0;
  rows[1].cells[0].value = 0; rows[1].cells[0].displayValue = 0;
  const zeroTexts = cells(buildReportPrintFromReportFill({ reportSpec: smallSpec, reportFill: smallFill })).slice(0, 2).map(cell => cell.text);
  assert.deepEqual(zeroTexts, ["-$0.00", "$0.00"]);
} finally {
  Object.defineProperty(Intl.NumberFormat.prototype, "format", numberFormat);
}
console.log("report print cell reuse preserves complete formatting and invocation isolation");
