import assert from "node:assert/strict";

import { runUICommand } from "./commands.js";
import {
  registerReportWindowActions,
  scheduleReportWindowMutation,
  reportWindowRunReceipt,
  reportWindowMaterialization,
} from "./reportActions.js";

const calls = [];

// Synthetic live execution: no persistence is available, but orchestration can
// follow its exact identity without treating the dispatch as completed data.
assert.deepEqual(reportWindowRunReceipt({ok:true,runId:'live-1',durable:false}), {
  ok:true,accepted:true,status:'running',materializationId:'live-1',
});
assert.deepEqual(reportWindowRunReceipt({ok:true,runId:'saved-1',durable:true}), {
  ok:true,durable:true,reportRunId:'saved-1',
});
assert.equal(reportWindowRunReceipt({ok:true}).ok,false);
assert.deepEqual(reportWindowRunReceipt({ok:false,error:'failed'}),{ok:false,error:'failed'});
const live = {runId:'live-1',durable:false,status:'running'};
assert.equal(reportWindowMaterialization(live,{fresh:true,status:'completed'}).status,'running');
assert.equal(reportWindowMaterialization({...live,status:'completed'},{fresh:false}).status,'running');
assert.deepEqual(reportWindowMaterialization({...live,status:'completed'},{fresh:true,datasets:[]}), {
  fresh:true,datasets:[],id:'live-1',status:'completed',errors:[],
});
assert.equal(reportWindowMaterialization({...live,runId:'live-2'},{fresh:true}).id,'live-2');
assert.deepEqual(reportWindowMaterialization({...live,status:'failed',error:{message:'source unavailable'}},{}).errors,['source unavailable']);
assert.equal(reportWindowMaterialization({...live,status:'superseded'},{}).status,'failed');
const savedMaterialization={status:'completed'};
assert.equal(reportWindowMaterialization({...live,durable:true},savedMaterialization),savedMaterialization);
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


// UI command input reaches the registered report handler unchanged.
const linkedParams = { windowId: "linked-window", requestId: "12345678-1234-1234-1234-123456789ABC", reportAdmissionRef: " opaque/ref " };
const unregisterLinked = registerReportWindowActions("linked-window", {
  run: input => { assert.deepEqual(input, linkedParams); return { ok: true, materializationId: input.requestId }; },
});
assert.equal((await runUICommand({ method: "ui.report.run", params: linkedParams })).materializationId, linkedParams.requestId);
unregisterLinked();
