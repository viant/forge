import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  applyReportCalculatedFields,
  evaluateReportCalculatedFieldExpression,
  normalizeReportCalculatedField,
  parseReportCalculatedFieldExpression,
} from "./calculatedFieldModel.js";
import {
  listReportCalculatedFieldFunctionSpecs,
  listReportCalculatedFieldTableCalculationSpecs,
} from "./calculationContracts.js";

const fixtureCorpus = JSON.parse(
  readFileSync(new URL("./fixtures/calculated-field-expression-fixtures.v1.json", import.meta.url), "utf8"),
);
const tableCalculationFixtureCorpus = JSON.parse(
  readFileSync(new URL("./fixtures/table-calculation-conformance-fixtures.v1.json", import.meta.url), "utf8"),
);

assert.deepEqual(
  listReportCalculatedFieldFunctionSpecs(),
  fixtureCorpus.functions,
);
assert.deepEqual(
  listReportCalculatedFieldTableCalculationSpecs(),
  tableCalculationFixtureCorpus.functions,
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

fixtureCorpus.parseErrorCases.forEach((fixture) => {
  assert.throws(
    () => parseReportCalculatedFieldExpression(fixture.expr),
    new RegExp(fixture.error.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    fixture.id,
  );
});

fixtureCorpus.evaluationCases.forEach((fixture) => {
  assert.deepEqual(
    evaluateReportCalculatedFieldExpression(fixture.expr, fixture.row),
    fixture.expected,
    fixture.id,
  );
});

tableCalculationFixtureCorpus.runtimeCases.forEach((fixture) => {
  assert.deepEqual(
    applyReportCalculatedFields(fixture.rows, fixture.definitions),
    fixture.expectedRows,
    fixture.id,
  );
});

assert.deepEqual(
  normalizeReportCalculatedField({
    id: "projectedLift",
    label: "Projected Lift",
    dataType: "number",
    expr: "if(channelId = 'CTV', totalSpend, null)",
  }, { datasetRef: "primary" }),
  {
    id: "projectedLift",
    key: "projectedLift",
    kind: "rowCalc",
    label: "Projected Lift",
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
