import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const verificationSteps = [
  {
    label: "semantic model ref",
    command: process.execPath,
    args: ["--no-warnings", "src/semantic/modelRef.test.js"],
  },
  {
    label: "semantic model provider",
    command: process.execPath,
    args: ["--no-warnings", "src/semantic/modelProvider.test.js"],
  },
  {
    label: "semantic model validation",
    command: process.execPath,
    args: ["--no-warnings", "src/semantic/modelValidation.test.js"],
  },
  {
    label: "report builder semantic helpers",
    command: process.execPath,
    args: ["--no-warnings", "src/components/dashboard/reportBuilderSemantic.test.js"],
  },
  {
    label: "report builder utils",
    command: process.execPath,
    args: ["--no-warnings", "src/components/dashboard/reportBuilderUtils.test.js"],
  },
  {
    label: "semantic readiness",
    command: process.execPath,
    args: ["--no-warnings", "src/components/dashboard/reportBuilderReadiness.test.js"],
  },
  {
    label: "semantic validation lifecycle",
    command: process.execPath,
    args: ["--no-warnings", "src/components/dashboard/reportBuilderSemanticValidationState.test.js"],
  },
  {
    label: "preview semantic behavior helper",
    command: process.execPath,
    args: ["--no-warnings", "src/demos/reportBuilder/previewSemanticValidation.test.js"],
  },
  {
    label: "preview metrics helper",
    command: process.execPath,
    args: ["--no-warnings", "src/demos/reportBuilder/previewMetrics.test.js"],
  },
  {
    label: "preview scenario runner helper",
    command: process.execPath,
    args: ["--no-warnings", "scripts/report-builder-preview-scenarios.test.mjs"],
  },
  {
    label: "self-hosted preview smoke",
    command: "npm",
    args: ["run", "smoke:report-builder-preview:ci"],
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
  console.log("Phase 1 semantic preview verification");
  console.log("");
  for (const step of verificationSteps) {
    console.log(`Running: ${step.label}`);
    await runStep(step);
  }
  console.log("");
  console.log(`Phase 1 semantic preview verification complete: ${verificationSteps.length}/${verificationSteps.length} passed`);
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
