import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WindowYamlEditor from "./WindowYamlEditor";
const source = "view:\n  content:\n    id: main\n    rowSpan: 2\n";
const html = renderToStaticMarkup(<WindowYamlEditor defaultValue={source} />);
const rows = [...html.matchAll(/<div\b[^>]*role="treeitem"[^>]*>/g)].map(
  (match) => match[0]
);
assert.ok(rows.length > 4);
assert.equal(
  rows.filter((row) => /tabindex="0"/.test(row)).length,
  1,
  "one tree tab stop"
);
assert.equal(
  rows.filter((row) => /aria-selected="true"/.test(row)).length,
  1,
  "one selected row"
);
assert.ok(rows.filter((row) => /aria-expanded="true"/.test(row)).length >= 3);
assert.ok(
  rows.every(
    (row) =>
      /aria-label=/.test(row) &&
      /aria-level=/.test(row) &&
      /aria-posinset=/.test(row) &&
      /aria-setsize=/.test(row)
  )
);
for (const row of rows) {
  const owned = row.match(/aria-owns="([^"]+)"/)?.[1];
  if (owned)
    assert.ok(
      html.includes(`id="${owned}" role="group"`),
      "expanded treeitem owns its actual child group"
    );
}
assert.match(html, /aria-label="Edit view: 1 attributes"/);
assert.match(html, /aria-label="Document root"[^>]*aria-selected="true"/);
assert.match(html, /class="fwe-tree-row  is-selected"/);
assert.ok(
  !html.match(/<button\b[^>]*class="fwe-(?:node|expander)"[^>]*tabindex="0"/)
);
console.log(
  "Rendered tree ARIA ownership, expanded state, roving tab stop, root selection, and named inspector navigation passed."
);
