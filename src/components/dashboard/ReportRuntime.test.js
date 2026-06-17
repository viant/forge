import assert from "node:assert/strict";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ReportRuntime, { RefinementBarBlock } from "./ReportRuntime.jsx";

const reportSpec = {
  title: "Semantic Runtime Report",
  parameters: {
    viewMode: "chart",
    groupBy: "",
    pageSize: 25,
    orderField: "eventDate",
    orderDir: "asc",
  },
  layoutIntent: {
    blockOrder: [],
    items: [],
  },
  blocks: [],
  datasets: [],
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://steward/performance/ad_delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
      {
        id: "channel",
        rawId: "channelV2",
        label: "Channel",
        governance: {
          status: "deprecated",
        },
      },
    ],
    selectedMeasures: [
      {
        id: "available_impressions",
        rawId: "avails",
        label: "Available Impressions",
        format: "compactNumber",
        governance: {
          status: "draft",
        },
      },
    ],
  },
};

const reportFill = {
  diagnostics: [
    {
      code: "semanticProviderDiagnostics",
      severity: "warning",
      blockId: "primaryChart",
      path: "reportDocument.blocks.primaryChart.targetRef",
      message: "Semantic provider rejected the current drill target mapping.",
      suggestedFix: "Update the authored target mapping or remove the missing parameter.",
    },
  ],
  datasets: [],
  blocks: [],
};

const html = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec,
    reportFill,
    title: "Runtime Preview",
    subtitle: "Compiled authored report runtime surface.",
  }),
);

assert.ok(html.includes("Runtime Preview"));
assert.ok(html.includes("Compiled authored report runtime surface."));
assert.ok(html.includes("Model Ad Delivery"));
assert.ok(html.includes("Entity Line Delivery"));
assert.ok(html.includes("Dimensions Channel"));
assert.ok(html.includes("Measures Available Impressions"));
assert.ok(html.includes("1 deprecated"));
assert.ok(html.includes("1 draft"));
assert.ok(html.includes("Runtime Diagnostics"));
assert.ok(html.includes("Semantic provider rejected the current drill target mapping."));
assert.ok(html.includes("Update the authored target mapping or remove the missing parameter."));
assert.ok(html.includes("semanticProviderDiagnostics"));
assert.ok(html.includes("Block primaryChart"));
assert.ok(html.includes("reportDocument.blocks.primaryChart.targetRef"));

const emptyRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Refinement Runtime Report",
      layoutIntent: {
        blockOrder: ["activeDrillPath"],
        items: [{ blockId: "activeDrillPath" }],
      },
      blocks: [
        {
          id: "activeDrillPath",
          kind: "refinementBarBlock",
          title: "Active Refinements",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "activeDrillPath",
          kind: "refinementBarBlock",
          content: {
            title: "Active Refinements",
            emptyLabel: "No active refinements",
            refinements: [],
          },
        },
      ],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(!emptyRuntimeHtml.includes("Active Refinements"));
assert.ok(!emptyRuntimeHtml.includes("No active refinements"));

const unsupportedRefinementHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Unsupported Runtime Report",
      layoutIntent: {
        blockOrder: ["primaryTable"],
        items: [{ blockId: "primaryTable" }],
      },
      blocks: [
        {
          id: "primaryTable",
          kind: "tableBlock",
          datasetRef: "primary",
          columns: [
            { key: "ageGroup", sourceKey: "ageGroup", displayKey: "ageGroup", label: "Age Group", kind: "dimension" },
          ],
        },
      ],
      datasets: [
        {
          id: "primary",
          request: {
            dimensions: {
              ageGroup: true,
            },
          },
        },
      ],
    },
    reportFill: {
      diagnostics: [
        {
          code: "runtimeRefinementUnsupported",
          severity: "warning",
          message: "Runtime refinement actions are unavailable for Age Group because no backend runtime filter mapping is declared.",
        },
      ],
      datasets: [
        {
          id: "primary",
          rows: [{ ageGroup: "18-24" }],
          provenance: {
            diagnostics: [],
          },
        },
      ],
      blocks: [
        {
          id: "primaryTable",
          kind: "tableBlock",
          datasetRef: "primary",
          content: {
            columns: [
              { key: "ageGroup", sourceKey: "ageGroup", displayKey: "ageGroup", label: "Age Group", kind: "dimension" },
            ],
            resolvedRows: [],
          },
        },
      ],
    },
  }),
);
assert.ok(!unsupportedRefinementHtml.includes("runtimeRefinementUnsupported"));
assert.ok(!unsupportedRefinementHtml.includes("Runtime refinement actions are unavailable for Age Group because no backend runtime filter mapping is declared."));

function collectReactElements(node, predicate, matches = []) {
  if (node == null || typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    return matches;
  }
  if (Array.isArray(node)) {
    node.forEach((entry) => {
      collectReactElements(entry, predicate, matches);
    });
    return matches;
  }
  if (!React.isValidElement(node)) {
    return matches;
  }
  if (predicate(node)) {
    matches.push(node);
  }
  collectReactElements(node.props?.children, predicate, matches);
  return matches;
}

const refinementBlock = {
  id: "activeDrillPath",
  kind: "refinementBarBlock",
  content: {
    title: "Active Drill Path",
    actionKinds: ["remove", "clearAll"],
    emptyLabel: "No active market drill path",
    refinements: [
      {
        id: "drill:country:reachRateTrend",
        op: "drill",
        field: "country",
        values: ["US"],
        sourceBlockId: "reachRateTrend",
        label: "Drill to Region = US",
      },
      {
        id: "keep:channelV2:reachRateTable",
        op: "keep",
        field: "channelV2",
        values: ["Display"],
        sourceBlockId: "reachRateTable",
        label: "Keep Channel = Display",
      },
    ],
  },
};

const removeCalls = [];
let clearCalls = 0;
let undoCalls = 0;
let redoCalls = 0;
const refinementTree = RefinementBarBlock({
  block: refinementBlock,
  runtimeHandlers: {
    removeRefinement(refinementId) {
      removeCalls.push(refinementId);
    },
    clearRefinements() {
      clearCalls += 1;
    },
    undoRefinements() {
      undoCalls += 1;
    },
    redoRefinements() {
      redoCalls += 1;
    },
    canUndoRefinements: true,
    canRedoRefinements: true,
  },
});
const buttons = collectReactElements(refinementTree, (element) => element.type === "button");

const removeDrillButton = buttons.find((button) => button.props?.["aria-label"] === "Remove refinement Drill to Region = US") || null;
assert.ok(removeDrillButton);
removeDrillButton.props.onClick();
assert.deepEqual(removeCalls, ["drill:country:reachRateTrend"]);

const removeKeepButton = buttons.find((button) => button.props?.["aria-label"] === "Remove refinement Keep Channel = Display") || null;
assert.ok(removeKeepButton);
removeKeepButton.props.onClick();
assert.deepEqual(removeCalls, [
  "drill:country:reachRateTrend",
  "keep:channelV2:reachRateTable",
]);

const clearAllButton = buttons.find((button) => button.props?.["aria-label"] === "Clear all refinements") || null;
assert.ok(clearAllButton);
clearAllButton.props.onClick();
assert.equal(clearCalls, 1);

const refinementHtml = renderToStaticMarkup(
  React.createElement(RefinementBarBlock, {
    block: refinementBlock,
    runtimeHandlers: {
      removeRefinement() {},
      clearRefinements() {},
    },
  }),
);
assert.ok(refinementHtml.includes("Drill to Region = US"));
assert.ok(refinementHtml.includes("Keep Channel = Display"));
assert.ok(refinementHtml.includes("Clear all"));
assert.ok(!refinementHtml.includes("Generic refinement trail compiled from the authored report contract."));
assert.ok(!refinementHtml.includes(">remove<"));
assert.ok(!refinementHtml.includes(">clearAll<"));

const emptyRefinementHtml = renderToStaticMarkup(
  React.createElement(RefinementBarBlock, {
    block: {
      id: "activeDrillPath",
      kind: "refinementBarBlock",
      content: {
        title: "Active Drill Path",
        actionKinds: ["remove", "clearAll"],
        emptyLabel: "No active market drill path",
        refinements: [],
      },
    },
    runtimeHandlers: {
      removeRefinement() {},
      clearRefinements() {},
    },
  }),
);
assert.equal(emptyRefinementHtml, "");

const fallbackEmptyRefinementHtml = renderToStaticMarkup(
  React.createElement(RefinementBarBlock, {
    block: {
      id: "activeDrillPath",
      kind: "refinementBarBlock",
      content: {
        refinements: [],
      },
    },
    runtimeHandlers: null,
  }),
);
assert.equal(fallbackEmptyRefinementHtml, "");

const fallbackActionTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      title: "Active Drill Path",
      emptyLabel: "No active market drill path",
      refinements: refinementBlock.content.refinements,
    },
  },
  runtimeHandlers: {
    removeRefinement() {},
    clearRefinements() {},
  },
});
const fallbackActionButtons = collectReactElements(fallbackActionTree, (element) => element.type === "button");
assert.equal(fallbackActionButtons.filter((button) => typeof button.props?.["aria-label"] === "string" && button.props["aria-label"].startsWith("Remove refinement ")).length, 2);
assert.equal(fallbackActionButtons.some((button) => button.props?.["aria-label"] === "Clear all refinements"), true);

const fallbackHistoryTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      title: "Active Drill Path",
      emptyLabel: "No active market drill path",
      refinements: refinementBlock.content.refinements,
    },
  },
  runtimeHandlers: {
    undoRefinements() {
      undoCalls += 1;
    },
    redoRefinements() {
      redoCalls += 1;
    },
    canUndoRefinements: true,
    canRedoRefinements: false,
  },
});
const fallbackHistoryButtons = collectReactElements(fallbackHistoryTree, (element) => element.type === "button");
const fallbackUndoButton = fallbackHistoryButtons.find((button) => button.props?.["aria-label"] === "Undo refinement changes") || null;
assert.ok(fallbackUndoButton);
assert.equal(fallbackUndoButton.props.disabled, false);
const fallbackRedoButton = fallbackHistoryButtons.find((button) => button.props?.["aria-label"] === "Redo refinement changes") || null;
assert.ok(fallbackRedoButton);
assert.equal(fallbackRedoButton.props.disabled, true);

const noHandlerTree = RefinementBarBlock({
  block: refinementBlock,
  runtimeHandlers: null,
});
const noHandlerButtons = collectReactElements(noHandlerTree, (element) => element.type === "button");
assert.equal(noHandlerButtons.length, 0);

const idlessRefinementTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      ...refinementBlock.content,
      refinements: [
        {
          op: "keep",
          field: "channelV2",
          values: ["Display"],
          label: "Keep Channel = Display",
        },
      ],
    },
  },
  runtimeHandlers: {
    removeRefinement() {},
    clearRefinements() {},
  },
});
const idlessButtons = collectReactElements(idlessRefinementTree, (element) => element.type === "button");
assert.equal(idlessButtons.filter((button) => typeof button.props?.["aria-label"] === "string" && button.props["aria-label"].startsWith("Remove refinement ")).length, 0);
assert.equal(idlessButtons.some((button) => button.props?.["aria-label"] === "Clear all refinements"), true);

const clearOnlyTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      ...refinementBlock.content,
      actionKinds: ["clearAll"],
    },
  },
  runtimeHandlers: {
    removeRefinement() {},
    clearRefinements() {},
  },
});
const clearOnlyButtons = collectReactElements(clearOnlyTree, (element) => element.type === "button");
assert.equal(clearOnlyButtons.filter((button) => typeof button.props?.["aria-label"] === "string" && button.props["aria-label"].startsWith("Remove refinement ")).length, 0);
assert.equal(clearOnlyButtons.some((button) => button.props?.["aria-label"] === "Clear all refinements"), true);

const removeOnlyTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      ...refinementBlock.content,
      actionKinds: ["remove"],
    },
  },
  runtimeHandlers: {
    removeRefinement() {},
    clearRefinements() {},
  },
});
const removeOnlyButtons = collectReactElements(removeOnlyTree, (element) => element.type === "button");
assert.equal(removeOnlyButtons.filter((button) => typeof button.props?.["aria-label"] === "string" && button.props["aria-label"].startsWith("Remove refinement ")).length, 2);
assert.equal(removeOnlyButtons.some((button) => button.props?.["aria-label"] === "Clear all refinements"), false);

const disabledActionsTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      ...refinementBlock.content,
      actionKinds: [],
    },
  },
  runtimeHandlers: {
    removeRefinement() {},
    clearRefinements() {},
    undoRefinements() {},
    redoRefinements() {},
    canUndoRefinements: true,
    canRedoRefinements: true,
  },
});
const disabledActionButtons = collectReactElements(disabledActionsTree, (element) => element.type === "button");
assert.equal(disabledActionButtons.length, 0);

const historyActionTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      ...refinementBlock.content,
      actionKinds: ["undo", "redo"],
    },
  },
  runtimeHandlers: {
    undoRefinements() {
      undoCalls += 1;
    },
    redoRefinements() {
      redoCalls += 1;
    },
    canUndoRefinements: true,
    canRedoRefinements: false,
  },
});
const historyButtons = collectReactElements(historyActionTree, (element) => element.type === "button");
const undoButton = historyButtons.find((button) => button.props?.["aria-label"] === "Undo refinement changes") || null;
assert.ok(undoButton);
assert.equal(undoButton.props.disabled, false);
undoButton.props.onClick();
assert.equal(undoCalls, 1);

const redoButton = historyButtons.find((button) => button.props?.["aria-label"] === "Redo refinement changes") || null;
assert.ok(redoButton);
assert.equal(redoButton.props.disabled, true);
redoButton.props.onClick();
assert.equal(redoCalls, 0);

console.log("ReportRuntime ✓ renders semantic binding chips and actionable runtime diagnostics");
