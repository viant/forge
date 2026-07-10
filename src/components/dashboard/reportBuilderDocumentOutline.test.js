import assert from "node:assert/strict";

import {
  buildReportBuilderDocumentOutlineEntries,
  flattenReportBuilderDocumentOutlineEntries,
  isReportBuilderScopeRuntimeOnlyOutlineKind,
  resolveReportBuilderDocumentInsertionTarget,
  resolveReportBuilderPreferredSelectedEntryId,
  resolveReportBuilderSelectedDrillBindings,
  resolveReportBuilderSelectedInsertionGroupIds,
  shouldShowReportBuilderSelectedSemanticBinding,
} from "./reportBuilderDocumentOutline.js";

const outline = buildReportBuilderDocumentOutlineEntries({
  activeDataViewLabel: "Current data selection",
  authoredDatasetOptions: [
    { value: "primary", label: "Performance Cube" },
    { value: "forecast_cube", label: "Forecast Cube" },
  ],
  primaryDatasetLabel: "Metrics Ad Cube Report",
  primaryResultChildren: [
    {
      id: "primaryBuilder:chart",
      kind: "chartView",
      title: "Chart view",
      summary: "Line chart",
      actionLabel: "Edit chart",
      widthLabel: "Primary view",
    },
    {
      id: "primaryBuilder:table",
      kind: "tableView",
      title: "Table view",
      summary: "2 breakdowns • 2 measures",
      actionLabel: "Edit fields",
      widthLabel: "Primary view",
    },
  ],
  authoredDocumentBlocks: [
    {
      id: "narrativeIntro",
      kind: "markdownBlock",
      title: "Narrative",
      markdown: "## Narrative\nReader-facing context.",
    },
    {
      id: "detailTable",
      kind: "tableBlock",
      title: "Detail Table",
      datasetRef: "forecast_cube",
      columns: [
        { key: "channel", label: "Channel" },
        { key: "spend", label: "Spend" },
      ],
    },
    {
      id: "statusPills",
      kind: "badgesBlock",
      title: "Status Pills",
      items: [
        { label: "Setup", value: "Live", tone: "success" },
        { label: "Pacing", value: "Behind", tone: "warning" },
      ],
    },
  ],
  authoredDocumentLayout: {
    items: [
      { blockId: "primaryBuilder" },
      { blockId: "narrativeIntro", size: "half" },
      { blockId: "detailTable" },
      { blockId: "statusPills", size: "half" },
    ],
  },
  authoredDrillSummary: {
    hierarchies: [
      {
        id: "inventory_path",
        label: "Inventory Path",
        summary: "3 levels: Channel -> Publisher -> Site Type",
      },
    ],
  },
});

assert.equal(outline.length, 4);
assert.equal(outline[0].id, "primaryBuilder");
assert.equal(outline[0].children.length, 3);
assert.equal(outline[0].children[0].kind, "chartView");
assert.equal(outline[0].children[1].kind, "tableView");
assert.equal(outline[0].children[2].kind, "drillHierarchy");
assert.equal(outline[1].id, "narrativeIntro");
assert.equal(outline[1].children.length, 0);
assert.equal(outline[2].id, "detailTable");
assert.equal(outline[2].summary, "2 fields");
assert.equal(outline[2].datasetLabel, "Forecast Cube");
assert.equal(outline[2].children.length, 0);
assert.equal(outline[3].id, "statusPills");
assert.equal(outline[3].summary, "2 pills");
assert.equal(outline[3].children.length, 0);

const flattenedOutline = flattenReportBuilderDocumentOutlineEntries(outline);
assert.deepEqual(
  flattenedOutline.map((entry) => `${entry.depth}:${entry.id}`),
  [
    "0:primaryBuilder",
    "1:primaryBuilder:chart",
    "1:primaryBuilder:table",
    "1:primaryBuilder:drill:inventory_path",
    "0:narrativeIntro",
    "0:detailTable",
    "0:statusPills",
  ],
);
assert.equal(
  flattenedOutline.find((entry) => entry.id === "detailTable")?.datasetLabel,
  "Forecast Cube",
);

assert.deepEqual(
  resolveReportBuilderDocumentInsertionTarget(outline, "primaryBuilder"),
  {
    selectedEntryId: "primaryBuilder",
    selectedTitle: "Current data selection",
    insertionAfterId: "primaryBuilder",
    insertionAnchorTitle: "",
  },
);

assert.deepEqual(
  resolveReportBuilderDocumentInsertionTarget(outline, "primaryBuilder:table"),
  {
    selectedEntryId: "primaryBuilder:table",
    selectedTitle: "Table view",
    insertionAfterId: "primaryBuilder",
    insertionAnchorTitle: "",
  },
);

assert.deepEqual(
  resolveReportBuilderDocumentInsertionTarget(outline, "detailTable"),
  {
    selectedEntryId: "detailTable",
    selectedTitle: "Detail Table",
    insertionAfterId: "detailTable",
    insertionAnchorTitle: "Detail Table",
  },
);

assert.equal(
  resolveReportBuilderPreferredSelectedEntryId(outline, {
    currentSelectedEntryId: "primaryBuilder",
    preferChartView: true,
  }),
  "primaryBuilder:chart",
);

assert.equal(
  resolveReportBuilderPreferredSelectedEntryId(outline, {
    currentSelectedEntryId: "detailTable",
    preferChartView: true,
  }),
  "detailTable",
);

assert.equal(
  resolveReportBuilderPreferredSelectedEntryId(outline, {
    currentSelectedEntryId: "primaryBuilder",
    preferTableView: true,
  }),
  "primaryBuilder:table",
);

assert.equal(shouldShowReportBuilderSelectedSemanticBinding("primaryBuilder"), true);
assert.equal(shouldShowReportBuilderSelectedSemanticBinding("tableView"), true);
assert.equal(shouldShowReportBuilderSelectedSemanticBinding("tableBlock"), true);
assert.equal(shouldShowReportBuilderSelectedSemanticBinding("badgesBlock"), true);
assert.equal(shouldShowReportBuilderSelectedSemanticBinding("filterBarBlock"), true);
assert.equal(shouldShowReportBuilderSelectedSemanticBinding("refinementBarBlock"), true);
assert.equal(shouldShowReportBuilderSelectedSemanticBinding("drillPlaceholder"), true);
assert.equal(shouldShowReportBuilderSelectedSemanticBinding("markdownBlock"), false);

assert.deepEqual(resolveReportBuilderSelectedInsertionGroupIds("primaryBuilder"), ["document", "runtime"]);
assert.deepEqual(resolveReportBuilderSelectedInsertionGroupIds("chartView"), ["document", "runtime"]);
assert.deepEqual(resolveReportBuilderSelectedInsertionGroupIds("tableBlock"), ["document"]);
assert.deepEqual(resolveReportBuilderSelectedInsertionGroupIds("badgesBlock"), ["document"]);
assert.deepEqual(resolveReportBuilderSelectedInsertionGroupIds("markdownBlock"), ["document"]);
assert.deepEqual(resolveReportBuilderSelectedInsertionGroupIds("filterBarBlock"), ["runtime"]);
assert.deepEqual(resolveReportBuilderSelectedInsertionGroupIds("refinementBarBlock"), ["runtime"]);
assert.deepEqual(resolveReportBuilderSelectedInsertionGroupIds("drillHierarchy"), ["runtime"]);

assert.equal(isReportBuilderScopeRuntimeOnlyOutlineKind("filterBarBlock"), true);
assert.equal(isReportBuilderScopeRuntimeOnlyOutlineKind("refinementBarBlock"), true);
assert.equal(isReportBuilderScopeRuntimeOnlyOutlineKind("drillHierarchy"), true);
assert.equal(isReportBuilderScopeRuntimeOnlyOutlineKind("drillPlaceholder"), true);
assert.equal(isReportBuilderScopeRuntimeOnlyOutlineKind("primaryBuilder"), false);
assert.equal(isReportBuilderScopeRuntimeOnlyOutlineKind("chartView"), false);
assert.equal(isReportBuilderScopeRuntimeOnlyOutlineKind("tableBlock"), false);
assert.equal(isReportBuilderScopeRuntimeOnlyOutlineKind("markdownBlock"), false);

assert.deepEqual(
  resolveReportBuilderSelectedDrillBindings({
    selectedEntryId: "primaryBuilder:drill:inventory_path",
    hierarchies: [
      {
        id: "inventory_path",
        label: "Inventory Path",
        levels: [
          { field: "channel" },
          { field: "publisher" },
        ],
      },
    ],
    detailBindings: [
      { actionId: "detail_channel", fieldRef: "channel", actionLabel: "Channel detail" },
      { actionId: "detail_country", fieldRef: "country", actionLabel: "Country detail" },
    ],
  }),
  {
    hierarchy: {
      id: "inventory_path",
      label: "Inventory Path",
      levels: [
        { field: "channel" },
        { field: "publisher" },
      ],
    },
    bindings: [
      { actionId: "detail_channel", fieldRef: "channel", actionLabel: "Channel detail" },
    ],
    missingFieldRefs: ["publisher"],
  },
);

assert.deepEqual(
  resolveReportBuilderSelectedDrillBindings({
    selectedEntryId: "primaryBuilder:drill:new",
    hierarchies: [],
    detailBindings: [
      { actionId: "detail_channel", fieldRef: "channel", actionLabel: "Channel detail" },
    ],
  }),
  {
    hierarchy: null,
    bindings: [],
    missingFieldRefs: [],
  },
);

const placeholderOutline = buildReportBuilderDocumentOutlineEntries({
  activeDataViewLabel: "Current data selection",
  authoredDocumentBlocks: [
    {
      id: "detailTable",
      kind: "tableBlock",
      title: "Detail Table",
      columns: [{ key: "channel", label: "Channel" }],
    },
  ],
  authoredDocumentLayout: {
    items: [{ blockId: "primaryBuilder" }, { blockId: "detailTable" }],
  },
  authoredDrillSummary: {
    hierarchies: [],
  },
  currentBreakdownDrillHierarchy: {
    levels: [
      { label: "Channel" },
      { label: "Publisher" },
    ],
  },
});

assert.equal(placeholderOutline.length, 2);
assert.equal(placeholderOutline[0].id, "primaryBuilder");
assert.equal(placeholderOutline[0].children.length, 1);
assert.equal(placeholderOutline[0].children[0].kind, "drillPlaceholder");
assert.equal(
  placeholderOutline[0].children[0].summary,
  "Current path Channel -> Publisher",
);
assert.equal(placeholderOutline[1].children.length, 0);

assert.deepEqual(
  resolveReportBuilderDocumentInsertionTarget(placeholderOutline, "primaryBuilder:drill:new"),
  {
    selectedEntryId: "primaryBuilder:drill:new",
    selectedTitle: "Add drill branch",
    insertionAfterId: "primaryBuilder",
    insertionAnchorTitle: "",
  },
);

const fallbackLayoutOutline = buildReportBuilderDocumentOutlineEntries({
  activeDataViewLabel: "Current data selection",
  authoredDocumentBlocks: [
    {
      id: "narrativeIntro",
      kind: "markdownBlock",
      title: "Narrative",
      markdown: "## Narrative\nReader-facing context.",
    },
    {
      id: "detailTable",
      kind: "tableBlock",
      title: "Detail Table",
      columns: [{ key: "channel", label: "Channel" }],
    },
  ],
  authoredDocumentLayout: null,
  authoredDrillSummary: {
    hierarchies: [],
  },
});

assert.deepEqual(
  fallbackLayoutOutline.map((entry) => entry.id),
  ["narrativeIntro", "detailTable", "primaryBuilder"],
);
assert.equal(fallbackLayoutOutline[0].title, "Narrative");
assert.equal(fallbackLayoutOutline[1].title, "Detail Table");
assert.equal(fallbackLayoutOutline[2].title, "Current data selection");
assert.deepEqual(
  resolveReportBuilderDocumentInsertionTarget(fallbackLayoutOutline, ""),
  {
    selectedEntryId: "primaryBuilder",
    selectedTitle: "Current data selection",
    insertionAfterId: "primaryBuilder",
    insertionAnchorTitle: "",
  },
);

const authoredOnlyOutline = buildReportBuilderDocumentOutlineEntries({
  authoredDocumentBlocks: [
    {
      id: "narrativeIntro",
      kind: "markdownBlock",
      title: "Narrative",
      markdown: "## Narrative\nReader-facing context.",
    },
    {
      id: "detailTable",
      kind: "tableBlock",
      title: "Detail Table",
      columns: [{ key: "channel", label: "Channel" }],
    },
  ],
  authoredDocumentLayout: {
    items: [{ blockId: "narrativeIntro" }, { blockId: "detailTable" }],
  },
});

assert.deepEqual(
  authoredOnlyOutline.map((entry) => entry.id),
  ["narrativeIntro", "detailTable"],
);
assert.deepEqual(
  resolveReportBuilderDocumentInsertionTarget(authoredOnlyOutline, "missingSelection"),
  {
    selectedEntryId: "narrativeIntro",
    selectedTitle: "Narrative",
    insertionAfterId: "narrativeIntro",
    insertionAnchorTitle: "Narrative",
  },
);

console.log("reportBuilderDocumentOutline ✓ builds primary/result/authored tree entries and drill child nodes");
