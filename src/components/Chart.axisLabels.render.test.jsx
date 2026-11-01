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
