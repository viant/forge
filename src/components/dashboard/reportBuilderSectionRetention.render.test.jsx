// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { validateReportSpec } from "../../reporting/schema/reportSchemas.js";
import {
  SectionRetentionFixture,
  sectionFixtureRows,
  sectionFixtureSpec,
} from "./reportBuilderSectionRetention.fixture.jsx";
const tick = () => new Promise((r) => setTimeout(r, 0));
it("Overview→Pacing→Overview retains exact completed datasets with zero Pacing reads and invalidates filter/user/revision/manual run", async () => {
  expect(validateReportSpec(sectionFixtureSpec)).toEqual({
    valid: true,
    errors: [],
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const calls = [];
  const owner = (account = "one", revision = 1) => ({
    windowState: {
      accountId: account,
      metadata: { resource: { uri: "window://example/report", revision } },
    },
    handlers: {
      reportBuilderPreview: {
        fetchByRef: async ({ parameters }) => {
          calls.push(parameters);
          return {
            data: sectionFixtureRows[parameters.filters.fixtureDataset],
          };
        },
      },
    },
    Context: () => ({ dataSource: { selectors: { data: "data" } } }),
  });
  let context = owner();
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  const render = async (props = {}) =>
    act(async () => {
      root.render(<SectionRetentionFixture owner={context} {...props} />);
      for (let i = 0; i < 5; i++) await tick();
    });
  const state = () => JSON.parse(el.querySelector("output").textContent);
  const click = async (name) =>
    act(async () => {
      [...el.querySelectorAll("[role=tab]")]
        .find((b) => b.textContent === name)
        .click();
      for (let i = 0; i < 5; i++) await tick();
    });
  try {
    await render();
    expect(state().ready).toBe(true);
    expect(state().exportReady).toBe(true);
    expect(calls).toHaveLength(3);
    await click("Pacing");
    expect(state().ready).toBe(true);
    expect(el.textContent).toContain("Pacing evidence");
    expect(state().exportReady).toBe(true);
    expect(calls).toHaveLength(3);
    await click("Overview");
    expect(state().ready).toBe(true);
    expect(el.textContent).toContain("Breakdown");
    expect(calls).toHaveLength(3);
    await render({ filter: "changed" });
    expect(calls).toHaveLength(6);
    await render({ filter: "changed", run: 1 });
    expect(calls).toHaveLength(9);
    context = owner("two");
    await render({ filter: "changed", run: 1 });
    expect(calls).toHaveLength(12);
    context = owner("two", 2);
    await render({ filter: "changed", run: 1 });
    expect(calls).toHaveLength(15);
    context.identity = { actorRef: "user://example/other" };
    await render({ filter: "changed", run: 1 });
    expect(calls).toHaveLength(18);
    context.handlers.reportBuilderPreview.fetchByRef = async () => {
      throw new Error("Example source unavailable");
    };
    await render({ filter: "changed", run: 2 });
    expect(state().ready).toBe(false);
    expect(state().error).toContain("Example source unavailable");
    expect(el.querySelectorAll("[role=tab]")).toHaveLength(2);
    expect(el.textContent).not.toContain("Pacing evidence");
  } finally {
    await act(async () => root.unmount());
    el.remove();
  }
});
