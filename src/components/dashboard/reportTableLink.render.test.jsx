import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { renderDashboardTableCell } from "./dashboardVisualUtils.jsx";

const linkedHtml = renderToStaticMarkup(renderDashboardTableCell(
  "Creative launch",
  { creativeName: "Creative launch", creativeUrl: "https://example.test/creative/42" },
  { key: "creativeName", link: { kind: "external", urlField: "creativeUrl" } },
  "en-US",
  {},
));
assert.ok(linkedHtml.includes('href="https://example.test/creative/42"'));
assert.ok(linkedHtml.includes('target="_blank"'));
assert.ok(linkedHtml.includes('rel="noopener noreferrer"'));

const plainHtml = renderToStaticMarkup(renderDashboardTableCell(
  "Creative launch",
  { creativeName: "Creative launch" },
  { key: "creativeName", link: { kind: "external", urlField: "creativeUrl" } },
  "en-US",
  {},
));
assert.equal(plainHtml.includes("<a"), false);
assert.ok(plainHtml.includes("Creative launch"));

const templateColumn = {key:'name',link:{kind:'external',hrefTemplate:'https://example.invalid/records/{{recordId}}'}};
const templateHtml = renderToStaticMarkup(renderDashboardTableCell(
  'North & record', {recordId:'9007199254740993'}, templateColumn, 'en-US', {},
));
assert.ok(templateHtml.includes('href="https://example.invalid/records/9007199254740993"'));
assert.ok(templateHtml.includes('target="_blank"'));
assert.ok(templateHtml.includes('rel="noopener noreferrer"'));
assert.ok(templateHtml.includes('North &amp; record'));
for (const [row,column] of [
  [{},templateColumn],
  [{recordId:null},templateColumn],
  [{recordId:17},{...templateColumn,link:{kind:'external',hrefTemplate:'javascript:{{recordId}}'}}],
]) {
  const html = renderToStaticMarkup(renderDashboardTableCell('Inert record',row,column,'en-US',{}));
  assert.equal(html.includes('<a'),false,'invalid report template must not fall back to a generic table link');
  assert.ok(html.includes('Inert record'));
}

let entityOpen = null;
const entityElement = renderDashboardTableCell(
  "Creative launch",
  { creativeName: "Creative launch", creativeId: 42 },
  { key: "creativeName", link: { kind: "entityDetail", handler: "creative", idField: "creativeId" } },
  "en-US",
  { handlers: { entityDetail: { creative: (payload) => { entityOpen = payload; } } } },
);
entityElement.props.onClick({ preventDefault() {}, stopPropagation() {} });
assert.equal(entityOpen.entityId, 42);
