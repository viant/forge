import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ReportBuilderOptionControls from "./ReportBuilderOptionControls.jsx";

const definitions = [
  { name: "model", label: "Attribution model", type: "string", description: "Select a model.", values: [{ value: "linear", label: "Linear" }] },
  { name: "days", label: "Lookback days", type: "integer", description: "Whole days.", values: [] },
  { name: "organic", label: "Include organic", type: "boolean", description: "Include organic events.", values: [] },
];
const html = renderToStaticMarkup(<ReportBuilderOptionControls definitions={definitions} values={{ model: "linear", days: 30, organic: true }} />);

assert.match(html, /aria-labelledby="report-builder-options-heading"/);
assert.match(html, /for="report-builder-option-model"/);
assert.match(html, /aria-describedby="report-builder-option-model-description"/);
assert.match(html, /<select id="report-builder-option-model"/);
assert.match(html, /type="number" step="1"/);
assert.match(html, /type="checkbox"[^>]*checked=""/);
const modifiedHtml = renderToStaticMarkup(<ReportBuilderOptionControls definitions={definitions} values={{ model: "linear" }} activeCount={1} onReset={() => {}} />);
assert.match(modifiedHtml, /aria-label="Reset report options to defaults"/);

const css = fs.readFileSync(new URL("./Dashboard.css", import.meta.url), "utf8");
assert.match(css, /report-options-grid[\s\S]*repeat\(auto-fit, minmax\(180px, 1fr\)\)/, "desktop uses a fluid multi-column grid");
assert.match(css, /@media \(max-width: 900px\)[\s\S]*report-options-grid[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/, "tablet uses two columns");
assert.match(css, /@media \(max-width: 600px\)[\s\S]*report-options-grid[\s\S]*grid-template-columns: 1fr/, "phone uses one column");

console.log("ReportBuilderOptionControls ✓ accessible control markup for responsive report options");

const headerHtml = renderToStaticMarkup(<ReportBuilderOptionControls
  definitions={definitions.slice(0, 1)} values={{ model: "linear" }}
  presentation="header" headingId="pathways-options" activeCount={1} onReset={() => {}}
/>);
assert.match(headerHtml, /report-options--header/);
assert.match(headerHtml, /aria-labelledby="pathways-options"/);
assert.match(headerHtml, /Select a model/);
assert.match(headerHtml, /Reset report options to defaults/);
assert.doesNotMatch(headerHtml, /Lookback days|Include organic|Adjust server-published/);
