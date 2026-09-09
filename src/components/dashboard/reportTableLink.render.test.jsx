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
