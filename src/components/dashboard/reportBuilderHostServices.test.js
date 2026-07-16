import assert from "node:assert/strict";

import { buildReportBuilderHostServices } from "./reportBuilderHostServices.js";

const calls = [];
const originalFetch = global.fetch;
let returnFailedStatus = false;

global.fetch = async (url, init = {}) => {
  calls.push({
    url: String(url || ""),
    method: String(init.method || "GET"),
    headers: { ...(init.headers || {}) },
    body: init.body ? JSON.parse(String(init.body)) : null,
  });
  const isStatusRequest = String(url).includes("reporting%3Aget_export_status");
  return {
    ok: !(returnFailedStatus && isStatusRequest),
    status: returnFailedStatus && isStatusRequest ? 409 : 200,
    statusText: returnFailedStatus && isStatusRequest ? "Conflict" : "OK",
    async text() {
      if (String(url).includes("reporting%3Asubmit_export")) {
        return JSON.stringify({ result: JSON.stringify({ jobId: "job-1", status: "queued" }) });
      }
      if (String(url).includes("reporting%3Aget_export_status")) {
        if (returnFailedStatus) {
          return JSON.stringify({ result: JSON.stringify({ jobId: "job-1", status: "failed", error: "Renderer rejected the report." }) });
        }
        return JSON.stringify({ result: JSON.stringify({ jobId: "job-1", status: "succeeded", artifactId: "artifact-1", format: "pdf" }) });
      }
      if (String(url).includes("reporting%3Alist_reports")) {
        return JSON.stringify({ result: JSON.stringify({ reports: [{ artifactId: "report-1", title: "Forecasting Q3" }] }) });
      }
      return JSON.stringify({ ok: true });
    },
  };
};

const synthesized = buildReportBuilderHostServices({
  services: {},
  endpoints: {
    appAPI: { baseURL: "http://localhost:9191/v1/" },
  },
  auth: {
    defaultAuthProvider: "default",
    authStates: {
      default: {
        jwtToken: {
          id_token: "token-123",
        },
      },
    },
  },
  endpointName: "appAPI",
  conversationId: "conv-123",
});

assert.equal(typeof synthesized.reportExport?.submitRequest, "function");
assert.equal(typeof synthesized.reportStore?.listReports, "function");
assert.equal(typeof synthesized.reportLifecycle?.shareArtifact, "function");
assert.equal(typeof synthesized.reportSharedArtifacts?.listArtifacts, "function");

const queued = await synthesized.reportExport.submitRequest({
  request: {
    kind: "reportExportRequest",
    version: 1,
    target: { format: "pdf" },
    source: {
      from: "preset",
      artifactKind: "reportBuilder.reportTemplate",
      artifactRef: "reportBuilder.reportTemplate://metricReportBuilder:performance_inventory_brief",
      title: "Performance Inventory Brief",
      sourceArtifactId: "performance_inventory_brief",
    },
    reportSpec: { kind: "reportSpec", version: 1, source: { kind: "dashboard.reportBuilder", containerId: "demo", stateKey: "demo", dataSourceRef: "demo" }, datasets: [], blocks: [], refinements: [], calculatedFields: [], parameters: {}, layoutIntent: { kind: "single", blockOrder: [] } },
    reportFill: { kind: "reportFill", version: 1, specVersion: 1, specHash: "spec-1", source: { kind: "dashboard.reportBuilder", containerId: "demo", stateKey: "demo", dataSourceRef: "demo" }, parameters: {}, refinements: [], calculatedFields: [], datasets: [], blocks: [], diagnostics: [] },
    reportPrint: { kind: "reportPrint", version: 1, specVersion: 1, fillVersion: 1, specHash: "spec-1", fillHash: "fill-1", source: { kind: "dashboard.reportBuilder", containerId: "demo", stateKey: "demo", dataSourceRef: "demo" }, title: "Demo", pageGeometry: { width: 612, height: 792, marginTop: 48, marginRight: 48, marginBottom: 48, marginLeft: 48, headerHeight: 24, footerHeight: 24 }, pages: [], bookmarks: [], diagnostics: [] },
  },
});
assert.deepEqual(queued, { jobId: "job-1", status: "queued" });
assert.equal(calls[0].url, "http://localhost:9191/v1/tools/reporting%3Asubmit_export/execute?conversationId=conv-123");
assert.equal(calls[0].method, "POST");
assert.equal(calls[0].headers.Authorization, "Bearer token-123");
assert.equal(calls[0].body.reportExportRequest.source.from, "preset");

const completed = await synthesized.reportExport.getStatus({ jobId: "job-1" });
assert.deepEqual(completed, { jobId: "job-1", status: "succeeded", artifactId: "artifact-1", format: "pdf" });
assert.equal(calls[1].url, "http://localhost:9191/v1/tools/reporting%3Aget_export_status/execute?conversationId=conv-123");
assert.deepEqual(calls[1].body, { jobId: "job-1" });

returnFailedStatus = true;
await assert.rejects(
  () => synthesized.reportExport.getStatus({ jobId: "job-1" }),
  (error) => {
    assert.deepEqual(error.toolResult, { jobId: "job-1", status: "failed", error: "Renderer rejected the report." });
    assert.deepEqual(error.responseEnvelope, { jobId: "job-1", status: "failed", error: "Renderer rejected the report." });
    return true;
  },
);
returnFailedStatus = false;

const reports = await synthesized.reportStore.listReports({ limit: 10 });
assert.deepEqual(reports, { reports: [{ artifactId: "report-1", title: "Forecasting Q3" }] });
const listReportsCall = calls.find((call) => call.url.includes("reporting%3Alist_reports"));
assert.equal(listReportsCall?.url, "http://localhost:9191/v1/tools/reporting%3Alist_reports/execute?conversationId=conv-123");
assert.deepEqual(listReportsCall?.body, { limit: 10 });

const explicitSubmit = async () => ({ ok: "explicit" });
const explicit = buildReportBuilderHostServices({
  services: {
    reportExport: {
      submitRequest: explicitSubmit,
    },
  },
  endpoints: {
    appAPI: { baseURL: "http://localhost:9191/v1" },
  },
  endpointName: "appAPI",
});

assert.equal(explicit.reportExport.submitRequest, explicitSubmit);
assert.equal(typeof explicit.reportExport.getStatus, "function");
assert.equal(typeof explicit.reportExport.getArtifact, "function");

const fetchCallCountBeforeCompleteExplicit = calls.length;
const completeExplicitServices = {
  reportExport: {
    submitRequest: async () => ({ ok: true }),
    getStatus: async () => ({ status: "queued" }),
    getArtifact: async () => ({ bytes: new Uint8Array() }),
    listJobs: async () => ({ jobs: [] }),
    listArtifacts: async () => ({ artifacts: [] }),
  },
  reportStore: {
    saveReport: async () => ({ ok: true }),
    getReport: async () => ({ artifactId: "report-1" }),
    listReports: async () => ({ reports: [] }),
    updateReport: async () => ({ ok: true }),
  },
  reportLifecycle: {
    shareArtifact: async () => ({ ok: true }),
    transitionArtifact: async () => ({ ok: true }),
  },
  reportSharedArtifacts: {
    listArtifacts: async () => ({ artifacts: [] }),
    getArtifact: async () => ({ artifactId: "shared-1" }),
  },
};

const completeExplicit = buildReportBuilderHostServices({
  services: completeExplicitServices,
  endpoints: {
    appAPI: { baseURL: "http://localhost:9191/v1" },
  },
  endpointName: "appAPI",
});

assert.equal(completeExplicit, completeExplicitServices);
assert.equal(calls.length, fetchCallCountBeforeCompleteExplicit);

global.fetch = originalFetch;

console.log("reportBuilderHostServices ✓ synthesizes fallback handlers only when the host bundle is incomplete");
