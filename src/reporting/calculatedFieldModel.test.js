import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  applyReportCalculatedFields,
  evaluateReportCalculatedFieldExpression,
  normalizeReportCalculatedField,
  parseReportCalculatedFieldExpression,
} from "./calculatedFieldModel.js";

const fixtures = JSON.parse(
  readFileSync(new URL("./fixtures/calculated-field-expression-fixtures.v1.json", import.meta.url), "utf8"),
);

assert.deepEqual(parseReportCalculatedFieldExpression("if(impressions = 0, null, round((clicks / impressions) * 100, 2))"), {
  expr: "if(impressions = 0, null, round((clicks / impressions) * 100, 2))",
  ast: {
    type: "call",
    callee: "if",
    args: [
      {
        type: "binary",
        operator: "=",
        left: { type: "identifier", name: "impressions" },
        right: { type: "literal", value: 0 },
      },
      { type: "literal", value: null },
      {
        type: "call",
        callee: "round",
        args: [
          {
            type: "binary",
            operator: "*",
            left: {
              type: "binary",
              operator: "/",
              left: { type: "identifier", name: "clicks" },
              right: { type: "identifier", name: "impressions" },
            },
            right: { type: "literal", value: 100 },
          },
          { type: "literal", value: 2 },
        ],
      },
    ],
  },
  dependencies: ["impressions", "clicks"],
});

fixtures.forEach((fixture) => {
  assert.deepEqual(
    evaluateReportCalculatedFieldExpression(fixture.expr, fixture.row),
    fixture.expected,
    fixture.id,
  );
});

assert.deepEqual(
  normalizeReportCalculatedField({
    id: "forecastLift",
    label: "Forecast Lift",
    dataType: "number",
    expr: "if(channelId = 'CTV', totalSpend, null)",
  }, { datasetRef: "primary" }),
  {
    id: "forecastLift",
    key: "forecastLift",
    kind: "rowCalc",
    label: "Forecast Lift",
    dataType: "number",
    datasetRef: "primary",
    dependencies: ["channelId", "totalSpend"],
    expr: "if(channelId = 'CTV', totalSpend, null)",
  },
);

assert.deepEqual(
  applyReportCalculatedFields([
    { channelId: "Display", siteType: "streaming", clicks: 25, impressions: 1000, totalSpend: 200 },
    { channelId: "CTV", siteType: "streaming", clicks: 0, impressions: 0, totalSpend: 400 },
  ], [
    {
      id: "ctr",
      label: "CTR",
      dataType: "number",
      expr: "if(impressions = 0, null, round((clicks / impressions) * 100, 2))",
    },
    {
      id: "ctrBadge",
      label: "CTR Badge",
      dataType: "string",
      expr: "if(isNull(ctr), 'n/a', concat(upper(channelId), ':', ctr))",
    },
  ]),
  [
    {
      channelId: "Display",
      siteType: "streaming",
      clicks: 25,
      impressions: 1000,
      totalSpend: 200,
      ctr: 2.5,
      ctrBadge: "DISPLAY:2.5",
    },
    {
      channelId: "CTV",
      siteType: "streaming",
      clicks: 0,
      impressions: 0,
      totalSpend: 400,
      ctr: null,
      ctrBadge: "n/a",
    },
  ],
);

console.log("calculatedFieldModel ✓ normalizes and evaluates local row expressions and legacy calculations");
