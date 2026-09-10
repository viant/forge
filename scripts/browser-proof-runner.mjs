import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

function fail(message) {
  throw new Error(message);
}

function substituteEnv(value) {
  if (typeof value === "string") {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key) => {
      if (!(key in process.env)) fail(`Missing required environment variable: ${key}`);
      return process.env[key] || "";
    });
  }
  if (Array.isArray(value)) return value.map(substituteEnv);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, substituteEnv(entry)]));
  }
  return value;
}

function timeout(step, fallback = 30_000) {
  return Number(step?.timeoutMs) || fallback;
}

function textContent(page) {
  return page.locator("body").innerText();
}

function locator(page, step) {
  if (step.selector) return page.locator(step.selector);
  if (step.role) return page.getByRole(step.role, { name: step.name, exact: step.exact === true });
  if (step.text !== undefined) return page.getByText(step.text, { exact: step.exact === true });
  fail(`${step.type} requires selector, role, or text`);
}

function indexed(target, step) {
  return target.nth(Number.isInteger(Number(step.index)) ? Number(step.index) : 0);
}

async function poll(fn, step, message) {
  const deadline = Date.now() + timeout(step);
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (await fn()) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  fail(`${message}${lastError ? `: ${lastError.message || lastError}` : ""}`);
}

function entryBody(entry) {
  return String(entry?.body || "");
}

function matchesEntry(entry, step) {
  const urlIncludes = String(step.urlIncludes || "");
  const method = String(step.method || "").toUpperCase();
  return (!urlIncludes || String(entry?.url || "").includes(urlIncludes))
    && (!method || String(entry?.method || "").toUpperCase() === method);
}

async function jsonEval(entry, expression) {
  const body = JSON.parse(entryBody(entry) || "null");
  return Function("body", `return (${expression});`)(body);
}

async function runStep(page, step, runtime) {
  const outputFile = (file) => path.resolve(runtime.outputDir, String(file || ""));
  switch (step.type) {
    case "goto":
      await page.goto(new URL(step.url, runtime.baseUrl).href, { waitUntil: step.waitUntil || "domcontentloaded", timeout: timeout(step, 60_000) });
      return;
    case "reload":
      await page.reload({ waitUntil: step.waitUntil || "domcontentloaded", timeout: timeout(step, 60_000) });
      return;
    case "wait":
      await page.waitForTimeout(Number(step.ms) || 0);
      return;
    case "setViewport":
      await page.setViewportSize({ width: Number(step.width), height: Number(step.height) });
      return;
    case "clickRole":
    case "clickText":
    case "clickSelector":
      await indexed(locator(page, step), step).click({ timeout: timeout(step) });
      return;
    case "clickSelectorContains": {
      const target = page.locator(step.selector).filter({ hasText: step.text });
      await indexed(target, step).click({ timeout: timeout(step) });
      return;
    }
    case "fillSelector":
      await indexed(page.locator(step.selector), step).fill(String(step.value ?? step.text ?? ""), { timeout: timeout(step) });
      return;
    case "selectSelector":
      await indexed(page.locator(step.selector), step).selectOption(step.value ?? step.values, { timeout: timeout(step) });
      return;
    case "scrollSelector":
      await indexed(page.locator(step.selector), step).scrollIntoViewIfNeeded({ timeout: timeout(step) });
      return;
    case "setInputFiles": {
      const files = (Array.isArray(step.paths) ? step.paths : [step.path]).map(outputFile);
      await indexed(page.locator(step.selector), step).setInputFiles(files, { timeout: timeout(step) });
      return;
    }
    case "setInputFilesFromLatestDownload": {
      const downloads = runtime.downloads.filter((entry) => !entry.failure && (!step.filenameContains || entry.name.includes(step.filenameContains)));
      if (downloads.length === 0) fail("No matching completed download");
      await indexed(page.locator(step.selector), step).setInputFiles(downloads.at(-1).path, { timeout: timeout(step) });
      return;
    }
    case "eval":
      await page.evaluate(step.expression);
      return;
    case "waitForEval":
      await page.waitForFunction(step.expression, null, { timeout: timeout(step) });
      return;
    case "waitSelector":
      await indexed(page.locator(step.selector), step).waitFor({ state: step.state || "visible", timeout: timeout(step) });
      return;
    case "waitRole":
    case "waitForText":
      await indexed(locator(page, step), step).waitFor({ state: "visible", timeout: timeout(step) });
      return;
    case "waitForSelectorContains":
      await indexed(page.locator(step.selector).filter({ hasText: step.text }), step).waitFor({ state: "visible", timeout: timeout(step) });
      return;
    case "waitForDomContains":
      await poll(async () => (await textContent(page)).includes(step.text), step, `DOM did not contain '${step.text}'`);
      return;
    case "waitForChartRender":
      await poll(async () => page.locator(step.selector || "svg, canvas").count() > 0, step, "Chart did not render");
      return;
    case "assertText":
    case "assertRoleText":
      if (await indexed(locator(page, step), step).count() < 1) fail(`Expected visible text '${step.text || step.name}'`);
      return;
    case "assertNotText":
      if (await locator(page, step).count() > 0) fail(`Unexpected text '${step.text}'`);
      return;
    case "assertSelectorContains": {
      const actual = await indexed(page.locator(step.selector), step).innerText();
      if (!actual.includes(step.text)) fail(`Selector '${step.selector}' did not contain '${step.text}'`);
      return;
    }
    case "assertDomContains":
      if (!(await textContent(page)).includes(step.text)) fail(`DOM did not contain '${step.text}'`);
      return;
    case "assertDomNotContains":
      if ((await textContent(page)).includes(step.text)) fail(`DOM unexpectedly contained '${step.text}'`);
      return;
    case "clearLocalStorage":
      await page.evaluate((keys) => keys?.length ? keys.forEach((key) => localStorage.removeItem(key)) : localStorage.clear(), step.keys || []);
      return;
    case "clearConsoleEntries": runtime.consoleEntries.length = 0; return;
    case "clearRequestEntries": runtime.requests.length = 0; return;
    case "clearResponseEntries": runtime.responses.length = 0; return;
    case "clearDownloadEntries": runtime.downloads.length = 0; return;
    case "assertConsoleNotContains":
      if (runtime.consoleEntries.some((entry) => entry.includes(step.text))) fail(`Console unexpectedly contained '${step.text}'`);
      return;
    case "waitForRequestBodyContains":
    case "waitForResponseBodyContains": {
      const entries = step.type.includes("Request") ? runtime.requests : runtime.responses;
      await poll(() => entries.some((entry) => matchesEntry(entry, step) && entryBody(entry).includes(step.text)), step, `No matching ${step.type.includes("Request") ? "request" : "response"} body`);
      return;
    }
    case "assertRequestBodyContains":
    case "assertResponseBodyContains": {
      const entries = step.type.includes("Request") ? runtime.requests : runtime.responses;
      if (!entries.some((entry) => matchesEntry(entry, step) && entryBody(entry).includes(step.text))) fail(`No matching body contained '${step.text}'`);
      return;
    }
    case "waitForRequestJsonEval":
    case "waitForResponseJsonEval": {
      const entries = step.type.includes("Request") ? runtime.requests : runtime.responses;
      await poll(async () => {
        for (const entry of entries.filter((candidate) => matchesEntry(candidate, step))) {
          try { if (await jsonEval(entry, step.expression)) return true; } catch (_) { /* keep polling */ }
        }
        return false;
      }, step, "No matching JSON entry satisfied the expression");
      return;
    }
    case "assertRequestJsonEval":
    case "assertResponseJsonEval": {
      const entries = step.type.includes("Request") ? runtime.requests : runtime.responses;
      for (const entry of entries.filter((candidate) => matchesEntry(candidate, step))) {
        try { if (await jsonEval(entry, step.expression)) return; } catch (_) { /* try next */ }
      }
      fail("No matching JSON entry satisfied the expression");
    }
    case "waitForDownload":
      await poll(() => runtime.downloads.some((entry) => !step.filenameContains || entry.name.includes(step.filenameContains)), step, "Expected download did not complete");
      return;
    case "assertDownload":
      if (!runtime.downloads.some((entry) => !step.filenameContains || entry.name.includes(step.filenameContains))) fail("Expected download was not recorded");
      return;
    case "screenshot":
      await fs.mkdir(path.dirname(outputFile(step.file)), { recursive: true });
      await page.screenshot({ path: outputFile(step.file), fullPage: step.fullPage === true });
      return;
    default:
      fail(`Unsupported browser-proof step type: ${step.type}`);
  }
}

async function main() {
  const scenarioPath = process.argv[2];
  if (!scenarioPath) fail("Usage: node scripts/browser-proof-runner.mjs <scenario.json> [output-dir]");
  const outputDir = path.resolve(process.argv[3] || "output/playwright/browser-proof");
  const scenario = substituteEnv(JSON.parse(await fs.readFile(path.resolve(scenarioPath), "utf8")));
  const baseUrl = String(process.env.BASE_URL || scenario.baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) fail("BASE_URL or scenario.baseUrl is required");
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: scenario.headless !== false });
  const context = await browser.newContext({ viewport: scenario.viewport || { width: 1280, height: 720 }, acceptDownloads: true });
  const page = await context.newPage();
  const runtime = { baseUrl, outputDir, consoleEntries: [], requests: [], responses: [], downloads: [] };
  page.on("console", (message) => runtime.consoleEntries.push(`${message.type()}: ${message.text()}`));
  page.on("request", (request) => runtime.requests.push({ url: request.url(), method: request.method(), body: request.postData() || "" }));
  page.on("response", async (response) => runtime.responses.push({ url: response.url(), method: response.request().method(), body: await response.text().catch(() => "") }));
  page.on("download", async (download) => {
    const name = download.suggestedFilename();
    const filePath = path.resolve(outputDir, "downloads", name);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    let failure = "";
    try { await download.saveAs(filePath); } catch (error) { failure = String(error?.message || error); }
    runtime.downloads.push({ name, path: filePath, failure });
  });
  for (const mock of scenario.routeMocks || []) {
    let hits = 0;
    await page.route((url) => url.href.includes(mock.urlIncludes), async (route) => {
      if (mock.method && route.request().method() !== String(mock.method).toUpperCase()) return route.fallback();
      if (Number.isFinite(Number(mock.times)) && hits >= Number(mock.times)) return route.fallback();
      hits += 1;
      await route.fulfill({ status: Number(mock.status) || 200, headers: mock.headers, contentType: mock.contentType || (mock.json !== undefined ? "application/json" : "text/plain"), body: mock.json !== undefined ? JSON.stringify(mock.json) : String(mock.text || "") });
    });
  }
  try {
    for (let index = 0; index < (scenario.steps || []).length; index += 1) {
      try {
        await runStep(page, scenario.steps[index], runtime);
      } catch (error) {
        throw new Error(`Step ${index + 1} (${scenario.steps[index]?.type || "unknown"}) failed: ${error?.message || error}`, { cause: error });
      }
    }
  } catch (error) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await page.screenshot({ path: path.resolve(outputDir, `failure-${stamp}.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
