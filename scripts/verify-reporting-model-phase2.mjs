import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const verificationSteps = [
  {
    label: "report spec model",
    command: process.execPath,
    args: ["--no-warnings", "src/reporting/reportSpecModel.test.js"],
  },
  {
    label: "report document model",
    command: process.execPath,
    args: ["--no-warnings", "src/reporting/reportDocumentModel.test.js"],
  },
  {
    label: "report fill model",
    command: process.execPath,
    args: ["--no-warnings", "src/reporting/reportFillModel.test.js"],
  },
  {
    label: "table visual spec",
    command: process.execPath,
    args: ["--no-warnings", "src/reporting/tableVisualSpec.test.js"],
  },
  {
    label: "report refinement model",
    command: process.execPath,
    args: ["--no-warnings", "src/reporting/reportRefinementModel.test.js"],
  },
  {
    label: "drill metadata provider",
    command: process.execPath,
    args: ["--no-warnings", "src/reporting/drillMetadataProvider.test.js"],
  },
  {
    label: "authored runtime unit suite",
    command: process.execPath,
    args: ["--no-warnings", "scripts/run-authored-runtime-unit-tests.mjs"],
  },
  {
    label: "authored runtime preview smoke",
    command: "npm",
    args: ["run", "smoke:report-builder-preview:runtime"],
  },
];

function runStep(step) {
  return new Promise((resolve, reject) => {
    const child = spawn(step.command, step.args, {
      cwd: repoRoot,
      env: {
        ...process.env,
      },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${step.command} ${step.args.join(" ")} failed with code ${code}`));
      }
    });
  });
}

async function main() {
  console.log("Phase 2 reporting model verification");
  console.log("");
  for (const step of verificationSteps) {
    console.log(`Running: ${step.label}`);
    await runStep(step);
  }
  console.log("");
  console.log(`Phase 2 reporting model verification complete: ${verificationSteps.length}/${verificationSteps.length} passed`);
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
