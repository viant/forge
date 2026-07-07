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

async function waitForActionIdle(page, timeoutMs = 25000) {
  return waitForNotText(page, [
    "Refreshing authored runtime",
    "Preparing authored report",
    "Executing the compiled runtime request",
    "Updating this report with the latest results…",
  ], timeoutMs);
}

async function clickFirstAction(page, title) {
  const buttons = page.locator(`.forge-report-runtime-table-panel tbody tr .forge-dashboard-row-action[title="${title}"]`);
  const count = await buttons.count();
  assert.notEqual(count, 0, `expected runtime action '${title}' to be present`);
  await buttons.nth(0).click();
}

async function clearAllRefinements(page) {
  const clearButtons = page.getByRole("button", { name: "Clear all" });
  const count = await clearButtons.count();
  if (count > 0) {
    await clearButtons.nth(0).click();
    await waitForActionIdle(page, 25000);
  }
}

async function readRuntimeState(page) {
  return page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll(".forge-report-runtime-refinement-chip,.forge-report-builder__result-meta-chip"))
      .map((node) => (node.innerText || node.textContent || "").trim())
      .filter(Boolean);
    const rowActions = Array.from(document.querySelectorAll(".forge-report-runtime-table-panel tbody tr .forge-dashboard-row-action"))
      .slice(0, 8)
      .map((node) => ({
        title: node.getAttribute("title") || "",
        visible: (node.querySelector(".forge-dashboard-row-action__label")?.textContent || "").trim(),
      }));
    const rowCount = document.querySelectorAll(".forge-report-runtime-table-panel tbody tr").length;
    const body = document.body.innerText || "";
    return {
      body,
      chips,
      rowActions,
      rowCount,
    };
  });
}

async function assertContainsActionTitles(page, expectedTitles) {
  const state = await readRuntimeState(page);
  const presentTitles = new Set(state.rowActions.map((entry) => entry.title).filter(Boolean));
  expectedTitles.forEach((title) => {
    assert.equal(presentTitles.has(title), true, `expected runtime action title '${title}' to be present`);
  });
  return state;
}

async function runHostedRuntimeActionSmoke({
  authBaseURL,
  uiBaseURL,
  conversationId,
  secretsURL,
  starterLabel,
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
    await page.goto(`${uiBaseURL}/conversation/${conversationId}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    const useButtons = page.getByRole("button", { name: "Use" });
    if (await useButtons.count()) {
      await useButtons.first().click();
      await page.waitForTimeout(1200);
      const afterUseBody = (await page.locator("body").textContent()) || "";
      assert.equal(
        afterUseBody.includes(`${starterLabel} applied.`),
        true,
        `expected hosted builder to apply starter ${starterLabel}`,
      );
    }

    await page.locator(".forge-report-builder__run-button").click();
    await waitForActionIdle(page, 25000);
    await clearAllRefinements(page);

    const baselineState = await assertContainsActionTitles(page, [
      "Keep only",
      "Exclude",
      "Drill to Publisher",
      "Show channel details",
    ]);
    assert.equal(baselineState.rowCount > 1, true, "expected hosted authored report to render more than one base row");

    await clickFirstAction(page, "Keep only");
    await waitForActionIdle(page, 25000);
    const keptState = await readRuntimeState(page);
    assert.equal(
      keptState.chips.some((entry) => entry.includes("Keep only =")),
      true,
      "expected Keep only to create an active refinement chip",
    );
    assert.equal(
      keptState.rowCount < baselineState.rowCount,
      true,
      "expected Keep only to reduce the rendered runtime table rows",
    );

    await clearAllRefinements(page);
    const clearedAfterKeepState = await readRuntimeState(page);
    assert.equal(
      clearedAfterKeepState.chips.length,
      0,
      "expected Clear all to remove Keep only refinements",
    );

    await clickFirstAction(page, "Exclude");
    await waitForActionIdle(page, 25000);
    const excludedState = await readRuntimeState(page);
    assert.equal(
      excludedState.chips.some((entry) => entry.includes("Exclude =")),
      true,
      "expected Exclude to create an active refinement chip",
    );
    assert.equal(
      excludedState.rowCount < baselineState.rowCount,
      true,
      "expected Exclude to reduce the rendered runtime table rows",
    );

    await clearAllRefinements(page);
    const clearedAfterExcludeState = await readRuntimeState(page);
    assert.equal(
      clearedAfterExcludeState.chips.length,
      0,
      "expected Clear all to remove Exclude refinements",
    );

    await clickFirstAction(page, "Show channel details");
    await waitForActionIdle(page, 25000);
    const channelDetailState = await readRuntimeState(page);
    assert.equal(
      channelDetailState.body.includes("target://steward/performance/channel-detail"),
      true,
      "expected hosted channel detail action to resolve the Steward channel detail target",
    );
    assert.equal(
      channelDetailState.body.includes("Detail target resolved with omitted parameters"),
      false,
      "hosted channel detail action should not emit omitted-parameter diagnostics",
    );

    await clickFirstAction(page, "Drill to Publisher");
    await waitForActionIdle(page, 25000);
    const drilledState = await assertContainsActionTitles(page, [
      "Keep only",
      "Exclude",
      "Drill to Site Type",
      "Show publisher details",
    ]);

    assert.equal(
      drilledState.body.includes("Publisher"),
      true,
      "expected hosted authored report to drill from channel to publisher rows",
    );

    await clickFirstAction(page, "Show publisher details");
    await waitForActionIdle(page, 25000);
    const publisherDetailState = await readRuntimeState(page);

    assert.equal(
      publisherDetailState.body.includes("target://steward/performance/publisher-detail"),
      true,
      "expected hosted publisher detail action to resolve the Steward publisher detail target",
    );
    assert.equal(
      publisherDetailState.body.includes("Detail target resolved with omitted parameters"),
      false,
      "hosted publisher detail action should not emit omitted-parameter diagnostics",
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
const conversationId = requireEnv("STEWARD_CONVERSATION_ID");
const secretsURL = requireEnv("STEWARD_OOB_SECRETS_URL");
const starterLabel = optionalEnv("STEWARD_REPORT_STARTER_LABEL", "Performance Inventory Brief");
const screenshotPath = optionalEnv(
  "STEWARD_HOSTED_DRILL_SMOKE_SCREENSHOT",
  path.resolve(SCRIPT_DIR, "../output/playwright/steward-hosted-oob-drill-smoke.png"),
);

await runHostedRuntimeActionSmoke({
  authBaseURL,
  uiBaseURL,
  conversationId,
  secretsURL,
  starterLabel,
  screenshotPath,
});

console.log("report-builder-hosted-steward-oob-drill-smoke ✓ hosted Steward BFF session verifies keep, exclude, channel detail, drill-to-publisher, and publisher detail through the real report builder");
