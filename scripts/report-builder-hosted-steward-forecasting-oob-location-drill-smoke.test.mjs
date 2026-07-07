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
    "Updating results…",
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
  const buttons = page.getByRole("button", { name, exact: true });
  const count = await buttons.count();
  assert.notEqual(count, 0, `expected button '${name}' to exist`);
  await buttons.nth(0).click();
}

async function clickExactButtonIfPresent(page, name) {
  const buttons = page.getByRole("button", { name, exact: true });
  const count = await buttons.count();
  if (count === 0) {
    return false;
  }
  await buttons.nth(0).click();
  return true;
}

async function removeBreakdownChip(page, title) {
  const buttonLocator = page.locator(`button[title="${title}"]`);
  const count = await buttonLocator.count();
  assert.notEqual(count, 0, `expected breakdown chip '${title}' to exist`);
  try {
    await buttonLocator.nth(0).click({
      force: true,
      timeout: 5000,
    });
  } catch (_) {
    const removed = await page.evaluate((chipTitle) => {
      const button = Array.from(document.querySelectorAll("button")).find((entry) => {
        return String(entry.getAttribute("title") || "").trim() === chipTitle;
      });
      if (!button) {
        return false;
      }
      if (typeof button.click === "function") {
        button.click();
        return true;
      }
      button.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
      return true;
    }, title);
    assert.equal(removed, true, `expected fallback removal for breakdown chip '${title}'`);
  }
  await page.waitForTimeout(400);
}

async function setBreakdownSelector(page, value) {
  const select = page.locator('[data-testid="report-builder-breakdown-selector"]');
  const count = await select.count();
  assert.notEqual(count, 0, "expected breakdown selector");
  await select.nth(0).selectOption(value);
  await page.waitForTimeout(900);
}

async function readActiveBreakdownTitles(page) {
  return page.evaluate(() => {
    const knownTitles = new Set([
      "Date",
      "Channel",
      "Publisher",
      "Site",
      "Country",
      "Region",
      "City",
      "ZIP",
      "Metro Code",
    ]);
    return Array.from(document.querySelectorAll("button[title]"))
      .map((entry) => String(entry.getAttribute("title") || "").trim())
      .filter((title) => knownTitles.has(title));
  });
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
      .slice(0, 24)
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

async function waitForHeadersToMatch(page, predicate, message, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await readRuntimeState(page);
    if (predicate(state.headers)) {
      return state.headers;
    }
    await page.waitForTimeout(300);
  }
  throw new Error(message);
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

async function runHostedForecastLocationDrillSmoke({
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
    await clickExactButton(page, "Edit data");
    await page.getByText("Current data selection", { exact: true }).waitFor({ state: "visible", timeout: 30000 });

    await removeBreakdownChip(page, "Channel");
    await setBreakdownSelector(page, "country");

    const activeBreakdowns = await readActiveBreakdownTitles(page);
    assert.equal(
      activeBreakdowns.includes("Country"),
      true,
      `expected active breakdown chips to include Country, got ${JSON.stringify(activeBreakdowns)}`,
    );
    assert.equal(
      activeBreakdowns.includes("Channel"),
      false,
      `expected Channel to be removed from active breakdown chips, got ${JSON.stringify(activeBreakdowns)}`,
    );

    await clickExactButton(page, "Add table");
    await page.waitForTimeout(800);
    await clickExactButtonIfPresent(page, "Add Block");
    await page.getByText("Detail Table", { exact: true }).waitFor({ state: "visible", timeout: 30000 });

    await clickExactButton(page, "Run");
    await waitForActionIdle(page, 30000);

    const baselineState = await readRuntimeState(page);
    assert.equal(baselineState.rowCount > 0, true, "expected runtime preview rows after switching to Country");
    assert.equal(baselineState.headers.includes("Country"), true, "expected Country header in runtime preview");
    assert.equal(baselineState.actionTitles.includes("Drill to Region"), true, "expected Region drill action in runtime preview");

    await clickActionUntilChipAppears(page, {
      title: "Drill to Region",
      selector: '.forge-report-builder__runtime-preview [data-action-id="drill:country:region"]',
      chipPrefix: "Country =",
      headersPredicate: (headers) => headers.includes("Region") && !headers.includes("Country"),
      timeoutMs: 30000,
    });

    const regionState = await readRuntimeState(page);
    assert.equal(regionState.actionTitles.includes("Drill to Metro Code"), true, "expected Metro Code drill action after drilling to Region");

    await clickActionUntilChipAppears(page, {
      title: "Drill to Metro Code",
      selector: '.forge-report-builder__runtime-preview [data-action-id="drill:region:metrocode"]',
      chipPrefix: "Region =",
      headersPredicate: (headers) => headers.includes("Metro Code") && !headers.includes("Region"),
      timeoutMs: 30000,
    });

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
  "STEWARD_FORECASTING_LOCATION_DRILL_SMOKE_SCREENSHOT",
  path.resolve(SCRIPT_DIR, "../output/playwright/steward-forecasting-oob-location-drill-smoke.png"),
);

await runHostedForecastLocationDrillSmoke({
  authBaseURL,
  uiBaseURL,
  secretsURL,
  screenshotPath,
});

console.log("report-builder-hosted-steward-forecasting-oob-location-drill-smoke ✓ hosted Steward forecasting data editor pivots to Country and drills Country -> Region -> Metro Code through the real runtime preview");
