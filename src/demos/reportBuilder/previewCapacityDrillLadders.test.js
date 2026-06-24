import assert from "node:assert/strict";

import {
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
} from "../../components/dashboard/reportBuilderRuntimePreview.js";
import { runPreviewRuntimeRequest } from "./previewRuntimeQuery.js";
import { RAW_ROWS } from "./previewDemoRows.js";

const container = {
  id: "capacityPreview",
  stateKey: "capacityPreview",
  title: "Capacity Preview",
  dataSourceRef: "demoReportSource",
};

function buildRuntimePreviewFromRequest({ config, state, refinements, drillTransitions, orderBy }) {
  const model = buildReportBuilderRuntimePreviewModel({
    container,
    config,
    state,
    refinements,
    drillTransitions,
    requestTransform: ({ request }) => ({
      ...request,
      orderBy: [orderBy],
    }),
  });
  const runtimeRows = runPreviewRuntimeRequest(
    RAW_ROWS,
    model.reportSpec.datasets[0].request,
    config,
  );
  return {
    model,
    runtimeRows,
    preview: buildReportBuilderRuntimePreview({
      model,
      rows: runtimeRows.rows,
      hasMore: runtimeRows.hasMore,
    }),
  };
}

const inventoryConfig = {
  measures: [
    { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
  ],
  dimensions: [
    {
      id: "channelV2",
      key: "channelV2",
      label: "Channel",
      runtimeFilter: {
        includeParamPath: "filters.includeChannelV2",
        excludeParamPath: "filters.excludeChannelV2",
      },
    },
    {
      id: "publisher",
      key: "publisher",
      label: "Publisher",
      runtimeFilter: {
        includeParamPath: "filters.includePublisher",
        excludeParamPath: "filters.excludePublisher",
      },
    },
    {
      id: "siteType",
      key: "siteType",
      label: "Site Type",
      runtimeFilter: {
        includeParamPath: "filters.includeSiteType",
        excludeParamPath: "filters.excludeSiteType",
      },
    },
  ],
};

const inventoryState = {
  selectedMeasures: ["avails"],
  selectedDimensions: ["channelV2"],
  primaryMeasure: "avails",
  orderField: "avails",
  orderDir: "desc",
  pageSize: 12,
  viewMode: "table",
};

const inventoryRefinements = [
  {
    id: "drill:channelV2:primaryTable",
    op: "drill",
    field: "channelV2",
    values: ["Display"],
    sourceBlockId: "primaryTable",
    label: "Drill to Publisher = Display",
  },
  {
    id: "drill:publisher:primaryTable",
    op: "drill",
    field: "publisher",
    values: ["Acme Media"],
    sourceBlockId: "primaryTable",
    label: "Drill to Site Type = Acme Media",
  },
];

const inventoryDrillTransitions = [
  {
    refinementId: "drill:channelV2:primaryTable",
    sourceField: "channelV2",
    nextFieldRef: "publisher",
    sourceBlockId: "primaryTable",
  },
  {
    refinementId: "drill:publisher:primaryTable",
    sourceField: "publisher",
    nextFieldRef: "siteType",
    sourceBlockId: "primaryTable",
  },
];

const inventoryRuntime = buildRuntimePreviewFromRequest({
  config: inventoryConfig,
  state: inventoryState,
  refinements: inventoryRefinements,
  drillTransitions: inventoryDrillTransitions,
  orderBy: "siteType asc",
});

assert.equal(inventoryRuntime.model.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.equal(inventoryRuntime.model.reportSpec.datasets[0].request.dimensions.publisher, true);
assert.equal(inventoryRuntime.model.reportSpec.datasets[0].request.dimensions.siteType, true);
assert.deepEqual(
  inventoryRuntime.preview.reportFill.datasets[0].rows.map((row) => row.siteType),
  ["Open Web", "Private Marketplace"],
);
assert.deepEqual(
  inventoryRuntime.preview.reportFill.datasets[0].rows.map((row) => row.avails),
  [37100, 45700],
);

const locationConfig = {
  measures: [
    { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
  ],
  dimensions: [
    {
      id: "country",
      key: "country",
      label: "Market",
      runtimeFilter: {
        includeParamPath: "filters.includeCountry",
        excludeParamPath: "filters.excludeCountry",
      },
    },
    {
      id: "region",
      key: "region",
      label: "Region",
      runtimeFilter: {
        includeParamPath: "filters.includeLocationDim",
        excludeParamPath: "filters.excludeLocationDim",
        format: "locationTuple",
        parentField: "country",
      },
    },
    {
      id: "metrocode",
      key: "metrocode",
      label: "Metro Area",
      runtimeFilter: {
        includeParamPath: "filters.includeMetrocode",
        excludeParamPath: "filters.excludeMetrocode",
      },
    },
  ],
};

const locationState = {
  selectedMeasures: ["avails"],
  selectedDimensions: ["country"],
  primaryMeasure: "avails",
  orderField: "avails",
  orderDir: "desc",
  pageSize: 12,
  viewMode: "table",
};

const locationRefinements = [
  {
    id: "drill:country:primaryTable",
    op: "drill",
    field: "country",
    values: ["US"],
    sourceBlockId: "primaryTable",
    label: "Drill to Region = US",
  },
  {
    id: "drill:region:primaryTable",
    op: "drill",
    field: "region",
    values: ["West"],
    sourceBlockId: "primaryTable",
    label: "Drill to Metro = West",
  },
];

const locationDrillTransitions = [
  {
    refinementId: "drill:country:primaryTable",
    sourceField: "country",
    nextFieldRef: "region",
    sourceBlockId: "primaryTable",
  },
  {
    refinementId: "drill:region:primaryTable",
    sourceField: "region",
    nextFieldRef: "metrocode",
    sourceBlockId: "primaryTable",
  },
];

const locationRuntime = buildRuntimePreviewFromRequest({
  config: locationConfig,
  state: locationState,
  refinements: locationRefinements,
  drillTransitions: locationDrillTransitions,
  orderBy: "metrocode asc",
});

assert.equal(locationRuntime.model.reportSpec.datasets[0].request.dimensions.country, true);
assert.equal(locationRuntime.model.reportSpec.datasets[0].request.dimensions.region, true);
assert.equal(locationRuntime.model.reportSpec.datasets[0].request.dimensions.metrocode, true);
assert.deepEqual(
  locationRuntime.preview.reportFill.datasets[0].rows.map((row) => row.metrocode),
  ["Los Angeles DMA", "New York DMA"],
);
assert.deepEqual(
  locationRuntime.preview.reportFill.datasets[0].rows.map((row) => row.avails),
  [29300, 37100],
);

console.log("previewCapacityDrillLadders ✓ capacity demo data supports meaningful 3-step inventory and location drills");
