import assert from "node:assert/strict";

import { normalizeReportTableLink, resolveReportTableLink } from "./reportTableLink.js";

assert.deepEqual(normalizeReportTableLink({ kind: "external", urlField: "creativeUrl" }), {
  kind: "external",
  urlField: "creativeUrl",
});
assert.equal(normalizeReportTableLink({ kind: "external", hrefTemplate: "javascript:alert(1)" }), null);
assert.equal(normalizeReportTableLink({ kind: "entityDetail", handler: "creative" }), null);

assert.deepEqual(resolveReportTableLink({
  row: { creative: "Launch", creativeUrl: "https://example.test/creative/42" },
  column: { link: { kind: "external", urlField: "creativeUrl" } },
  value: "Launch",
}), {
  kind: "external",
  href: "https://example.test/creative/42",
  text: "Launch",
  target: "_blank",
  rel: "noopener noreferrer",
  title: "Launch",
});
assert.equal(resolveReportTableLink({
  row: { creative: "Launch" },
  column: { link: { kind: "external", urlField: "creativeUrl" } },
  value: "Launch",
}), null);
assert.equal(resolveReportTableLink({
  row: { creative: "Launch", creativeUrl: "javascript:alert(1)" },
  column: { link: { kind: "external", urlField: "creativeUrl" } },
  value: "Launch",
}), null);

const openCreative = () => {};
assert.deepEqual(resolveReportTableLink({
  row: { creative: "Launch", creativeId: 42 },
  column: { link: { kind: "entityDetail", handler: "creative", idField: "creativeId" } },
  value: "Launch",
  entityDetailHandlers: { creative: openCreative },
}), {
  kind: "entityDetail",
  handler: openCreative,
  handlerName: "creative",
  entityId: 42,
  text: "Launch",
  title: "Launch",
});
assert.equal(resolveReportTableLink({
  row: { creative: "Launch", creativeId: 42 },
  column: { link: { kind: "entityDetail", handler: "unknown", idField: "creativeId" } },
  value: "Launch",
  entityDetailHandlers: { creative: openCreative },
}), null);
