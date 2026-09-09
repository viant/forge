import assert from "node:assert/strict";
import fs from "node:fs";
import {
  resolveReportBuilderDefinitionDataSourceRef,
  resolveReportBuilderDefinitionInitialization,
} from "./reportBuilderDefinitionInitialization.js";

assert.equal(resolveReportBuilderDefinitionDataSourceRef({}, {}), "");
assert.equal(resolveReportBuilderDefinitionDataSourceRef(
  { definitionDataSourceRef: "definition_rows" },
  {},
), "definition_rows");
assert.equal(resolveReportBuilderDefinitionDataSourceRef(
  { dashboard: { reportBuilder: { definitionDataSourceRef: "nested_definition" } } },
  {},
), "nested_definition");
assert.equal(resolveReportBuilderDefinitionDataSourceRef(
  { definitionDataSourceRef: "container_definition" },
  { definitionDataSourceRef: "config_definition" },
), "config_definition");

assert.deepEqual(resolveReportBuilderDefinitionInitialization(), {
  enabled: false, ready: true, status: "disabled", shouldFetch: false, message: "",
});
assert.deepEqual(resolveReportBuilderDefinitionInitialization({
  dataSourceRef: "definition_rows", contextAvailable: true,
}), {
  enabled: true, ready: false, status: "loading", shouldFetch: true, message: "Loading report definition…",
});
assert.equal(resolveReportBuilderDefinitionInitialization({
  dataSourceRef: "definition_rows", contextAvailable: true, loading: true,
}).shouldFetch, false);
assert.deepEqual(resolveReportBuilderDefinitionInitialization({
  dataSourceRef: "definition_rows", contextAvailable: true, definitionReady: true,
}), {
  enabled: true, ready: true, status: "ready", shouldFetch: false, message: "",
});
assert.equal(resolveReportBuilderDefinitionInitialization({
  dataSourceRef: "definition_rows", contextAvailable: true, error: new Error("private backend detail"),
}).message, "Report definition could not be loaded.");
assert.equal(resolveReportBuilderDefinitionInitialization({
  dataSourceRef: "definition_rows", contextAvailable: true, fetchRequested: true,
}).message, "No authorized report definition was returned.");
assert.equal(resolveReportBuilderDefinitionInitialization({
  dataSourceRef: "definition_rows", contextAvailable: true, rowCount: 1,
}).message, "Report definition identity could not be verified.");
assert.equal(resolveReportBuilderDefinitionInitialization({
  dataSourceRef: "definition_rows", contextAvailable: true, definitionError: "Definition identity mismatch.",
}).message, "Definition identity mismatch.");

const source = fs.readFileSync(new URL("./ReportBuilder.jsx", import.meta.url), "utf8");
assert.match(source, /definitionContext\?\.handlers\?\.dataSource\?\.fetchCollection/);
assert.match(source, /if \(!definitionInitialization\.ready\)[\s\S]*ReportBuilderDefinitionStatus/);
assert.match(source, /return <ReportBuilderReady container=\{sourceContainer\} context=\{context\} \/>/);
assert.ok(source.indexOf("definitionInitialization.ready") < source.indexOf("function ReportBuilderReady"), "definition gate must precede the existing compile/run component");

console.log("reportBuilder hosted definition initialization ✓ fetch-before-compile, loading, identity, empty, and error gates");
