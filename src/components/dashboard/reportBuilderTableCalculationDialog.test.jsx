import assert from "node:assert/strict";
import React from "react";
import { ReportBuilderTableCalculationDialog } from "./reportBuilderComponents.jsx";

function elements(node) {
    if (!node || typeof node !== "object") return [];
    return [node, ...React.Children.toArray(node.props?.children).flatMap(elements)];
}
const options = {sourceFields: [{id: "value", label: "Value"}], orderFields: [{id: "sequence", label: "Sequence"}, {id: "stable", label: "Stable"}], partitionDimensions: [{id: "group", label: "Group"}]};
function dialog(draft) {
    let changed;
    const nodes = elements(ReportBuilderTableCalculationDialog({isOpen: true, draft, fieldOptions: options, validation: {valid: true}, onDraftChange: (value) => { changed = value; }}));
    return {nodes, named: (name) => nodes.find((node) => node.props?.name === name), change: (name, value) => {nodes.find((node) => node.props?.name === name).props.onChange({target: {value}}); return changed;}};
}
const lag = dialog({functionId: "lag", sourceField: "value", orderByField: "sequence", additionalOrderBy: [{field: "stable", direction: "desc"}], offset: "2"});
assert.equal(lag.named("tableCalcOffset").props.min, "1");
assert.equal(lag.named("tableCalcOffset").props.max, "10000");
assert.ok(lag.named("tableCalcSourceField"));
assert.ok(lag.named("tableCalcOrderByField"));
assert.equal(lag.named("tableCalcAdditionalDirection0").props.value, "desc");
assert.equal(lag.change("tableCalcOffset", "3").offset, "3");
assert.deepEqual(lag.change("tableCalcAdditionalDirection0", "asc").additionalOrderBy, [{field: "stable", direction: "asc"}]);
assert.ok(lag.nodes.find((node) => node.props?.children === "Add Order Field"));
assert.ok(lag.nodes.find((node) => node.props?.children === "Group"));
const bounded = dialog({functionId: "windowMax", frameType: "rows", framePreceding: "2", frameFollowing: "0"});
assert.ok(bounded.named("tableCalcFramePreceding"));
assert.ok(bounded.named("tableCalcFrameFollowing"));
assert.equal(bounded.named("tableCalcFrameFollowing").props.min, "0");
assert.equal(bounded.named("tableCalcFramePreceding").props.max, "10000");
const next = bounded.change("tableCalcFrameType", "full");
assert.equal(next.framePreceding, "");
assert.equal(next.frameFollowing, "");
const full = dialog(next);
assert.equal(full.named("tableCalcFramePreceding"), undefined);
assert.ok(full.named("tableCalcOrderByField")); // Optional ordering remains editable and round-trips.
const switched = bounded.change("tableCalcFunction", "lag");
assert.equal(switched.frameType, "");
assert.equal(switched.framePreceding, "");
assert.equal(switched.offset, "1");
assert.equal(switched.windowSize, "");
console.log("table calculation dialog controls passed");
