import assert from "node:assert/strict";
import React from "react";
import fs from "node:fs";
import {renderToStaticMarkup} from "react-dom/server";
import ReportPrintPreview from "./ReportPrintPreview.jsx";
const actual=JSON.parse(fs.readFileSync("src/reporting/fixtures/ordinary-mcp-widgets-report-print.v1.json","utf8"));
const html=renderToStaticMarkup(<ReportPrintPreview reportPrint={actual}/>);
for (const text of ["alpha","beta","gamma","125.5","274.5","100"]) assert.ok(html.includes(text));
assert.ok(html.includes(`viewBox="0 0 ${actual.pageGeometry.width} ${actual.pageGeometry.height}"`));
assert.ok(html.includes("Canonical print preview"));
assert.ok(html.includes("Page 1"));
assert.ok(!html.includes("iframe"));
const copy=structuredClone(actual);
copy.pages[0].elements[0].text='<script>alert("x")</script>';
const escaped=renderToStaticMarkup(<ReportPrintPreview reportPrint={copy}/>);
assert.ok(escaped.includes("&lt;script&gt;"));assert.ok(!escaped.includes("<script>"));
for(const name of ["authored-landscape-report-print-fixture.v1.json","capacity-audience-landscape-report-print-fixture.v1.json"]){
 const fixture=JSON.parse(fs.readFileSync("src/reporting/fixtures/"+name,"utf8"));
 const print=fixture.reportPrint || fixture;
 const rendered=renderToStaticMarkup(<ReportPrintPreview reportPrint={print}/>);
 assert.ok(rendered.includes(`viewBox="0 0 ${print.pageGeometry.width} ${print.pageGeometry.height}"`));
 assert.equal((rendered.match(/<figure/g)||[]).length,print.pages.length);
}
console.log("actual canonical reportPrint and authored geometry/escaping SSR passed");

const unsupported=structuredClone(actual); unsupported.pages[0].elements[0].kind="futurePrintKind";
assert.ok(renderToStaticMarkup(<ReportPrintPreview reportPrint={unsupported}/>).includes("Unsupported or invalid canonical print page"));
