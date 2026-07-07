import assert from "node:assert/strict";

import { hydrateReportBuilderRuntimeRows } from "./reportBuilderRuntimeRowHydration.js";

const requests = [];
const builderContext = {
  Context(dataSourceRef) {
    assert.equal(dataSourceRef, "publisher_lookup");
    return {
      dataSource: {
        selectors: {
          data: "data",
        },
      },
      handlers: {
        dataSource: {
          async fetchRecords({ parameters }) {
            requests.push(parameters);
            return {
              data: [
                { id: 147, name: "FreeWheel" },
                { id: 162, name: "Magnite Streaming (Telaria)" },
              ],
            };
          },
        },
      },
    };
  },
};

const hydrated = await hydrateReportBuilderRuntimeRows({
  builderContext,
  config: {
    dimensions: [
      {
        id: "publisherId",
        key: "publisherId",
        displayKey: "publisherName",
        displayLookup: {
          dataSourceRef: "publisher_lookup",
          batchResolveInput: "PublisherIds",
          resolveInput: "PublisherId",
          valuePath: "id",
          labelPath: "name",
          parameters: {
            Fields: ["id", "name"],
          },
        },
      },
    ],
  },
  request: {
    dimensions: {
      publisherId: true,
    },
  },
  rows: [
    { publisherId: 147, totalSpend: 1200 },
    { publisherId: 162, totalSpend: 900 },
    { publisherId: 508, totalSpend: 750 },
    { publisherId: 147, totalSpend: 300 },
  ],
});

assert.deepEqual(requests, [
  {
    Fields: ["id", "name"],
    PublisherIds: [147, 162, 508],
    Limit: 3,
  },
]);

assert.deepEqual(hydrated, [
  { publisherId: 147, publisherName: "FreeWheel", totalSpend: 1200 },
  { publisherId: 162, publisherName: "Magnite Streaming (Telaria)", totalSpend: 900 },
  { publisherId: 508, publisherName: "Publisher 508", totalSpend: 750 },
  { publisherId: 147, publisherName: "FreeWheel", totalSpend: 300 },
]);

console.log("reportBuilderRuntimeRowHydration ✓ batches lookup-backed display hydration for runtime rows");
