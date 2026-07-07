import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("const revealSemanticImportSurface = React.useCallback"),
  true,
  "ReportBuilder should centralize the semantic import reveal behavior.",
);

assert.equal(
  source.includes("if (activated) {\n                    revealSemanticImportSurface();\n                    return;\n                }"),
  true,
  "ReportBuilder should reveal the semantic surface before returning from a successful raw-mode auto-activation.",
);

assert.equal(
  source.includes("const hideImportedActivationArtifactSummaries = activeImportedSemanticSessionMatchesCurrentArtifact && importedGetResponseActive;"),
  true,
  "ReportBuilder should hide imported reopen/import summary cards only for the currently activated imported semantic artifact.",
);

assert.equal(
  source.includes("!hideImportedActivationGetResponseSummary"),
  true,
  "ReportBuilder should stop repeating imported reopen-bundle summaries on the main surface after semantic activation succeeds.",
);

assert.equal(
  source.includes("!hideImportedActivationUpdatePayloadSummary"),
  true,
  "ReportBuilder should stop repeating imported update-request summaries on the main surface after semantic activation succeeds.",
);

assert.equal(
  source.includes("chartApplyFeedback?.hideWhenHydratedSessionActive && hydratedReportDocumentSession"),
  true,
  "ReportBuilder should hide semantic import success feedback once the reopened session is already active.",
);

assert.equal(
  source.includes("configSemanticModel: hydratedReportDocumentSession?.reopenedConfig?.semanticModel || config?.semanticModel || null"),
  true,
  "ReportBuilder should fall back to the hydrated reopened session semantic model during reload recovery.",
);

assert.equal(
  source.includes("!semanticResultSurfaceState ? renderSemanticBindingChips(reopenedSemanticBindingViewState"),
  true,
  "ReportBuilder should avoid repeating reopened-session semantic chips when the main semantic context banner is already visible.",
);

assert.equal(
  source.includes("semanticContextDescription === runtimeErrorDescription"),
  true,
  "ReportBuilder should hide the lower authored-runtime semantic error card when it is repeating the same non-actionable semantic warning already shown in the main semantic context banner.",
);

assert.equal(
  source.includes("semanticContextDescription === runtimeBlockedDescription"),
  true,
  "ReportBuilder should hide the lower authored-runtime semantic blocked card when it is repeating the same non-actionable semantic warning already shown in the main semantic context banner.",
);

console.log("reportBuilderSemanticWorkspaceImportCoverage ✓ semantic auto-activation keeps the semantic surface visible");
