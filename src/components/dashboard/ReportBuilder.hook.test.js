import { describe, expect, it } from "vitest";

import {
  applyReportBuilderStateHook,
  resolveReportBuilderHookHandler,
  resolveReportBuilderLookupDescriptor,
  resolveReportBuilderNotices,
} from "./ReportBuilder.jsx";

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

  it("resolves configured notices from state arrays", () => {
    expect(resolveReportBuilderNotices(
      {
        notices: [
          {
            id: "unsupportedForecastFeatures",
            level: "warning",
            title: "Unsupported forecast features were skipped",
            sourcePath: "forecastHandoffMeta.unsupportedFeatureKeys",
          },
        ],
      },
      {
        forecastHandoffMeta: {
          unsupportedFeatureKeys: ["peer39.social.context"],
        },
      },
    )).toEqual([
      {
        id: "unsupportedForecastFeatures",
        level: "warning",
        title: "Unsupported forecast features were skipped",
        description: "",
        items: ["peer39.social.context"],
      },
    ]);
  });

  it("resolves lookup descriptors from the configured lookup hook and merges local lookup config", () => {
    const context = {
      metadata: { namespace: "Forecasting" },
      lookupHandler(name) {
        if (name === "Forecasting.stewardForecastingBuilder.resolveLookup") {
          return ({ filterDef, rowId }) => ({
            dialogId: "targetingTreePicker",
            parameters: {
              Field: "USER_POOL",
              rowId,
              featureKey: filterDef.targetingFeatureKey,
            },
          });
        }
        throw new Error(`missing ${name}`);
      },
    };

    expect(resolveReportBuilderLookupDescriptor(
      context,
      { hooks: { resolveLookup: "Forecasting.stewardForecastingBuilder.resolveLookup" } },
      { staticFilters: { channelIds: [1] } },
      { id: "include" },
      {
        id: "includeUserPools",
        targetingFeatureKey: "user.segment",
        lookup: { multiple: true },
      },
      "row_1",
    )).toEqual({
      multiple: true,
      dialogId: "targetingTreePicker",
      parameters: {
        Field: "USER_POOL",
        rowId: "row_1",
        featureKey: "user.segment",
      },
    });
  });

  it("does not produce a lookup descriptor when the hook returns null for an unsupported feature", () => {
    const context = {
      metadata: { namespace: "Forecasting" },
      lookupHandler(name) {
        if (name === "Forecasting.stewardForecastingBuilder.resolveLookup") {
          return () => null;
        }
        throw new Error(`missing ${name}`);
      },
    };

    expect(resolveReportBuilderLookupDescriptor(
      context,
      { hooks: { resolveLookup: "Forecasting.stewardForecastingBuilder.resolveLookup" } },
      {},
      { id: "include" },
      {
        id: "includeExternalPmpDeals",
        targetingFeatureKey: "external.pmp.deal",
      },
      "row_external",
    )).toEqual({});
  });
});
