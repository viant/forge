import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parsePreviewScenarioRunnerArgs } from "./report-builder-preview-scenarios.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const viteBin = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");
const runnerScript = path.join(repoRoot, "scripts", "run-report-builder-preview-scenarios.mjs");
const staticPreviewConfig = path.join(repoRoot, "vite.reportbuilder-preview.config.mjs");
const defaultStaticPreviewDir = path.join(repoRoot, "output", "report-builder-preview-static");
const defaultStaticScenarioOutputRoot = path.join(repoRoot, "output", "playwright", "report-builder-preview-static");

function normalizeArgValue(value = "") {
  return String(value || "").trim();
}

export function resolveStaticPreviewOutputDir() {
  return defaultStaticPreviewDir;
}

export function resolveStaticPreviewBaseUrl(outputDir = defaultStaticPreviewDir) {
  return pathToFileURL(path.resolve(outputDir)).href.replace(/\/$/, "");
}

function filterForwardedArgs(args = []) {
  const rawArgs = Array.isArray(args) ? args.slice() : [];
  const forwarded = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = normalizeArgValue(rawArgs[index]);
    if (!arg) {
      continue;
    }
    if (arg === "--base-url") {
      index += 1;
      continue;
    }
    if (arg.startsWith("--base-url=")) {
      continue;
    }
    forwarded.push(arg);
  }
  return forwarded;
}

export function buildStaticPreviewScenarioRunnerArgs(args = [], {
  outputRoot = defaultStaticScenarioOutputRoot,
  baseUrl = resolveStaticPreviewBaseUrl(),
} = {}) {
  const parsed = parsePreviewScenarioRunnerArgs(filterForwardedArgs(args));
  const forwarded = [];
  if (parsed.list) {
    forwarded.push("--list");
  }
  if (parsed.help) {
    forwarded.push("--help");
  }
  if (parsed.continueOnError) {
    forwarded.push("--continue-on-error");
  }
  forwarded.push("--base-url", normalizeArgValue(baseUrl));
  forwarded.push("--output-root", normalizeArgValue(parsed.outputRoot || outputRoot));
  if (normalizeArgValue(parsed.summaryFile)) {
    forwarded.push("--summary-file", normalizeArgValue(parsed.summaryFile));
  }
  forwarded.push(...parsed.scenarioArgs.map((entry) => normalizeArgValue(entry)).filter(Boolean));
  return forwarded;
}

export function formatStaticPreviewRunnerError(error = null) {
  const message = String(error?.message || error || "").trim();
  if (!message) {
    return [
      "Static preview scenario runner failed.",
      "If the failure was a Playwright browser launch problem, rerun on a host that allows headless browser startup and has the required Playwright browser binaries installed.",
    ].join("\n");
  }
  if (message.includes("static preview scenario runner exited with code")) {
    return [
      message,
      "If the underlying failure was a Playwright browser launch error, rerun on a host that allows headless browser startup.",
      "If browser binaries are missing, run `npx playwright install` from the workspace before retrying.",
    ].join("\n");
  }
  return message;
}

function spawnChild(command, args, options = {}) {
  return spawn(command, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
    },
    stdio: "inherit",
    ...options,
  });
}

function waitForExit(child, label) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} exited with code ${code}`));
      }
    });
  });
}

async function buildStaticPreview(outputDir = defaultStaticPreviewDir) {
  const buildChild = spawnChild(process.execPath, [
    "--no-warnings",
    viteBin,
    "build",
    "--config",
    staticPreviewConfig,
  ]);
  await waitForExit(buildChild, "static preview build");
  const previewHtmlPath = path.join(outputDir, "report-builder-preview.html");
  await fs.access(previewHtmlPath);
  return previewHtmlPath;
}

async function main() {
  const runnerArgs = buildStaticPreviewScenarioRunnerArgs(process.argv.slice(2), {
    outputRoot: defaultStaticScenarioOutputRoot,
    baseUrl: resolveStaticPreviewBaseUrl(defaultStaticPreviewDir),
  });
  await buildStaticPreview(defaultStaticPreviewDir);
  const runnerChild = spawnChild(process.execPath, [
    "--no-warnings",
    runnerScript,
    ...runnerArgs,
  ]);
  try {
    await waitForExit(runnerChild, "static preview scenario runner");
  } catch (error) {
    throw new Error(formatStaticPreviewRunnerError(error));
  }
}

const invokedPath = normalizeArgValue(process.argv[1] || "");
const currentScriptUrl = pathToFileURL(__filename).href;
const invokedScriptUrl = invokedPath ? pathToFileURL(path.resolve(invokedPath)).href : "";

if (invokedScriptUrl === currentScriptUrl) {
  main().catch((error) => {
    console.error(String(error?.message || error));
    process.exit(1);
  });
}
