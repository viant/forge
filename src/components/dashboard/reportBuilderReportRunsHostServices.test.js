import assert from "node:assert/strict";

import { buildReportBuilderHostServices } from "./reportBuilderHostServices.js";

const originalFetch = global.fetch;

function response(status, body, { raw = false } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? "OK" : "Error",
        async text() {
            if (body == null) return "";
            return raw ? String(body) : JSON.stringify(body);
        },
    };
}

function makeServices(options = {}) {
    return buildReportBuilderHostServices({
        services: options.services || {},
        endpoints: { appAPI: { baseURL: "http://localhost:9191/v1/" } },
        endpointName: "appAPI",
        auth: {
            defaultAuthProvider: "default",
            authStates: { default: { jwtToken: { id_token: "token-123" } } },
        },
        prepareRequest: options.prepareRequest,
    });
}

const calls = [];
const replies = [];
global.fetch = async (url, init = {}) => {
    calls.push({
        url: String(url),
        method: init.method,
        headers: { ...init.headers },
        body: init.body ? JSON.parse(init.body) : undefined,
    });
    return replies.shift() || response(500, { error: "missing test response" });
};

const services = makeServices({
    prepareRequest(request) {
        request.headers["X-Forge-Test"] = "prepared";
        return request;
    },
});
assert.equal(typeof services.reportRuns?.begin, "function");
assert.equal(typeof services.reportRuns?.complete, "function");
assert.equal(typeof services.reportRuns?.fail, "function");
assert.equal(typeof services.reportRuns?.activate, "function");
assert.equal(typeof services.reportRuns?.getContext, "function");
assert.equal(typeof services.reportRuns?.adopt, "function");

replies.push(
    response(200, {
        run: { reportRunId: "server-run-1", conversationId: "conv-1", origin: "prompt", status: "running", revision: 1 },
        context: { conversationId: "conv-1", activeReportRunId: "prior-run", revision: 4 },
    }),
    response(200, { reportRunId: "server-run-1", conversationId: "conv-1", status: "completed", revision: 2 }),
    response(200, { conversationId: "conv-1", activeReportRunId: "server-run-1", revision: 5 }),
    response(200, { conversationId: "conv-1", activeReportRunId: "server-run-1", revision: 5 }),
);

const begun = await services.reportRuns.begin({
    uiRunRequestId: "ui-request-1",
    conversationId: "conv-1",
    turnId: "forge-only-turn",
    windowId: "forge-only-window",
    origin: "prompt",
    builderRef: "generic-builder",
    requestedParams: { region: "west" },
    effectiveParams: { region: "west", limit: 10 },
});
assert.equal(begun.enabled, true);
assert.equal(begun.run.reportRunId, "server-run-1");
assert.equal(begun.run.revision, 1);

const completed = await services.reportRuns.complete({
    reportRunId: "server-run-1",
    conversationId: "conv-1",
    turnId: "forge-only-turn",
    windowId: "forge-only-window",
    expectedRevision: 1,
    reportSpec: { kind: "reportSpec", version: 1 },
    reportFill: { kind: "reportFill", version: 1 },
    reportPrint: { kind: "reportPrint", version: 1 },
});
assert.equal(completed.revision, 2);

const activated = await services.reportRuns.activate({
    reportRunId: "server-run-1",
    conversationId: "conv-1",
    turnId: "forge-only-turn",
    expectedRunRevision: 2,
    expectedContextRevision: 4,
    source: "prompt",
});
assert.equal(activated.activeReportRunId, "server-run-1");

const current = await services.reportRuns.getContext({ conversationId: "conv-1" });
assert.deepEqual(current, {
    enabled: true,
    context: { conversationId: "conv-1", activeReportRunId: "server-run-1", revision: 5 },
});

assert.deepEqual(calls.slice(0, 4).map((call) => call.url), [
    "http://localhost:9191/v1/api/report-runs/begin",
    "http://localhost:9191/v1/api/report-runs/server-run-1/complete",
    "http://localhost:9191/v1/api/report-runs/server-run-1/activate",
    "http://localhost:9191/v1/api/report-runs/context/conv-1",
]);
assert.deepEqual(calls[0].body, {
    conversationId: "conv-1",
    origin: "prompt",
    builderRef: "generic-builder",
    requestedParams: { region: "west" },
    effectiveParams: { region: "west", limit: 10 },
    uiRunRequestId: "ui-request-1",
});
assert.deepEqual(calls[1].body, {
    reportRunId: "server-run-1",
    conversationId: "conv-1",
    expectedRevision: 1,
    reportSpec: { kind: "reportSpec", version: 1 },
    reportFill: { kind: "reportFill", version: 1 },
    reportPrint: { kind: "reportPrint", version: 1 },
});
assert.equal(calls[0].headers.Authorization, "Bearer token-123");
assert.equal(calls[0].headers["X-Forge-Test"], "prepared");
assert.equal(calls[3].method, "GET");
assert.equal(calls[3].body, undefined);
assert.equal(calls.filter((call) => call.url.endsWith("/complete")).length, 1, "one completion call emits one transition");

replies.push(response(409, { error: "report run: stale revision" }));
await assert.rejects(
    () => services.reportRuns.complete({
        reportRunId: "server-run-1",
        conversationId: "conv-1",
        expectedRevision: 1,
        reportSpec: {},
        reportFill: {},
        reportPrint: {},
    }),
    (error) => error.status === 409 && error.message === "report run: stale revision",
);

replies.push(response(200, { reportRunId: "server-run-1", status: "completed" }));
await assert.rejects(
    () => services.reportRuns.complete({
        reportRunId: "server-run-1",
        expectedRevision: 1,
        reportSpec: {},
        reportFill: {},
        reportPrint: {},
    }),
    /invalid run revision/,
);

replies.push(response(200, { run: { status: "running", revision: 1 } }));
await assert.rejects(
    () => services.reportRuns.begin({ uiRunRequestId: "ui-request-missing-id" }),
    /invalid run identity or status/,
);

replies.push(response(200, { run: { reportRunId: "server-run-no-revision", status: "running" } }));
await assert.rejects(
    () => services.reportRuns.begin({ uiRunRequestId: "ui-request-missing-revision" }),
    /invalid run revision/,
);

replies.push(response(200, {
    run: { reportRunId: "server-run-invalid-context", status: "running", revision: 1 },
    context: { conversationId: "conv-1", revision: 2 },
}));
await assert.rejects(
    () => services.reportRuns.begin({
        uiRunRequestId: "ui-request-invalid-context",
        conversationId: "conv-1",
    }),
    /invalid active context/,
);

replies.push(response(404, "404 page not found\n", { raw: true }));
assert.deepEqual(
    await services.reportRuns.begin({ uiRunRequestId: "feature-off" }),
    { enabled: false },
);

replies.push(
    response(404, "404 page not found\n", { raw: true }),
    response(404, { error: "report run: not found" }),
);
assert.deepEqual(await services.reportRuns.getContext({ conversationId: "conv-off" }), {
    enabled: false,
    context: null,
});
assert.deepEqual(await services.reportRuns.getContext({ conversationId: "conv-empty" }), {
    enabled: true,
    context: null,
});

replies.push(
    response(200, { reportRunId: "server-run-failed", conversationId: "", status: "failed", revision: 2 }),
    response(200, {
        run: { reportRunId: "server-run-manual", conversationId: "conv-2", origin: "manual", status: "completed", revision: 3 },
        context: { conversationId: "conv-2", activeReportRunId: "server-run-manual", revision: 1 },
    }),
);
const failed = await services.reportRuns.fail({
    reportRunId: "server-run-failed",
    expectedRevision: 1,
    failureCode: "browser_run_failed",
    failureText: "Datasource failed.",
});
assert.equal(failed.status, "failed");
const adopted = await services.reportRuns.adopt({
    reportRunId: "server-run-manual",
    conversationId: "conv-2",
    expectedRunRevision: 2,
    expectedContextRevision: 0,
    source: "manual",
});
assert.equal(adopted.context.activeReportRunId, "server-run-manual");

let explicitCompleteCalls = 0;
const explicitComplete = async () => {
    explicitCompleteCalls += 1;
    return { reportRunId: "host-run", revision: 8, status: "completed" };
};
const partiallyExplicit = makeServices({
    services: { reportRuns: { complete: explicitComplete } },
});
assert.equal(partiallyExplicit.reportRuns.complete, explicitComplete);
assert.equal(typeof partiallyExplicit.reportRuns.begin, "function");
const fetchCountBeforeExplicit = calls.length;
await partiallyExplicit.reportRuns.complete({ reportRunId: "host-run" });
assert.equal(explicitCompleteCalls, 1);
assert.equal(calls.length, fetchCountBeforeExplicit, "an existing transition handler is never duplicated by the fallback");

global.fetch = originalFetch;

console.log("reportBuilderReportRunsHostServices ✓ exact host lifecycle, fail-closed identity, CAS errors, and handler precedence");
