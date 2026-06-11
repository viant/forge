import assert from "node:assert/strict";
import React from "react";

import { DashboardErrorBoundary } from "./dashboardErrorBoundary.js";

function syncState(boundary) {
    boundary.setState = (update) => {
        const next = typeof update === "function"
            ? update(boundary.state, boundary.props)
            : update;
        boundary.state = {
            ...boundary.state,
            ...(next || {}),
        };
    };
}

function findElementByType(element, type) {
    if (!element || typeof element !== "object") {
        return null;
    }
    if (element.type === type) {
        return element;
    }
    const children = React.Children.toArray(element.props?.children || []);
    for (const child of children) {
        const match = findElementByType(child, type);
        if (match) {
            return match;
        }
    }
    return null;
}

const okChild = React.createElement("div", { id: "ok-child" }, "Recovered child");
const boundary = new DashboardErrorBoundary({
    container: { id: "chartBlock", title: "Forecasting Chart" },
    children: okChild,
});
syncState(boundary);

boundary.state = { error: new Error("boom") };
const errorTree = boundary.render();
const retryButton = findElementByType(errorTree, "button");

assert.ok(retryButton, "expected retry button when boundary is in error state");
assert.equal(retryButton.props.children, "Retry");

retryButton.props.onClick();

assert.equal(boundary.state.error, null);
assert.equal(boundary.render(), okChild);

boundary.state = { error: new Error("boom again") };
boundary.props = {
    ...boundary.props,
    children: React.createElement("div", { id: "next-child" }, "Next child"),
};
boundary.componentDidUpdate({
    ...boundary.props,
    children: okChild,
});
assert.equal(boundary.state.error, null);

console.log("dashboardErrorBoundary ✓ retry clears render error state");
