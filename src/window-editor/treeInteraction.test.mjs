import assert from "node:assert/strict";
import {
  buildWindowTree,
  childCount,
  treeBranchForId,
  indexTree,
  visibleTreeRows,
  ancestorsOf,
  revealTreePath,
  treeKeyAction,
  attributeDraftReducer,
  validateAttributeDraft,
} from "./treeInteraction";
import { pathKey, readDocument } from "./windowDocument";
const source =
  "# keep comment\nwindowKey: test\nview:\n  content:\n    id: main\n    rowSpan: 2\n    custom: untouched\n";
const parsed = readDocument(source);
const roots = buildWindowTree(parsed.value),
  index = indexTree(roots);
let expanded = new Set(["group:web", "variant:web:0"]);
let rows = visibleTreeRows(roots, expanded);
assert.equal(treeKeyAction("ArrowDown", rows[0].id, rows).focus, rows[1].id);
assert.equal(treeKeyAction("ArrowUp", rows[1].id, rows).focus, rows[0].id);
assert.equal(treeKeyAction("Home", rows.at(-1).id, rows).focus, rows[0].id);
assert.equal(treeKeyAction("End", rows[0].id, rows).focus, rows.at(-1).id);
assert.equal(
  treeKeyAction("ArrowLeft", "variant:web:0", rows).collapse,
  "variant:web:0"
);
assert.equal(
  treeKeyAction("ArrowRight", "group:web", rows).focus,
  "variant:web:0"
);
assert.equal(
  treeKeyAction("Enter", "variant:web:0", rows).activate,
  "variant:web:0"
);
assert.equal(
  treeKeyAction(" ", "variant:web:0", rows).activate,
  "variant:web:0"
);
const viewId = `variant:web:0:${pathKey(["view"])}`;
assert.equal(treeKeyAction("ArrowRight", viewId, rows).expand, viewId);
expanded.add(viewId);
rows = visibleTreeRows(roots, expanded);
const contentId = `variant:web:0:${pathKey(["view", "content"])}`;
assert.equal(treeKeyAction("ArrowRight", viewId, rows).focus, contentId);
assert.equal(treeKeyAction("ArrowLeft", contentId, rows).focus, viewId);
const selectedPath = ["view", "content"];
const reveal = revealTreePath(selectedPath, roots, "variant:web:0");
assert.equal(reveal.id, contentId);
assert.deepEqual(reveal.ancestors, ["group:web", "variant:web:0", viewId]);
// A nested inspector navigation after Collapse All reveals every ancestor and
// keeps the variant branch, rather than selecting an invisible duplicate path.
expanded = new Set(reveal.ancestors);
assert.ok(visibleTreeRows(roots, expanded).some((row) => row.id === reveal.id));
assert.deepEqual(ancestorsOf(contentId, index), reveal.ancestors);
const canonicalReveal = revealTreePath(selectedPath, roots, "document");
assert.equal(canonicalReveal.id, `document:${pathKey(selectedPath)}`);
assert.equal(revealTreePath([], roots, "document").id, "document-root");
const bundle = {
  format: "window.bundle",
  targets: [
    { target: { platform: "ios", formFactor: "tablet" }, variant: "tablet" },
  ],
  variants: {
    tablet: { window: parsed.value },
    unbound: { window: parsed.value },
  },
};
const bundledRoots = buildWindowTree(bundle);
const bundledReveal = revealTreePath(
  ["variants", "tablet", "window", "view", "content"],
  bundledRoots,
  "variant:ios:0"
);
assert.equal(bundledReveal.ancestors[0], "group:ios");
assert.ok(
  visibleTreeRows(bundledRoots, new Set(bundledReveal.ancestors)).some(
    (row) => row.id === bundledReveal.id
  )
);
assert.ok(revealTreePath(["variants", "unbound", "window"], bundledRoots));
// Draft lifetime is independent of current selection/mode, and keyed by full
// YAML path so equal attribute names in other nodes cannot overwrite it.
const draftPath = ["view", "content", "rowSpan"];
let drafts = attributeDraftReducer(
  {},
  {
    type: "edit",
    path: draftPath,
    ownerPath: selectedPath,
    draft: { value: "abc" },
  }
);
const invalid = validateAttributeDraft("abc", "integer");
assert.ok(invalid.error);
drafts = attributeDraftReducer(drafts, {
  type: "edit",
  path: draftPath,
  ownerPath: selectedPath,
  draft: { value: "abc", error: invalid.error },
});
const otherPath = ["view", "content", "containers", 0, "rowSpan"];
drafts = attributeDraftReducer(drafts, {
  type: "edit",
  path: otherPath,
  ownerPath: otherPath.slice(0, -1),
  draft: { value: "3" },
});
assert.equal(drafts[pathKey(draftPath)].value, "abc");
assert.equal(drafts[pathKey(draftPath)].error, "Enter a valid integer.");
assert.equal(
  parsed.value.view.content.rowSpan,
  2,
  "invalid draft never changes source value"
);
assert.equal(
  validateAttributeDraft("2.5", "integer").error,
  "Enter a valid integer."
);
assert.equal(
  validateAttributeDraft("", "number").error,
  "Enter a valid number."
);
assert.equal(validateAttributeDraft("4", "integer").value, 4);
assert.equal(validateAttributeDraft("2.5", "number").value, 2.5);
drafts = attributeDraftReducer(drafts, { type: "discard", path: draftPath });
assert.equal(drafts[pathKey(draftPath)], undefined);
assert.equal(drafts[pathKey(otherPath)].value, "3");
console.log(
  "Tree keyboard navigation, ancestor reveal, bundle branches, and path-owned numeric draft regressions passed."
);

// Dataset/model content remains attached, but collapsed branches have no eager
// descendants. Revelation visits only its ancestry and immediate siblings.
const rowsValue = Array.from({ length: 5000 }, (_, id) => ({ id, extension: { keep: true } }));
const lazyBundle = {
  format: "window.bundle", targets: [
    { target: {}, variant: "shared" },
    { target: { platform: "web" }, variant: "shared" },
    { target: { platform: "ios", formFactor: "phone" }, variant: "shared" },
  ],
  variants: { shared: { window: { view: { content: { id: "main" } } }, dataSources: { records: { backend: { rows: rowsValue } } } }, unbound: { window: { custom: true } } },
};
const lazyRoots = buildWindowTree(lazyBundle);
const initialIndex = indexTree(lazyRoots);
const datasetPaths = () => [...initialIndex.values()].filter((node) => node.path?.includes("dataSources"));
assert.equal(datasetPaths().length, 0);
assert.equal(lazyRoots[0].children.length, 0, "collapsed Document root does not duplicate variants");
assert.equal(childCount(lazyRoots[0]), 3, "collapsed nodes still expose correct expandability");
const defaultRows = visibleTreeRows(lazyRoots, new Set(["group:web", "variant:web:0"]), initialIndex);
assert.ok(defaultRows.some((node) => node.key === "dataSources"));
const collapsedDataSource = datasetPaths().find((node) => node.path.length === 3);
assert.equal(collapsedDataSource.children.length, 0, "large datasource dictionaries remain collapsed and unmaterialized");
const targetPath = ["variants", "shared", "dataSources", "records", "backend", "rows", 4999, "extension", "keep"];
const last = revealTreePath(targetPath, lazyRoots, "variant:web:0");
assert.ok(last);
assert.equal(indexTree(lazyRoots), initialIndex, "reveal reuses and extends the same index");
assert.ok(visibleTreeRows(lazyRoots, new Set(last.ancestors), initialIndex).some((node) => node.id === last.id));
assert.equal(initialIndex.get(last.id).value, true, "unknown dataset fields are reachable without stripping content");
const firstRowId = `variant:web:0:${pathKey(targetPath.slice(0, 6).concat(0))}`;
assert.equal(initialIndex.get(firstRowId).children.length, 0, "revealing the last row does not materialize unrelated row descendants");
assert.equal(lazyBundle.variants.shared.dataSources.records.backend.rows, rowsValue);
assert.equal(treeBranchForId(`variant:ios:0:${pathKey(targetPath)}`, lazyRoots), "variant:ios:0", "collapsed branch ownership survives a source refresh");
assert.ok(revealTreePath(["targets", 2, "target", "platform"], lazyRoots, "variant:ios:0"));
assert.ok(revealTreePath(["variants", "unbound", "window", "custom"], lazyRoots));
const cyclicValue = {}; cyclicValue.self = cyclicValue;
const cyclicRoots = buildWindowTree({ recursive: cyclicValue });
assert.ok(revealTreePath(["recursive", "self"], cyclicRoots));
assert.equal(revealTreePath(["recursive", "self", "self"], cyclicRoots), null, "cyclic aliases do not cause unbounded lazy expansion");
console.log("Lazy collapsed branches, complete dataset/unknown-field reveal, shared bindings, persistent index and cycle bounds passed.");
