import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("if (!designWorkspaceMode) {\n            return null;\n        }"),
  true,
  "ReportBuilder should allow the design workspace overview to render in compact hosted mode.",
);

assert.equal(
  source.includes("if (designWorkspaceMode) {\n            setWorkspaceMode(\"report\");\n        }"),
  true,
  "ReportBuilder should switch from Design to the Report surface on Run even in compact authoring mode.",
);
