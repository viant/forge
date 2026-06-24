import assert from "node:assert/strict";

import {
  hasReportRuntimeDrillMetadata,
  resolveReportRuntimeDrillMetadataProvider,
} from "./reportRuntimeDrillProvider.js";

const reportSpec = {
  kind: "reportSpec",
  drillMetadata: {
    hierarchies: [
      {
        id: "inventory",
        levels: [
          { field: "channelV2", label: "Channel" },
          { field: "publisher", label: "Publisher" },
        ],
      },
    ],
    fieldActions: [
      {
        fieldRef: "eventDate",
        actions: [
          { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://demo/date-detail" },
        ],
      },
    ],
    detailTargets: [
      {
        targetRef: "target://demo/date-detail",
        navigationMode: "hostRoute",
        parameters: {
          eventDate: "$value",
        },
      },
    ],
  },
};

assert.equal(hasReportRuntimeDrillMetadata(reportSpec), true);
assert.equal(hasReportRuntimeDrillMetadata({ kind: "reportSpec" }), false);

const explicitProvider = {
  async listAvailableRefinements() {
    return [{ id: "keep", label: "Keep only", kind: "keep" }];
  },
};

assert.equal(resolveReportRuntimeDrillMetadataProvider({
  reportSpec,
  runtimeHandlers: {
    drillMetadataProvider: {
      async getDrillHierarchy() {
        return null;
      },
      async getDetailTarget() {
        return null;
      },
      async listAvailableRefinements() {
        return [{ id: "keep", label: "Keep only", kind: "keep" }];
      },
    },
  },
})?.listAvailableRefinements instanceof Function, true);

const fallbackFromPartialProvider = resolveReportRuntimeDrillMetadataProvider({
  reportSpec,
  runtimeHandlers: {
    drillMetadataProvider: explicitProvider,
  },
});
assert.notEqual(fallbackFromPartialProvider, explicitProvider);
assert.equal(typeof fallbackFromPartialProvider?.getDetailTarget, "function");
assert.deepEqual(await fallbackFromPartialProvider.getDetailTarget("target://demo/date-detail"), {
  targetRef: "target://demo/date-detail",
  navigationMode: "hostRoute",
  parameters: {
    eventDate: "$value",
  },
});

const provider = resolveReportRuntimeDrillMetadataProvider({ reportSpec, runtimeHandlers: {} });
assert.equal(typeof provider?.listAvailableRefinements, "function");
assert.deepEqual(await provider.getDrillHierarchy("channelV2"), {
  fieldRef: "channelV2",
  levels: [
    { id: "channelV2", field: "channelV2", label: "Channel" },
    { id: "publisher", field: "publisher", label: "Publisher" },
  ],
});
assert.deepEqual(await provider.getDetailTarget("target://demo/date-detail"), {
  targetRef: "target://demo/date-detail",
  navigationMode: "hostRoute",
  parameters: {
    eventDate: "$value",
  },
});
assert.deepEqual(await provider.listAvailableRefinements("tableBlock", "channelV2"), [
  { id: "keep:channelV2", label: "Keep only", kind: "keep" },
  { id: "exclude:channelV2", label: "Exclude", kind: "exclude" },
  { id: "drill:channelV2:publisher", label: "Drill to Publisher", kind: "drill", nextFieldRef: "publisher" },
]);

assert.equal(resolveReportRuntimeDrillMetadataProvider({
  reportSpec: { kind: "reportSpec" },
  runtimeHandlers: {},
}), null);

assert.equal(resolveReportRuntimeDrillMetadataProvider({
  reportSpec: { kind: "reportSpec" },
  runtimeHandlers: {
    drillMetadataProvider: explicitProvider,
  },
}), null);

console.log("reportRuntimeDrillProvider ✓ resolves explicit or report-spec-backed drill providers for runtime");
