import assert from "node:assert/strict";

import { buildReportRuntimeDetailDiagnosticMessage } from "./reportRuntimeDetailDiagnosticModel.js";

assert.equal(buildReportRuntimeDetailDiagnosticMessage({
  unresolvedParameters: [],
}), null);

assert.equal(buildReportRuntimeDetailDiagnosticMessage({
  unresolvedParameters: [
    { parameter: "campaign", field: "campaign", ambiguous: true },
  ],
}), "Detail target resolved with omitted parameters: campaign.");

assert.equal(buildReportRuntimeDetailDiagnosticMessage({
  unresolvedParameters: [
    { parameter: "campaign", field: "campaign", ambiguous: true },
    { parameter: "publisher", field: "publisher", ambiguous: true },
  ],
}), "Detail target resolved with omitted parameters: campaign, publisher.");

console.log("reportRuntimeDetailDiagnosticModel ✓ summarizes unresolved detail target parameters for runtime warnings");
