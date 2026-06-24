import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-seeded-capacity-template-export-geometry.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 40);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndexes(predicate) {
  return scenario.steps.reduce((matches, step, index) => {
    if (predicate(step, index)) {
      matches.push(index);
    }
    return matches;
  }, []);
}

assert.equal(
  expressions.some((expression) => expression.includes("__artifactDownloadCapture")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("List ReportDocuments response: 7 entries")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && String(step.selector || "").includes("Document version")),
  true,
);

const expectedEntries = [
  {
    reportId: "capacityQ3",
    selectedTitle: "Capacity Q3",
    templateLabel: "Capacity Inventory Brief",
    exportTitle: "Capacity Q3",
    bookmarkId: "bookmark.primaryTable",
    expectedFilename: "Capacity Q3-savedPayload-pdf-export-request.json",
  },
  {
    reportId: "capacityLocationQ3",
    selectedTitle: "Capacity Location Q3",
    templateLabel: "Capacity Location Brief",
    exportTitle: "Capacity Location Q3",
    bookmarkId: "bookmark.primaryTable",
    expectedFilename: "Capacity Location Q3-savedPayload-pdf-export-request.json",
  },
  {
    reportId: "capacityInventoryTopChannelsQ3",
    selectedTitle: "Capacity Inventory Top Channels Q3",
    templateLabel: "Capacity Inventory Brief",
    exportTitle: "Capacity Inventory Top Channels Q3",
    bookmarkId: "bookmark.primaryChart",
    expectedFilename: "Capacity Inventory Top Channels Q3-savedPayload-pdf-export-request.json",
  },
  {
    reportId: "capacityLocationsTopMarketsQ3",
    selectedTitle: "Capacity Locations Top Markets Q3",
    templateLabel: "Capacity Location Brief",
    exportTitle: "Capacity Locations Top Markets Q3",
    bookmarkId: "bookmark.primaryChart",
    expectedFilename: "Capacity Locations Top Markets Q3-savedPayload-pdf-export-request.json",
  },
];

for (const entry of expectedEntries) {
  const selectIndex = scenario.steps.findIndex((step) => step?.type === "selectSelector" && step?.value === entry.reportId);
  const nextSelectIndex = scenario.steps.findIndex((step, index) => index > selectIndex && step?.type === "selectSelector");
  const windowEnd = nextSelectIndex === -1 ? scenario.steps.length : nextSelectIndex;
  const entryWindow = scenario.steps.slice(selectIndex, windowEnd);
  const entryExpressions = entryWindow
    .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
    .map((step) => String(step.expression || ""));

  assert.notEqual(selectIndex, -1);
  assert.equal(
    entryWindow.some((step) => step?.type === "selectSelector" && step?.value === entry.reportId),
    true,
  );
  assert.equal(
    entryWindow.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes(`Selected entry: ${entry.selectedTitle}`)),
    true,
  );
  assert.equal(
    entryExpressions.some((expression) => expression.includes(`Selected entry: ${entry.selectedTitle}`) && expression.includes(`Template: ${entry.templateLabel}`)),
    true,
  );
  assert.equal(
    entryWindow.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes(`"title": "${entry.exportTitle}"`)),
    true,
  );
  assert.equal(
    entryWindow.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes(`"id": "${entry.bookmarkId}"`)),
    true,
  );
  assert.equal(
    entryExpressions.some((expression) => expression.includes(entry.expectedFilename)),
    true,
  );
  assert.equal(
    entryExpressions.some((expression) => expression.includes(`\\\"title\\\": \\\"${entry.exportTitle}\\\"`) && expression.includes(`\\\"id\\\": \\\"${entry.bookmarkId}\\\"`) && expression.includes('"width": 792') && expression.includes('"height": 612')),
    true,
  );
  assert.equal(
    entryExpressions.some((expression) => expression.includes("Selected list entry export button not found.")),
    true,
  );
  assert.equal(
    entryExpressions.some((expression) => expression.includes("Download export request button not found.")),
    true,
  );
  assert.equal(
    entryExpressions.some((expression) => expression.includes("Hide export request button not found.")),
    true,
  );
}

assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("seeded-capacity-template-export-geometry")),
  true,
);

const selectedEntryIndexes = expectedEntries.map((entry) => findStepIndexes(
  (step) => step?.type === "waitForDomContains" && String(step?.text || "").includes(`Selected entry: ${entry.selectedTitle}`),
)[0]);
const inspectIndexes = findStepIndexes((step) => step?.type === "eval" && String(step?.expression || "").includes("Selected list entry export button not found."));
const downloadIndexes = findStepIndexes((step) => step?.type === "eval" && String(step?.expression || "").includes("Download export request button not found."));
const hideIndexes = findStepIndexes((step) => step?.type === "eval" && String(step?.expression || "").includes("Hide export request button not found."));

assert.equal(selectedEntryIndexes.length, 4);
assert.equal(inspectIndexes.length, 4);
assert.equal(downloadIndexes.length, 4);
assert.equal(hideIndexes.length, 4);

for (const index of selectedEntryIndexes) {
  assert.notEqual(index, undefined);
}

for (let i = 1; i < selectedEntryIndexes.length; i += 1) {
  assert.equal(selectedEntryIndexes[i - 1] < selectedEntryIndexes[i], true);
  assert.equal(inspectIndexes[i - 1] < inspectIndexes[i], true);
  assert.equal(downloadIndexes[i - 1] < downloadIndexes[i], true);
  assert.equal(hideIndexes[i - 1] < hideIndexes[i], true);
}

for (let i = 0; i < selectedEntryIndexes.length; i += 1) {
  assert.equal(selectedEntryIndexes[i] < inspectIndexes[i], true);
  assert.equal(inspectIndexes[i] < downloadIndexes[i], true);
  assert.equal(downloadIndexes[i] < hideIndexes[i], true);
}

console.log("report-builder-preview-seeded-capacity-template-export-geometry-scenario-assets ✓ seeded list-entry export geometry covers inventory/location ladder and chart-first entries with inspect/download/hide flow");
