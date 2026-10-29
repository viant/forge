import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {normalizeReportCalculatedField} from "./calculatedFieldModel.js";
import {buildReportFillFromReportSpec} from "./reportFillModel.js";
import {validateReportSpec, validateReportFill, validateReportPrint} from "./schema/reportSchemas.js";

// Independently authored, domain-neutral inputs; also exercise the existing runtime corpus.
const corpus = JSON.parse(fs.readFileSync(new URL("./fixtures/table-calculation-conformance-fixtures.v1.json", import.meta.url)));
corpus.runtimeCases.push({
  id: "row_lag_row_zero_null_and_original_order",
  definitions: [
    {id: "relative", expr: "normalized / nullif(abs(previous), 0)"},
    {id: "previous", compute: {type: "lag", sourceField: "normalized", orderBy: [{field: "sequence", direction: "asc"}], offset: 1}},
    {id: "normalized", expr: "coalesce(value, 0)"},
  ],
  rows: [{sequence: 3, value: -2}, {sequence: 1, value: 0}, {sequence: 2, value: null}, {sequence: 4, value: 4}],
  expectedRows: [
    {sequence: 3, value: -2, normalized: -2, previous: 0, relative: null},
    {sequence: 1, value: 0, normalized: 0, previous: null, relative: null},
    {sequence: 2, value: null, normalized: 0, previous: 0, relative: null},
    {sequence: 4, value: 4, normalized: 4, previous: -2, relative: 2},
  ],
});
const bundled = {};
vm.runInNewContext(fs.readFileSync(new URL("../../backend/reporting/materializer/lowerer.bundle.js", import.meta.url), "utf8"), bundled);
function specFor(definitions) {
  const fields = definitions.map(field => normalizeReportCalculatedField({...field, datasetRef: "primary"}));
  return {
    version: 1, kind: "reportSpec", title: "Ordered calculation evidence",
    source: {kind: "report", containerId: "synthetic", stateKey: "synthetic", dataSourceRef: "rows"},
    parameters: {viewMode: "table", pageSize: 100, groupBy: "", orderField: "", orderDir: "asc"},
    layoutIntent: {kind: "stack", resultPanePosition: "bottom", blockOrder: ["evidence"]},
    refinements: [], calculatedFields: fields,
    datasets: [{id: "primary", dataSourceRef: "rows", request: {}}],
    blocks: [{id: "evidence", kind: "tableBlock", datasetRef: "primary", title: "Evidence",
      runtime: {requireCompleteDataset: true},
      columns: fields.map(field => ({key: field.key, label: field.label}))}],
  };
}
function assertValid(result, label) {
  assert.deepEqual(result, {valid: true, errors: []}, label);
}
for (const fixture of corpus.runtimeCases.filter(item => item.definitions.some(field => ["lag", "windowMax"].includes(field.compute?.type)))) {
  const spec = specFor(fixture.definitions);
  assertValid(validateReportSpec(spec), fixture.id + " public spec");
  const datasets = {primary: {rows: fixture.rows, hasMore: false}};
  const original = JSON.stringify({spec, datasets});
  const fill = buildReportFillFromReportSpec(spec, datasets);
  assertValid(validateReportFill(fill), fixture.id + " public fill");
  assert.deepEqual(fill.datasets[0].rows, fixture.expectedRows, fixture.id + " source semantics");
  // The trusted backend's actual JSON fill/print entry point uses the same canonical functions.
  const printed = JSON.parse(bundled.ForgeAuthoredLowerer.materialize(JSON.stringify({reportSpec: spec, datasets})));
  assert.deepEqual(printed.reportFill.datasets[0].rows, fixture.expectedRows, fixture.id + " print pipeline semantics");
  assertValid(validateReportPrint(printed.reportPrint), fixture.id + " public print");
  if (fixture.id === "row_lag_row_zero_null_and_original_order") {
    const relativeCells = printed.reportPrint.pages.flatMap(page => page.elements)
      .filter(element => element.kind === "tableCellText" && element.columnKey === "relative");
    assert.deepEqual(relativeCells.map(cell => cell.text), ["—", "—", "—", "2"], "print cells retain nulls and dependency-ordered results in input row order");
  }
  for (const partial of [{rows: fixture.rows}, {rows: fixture.rows, hasMore: true},
    {rows: fixture.rows, hasMore: false, truncated: true},
    {rows: fixture.rows, hasMore: false, provenance: {hasMore: true}}]) {
    assert.throws(() => bundled.ForgeAuthoredLowerer.materialize(JSON.stringify({reportSpec: spec, datasets: {primary: partial}})), /requires explicitly complete/);
  }
  const pagedSpec = structuredClone(spec);
  pagedSpec.datasets[0].request.offset = 1;
  assert.throws(() => buildReportFillFromReportSpec(pagedSpec, datasets), /requires explicitly complete/);
  assert.equal(JSON.stringify({spec, datasets}), original, "inputs stay immutable");
}
const lag = {type: "lag", sourceField: "value", orderBy: [{field: "index", direction: "asc"}]};
const full = {type: "windowMax", sourceField: "value", frame: {type: "full"}};
const bounded = {...full, orderBy: lag.orderBy, frame: {type: "rows", preceding: 1, following: 0}};
for (const compute of [lag, {...lag, offset: 10000}, full, bounded,
  {...lag, partitionBy: ["group", "category"]},
  {...full, partitionBy: ["group"], orderBy: [{field: "sequence", direction: "desc"}]},
  {...bounded, frame: {type: "rows", preceding: 10000, following: 10000}}]) {
  const spec = specFor([{id: "result", compute: lag}]);
  spec.calculatedFields[0].compute = compute;
  assertValid(validateReportSpec(spec), "valid public window compute");
  const fill = buildReportFillFromReportSpec(spec, {primary: {rows: [], hasMore: false}});
  assertValid(validateReportFill(fill), "valid public fill window compute");
}
// Mutate after normalization: invalid source definitions must not be silently repaired.
for (const compute of [
  ...[lag, full, bounded].flatMap(compute => [
    ...["", " ", "\t\n"].map(sourceField => ({...compute, sourceField})),
    ...["", " ", "\t\n"].map(field => ({...compute, orderBy: [{field, direction: "asc"}]})),
    ...["", " ", "\t\n"].map(field => ({...compute, partitionBy: ["group", field]})),
  ]),
  {...lag, numerator: "value"}, {...lag, denominator: "value"}, {...lag, orderBy: []},
  {...lag, orderBy: [{field: "index", direction: "sideways"}]},
  {...lag, orderBy: [{field: "index", direction: "asc", extra: true}]},
  {...lag, offset: 0}, {...lag, offset: 10001}, {...lag, offset: 1.5}, {...lag, offset: "1"},
  {...lag, frame: {type: "full"}}, {...full, frame: undefined},
  {...full, frame: {type: "full", preceding: 1}}, {...full, offset: 1},
  {...bounded, orderBy: []}, {...bounded, orderBy: undefined},
  {...bounded, frame: {type: "rows", preceding: -1, following: 0}},
  {...bounded, frame: {type: "rows", preceding: 10001, following: 0}},
  {...bounded, frame: {type: "rows", preceding: 1, following: 0, extra: true}},
]) {
  const spec = specFor([{id: "result", compute: lag}]);
  spec.calculatedFields[0].compute = compute;
  assert.equal(validateReportSpec(spec).valid, false, "reject invalid spec " + JSON.stringify(compute));
  const fill = buildReportFillFromReportSpec(specFor([{id: "result", compute: lag}]), {primary: {rows: [], hasMore: false}});
  fill.calculatedFields[0].compute = compute;
  assert.equal(validateReportFill(fill).valid, false, "reject invalid fill " + JSON.stringify(compute));
}
console.log("PASS public lag/window grammar, trusted fill/print pipeline and completeness guards");
