import { describe, expect, it } from "vitest";

import { applyReportBuilderStateHook, resolveReportBuilderHookHandler } from "./ReportBuilder.jsx";

describe("resolveReportBuilderHookHandler", () => {
  it("resolves unqualified handlers from the current window namespace", () => {
    const calls = [];
    const handler = () => "ok";
    const context = {
      metadata: { namespace: "Performance Metrics" },
      lookupHandler(name) {
        calls.push(name);
        if (name === "Performance Metrics.stewardReportBuilder.buildRequest") {
          return handler;
        }
        throw new Error(`missing ${name}`);
      },
    };

    const resolved = resolveReportBuilderHookHandler(context, "stewardReportBuilder.buildRequest");
    expect(resolved).toBe(handler);
    expect(calls).toEqual([
      "stewardReportBuilder.buildRequest",
      "Performance Metrics.stewardReportBuilder.buildRequest",
    ]);
  });

  it("uses direct lookup when the hook name is already resolvable", () => {
    const handler = () => "ok";
    const context = {
      metadata: { namespace: "Performance Metrics" },
      lookupHandler(name) {
        if (name === "stewardReportBuilder.buildRequest") {
          return handler;
        }
        throw new Error(`missing ${name}`);
      },
    };

    expect(resolveReportBuilderHookHandler(context, "stewardReportBuilder.buildRequest")).toBe(handler);
  });

  it("applies initializeState hook output when configured", () => {
    const context = {
      metadata: { namespace: "Performance Metrics" },
      lookupHandler(name) {
        if (name === "Performance Metrics.stewardReportBuilder.initializeState") {
          return ({ state, windowForm }) => ({
            ...state,
            seededFromPrefill: windowForm.prefill.advertiserId,
          });
        }
        throw new Error(`missing ${name}`);
      },
    };

    expect(applyReportBuilderStateHook(
      context,
      { hooks: { initializeState: "Performance Metrics.stewardReportBuilder.initializeState" } },
      { page: 1 },
      { prefill: { advertiserId: 123 } },
    )).toEqual({
      page: 1,
      seededFromPrefill: 123,
    });
  });
});
