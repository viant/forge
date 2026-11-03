import React, {act} from "react";
import {createRoot} from "react-dom/client";
import {expect, it, vi} from "vitest";
import Chart from "./Chart.jsx";
import {buildExplicitReportBuilderChartContainer} from "./dashboard/reportBuilderUtils.js";

it("hides authored static legends while preserving native series selectors", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class {observe() {} disconnect() {}});
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(500);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({measureText: text => ({width: String(text).length * 7})});
  const config = {dimensions: [{id: "item", key: "item"}], measures: [{id: "stored", key: "stored"}, {id: "requested", key: "requested"}, {id: "transit", key: "transit"}]};
  const context = {signals: {collection: {value: [{item: "Bracket", stored: 7, requested: 4, transit: 2}]}, control: {value: {}}, metrics: {value: {}}, windowForm: {value: {}}}};
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    for (const showLegend of [undefined, true, false]) {
      const chartSpec = {type: "horizontal_bar", appearance: "document", xField: "item", yFields: ["stored", "requested", "transit"], ...(showLegend === undefined ? {} : {showLegend})};
      const container = buildExplicitReportBuilderChartContainer({id: "inventory"}, config, {}, chartSpec);
      await act(async () => root.render(<Chart container={container} context={context}/>));
      expect(host.querySelectorAll(".recharts-legend-wrapper")).toHaveLength(showLegend === false ? 0 : 1);
      expect(host.querySelectorAll(".forge-chart-document-legend")).toHaveLength(showLegend === false ? 0 : 1);
      expect(host.querySelectorAll("input[type=checkbox]")).toHaveLength(3);
      expect(host.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(3);
      if (showLegend === false) {
        await act(async () => host.querySelector("input[type=checkbox]").click());
        await vi.waitFor(() => expect(host.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(2));
        await act(async () => host.querySelector("input[type=checkbox]").click());
        await vi.waitFor(() => expect(host.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(3));
      }
    }
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
