import assert from "node:assert/strict";

import {
  buildCreateReportDocumentPayload,
  buildDeleteReportDocumentRequest,
  buildGetReportDocumentRequest,
  buildGetReportDocumentResponse,
  buildListReportDocumentsRequest,
  buildListReportDocumentsResponse,
  buildReportDocumentCompileState,
  buildReportDocumentRef,
  buildUpdateReportDocumentConflictDiagnostic,
  buildUpdateReportDocumentPayload,
} from "./reportDocumentStore.js";

const document = {
  version: 1,
  kind: "reportDocument",
  id: "demoReportBuilder",
  title: "Report Builder Demo",
  subtitle: "Weekly Rollup",
  description: "Conflict diagnostic metadata summary.",
  blocks: [
    { id: "primaryBuilder", kind: "reportBuilderBlock" },
  ],
};

const reportSpec = {
  version: 1,
  kind: "reportSpec",
  blocks: [
    { id: "primaryTable", kind: "tableBlock" },
    { id: "primaryChart", kind: "chartBlock" },
  ],
  datasets: [
    { id: "primary" },
  ],
};

assert.deepEqual(buildReportDocumentRef(document), {
  reportId: "demoReportBuilder",
});

assert.deepEqual(buildReportDocumentCompileState(reportSpec), {
  status: "clean",
  reportSpecVersion: 1,
  blockCount: 2,
  datasetCount: 1,
});

assert.deepEqual(buildReportDocumentCompileState(reportSpec, {
  diagnostics: [
    {
      code: "documentBlockValueFieldUnavailable",
      severity: "error",
      path: "reportDocument.blocks.headlineKpi.valueField",
      message: "Headline KPI references unavailable KPI value field 'avails'.",
      suggestedFix: "Edit the KPI block.",
    },
  ],
}), {
  status: "invalid",
  reportSpecVersion: 1,
  blockCount: 2,
  datasetCount: 1,
  diagnostics: [
    {
      code: "documentBlockValueFieldUnavailable",
      severity: "error",
      path: "reportDocument.blocks.headlineKpi.valueField",
      message: "Headline KPI references unavailable KPI value field 'avails'.",
      suggestedFix: "Edit the KPI block.",
    },
  ],
});

assert.deepEqual(buildCreateReportDocumentPayload({
  document,
  reportSpec,
  createdAt: 1700,
  source: {
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_demo",
  },
}), {
  version: 1,
  kind: "createReportDocumentPayload",
  createdAt: 1700,
  reportRef: {
    reportId: "demoReportBuilder",
  },
  title: "Report Builder Demo",
  document,
  compileState: {
    status: "clean",
    reportSpecVersion: 1,
    blockCount: 2,
    datasetCount: 1,
  },
  source: {
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_demo",
  },
});

assert.equal(buildCreateReportDocumentPayload({
  document,
  reportSpec,
  compileDiagnostics: [
    {
      code: "documentBlockValueFieldUnavailable",
      severity: "error",
      message: "Headline KPI references unavailable KPI value field 'avails'.",
    },
  ],
})?.compileState?.status, "invalid");

assert.equal(
  buildCreateReportDocumentPayload({
    document: {
      ...document,
      title: "   ",
    },
    reportSpec,
    createdAt: 0,
  })?.title,
  "demoReportBuilder",
);
assert.equal(
  buildCreateReportDocumentPayload({
    document,
    reportSpec: {},
  }),
  null,
);

assert.deepEqual(buildUpdateReportDocumentPayload({
  reportRef: { reportId: "demoReportBuilder" },
  document,
  reportSpec,
  expectedVersion: 7,
  updatedAt: 1900,
}), {
  version: 1,
  kind: "updateReportDocumentPayload",
  updatedAt: 1900,
  reportRef: {
    reportId: "demoReportBuilder",
  },
  expectedVersion: 7,
  title: "Report Builder Demo",
  document,
  compileState: {
    status: "clean",
    reportSpecVersion: 1,
    blockCount: 2,
    datasetCount: 1,
  },
});

assert.equal(buildUpdateReportDocumentPayload({
  reportRef: { reportId: "demoReportBuilder" },
  document,
  reportSpec,
  compileDiagnostics: [
    {
      code: "documentBlockValueFieldUnavailable",
      severity: "error",
      message: "Headline KPI references unavailable KPI value field 'avails'.",
    },
  ],
  expectedVersion: 3,
})?.compileState?.status, "invalid");

assert.deepEqual(buildUpdateReportDocumentConflictDiagnostic({
  updatePayload: buildUpdateReportDocumentPayload({
    reportRef: { reportId: "demoReportBuilder" },
    document,
    reportSpec,
    expectedVersion: 7,
    updatedAt: 1900,
    source: {
      kind: "reportBuilder.savedReportPayload",
      payloadId: "rbreport_demo",
    },
  }),
  currentVersion: 9,
  detectedAt: 2400,
}), {
  version: 1,
  kind: "updateReportDocumentConflictDiagnostic",
  code: "reportDocumentVersionConflict",
  severity: "error",
  detectedAt: 2400,
  reportRef: {
    reportId: "demoReportBuilder",
  },
  title: "Report Builder Demo",
  subtitle: "Weekly Rollup",
  description: "Conflict diagnostic metadata summary.",
  expectedVersion: 7,
  currentVersion: 9,
  message: "Could not update Report Builder Demo because expected version 7 does not match current saved version 9.",
  suggestedAction: "Reload the latest ReportDocument before retrying the update.",
  source: {
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_demo",
  },
});

assert.deepEqual(buildUpdateReportDocumentPayload({
  reportRef: {},
  document,
  reportSpec,
  expectedVersion: 2,
  updatedAt: 2000,
}), {
  version: 1,
  kind: "updateReportDocumentPayload",
  updatedAt: 2000,
  reportRef: {
    reportId: "demoReportBuilder",
  },
  expectedVersion: 2,
  title: "Report Builder Demo",
  document,
  compileState: {
    status: "clean",
    reportSpecVersion: 1,
    blockCount: 2,
    datasetCount: 1,
  },
});

assert.deepEqual(buildGetReportDocumentRequest({
  id: "demoReportBuilder",
}), {
  version: 1,
  kind: "getReportDocumentRequest",
  reportRef: {
    reportId: "demoReportBuilder",
  },
});

assert.deepEqual(buildGetReportDocumentResponse({
  reportRef: { reportId: "demoReportBuilder" },
  version: 11,
  savedAt: 2600,
  document,
  compileState: {
    status: "clean",
    reportSpecVersion: 1,
    blockCount: 2,
    datasetCount: 1,
  },
}), {
  version: 1,
  kind: "getReportDocumentResponse",
  reportRef: {
    reportId: "demoReportBuilder",
  },
  documentVersion: 11,
  savedAt: 2600,
  document,
  compileState: {
    status: "clean",
    reportSpecVersion: 1,
    blockCount: 2,
    datasetCount: 1,
  },
});

assert.deepEqual(buildListReportDocumentsRequest({
  scope: {
    workspaceRef: "forecasting",
  },
  cursor: "next-page",
  limit: 500,
}), {
  version: 1,
  kind: "listReportDocumentsRequest",
  limit: 200,
  scope: {
    workspaceRef: "forecasting",
  },
  cursor: "next-page",
});

assert.deepEqual(buildListReportDocumentsResponse({
  entries: [
    {
      reportRef: { reportId: "demoReportBuilder" },
      documentVersion: 11,
      title: "Report Builder Demo",
      savedAt: 2600,
      source: {
        kind: "dashboard.reportBuilder",
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
      },
      compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 2,
        datasetCount: 1,
      },
    },
    {
      document: {
        id: "forecastingQ3",
        title: "Forecasting Q3",
      },
      version: 4,
      savedAt: 2800,
    },
  ],
  cursor: "next-page",
  hasMore: true,
}), {
  version: 1,
  kind: "listReportDocumentsResponse",
  entries: [
    {
      reportRef: { reportId: "demoReportBuilder" },
      documentVersion: 11,
      title: "Report Builder Demo",
      savedAt: 2600,
      source: {
        kind: "dashboard.reportBuilder",
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
      },
      compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 2,
        datasetCount: 1,
      },
    },
    {
      reportRef: { reportId: "forecastingQ3" },
      documentVersion: 4,
      title: "Forecasting Q3",
      savedAt: 2800,
    },
  ],
  cursor: "next-page",
  hasMore: true,
});

assert.deepEqual(buildDeleteReportDocumentRequest({
  reportId: "demoReportBuilder",
}), {
  version: 1,
  kind: "deleteReportDocumentRequest",
  reportRef: {
    reportId: "demoReportBuilder",
  },
});

assert.equal(buildCreateReportDocumentPayload({
  document,
}), null);
assert.equal(buildUpdateReportDocumentPayload({
  document,
  reportSpec,
  expectedVersion: 0,
}), null);
assert.equal(buildUpdateReportDocumentPayload({
  reportRef: { reportId: "otherReport" },
  document,
  reportSpec,
  expectedVersion: 3,
}), null);
assert.equal(buildUpdateReportDocumentConflictDiagnostic({
  updatePayload: buildUpdateReportDocumentPayload({
    document,
    reportSpec,
    expectedVersion: 7,
  }),
  currentVersion: 7,
}), null);
assert.equal(buildUpdateReportDocumentConflictDiagnostic({
  updatePayload: {
    kind: "createReportDocumentPayload",
    reportRef: { reportId: "demoReportBuilder" },
    expectedVersion: 7,
  },
  currentVersion: 9,
}), null);
assert.equal(buildGetReportDocumentResponse({
  version: 0,
  document,
}), null);
assert.deepEqual(buildListReportDocumentsResponse({
  entries: [
    null,
    {
      reportRef: { reportId: "" },
      documentVersion: 0,
      title: "",
    },
  ],
}), {
  version: 1,
  kind: "listReportDocumentsResponse",
  entries: [],
  cursor: "",
  hasMore: false,
});
assert.equal(buildGetReportDocumentRequest(null), null);
assert.equal(buildDeleteReportDocumentRequest({}), null);

console.log("reportDocumentStore ✓ shapes strict CRUD request contracts around authored ReportDocument payloads");
