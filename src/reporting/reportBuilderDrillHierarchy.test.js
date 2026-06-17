import assert from "node:assert/strict";

import {
  buildReportBuilderDrillActions,
  findReportBuilderDrillHierarchyLevel,
  normalizeReportBuilderDrillHierarchies,
  normalizeReportBuilderDrillHierarchy,
  resolveReportBuilderDrillHierarchy,
} from "./reportBuilderDrillHierarchy.js";

const hierarchies = [
  {
    id: "inventory",
    levels: [
      { field: "channelV2", label: "Channel" },
      { field: "publisher", label: "Publisher" },
      { field: "siteType", label: "Site Type" },
    ],
  },
  {
    id: "location",
    label: "Location Ladder",
    levels: [
      { field: "region", label: "Region" },
      { field: "country", label: "Market" },
      { field: "metrocode", label: "Metro Area" },
    ],
  },
];

assert.deepEqual(normalizeReportBuilderDrillHierarchy({
  id: "inventory",
  levels: [
    { field: "channelV2", label: "Channel" },
    { field: "publisher", label: "Publisher" },
  ],
}), {
  id: "inventory",
  levels: [
    { id: "channelV2", field: "channelV2", label: "Channel" },
    { id: "publisher", field: "publisher", label: "Publisher" },
  ],
});

assert.deepEqual(normalizeReportBuilderDrillHierarchies(hierarchies), [
  {
    id: "inventory",
    levels: [
      { id: "channelV2", field: "channelV2", label: "Channel" },
      { id: "publisher", field: "publisher", label: "Publisher" },
      { id: "siteType", field: "siteType", label: "Site Type" },
    ],
  },
  {
    id: "location",
    label: "Location Ladder",
    levels: [
      { id: "region", field: "region", label: "Region" },
      { id: "country", field: "country", label: "Market" },
      { id: "metrocode", field: "metrocode", label: "Metro Area" },
    ],
  },
]);

assert.deepEqual(findReportBuilderDrillHierarchyLevel(hierarchies, "publisher"), {
  hierarchy: {
    id: "inventory",
    levels: [
      { id: "channelV2", field: "channelV2", label: "Channel" },
      { id: "publisher", field: "publisher", label: "Publisher" },
      { id: "siteType", field: "siteType", label: "Site Type" },
    ],
  },
  levelIndex: 1,
  level: { id: "publisher", field: "publisher", label: "Publisher" },
  nextLevel: { id: "siteType", field: "siteType", label: "Site Type" },
});

assert.deepEqual(resolveReportBuilderDrillHierarchy(hierarchies, "region"), {
  fieldRef: "region",
  levels: [
    { id: "region", field: "region", label: "Region" },
    { id: "country", field: "country", label: "Market" },
    { id: "metrocode", field: "metrocode", label: "Metro Area" },
  ],
});

assert.deepEqual(buildReportBuilderDrillActions(hierarchies, "channelV2"), [
  {
    id: "drill:channelV2:publisher",
    label: "Drill to Publisher",
    kind: "drill",
    nextFieldRef: "publisher",
  },
]);

assert.deepEqual(buildReportBuilderDrillActions(hierarchies, "country"), [
  {
    id: "drill:country:metrocode",
    label: "Drill to Metro Area",
    kind: "drill",
    nextFieldRef: "metrocode",
  },
]);

assert.equal(resolveReportBuilderDrillHierarchy(hierarchies, "missing"), null);
assert.deepEqual(buildReportBuilderDrillActions(hierarchies, "siteType"), []);

console.log("reportBuilderDrillHierarchy ✓ normalizes explicit drill ladders and resolves next drill actions");
