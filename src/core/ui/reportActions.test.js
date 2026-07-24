import assert from "node:assert/strict";

import { runUICommand } from "./commands.js";
import {
  registerReportWindowActions,
  scheduleReportWindowMutation,
} from "./reportActions.js";

const calls = [];
const unregister = registerReportWindowActions("report-window-1", {
  getCurrent: () => ({
    ok: true,
    reportId: "delivery-review",
    request: { orderIds: [2680567] },
  }),
  run: (input) => {
    calls.push(["run", input]);
    return { ok: true, reportId: "delivery-review" };
  },
  save: async (input) => {
    calls.push(["save", input]);
    return {
      ok: true,
      artifactId: "artifact-1",
      reportId: "delivery-review",
    };
  },
});

assert.deepEqual(
  await runUICommand({
    method: "ui.report.getCurrent",
    params: { windowId: "report-window-1" },
  }),
  {
    ok: true,
    reportId: "delivery-review",
    request: { orderIds: [2680567] },
  },
);

assert.deepEqual(
  await runUICommand({
    method: "ui.report.run",
    params: { windowId: "report-window-1" },
  }),
  { ok: true, reportId: "delivery-review" },
);

assert.deepEqual(
  await runUICommand({
    method: "ui.report.save",
    params: { windowId: "report-window-1" },
  }),
  {
    ok: true,
    artifactId: "artifact-1",
    reportId: "delivery-review",
  },
);

assert.equal(calls.length, 2);
unregister();

const scheduled = [];
let mutationStarted = false;
scheduleReportWindowMutation(
  () => {
    mutationStarted = true;
  },
  (handler, delay) => scheduled.push({ handler, delay }),
);
assert.equal(mutationStarted, false);
assert.equal(scheduled.length, 1);
assert.equal(scheduled[0].delay, 0);
scheduled[0].handler();
assert.equal(mutationStarted, true);

await assert.rejects(
  runUICommand({
    method: "ui.report.getCurrent",
    params: { windowId: "report-window-1" },
  }),
  /report surface not found/,
);

console.log("reportActions ✓ dispatches typed report lifecycle actions");
