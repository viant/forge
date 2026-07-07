import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("const currentState = currentBuilderStateRef.current || state;\n        persistExplorationMutation({\n            ...currentState,\n            groupBy: value,"),
  true,
  "ReportBuilder should base compact group-by edits on the latest builder state instead of a stale render snapshot.",
);

assert.equal(
  source.includes("const currentState = currentBuilderStateRef.current || state;\n        const current = getScopeParamValue(currentState, key);\n        let nextValue;"),
  true,
  "ReportBuilder should base static filter toggles on the latest builder state instead of stale filter values.",
);

assert.equal(
  source.includes("const currentState = currentBuilderStateRef.current || state;\n        const current = getScopeParamValue(currentState, key);\n        const previous = current && typeof current === \"object\" ? current : {};"),
  true,
  "ReportBuilder should compose date-range edits from the latest builder state so start/end updates do not overwrite each other.",
);
