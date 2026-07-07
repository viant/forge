import assert from "node:assert/strict";

import { resolveDashboardTableColumnValue } from "./dashboardTableValue.js";

const row = {
  channelV2: 1,
  channel: {
    channel: "Display",
  },
  publisherId: 362,
  publisher: {
    name: "Equativ (Smart AdServer)",
  },
};

assert.equal(resolveDashboardTableColumnValue(row, {
  key: "channelV2",
  sourceKey: "channelV2",
  displayKey: "channel.channel",
}, { preferDisplay: true }), "Display");

assert.equal(resolveDashboardTableColumnValue(row, {
  key: "channelV2",
  sourceKey: "channelV2",
  displayKey: "channel.channel",
}, { preferDisplay: false }), 1);

assert.equal(resolveDashboardTableColumnValue(row, {
  key: "publisherId",
  sourceKey: "publisherId",
  displayKey: "publisher.name",
}, { preferDisplay: true }), "Equativ (Smart AdServer)");

assert.equal(resolveDashboardTableColumnValue(row, {
  key: "missing",
  sourceKey: "missing",
  displayKey: "publisher.name",
}, { preferDisplay: true }), "Equativ (Smart AdServer)");

assert.equal(resolveDashboardTableColumnValue(row, {
  key: "missing",
  sourceKey: "missing",
}, { preferDisplay: true }), undefined);

assert.equal(resolveDashboardTableColumnValue({
  channelId: 1,
}, {
  key: "channelId",
  sourceKey: "channelId",
  displayKey: "channelName",
  displayValueMap: {
    "1": "Display",
    "2": "CTV",
  },
}, { preferDisplay: true }), "Display");

assert.equal(resolveDashboardTableColumnValue({
  channelId: 1,
}, {
  key: "channelId",
  sourceKey: "channelId",
  displayKey: "channelId",
  displayValueMap: {
    "1": "Display",
    "2": "CTV",
  },
}, { preferDisplay: true }), "Display");

console.log("dashboardVisualUtils ✓ resolves table display values from displayKey before raw source fields");
