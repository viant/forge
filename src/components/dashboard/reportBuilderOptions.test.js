import assert from "node:assert/strict";
import {applyReportBuilderStateHook} from "./reportBuilderHooks.js";

import {
  partitionReportBuilderOptions,
  buildReportBuilderFilterToolbarModel,
  countModifiedReportBuilderOptions,
  normalizeReportBuilderOptionDefinitions,
  resolveEffectiveReportBuilderOptions,
  updateReportBuilderOptionValue,
} from "./reportBuilderOptions.js";
import {
  buildReportBuilderDefaultState,
  buildReportBuilderRequest,
  buildReportBuilderSettingsHash,
  mergeReportBuilderState,
  sanitizeReportBuilderState,
} from "./reportBuilderUtils.js";
import { applyReportBuilderRuntimeFieldCatalog } from "./reportBuilderRuntimeFieldCatalog.js";
import {
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
} from "./reportBuilderRuntimePreview.js";

const fieldCatalog = {
  columns: [
    { name: "day", role: "dimension", type: "date" },
    { name: "count", role: "measure", type: "integer" },
  ],
  defaultDimensions: ["day"],
  defaultMeasures: ["count"],
  options: [
    { name: "calculationMode", label: "Calculation mode", type: "string", default: "linear", values: [
      { value: "linear", label: "Linear" },
      { value: "weighted", label: "Weighted" },
    ], description: "Changes the calculation method." },
    { name: "lookbackDays", label: "Lookback", type: "integer", default: 30, values: [7, 30, 90] },
    { name: "includeArchived", label: "Include archived", type: "boolean", default: false, values: [true, false] },
  ],
};

const config = applyReportBuilderRuntimeFieldCatalog({
  runtimeFieldCatalog: { enabled: true },
  dataSourceRef: "summary_rows",
  result: { defaultMode: "table", viewModes: ["table"] },
  dataSources: [{
    id: "summary",
    dataSourceRef: "summary_rows_envelope",
    request: { dimensions: {}, measures: {}, filters: {}, limit: 1, offset: 0 },
    scope: { mode: "inherit" },
  }],
}, { reportDefinition: { fieldCatalog } });

assert.deepEqual(config.reportOptions.map((entry) => entry.name), ["calculationMode", "lookbackDays", "includeArchived"]);

const defaults = buildReportBuilderDefaultState(config);
assert.deepEqual(defaults.reportOptions, { calculationMode: "linear", lookbackDays: 30, includeArchived: false });
const defaultRequest = buildReportBuilderRequest(config, defaults);
assert.deepEqual(defaultRequest.options, defaults.reportOptions);

const changedOptions = updateReportBuilderOptionValue(config.reportOptions, defaults.reportOptions, "calculationMode", "weighted");
assert.equal(countModifiedReportBuilderOptions(config.reportOptions, defaults.reportOptions), 0);
assert.equal(countModifiedReportBuilderOptions(config.reportOptions, changedOptions), 1);
assert.deepEqual(buildReportBuilderFilterToolbarModel({
  optionDefinitions: config.reportOptions,
  optionValues: changedOptions,
}), { visible: true, activeNonDefaultCount: 1 });
assert.deepEqual(buildReportBuilderFilterToolbarModel({ allowedFilterCount: 2 }), { visible: true, activeNonDefaultCount: 0 });
const changedState = mergeReportBuilderState(config, { ...defaults, reportOptions: changedOptions });
const changedRequest = buildReportBuilderRequest(config, changedState);
assert.equal(changedRequest.options.calculationMode, "weighted");
assert.notEqual(JSON.stringify(defaultRequest), JSON.stringify(changedRequest), "option changes must separate datasource/cache request identity");
assert.notEqual(buildReportBuilderSettingsHash(defaults), buildReportBuilderSettingsHash(changedState));

const repaired = sanitizeReportBuilderState(config, {
  ...changedState,
  reportOptions: { calculationMode: "invented", lookbackDays: 12, includeArchived: "no" },
});
assert.deepEqual(repaired.reportOptions, defaults.reportOptions, "invalid persisted values fall back to registry defaults");
assert.deepEqual(resolveEffectiveReportBuilderOptions(config.reportOptions, { unknown: "discarded" }), defaults.reportOptions);

const legacyConfig = applyReportBuilderRuntimeFieldCatalog({ runtimeFieldCatalog: { enabled: true } }, {
  FieldCatalog: { ...fieldCatalog, options: undefined },
});
const legacyState = buildReportBuilderDefaultState(legacyConfig);
assert.equal(Object.prototype.hasOwnProperty.call(legacyState, "reportOptions"), false);
assert.equal(Object.prototype.hasOwnProperty.call(buildReportBuilderRequest(legacyConfig, legacyState), "options"), false);

const stateWithDocument = {
  ...changedState,
  reportDocumentTitle: "Option report",
  reportDocumentBlocks: [{ id: "summaryTable", kind: "tableBlock", datasetRef: "summary", columns: [{ key: "count", label: "Count" }] }],
  reportDocumentLayout: { type: "stack", items: [{ blockId: "summaryTable" }] },
};
const runtimeModel = buildReportBuilderRuntimePreviewModel({
  container: { id: "optionReport", stateKey: "optionReport", dataSourceRef: "summary_rows" },
  config,
  state: stateWithDocument,
  includePrimaryBlocks: true,
});
assert.deepEqual(runtimeModel.reportSpec.datasets.find((entry) => entry.id === "primary")?.request?.options, changedOptions);
assert.deepEqual(runtimeModel.reportSpec.datasets.find((entry) => entry.id === "summary")?.request?.options, changedOptions, "backend refetch datasets inherit effective options");
assert.deepEqual(runtimeModel.document.blocks.find((entry) => entry.kind === "reportBuilderBlock")?.state?.reportOptions, changedOptions, "saved report state retains effective options");
const runtimePreview = buildReportBuilderRuntimePreview({ model: runtimeModel, rows: [{ day: "2026-08-01", count: 7 }], datasetPayloads: {summary: {rows: [{count:7}]}}, hasMore: false });
assert.deepEqual(runtimePreview.exportRequest?.reportSpec?.datasets?.find((entry) => entry.id === "primary")?.request?.options, changedOptions, "export request retains effective options");

console.log("reportBuilderOptions ✓ defaults, validation, refresh identity, persistence, backend refetch, and compatibility");

const contextual = normalizeReportBuilderOptionDefinitions([{
  name: "exposurePerspective", label: "First vs. Last Exposure", type: "string",
  default: "Last", values: ["First", "Last"],
  presentation: { anchorBlockId: " mtaExposureComparison ", placement: "header", left: 10 },
}]);
assert.deepEqual(contextual[0].presentation, { anchorBlockId: "mtaExposureComparison", placement: "header" });
assert.deepEqual(normalizeReportBuilderOptionDefinitions(contextual), contextual);
for (const presentation of [{ placement: "header" }, { anchorBlockId: "x", placement: "floating" }, { anchorBlockId: 42, placement: "header" }]) {
  const [option] = normalizeReportBuilderOptionDefinitions([{ ...contextual[0], presentation }]);
  assert.equal(option.presentation, undefined);
  assert.equal(option.default, "Last");
}
assert.deepEqual(partitionReportBuilderOptions(contextual).rail, contextual, "missing, hidden, unsupported or not-yet-mounted headers fall back to rail");
assert.deepEqual(partitionReportBuilderOptions(contextual, { mtaExposureComparison: 1 }).rail, []);
assert.deepEqual(partitionReportBuilderOptions(contextual, { mtaExposureComparison: 0 }).rail, contextual, "unmounted headers restore rail controls");
const phone = partitionReportBuilderOptions(contextual, { mtaExposureComparison: 1 }, true);
assert.deepEqual(phone.rail, contextual);
assert.equal(phone.headers.size, 0);
assert.deepEqual(resolveEffectiveReportBuilderOptions(contextual, { exposurePerspective: "First" }), { exposurePerspective: "First" });

assert.deepEqual(runtimePreview.exportRequest.metadata.reportOptions, config.reportOptions);

// A producer-declared identifier can be an option in one report and a filter in another.
const declared = normalizeReportBuilderOptionDefinitions([{name:"accountId", label:"Account", type:"integer", default:7, values:[7,9]}]);
assert.equal(declared.length,1);
assert.deepEqual(resolveEffectiveReportBuilderOptions(declared, {accountId:9,undeclared:1}),{accountId:9});

const scopedOptions = {
  measures: [{id:"count",paramPath:"measures.count",default:true}],
  reportOptions: declared,
  predicates: [{id:"accountId", pinned:true, multiple:true, paramPath:"filters.accountId", prefill:{path:"accountId"}}],
};
const scopedState = applyReportBuilderStateHook(null, scopedOptions, buildReportBuilderDefaultState(scopedOptions), {prefill:{accountId:[23]}});
const scopedRequest = buildReportBuilderRequest(scopedOptions, scopedState);
assert.deepEqual(scopedRequest.filters.accountId,[23]);
assert.equal(scopedRequest.options.accountId,7);
