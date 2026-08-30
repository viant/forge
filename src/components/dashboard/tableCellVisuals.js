// Generic Forge dashboard-table visual primitives. Report Builder retains its
// legacy export names as a compatibility surface, while other Forge consumers
// import the neutral API from this module.
export {
  buildReportTableRuntimeColumns as buildTableRuntimeColumns,
  resolveReportTableCellVisualState as resolveTableCellVisualState,
} from "./reportTableCellVisuals.js";
