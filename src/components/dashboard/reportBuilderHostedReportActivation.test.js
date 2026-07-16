import assert from "node:assert/strict";

import {
    buildHostedReportActivationRequest,
    buildHostedReportActivationResponse,
    resolveHostedReportId,
} from "./reportBuilderHostedReportActivation.js";

assert.equal(resolveHostedReportId({ parameters: { reportId: " saved-report " } }), "saved-report");
assert.equal(resolveHostedReportId({ parameters: {} }), "");
assert.deepEqual(buildHostedReportActivationRequest(" saved-report "), { reportId: "saved-report" });
assert.equal(buildHostedReportActivationRequest(""), null);

const response = buildHostedReportActivationResponse({
    kind: "reportBuilder.savedReportPayload",
    reportId: "saved-report",
    title: "Saved report",
    version: 3,
    createdAt: "2026-07-15T08:00:00Z",
    document: {
        kind: "reportDocument",
        version: "1.0",
        id: "saved-report",
        title: "Saved report",
        dataSources: [],
        blocks: [{ id: "intro", type: "narrative", title: "Summary", body: "Saved content" }],
        layout: [{ blockId: "intro", width: "full" }],
    },
    reportSpec: {
        kind: "reportSpec",
        version: "1.0",
        id: "saved-report",
        title: "Saved report",
        datasets: [],
        blocks: [],
    },
});

assert.equal(response?.reportRef?.reportId, "saved-report");
assert.equal(response?.documentVersion, 3);
assert.equal(response?.document?.title, "Saved report");
assert.equal(buildHostedReportActivationResponse(null), null);
