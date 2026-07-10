import assert from "node:assert/strict";

import { shouldKeepPrimaryDataset } from "./reportPrimaryDatasetModel.js";

assert.equal(shouldKeepPrimaryDataset({
  includePrimaryBlocks: true,
  datasetBackedBlockDatasetRefs: ["forecast_cube"],
  availableNonPrimaryDatasetRefs: ["forecast_cube"],
}), true);

assert.equal(shouldKeepPrimaryDataset({
  includePrimaryBlocks: false,
  datasetBackedBlockDatasetRefs: [],
  availableNonPrimaryDatasetRefs: ["forecast_cube"],
}), true);

assert.equal(shouldKeepPrimaryDataset({
  includePrimaryBlocks: false,
  datasetBackedBlockDatasetRefs: ["primary"],
  availableNonPrimaryDatasetRefs: ["forecast_cube"],
}), true);

assert.equal(shouldKeepPrimaryDataset({
  includePrimaryBlocks: false,
  datasetBackedBlockDatasetRefs: ["forecast_cube"],
  availableNonPrimaryDatasetRefs: ["forecast_cube"],
}), false);

assert.equal(shouldKeepPrimaryDataset({
  includePrimaryBlocks: false,
  datasetBackedBlockDatasetRefs: ["forecast_cube", "forecast_chart_only"],
  availableNonPrimaryDatasetRefs: ["forecast_cube", "forecast_chart_only"],
}), false);

assert.equal(shouldKeepPrimaryDataset({
  includePrimaryBlocks: false,
  datasetBackedBlockDatasetRefs: ["orphan_dataset"],
  availableNonPrimaryDatasetRefs: ["forecast_cube"],
}), true);

console.log("reportPrimaryDatasetModel ✓ centralizes synthetic primary dataset keep/omit decisions");
