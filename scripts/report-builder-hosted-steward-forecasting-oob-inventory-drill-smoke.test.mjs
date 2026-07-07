import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalEnv(name, fallback = "") {
  const value = String(process.env[name] || "").trim();
  return value || fallback;
}

async function loadPlaywright() {
  const configuredModulePath = optionalEnv("PLAYWRIGHT_MODULE_PATH");
  const candidatePaths = [
    configuredModulePath,
    path.resolve(process.cwd(), "node_modules/playwright/index.mjs"),
    path.resolve(process.cwd(), "node_modules/playwright/index.js"),
    path.resolve(SCRIPT_DIR, "../node_modules/playwright/index.mjs"),
    path.resolve(SCRIPT_DIR, "../node_modules/playwright/index.js"),
    path.resolve(SCRIPT_DIR, "../../agently/ui/node_modules/playwright/index.mjs"),
    path.resolve(SCRIPT_DIR, "../../agently/ui/node_modules/playwright/index.js"),
  ].filter(Boolean);
  for (const candidatePath of candidatePaths) {
    if (!fs.existsSync(candidatePath)) {
      continue;
    }
    return import(pathToFileURL(candidatePath).href);
  }
  throw new Error(
    "Unable to resolve Playwright. Set PLAYWRIGHT_MODULE_PATH or install Playwright where the hosted Steward smoke script can import it.",
  );
}

async function waitForNotText(page, texts, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const body = (await page.locator("body").textContent()) || "";
    if (!texts.some((text) => body.includes(text))) {
      return body;
    }
    await page.waitForTimeout(500);
  }
  return (await page.locator("body").textContent()) || "";
}

async function waitForActionIdle(page, timeoutMs = 25000) {
  return waitForNotText(page, [
    "Refreshing authored runtime",
    "Preparing authored report",
    "Executing the compiled runtime request",
    "Updating this report with the latest results…",
  ], timeoutMs);
}

async function issueOOBSession({ authBaseURL, secretsURL }) {
  const response = await fetch(`${authBaseURL}/v1/api/auth/oob`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      secretsURL,
    }),
  });
  const bodyText = await response.text();
  const setCookie = response.headers.get("set-cookie") || "";
  const match = /agently_session=([^;]+)/.exec(setCookie);
  assert.equal(response.ok, true, `expected /v1/api/auth/oob to succeed, got ${response.status}: ${bodyText}`);
  assert.notEqual(match, null, "expected agently_session cookie from /v1/api/auth/oob");
  return match[1];
}

async function clickExactButton(page, name) {
  const buttons = page.getByRole("button", { name });
  const count = await buttons.count();
  assert.notEqual(count, 0, `expected button '${name}' to exist`);
  await buttons.nth(0).click();
}

async function waitForTableHeaders(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll(".forge-report-builder__runtime-preview th"))
    .map((node) => (node.innerText || node.textContent || "").trim())
    .filter(Boolean));
}

async function waitForHeadersToMatch(page, predicate, message, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const headers = await waitForTableHeaders(page);
    if (predicate(headers)) {
      return headers;
    }
    await page.waitForTimeout(300);
  }
  throw new Error(message);
}

async function readRuntimeState(page) {
  return page.evaluate(() => {
    const body = document.body.innerText || "";
    const headers = Array.from(document.querySelectorAll(".forge-report-builder__runtime-preview th"))
      .map((node) => (node.innerText || node.textContent || "").trim())
      .filter(Boolean);
    const chips = Array.from(document.querySelectorAll(".forge-report-builder__runtime-preview .forge-report-runtime-refinement-chip,.forge-report-builder__runtime-preview .forge-report-builder__result-meta-chip"))
      .map((node) => (node.innerText || node.textContent || "").trim())
      .filter(Boolean);
    const rowCount = document.querySelectorAll(".forge-report-builder__runtime-preview tbody tr").length;
    const actionTitles = Array.from(document.querySelectorAll(".forge-report-builder__runtime-preview .forge-dashboard-row-action"))
      .slice(0, 16)
      .map((node) => node.getAttribute("title") || "")
      .filter(Boolean);
    return {
      body,
      headers,
      chips,
      rowCount,
      actionTitles,
    };
  });
}

async function clickTableActionByTitle(page, title, index = 0) {
  const buttons = page.locator(`.forge-report-builder__runtime-preview .forge-dashboard-row-action[title="${title}"]`);
  const count = await buttons.count();
  assert.ok(count > index, `expected action '${title}' at index ${index}, found ${count}`);
  await buttons.nth(index).click();
}

async function clickRowActionByTextAndSelector(page, {
  rowText = "",
  selector = "",
}) {
  const clicked = await page.evaluate(({ nextRowText, nextSelector }) => {
    const normalizedRowText = String(nextRowText || "").trim();
    const normalizedSelector = String(nextSelector || "").trim();
    const rows = Array.from(document.querySelectorAll(".forge-report-builder__runtime-preview tbody tr"));
    const row = rows.find((entry) => (entry.innerText || entry.textContent || "").includes(normalizedRowText));
    if (!row) {
      return false;
    }
    const action = row.querySelector(normalizedSelector);
    if (!action || typeof action.click !== "function") {
      return false;
    }
    action.click();
    return true;
  }, {
    nextRowText: rowText,
    nextSelector: selector,
  });
  assert.equal(clicked, true, `expected row action '${selector}' inside row containing '${rowText}'`);
}

async function clickActionUntilChipAppears(page, {
  title,
  selector = "",
  chipPrefix,
  headersPredicate = null,
  timeoutMs = 25000,
}) {
  const buttons = selector
    ? page.locator(selector)
    : page.locator(`.forge-report-builder__runtime-preview .forge-dashboard-row-action[title="${title}"]`);
  const count = await buttons.count();
  assert.notEqual(count, 0, `expected at least one '${title || selector}' action`);
  const attemptedIndices = [];
  for (let index = 0; index < count; index += 1) {
    attemptedIndices.push(index);
    await buttons.nth(index).click();
    await waitForActionIdle(page, timeoutMs);
    const state = await readRuntimeState(page);
    const hasChip = state.chips.some((entry) => entry.includes(chipPrefix));
    const headersOk = typeof headersPredicate === "function" ? headersPredicate(state.headers) : true;
    if (hasChip && headersOk) {
      return {
        index,
        attemptedIndices,
        state,
      };
    }
  }
  throw new Error(`No '${title || selector}' action produced chip '${chipPrefix}' with the expected headers. Tried indices: ${attemptedIndices.join(", ") || "none"}.`);
}

async function runHostedForecastInventoryDrillSmoke({
  authBaseURL,
  uiBaseURL,
  secretsURL,
  screenshotPath,
}) {
  const { chromium } = await loadPlaywright();
  const sessionValue = await issueOOBSession({
    authBaseURL,
    secretsURL,
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: {
        width: 1440,
        height: 1400,
      },
    });
    const origin = new URL(uiBaseURL);
    await context.addCookies([{
      name: "agently_session",
      value: sessionValue,
      domain: origin.hostname,
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    }]);
    const page = await context.newPage();
    await page.goto(`${uiBaseURL}/mcp-ui/forge-window?windowKey=forecastingCubeBuilder`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.getByText("No blocks yet.", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
    await clickExactButton(page, "Use");
    await page.getByText("Forecast Inventory Brief applied.", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
    await page.getByText("Channel Comparison", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
    await clickExactButton(page, "Run");
    await waitForActionIdle(page, 30000);

    const baselineState = await readRuntimeState(page);
    assert.equal(baselineState.body.includes("Channel Comparison"), true, "expected Channel Comparison runtime table in preview");
    assert.equal(baselineState.rowCount > 0, true, "expected runtime preview rows for Forecast Inventory Brief");
    [
      "Keep only",
      "Exclude",
      "Drill to Publisher",
    ].forEach((title) => {
      assert.equal(baselineState.actionTitles.includes(title), true, `expected '${title}' in baseline actions`);
    });

    await clickRowActionByTextAndSelector(page, {
      rowText: "Audio",
      selector: '[data-action-id="drill:channelV2:publisherId"]',
    });
    await waitForActionIdle(page, 30000);
    const firstDrillState = await readRuntimeState(page);
    assert.equal(
      firstDrillState.chips.some((entry) => entry.includes("Channel =")),
      true,
      "expected first drill chip after drilling from Audio to Publisher",
    );
    const publisherHeaders = await waitForHeadersToMatch(page, (headers) => headers.includes("Publisher") && !headers.includes("Channel"), "expected runtime preview to drill from Channel to Publisher");
    assert.ok(publisherHeaders.includes("Publisher"), "expected Publisher header after first drill");
    const publisherState = await readRuntimeState(page);
    assert.equal(
      publisherState.actionTitles.includes("Drill to Site Type"),
      true,
      "expected Site Type drill action after first drill",
    );

    const secondDrillResult = await clickActionUntilChipAppears(page, {
      title: "Drill to Site Type",
      selector: '.forge-report-builder__runtime-preview [data-action-id="drill:publisherId:siteType"]',
      chipPrefix: "Publisher =",
      headersPredicate: (headers) => headers.includes("Site Type") && !headers.includes("Publisher"),
      timeoutMs: 30000,
    });
    assert.equal(
      secondDrillResult.state.chips.some((entry) => entry.includes("Publisher =")),
      true,
      "expected second drill chip after drilling to Site Type",
    );

    if (screenshotPath) {
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });
    }
  } finally {
    await browser.close();
  }
}

const authBaseURL = optionalEnv("STEWARD_AUTH_BASE_URL", "http://127.0.0.1:9191");
const uiBaseURL = optionalEnv("STEWARD_UI_BASE_URL", "http://127.0.0.1:5173");
const secretsURL = requireEnv("STEWARD_OOB_SECRETS_URL");
const screenshotPath = optionalEnv(
  "STEWARD_FORECASTING_INVENTORY_DRILL_SMOKE_SCREENSHOT",
  path.resolve(SCRIPT_DIR, "../output/playwright/steward-forecasting-oob-inventory-drill-smoke.png"),
);

await runHostedForecastInventoryDrillSmoke({
  authBaseURL,
  uiBaseURL,
  secretsURL,
  screenshotPath,
});

console.log("report-builder-hosted-steward-forecasting-oob-inventory-drill-smoke ✓ hosted Steward forecasting starter drills from channel to publisher to site type through the real runtime preview");
