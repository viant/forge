import assert from "node:assert/strict";

import {
  normalizeDashboardRowActionDisplayMode,
  normalizeDashboardRowActionKind,
  normalizeDashboardRowActionLabel,
  resolveDashboardRowActionIdentity,
  resolveDashboardRowActionKey,
  resolveDashboardRowActionPresentation,
  resolveDashboardRowActionShortLabel,
  resolveDashboardRowActionVisibleLabel,
} from "./dashboardRowActionPresentation.js";

assert.equal(normalizeDashboardRowActionDisplayMode(" compact "), "compact");
assert.equal(normalizeDashboardRowActionDisplayMode("icon-only"), "icon");
assert.equal(normalizeDashboardRowActionDisplayMode(""), "full");

assert.equal(normalizeDashboardRowActionKind(" Drill "), "drill");
assert.equal(normalizeDashboardRowActionLabel(" Show channel details "), "Show channel details");
assert.equal(normalizeDashboardRowActionLabel(0), "0");
assert.equal(normalizeDashboardRowActionLabel(false), "false");

assert.equal(resolveDashboardRowActionShortLabel({
  kind: "keep",
  label: "Keep only",
}), "Keep");

assert.equal(resolveDashboardRowActionShortLabel({
  kind: "exclude",
  label: "Exclude",
}), "Exclude");

assert.equal(resolveDashboardRowActionShortLabel({
  kind: "drill",
  label: "Drill to Publisher",
}), "Publisher");

assert.equal(resolveDashboardRowActionShortLabel({
  kind: "detail",
  label: "Show channel details",
}), "Channel");

assert.equal(resolveDashboardRowActionShortLabel({
  kind: "drill",
  label: "Open nested source",
}), "Open nested source");

assert.equal(resolveDashboardRowActionShortLabel({
  kind: "drill",
}), "Drill");

assert.equal(resolveDashboardRowActionShortLabel({
  kind: "detail",
}), "Details");

assert.equal(resolveDashboardRowActionVisibleLabel({
  kind: "keep",
  label: "Keep Channel",
}, {
  displayMode: "compact",
}), "Keep Channel");

assert.equal(resolveDashboardRowActionVisibleLabel({
  kind: "exclude",
  label: "Exclude Channel",
}, {
  displayMode: "compact",
}), "Exclude Channel");

assert.equal(resolveDashboardRowActionVisibleLabel({
  kind: "detail",
  label: "Show channel details",
}, {
  displayMode: "full",
}), "Show channel details");

assert.equal(resolveDashboardRowActionVisibleLabel({
  kind: "detail",
  label: "Show channel details",
}, {
  displayMode: "compact",
}), "Channel details");

assert.equal(resolveDashboardRowActionVisibleLabel({
  kind: "drill",
  label: "Drill to Publisher",
}, {
  displayMode: "compact",
}), "Drill to Publisher");

assert.equal(resolveDashboardRowActionVisibleLabel({
  kind: "detail",
  label: "Show channel details",
}, {
  displayMode: "icon",
}), "");

assert.deepEqual(resolveDashboardRowActionPresentation({
  kind: "keep",
  label: "Keep only",
}), {
  kind: "keep",
  icon: "tick",
  className: "forge-dashboard-row-action--keep",
  shortLabel: "Keep",
});

assert.deepEqual(resolveDashboardRowActionPresentation({
  kind: "detail",
  label: "Show channel details",
}), {
  kind: "detail",
  icon: "eye-open",
  className: "forge-dashboard-row-action--detail",
  shortLabel: "Channel",
});

assert.deepEqual(resolveDashboardRowActionPresentation({
  kind: "other",
  label: 0,
}), {
  kind: "other",
  icon: "more",
  className: "",
  shortLabel: "0",
});

assert.equal(resolveDashboardRowActionIdentity({ id: "drill:country:region", label: "Drill to Region" }), "drill:country:region");
assert.equal(resolveDashboardRowActionIdentity({ label: "Show channel details" }), "Show channel details");
assert.equal(resolveDashboardRowActionIdentity({ kind: "detail" }), "detail");

assert.equal(resolveDashboardRowActionKey({ id: 0 }, 2), "0:2");
assert.equal(resolveDashboardRowActionKey({ label: "Drill to Publisher" }, 1), "Drill to Publisher:1");
assert.equal(resolveDashboardRowActionKey({ kind: "detail" }, 0), "detail:0");

console.log("dashboardRowActionPresentation \u2713 resolves compact runtime action labels");
