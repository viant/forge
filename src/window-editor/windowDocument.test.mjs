import assert from "node:assert/strict";
import {
  readDocument,
  mutateDocument,
  removeDocumentNode,
  resolveSchema,
  schemaAtPath,
  canonicalSchema,
  targetGroups,
  treeNodes,
  detectIndent,
} from "./windowDocument.js";
const source =
  "# window author comment\nwindowKey: demo # key comment\nactions:\n  code: ./scripts/demo.js\nview:\n  content:\n    id: main\n    className: ./style/demo.css\n    containers:\n      - id: first\n      - id: second\n    extension:\n      unusual: true\n    items:\n      - name: title\n        required: false\n";
let parsed = readDocument(source);
assert.deepEqual(parsed.errors, []);
const changed = mutateDocument(
  parsed.document,
  ["view", "content", "id"],
  "updated"
);
assert.match(changed, /# window author comment/);
assert.match(changed, /# key comment/);
assert.match(changed, /\.\/scripts\/demo.js/);
assert.match(changed, /\.\/style\/demo.css/);
parsed = readDocument(changed);
assert.equal(parsed.value.view.content.extension.unusual, true);
assert.deepEqual(
  parsed.value.view.content.containers.map((v) => v.id),
  ["first", "second"]
);
parsed = readDocument(
  mutateDocument(
    parsed.document,
    ["view", "content", "items", 0, "required"],
    true
  )
);
assert.equal(parsed.value.view.content.items[0].required, true);
parsed = readDocument(
  mutateDocument(parsed.document, ["view", "content", "containers", 2], {
    id: "third",
  })
);
assert.deepEqual(
  parsed.value.view.content.containers.map((v) => v.id),
  ["first", "second", "third"]
);
parsed = readDocument(
  removeDocumentNode(parsed.document, ["view", "content", "containers", 1])
);
assert.deepEqual(
  parsed.value.view.content.containers.map((v) => v.id),
  ["first", "third"]
);
const contentSchema = schemaAtPath(["view", "content"], parsed.value);
assert.equal(contentSchema.properties.id.type, "string");
assert.ok(
  contentSchema.properties.dataSourceRef,
  "embedded Binding properties remain available"
);
for (const field of [
  "items",
  "containers",
  "tabs",
  "schemaBasedForm",
  "scheduleEditor",
  "permissionBoundary",
  "ruleEditor",
])
  assert.ok(contentSchema.properties[field], field);
assert.equal(
  schemaAtPath(["view", "content", "containers", 0], parsed.value).properties.id
    .type,
  "string"
);
assert.equal(
  schemaAtPath(["dataSource", "records"], {}).properties.cardinality.type,
  "string"
);
assert.equal(schemaAtPath(["view", "content", "ruleEditor"], {}).properties.field.type, "string");
assert.equal(schemaAtPath(["view", "content", "chart"], {}).properties.barSize.type, "number");
assert.equal(schemaAtPath(["view", "content", "chart"], {}).properties.showLegend.type, "boolean");
assert.equal(schemaAtPath(["dataSource", "records"], {}).properties.selectionPreserveAcrossPages.type, "boolean");
assert.equal(schemaAtPath(["view", "content", "wizard", "steps", 0], {}).properties.externalAdvance.type, "boolean");
assert.equal(schemaAtPath(["view", "content", "wizard", "steps", 0], {}).properties.terminal.type, "boolean");
assert.ok(resolveSchema(canonicalSchema).properties.resourceModels);
assert.ok(readDocument("view: [unterminated").errors.length);
assert.deepEqual(readDocument(changed).errors, []);
const bundle = {
  schemaVersion: 2,
  format: "window.bundle",
  targets: [
    { target: { platform: "ios", formFactor: "tablet" }, variant: "tablet" },
  ],
  variants: { tablet: { window: parsed.value } },
};
assert.equal(targetGroups(bundle)[1].children[0].label, "Tablet");
assert.deepEqual(targetGroups(bundle)[1].children[0].path, ["variants", "tablet"]);
assert.equal(
  schemaAtPath(["variants", "tablet", "window", "view", "content"], bundle)
    .properties.id.type,
  "string"
);

const alias = readDocument(
  "source: &shared\n  value: original # anchor comment\ncopy: *shared\n"
);
const aliasEdit = mutateDocument(alias.document, ["copy", "value"], "edited");
assert.match(aliasEdit, /&shared/);
assert.match(aliasEdit, /\*shared/);
assert.match(aliasEdit, /# anchor comment/);
assert.equal(readDocument(aliasEdit).value.source.value, "edited");
assert.equal(readDocument(aliasEdit).value.copy.value, "edited");
assert.ok(treeNodes(readDocument("recursive: &r {self: *r}").value).length);
assert.equal(
  schemaAtPath(["resource", "providerIdentity"], {}).type,
  "string",
  "imported resource schema is resolved"
);
assert.ok(canonicalSchema["x-forge-provenance"].sha256["model.go"]);

assert.ok(
  readDocument(removeDocumentNode(alias.document, ["source"])).errors.length,
  "removing a used anchor preserves an editable diagnostic draft"
);
console.log(
  "Window editor round trips, model coverage, bundle paths, comments, ordering, custom fields and invalid-source recovery passed."
);

const fourSpace = "# authored\nview:\n    content:\n        id: original # keep\n        title: " + "A long description without unwanted wrapping. ".repeat(8).trim() + "\n        containers:\n            - id: child\n              custom: true\n";
const fourEdited = mutateDocument(readDocument(fourSpace).document, ["view", "content", "id"], "edited");
assert.match(fourEdited, /^    content:/m);
assert.match(fourEdited, /^        id: edited # keep/m);
assert.match(fourEdited, /^        title: A long description.*wrapping\.$/m);
assert.equal(fourEdited.split("\n").length, fourSpace.split("\n").length);
const removed = removeDocumentNode(readDocument(fourEdited).document, ["view", "content", "id"]);
assert.match(removed, /^    content:/m);
assert.match(removed, /^        title: A long description/m);
console.log("Four-space formatting, long plain scalar and removal preservation passed.");

// At least 200,000 indented rows exceed the old Math.min(...widths) argument limit.
const hugeFormattedSource = "records:\n" + "    - value: synthetic\n".repeat(200_000) + "  extension: preserved\n";
assert.equal(detectIndent(hugeFormattedSource), 2);
assert.equal(detectIndent("root: value\n"), 2);
assert.equal(detectIndent("root:\n    child: value\n"), 4);
const cyclic = readDocument("# recursive authored source\nroot: &recursive\n  title: original\n  self: *recursive\ncopy: *recursive\n");
assert.deepEqual(cyclic.errors, []);
assert.equal(treeNodes(cyclic.value).length, 2);
const cyclicEdit = mutateDocument(cyclic.document, ["copy", "title"], "edited");
assert.match(cyclicEdit, /# recursive authored source/);
assert.match(cyclicEdit, /&recursive/);
assert.equal(readDocument(cyclicEdit).value.root.self.title, "edited");
console.log("Large formatted source indentation and recursive alias preservation passed.");
