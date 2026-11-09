import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import Chart from "./Chart.jsx";
import { buildExplicitReportBuilderChartContainer } from "./dashboard/reportBuilderUtils.js";
import fixture from "../../doc/examples/chart-axis-labels.json";

afterEach(() => vi.restoreAllMocks());

it.each(["bar", "horizontal_bar"])("renders authored %s value-axis labels for mixed and negative-only rows", async type => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ measureText: text => ({ width: String(text).length * 7 }) });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
        for (const { rows } of fixture.cases) {
            const container = buildExplicitReportBuilderChartContainer({ id: "inventory", dataSourceRef: "inventoryRows" }, fixture.config, {}, { ...fixture.chartSpec, type });
            const context = { signals: { collection: { value: rows }, control: { value: {} }, metrics: { value: {} }, windowForm: { value: {} } } };
            await act(async () => root.render(<Chart container={container} context={context} />));
            const valueAxis = host.querySelector(type === "horizontal_bar" ? ".recharts-xAxis" : ".recharts-yAxis");
            expect(valueAxis.textContent).toContain("Net quantity change");
            expect(valueAxis.textContent).not.toContain("Quantity added");
            if (type === "bar") expect(host.querySelector(".recharts-xAxis .recharts-label").textContent).toBe("Item");
            expect(host.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(rows.length);
        }
    } finally {
        await act(async () => root.unmount());
        host.remove();
        vi.unstubAllGlobals();
    }
});

it.each([false, true])("keeps document horizontal-bar category identity when civil-date display is declared: %s", async declared => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ measureText: text => ({ width: String(text).length * 7 }) });
    const day = "2026-06-13T00:00:00Z";
    const rows = [{ day, amount: 9 }];
    const onDatumSelect = vi.fn();
    const container = { id: "dated-bars", chart: {
        type: "horizontal_bar", appearance: "document", animation: false,
        xAxis: { dataKey: "day", ...(declared ? { tickFormat: "MMM d", valueMode: "civil" } : {}) },
        series: { categoryColors: { [day]: "#123456" }, values: [{ value: "amount", label: "Amount" }] },
    } };
    const context = { signals: { collection: { value: rows }, control: { value: {} }, metrics: { value: {} }, windowForm: { value: {} } } };
    try {
        await act(async () => root.render(<Chart container={container} context={context} onDatumSelect={onDatumSelect} />));
        expect(host.querySelector(".forge-chart-comparison-label").textContent).toBe(declared ? "Jun 13" : day);
        expect(host.querySelector(".forge-chart-comparison-track span").style.background).toBe("rgb(18, 52, 86)");
        await act(async () => host.querySelector(".forge-chart-comparisons button").click());
        expect(onDatumSelect).toHaveBeenCalledOnce();
        expect(onDatumSelect.mock.calls[0][0].xValue).toBe(day);
        expect(rows).toEqual([{ day, amount: 9 }]);
    } finally {
        await act(async () => root.unmount());
        host.remove();
        vi.unstubAllGlobals();
    }
});

it.each([
    { appearance: undefined, clamped: false, multi: false },
    { appearance: undefined, clamped: true, multi: false },
    { appearance: "document", clamped: true, multi: true },
])("formats declared dates on horizontal SVG category ticks: %j", async ({ appearance, clamped, multi }) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ measureText: text => ({ width: String(text).length * 7 }) });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const day = "2026-06-13T00:00:00Z";
    const container = { id: "dated-svg-bars", chart: {
        type: "horizontal_bar", appearance, animation: false,
        xAxis: { dataKey: "day", tickFormat: "MMM d", valueMode: "civil", ...(clamped ? { categoryLabel: { lines: 2, maxCharacters: 24 } } : {}) },
        series: { values: [{ value: "amount", label: "Amount" }, ...(multi ? [{ value: "other", label: "Other" }] : [])] },
    } };
    const context = { signals: { collection: { value: [{ day, amount: 9, other: 3 }] }, control: { value: {} }, metrics: { value: {} }, windowForm: { value: {} } } };
    try {
        await act(async () => root.render(<Chart container={container} context={context} />));
        expect(host.querySelector(".recharts-yAxis").textContent).toContain("Jun 13");
        expect(host.querySelector(".recharts-yAxis").textContent).not.toContain("T00:00:00Z");
        expect(host.querySelector(`[data-series-id="amount"][data-category="${day}"]`)).toBeTruthy();
    } finally {
        await act(async () => root.unmount());
        host.remove();
        vi.unstubAllGlobals();
    }
});
