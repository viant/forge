import assert from "node:assert/strict";

import { buildDashboardReportRuntimeBlock } from "./reportRuntimeBlock.js";

const reportSpec = {
  title: "Authored Semantic Report",
  binding: {
    mode: "semantic",
  },
};

const reportFill = {
  kind: "reportFill",
  blocks: [
    { id: "primaryTable", kind: "tableBlock" },
  ],
};

const reportPrint = {
  kind: "reportPrint",
  title: "Runtime Preview Print",
  pages: [
    { number: 1, elements: [], headerElements: [], footerElements: [] },
  ],
  bookmarks: [
    {
      id: "bookmark.primaryTable",
      title: "Primary Table",
      pageNumber: 1,
    },
  ],
};

const semanticBindingViewState = {
  title: "Semantic Binding",
  chips: [
    "Model Ad Delivery",
    "Entity Line Delivery",
  ],
  fieldGroups: [
    {
      id: "dimensions",
      title: "Selected dimensions (1)",
      fields: [
        { id: "channel", rawId: "channelV2", label: "Channel" },
      ],
    },
  ],
};

assert.deepEqual(buildDashboardReportRuntimeBlock({
  id: "authoredRuntime",
  subtitle: "Runtime preview",
  reportSpec,
  reportFill,
  reportPrint,
  semanticBindingViewState,
  locale: "en-US",
  hostIntent: {
    intentKind: "detailTarget",
    targetRef: "target://example/performance/channel-detail",
    navigationMode: "hostRoute",
    parameters: {
      channel: "Display",
    },
  },
}), {
  id: "authoredRuntime",
  kind: "dashboard.reportRuntime",
  title: "Authored Semantic Report",
  subtitle: "Runtime preview",
  dashboard: {
    reportRuntime: {
      reportSpec,
      reportFill,
      reportPrint,
      semanticBindingViewState,
      locale: "en-US",
      hostIntent: {
        intentKind: "detailTarget",
        targetRef: "target://example/performance/channel-detail",
        navigationMode: "hostRoute",
        parameters: {
          channel: "Display",
        },
      },
    },
  },
});

console.log("reportRuntimeBlock ✓ builds a reusable dashboard block contract for authored report runtime rendering");
