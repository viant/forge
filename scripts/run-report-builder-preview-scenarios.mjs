import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildPreviewScenarioRunSummary,
  buildPreviewScenarioGroups,
  expandPreviewScenarioArgs,
  parsePreviewScenarioRunnerArgs,
  previewScenarioDisplayName,
  REPORT_BUILDER_PREVIEW_SCENARIO_FILE_RE,
} from "./report-builder-preview-scenarios.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const testsDir = path.join(repoRoot, "tests");
const defaultOutputRoot = path.join(repoRoot, "output", "playwright", "report-builder-preview-suite");
const browserProofRunner = path.resolve(repoRoot, "../agently/ui/scripts/browser-proof-runner.mjs");

async function listScenarioFiles() {
  const entries = await fs.readdir(testsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && REPORT_BUILDER_PREVIEW_SCENARIO_FILE_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function resolveScenarioPaths(args = []) {
  const availableFiles = await listScenarioFiles();
  const resolvedFiles = expandPreviewScenarioArgs(args, availableFiles);
  return resolvedFiles.map((file) => path.join(testsDir, file));
}

async function printScenarioList() {
  const availableFiles = await listScenarioFiles();
  const groups = buildPreviewScenarioGroups(availableFiles);
  console.log("Preview scenario groups:");
  Object.entries(groups).forEach(([group, files]) => {
    console.log(`- ${group}: ${files.length}`);
  });
  console.log("");
  console.log("Available preview scenarios:");
  availableFiles.forEach((file) => {
    console.log(`- ${previewScenarioDisplayName(file)}`);
  });
}

function printHelp() {
  console.log("Usage: node scripts/run-report-builder-preview-scenarios.mjs [options] [scenario|group ...]");
  console.log("");
  console.log("Options:");
  console.log("- --list, -l              List available scenarios and groups");
  console.log("- --help, -h              Show this help");
  console.log("- --continue-on-error     Run every requested scenario and report all failures at the end");
  console.log("- --output-root <dir>     Override the output root directory");
  console.log("- --base-url <url>        Override BASE_URL for browser-proof-runner");
  console.log("- --summary-file <file>   Write a JSON summary for the requested run");
  console.log("");
  console.log("Groups:");
  console.log("- all");
  console.log("- semantic");
  console.log("- semantic-left-rail");
  console.log("- legacy");
}

async function main() {
  const parsedArgs = parsePreviewScenarioRunnerArgs(process.argv.slice(2));
  if (parsedArgs.help) {
    printHelp();
    return;
  }
  if (parsedArgs.list) {
    await printScenarioList();
    return;
  }
  await fs.access(browserProofRunner);
  const scenarioPaths = await resolveScenarioPaths(parsedArgs.scenarioArgs);
  const outputRoot = parsedArgs.outputRoot
    ? path.resolve(repoRoot, parsedArgs.outputRoot)
    : defaultOutputRoot;
  const summaryFile = parsedArgs.summaryFile
    ? path.resolve(repoRoot, parsedArgs.summaryFile)
    : "";
  await fs.mkdir(outputRoot, { recursive: true });
  const failures = [];
  const results = [];

  for (const scenarioPath of scenarioPaths) {
    const slug = scenarioSlug(scenarioPath);
    const outputDir = path.join(outputRoot, slug);
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`Running preview scenario: ${slug}`);
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    try {
      const materializedScenarioPath = await materializeScenarioPath(scenarioPath, outputDir);
      await runNodeScript(browserProofRunner, [materializedScenarioPath, outputDir], {
        env: {
          ...process.env,
          ...(parsedArgs.baseUrl ? { BASE_URL: parsedArgs.baseUrl } : {}),
        },
      });
      console.log(`Passed: ${slug}`);
      results.push({
        slug,
        scenarioPath,
        outputDir,
        status: "passed",
        startedAt,
        durationMs: Date.now() - startedMs,
      });
    } catch (error) {
      failures.push({
        slug,
        message: String(error?.message || error),
      });
      results.push({
        slug,
        scenarioPath,
        outputDir,
        status: "failed",
        startedAt,
        durationMs: Date.now() - startedMs,
        error: String(error?.message || error),
      });
      console.error(`Failed: ${slug}`);
      if (!parsedArgs.continueOnError) {
        await maybeWriteSummary(summaryFile, buildPreviewScenarioRunSummary({
          generatedAt: new Date().toISOString(),
          outputRoot,
          baseUrl: parsedArgs.baseUrl || "",
          total: scenarioPaths.length,
          results,
        }));
        throw error;
      }
    }
  }

  console.log("");
  console.log(`Preview scenarios complete: ${scenarioPaths.length - failures.length}/${scenarioPaths.length} passed`);
  await maybeWriteSummary(summaryFile, buildPreviewScenarioRunSummary({
    generatedAt: new Date().toISOString(),
    outputRoot,
    baseUrl: parsedArgs.baseUrl || "",
    total: scenarioPaths.length,
    results,
  }));
  if (failures.length > 0) {
    failures.forEach((failure) => {
      console.error(`- ${failure.slug}: ${failure.message}`);
    });
    throw new Error(`${failures.length} preview scenario(s) failed.`);
  }
}

async function maybeWriteSummary(summaryFile = "", summary = {}) {
  if (!summaryFile) {
    return;
  }
  await fs.mkdir(path.dirname(summaryFile), { recursive: true });
  await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2), "utf8");
}

function scenarioSlug(scenarioPath = "") {
  return path.basename(String(scenarioPath || "")).replace(/\.scenario\.(json|mjs)$/, "");
}

async function materializeScenarioPath(scenarioPath = "", outputDir = "") {
  const resolvedScenarioPath = path.resolve(String(scenarioPath || ""));
  if (!resolvedScenarioPath.endsWith(".scenario.mjs")) {
    return resolvedScenarioPath;
  }
  const module = await import(pathToFileURL(resolvedScenarioPath).href);
  const scenario = module?.default || module?.scenario || null;
  if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
    throw new Error(`Scenario module must export a scenario object: ${resolvedScenarioPath}`);
  }
  const materializedPath = path.join(
    path.resolve(outputDir || defaultOutputRoot),
    `${scenarioSlug(resolvedScenarioPath)}.materialized.scenario.json`,
  );
  await fs.writeFile(materializedPath, JSON.stringify(scenario, null, 2), "utf8");
  return materializedPath;
}

function runNodeScript(scriptPath, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--no-warnings", scriptPath, ...args], {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
      },
      ...options,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(scriptPath)} ${args.join(" ")} failed with code ${code}`));
      }
    });
  });
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
