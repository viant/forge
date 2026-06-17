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

assert.deepEqual(buildDashboardReportRuntimeBlock({
  id: "authoredRuntime",
  subtitle: "Runtime preview",
  reportSpec,
  reportFill,
  reportPrint,
  locale: "en-US",
  hostIntent: {
    intentKind: "detailTarget",
    targetRef: "target://steward/performance/channel-detail",
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
      locale: "en-US",
      hostIntent: {
        intentKind: "detailTarget",
        targetRef: "target://steward/performance/channel-detail",
        navigationMode: "hostRoute",
        parameters: {
          channel: "Display",
        },
      },
    },
  },
});

console.log("reportRuntimeBlock ✓ builds a reusable dashboard block contract for authored report runtime rendering");
