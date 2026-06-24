import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("Imported reopen artifact"),
  true,
  "ReportBuilder should use delivery-oriented imported reopen artifact wording in runtime feedback.",
);

assert.equal(
  source.includes("Imported report file"),
  true,
  "ReportBuilder should use delivery-oriented imported report file wording in runtime feedback.",
);

assert.equal(
  source.includes("This imported catalog entry can prepare a get request and reopen diagnostic"),
  true,
  "ReportBuilder should use catalog-entry wording in imported list-entry guidance.",
);

assert.equal(
  source.includes("matching local reopen artifact"),
  true,
  "ReportBuilder should use reopen-artifact wording in imported list-entry guidance.",
);

console.log("reportBuilderImportedDeliveryCoverage ✓ imported runtime feedback uses delivery-oriented wording");
