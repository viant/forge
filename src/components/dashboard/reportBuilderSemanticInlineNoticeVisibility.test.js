import assert from "node:assert/strict";

import { resolveReportBuilderVisibleSemanticInlineNotices } from "./reportBuilderSemanticInlineNoticeVisibility.js";

const semanticBindingInfoNotice = {
    level: "info",
    message: "Semantic binding: Ad Delivery • Entity: Line Delivery",
    actionLabel: "",
    action: "",
};

const validationNotice = {
    level: "danger",
    message: "Semantic validation: Provider unavailable.",
    actionLabel: "Retry validation",
    action: "retrySemanticValidation",
};

assert.deepEqual(
    resolveReportBuilderVisibleSemanticInlineNotices([
        semanticBindingInfoNotice,
        validationNotice,
    ], {
        reportWorkspaceMode: false,
        showAuthoredReportSurface: true,
    }),
    [
        semanticBindingInfoNotice,
        validationNotice,
    ],
);

assert.deepEqual(
    resolveReportBuilderVisibleSemanticInlineNotices([
        semanticBindingInfoNotice,
        validationNotice,
    ], {
        reportWorkspaceMode: true,
        showAuthoredReportSurface: true,
    }),
    [
        semanticBindingInfoNotice,
        validationNotice,
    ],
);

assert.deepEqual(
    resolveReportBuilderVisibleSemanticInlineNotices([
        null,
        semanticBindingInfoNotice,
        "ignore-me",
    ], {
        reportWorkspaceMode: true,
        showAuthoredReportSurface: true,
    }),
    [
        semanticBindingInfoNotice,
    ],
);

console.log("reportBuilderSemanticInlineNoticeVisibility ✓ keeps compact semantic binding notices visible in authored report mode");
