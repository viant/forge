import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/reportBuilderComponents.jsx"),
  "utf8",
);

assert.equal(
  source.includes("Data source"),
  true,
  "ReportBuilderDocumentBlockDialog should surface the bound data source for data-backed authored blocks.",
);

assert.equal(
  source.includes("forge-report-builder__dialog-source-card"),
  false,
  "ReportBuilderDocumentBlockDialog should use a compact source selector instead of large source cards.",
);

assert.equal(
  source.includes("Starter projection"),
  true,
  "ReportBuilderDocumentBlockDialog should expose reusable starter projections for table authoring.",
);

assert.equal(
  source.includes("Table projection"),
  true,
  "ReportBuilderDocumentBlockDialog should frame authored table setup as a block-level projection.",
);

assert.equal(
  source.includes("Starter projection"),
  true,
  "ReportBuilderDocumentBlockDialog should frame KPI and geo starter state as a starter projection rather than a shared data view.",
);

assert.equal(
  source.includes("dataViewLabel"),
  true,
  "ReportBuilderDocumentBlockDialog should accept shared data-view context for KPI and geo authored blocks.",
);

assert.equal(
  source.includes("Current working projection"),
  false,
  "ReportBuilderDocumentBlockDialog should not talk about a default builder projection.",
);

assert.equal(
  source.includes("semanticBindingState"),
  true,
  "ReportBuilderDocumentBlockDialog should accept semantic binding context for data-bearing authored block dialogs.",
);

assert.equal(
  source.includes("Missing source ("),
  true,
  "ReportBuilderDocumentBlockDialog should keep a missing dataset visible so authors can explicitly rebind instead of silently falling back.",
);

assert.equal(
  source.includes("Source query"),
  true,
  "ReportBuilderDocumentBlockDialog should surface a concise source-query summary for bound datasets while editing.",
);

assert.equal(
  source.includes("requestSummary"),
  true,
  "ReportBuilderDocumentBlockDialog should summarize the stored dataset request for bound non-primary datasets.",
);

assert.equal(
  source.includes("normalizedValueFieldOptions.map"),
  true,
  "ReportBuilderDocumentBlockDialog should source KPI value choices from the currently selected dataset.",
);

assert.equal(
  source.includes("normalizedSecondaryFieldOptions.map"),
  true,
  "ReportBuilderDocumentBlockDialog should source KPI secondary-field choices from the currently selected dataset.",
);

assert.equal(
  source.includes("<span>Dimensions</span>"),
  false,
  "ReportBuilderDocumentBlockDialog should present table fields as one unified list instead of a separate dimensions section.",
);

assert.equal(
  source.includes("<span>Measures</span>"),
  false,
  "ReportBuilderDocumentBlockDialog should present table fields as one unified list instead of a separate measures section.",
);

assert.equal(
  source.includes("forge-report-builder__table-field-list"),
  true,
  "ReportBuilderDocumentBlockDialog should offer a single unified field list for table authoring.",
);

assert.equal(
  source.includes("resolveTableFieldMarker"),
  true,
  "ReportBuilderDocumentBlockDialog should mark each table field with its source (dimension/measure/calculated/field).",
);

assert.equal(
  source.includes("icon: \"tag\""),
  true,
  "ReportBuilderDocumentBlockDialog should use icon-based markers instead of cryptic field abbreviations for dimensions.",
);

assert.equal(
  source.includes("forge-report-builder__table-canvas"),
  true,
  "ReportBuilderDocumentBlockDialog should render selected table columns as a table canvas, not just chips.",
);

assert.equal(
  source.includes("moveColumnKey"),
  true,
  "ReportBuilderDocumentBlockDialog should let authors adjust the visible order of selected table columns.",
);

assert.equal(
  source.includes("draggable"),
  true,
  "ReportBuilderDocumentBlockDialog should expose real drag surfaces for table fields and table headers.",
);

assert.equal(
  source.includes("handleTableHeaderDrop"),
  true,
  "ReportBuilderDocumentBlockDialog should support dropping dragged fields onto table headers to place or reorder them.",
);

assert.equal(
  source.includes("Block type"),
  false,
  "ReportBuilderDocumentBlockDialog should not waste space on a read-only block type field.",
);

assert.equal(
  source.includes("<span>Columns</span>"),
  false,
  "ReportBuilderDocumentBlockDialog should no longer frame table authoring around raw column lists.",
);

assert.equal(
  source.includes("<span>Table columns</span>"),
  true,
  "ReportBuilderDocumentBlockDialog should make the unified field list a primary, always-visible section rather than a collapsible picker.",
);

assert.equal(
  source.includes("Current builder selection"),
  true,
  "ReportBuilderDocumentBlockDialog should identify the live builder-derived starter as the current builder selection.",
);

assert.equal(
  source.includes("Starting from a custom projection."),
  false,
  "ReportBuilderDocumentBlockDialog should not mislabel the current live builder selection as a custom projection.",
);

assert.equal(
  source.includes("<span>Table layout</span>"),
  true,
  "ReportBuilderDocumentBlockDialog should present selected table columns as a layout canvas rather than a chip summary.",
);

assert.equal(
  source.includes("Apply current fields"),
  true,
  "ReportBuilderDocumentBlockDialog should offer an explicit current-selection repair when a table draft opens without fields.",
);

assert.equal(
  source.includes("starterSelectionColumnKeys"),
  true,
  "ReportBuilderDocumentBlockDialog should derive an explicit starter field set from the active builder selection for empty table drafts.",
);

assert.equal(
  source.includes("Search fields"),
  true,
  "ReportBuilderDocumentBlockDialog should let authors filter the field picker when sources expose many fields.",
);

assert.equal(
  source.includes("Filter dimensions and measures"),
  true,
  "ReportBuilderDocumentBlockDialog should provide a clear search placeholder for large field lists.",
);

assert.equal(
  source.includes("Current data selection"),
  false,
  "ReportBuilderDocumentBlockDialog should not leak the legacy current-data-selection label into table authoring copy.",
);

assert.equal(
  source.includes("MarkdownEditor"),
  true,
  "Narrative authored blocks should reuse the markdown editor instead of a plain textarea.",
);

assert.equal(
  source.includes("Start with the takeaway, context, and next action."),
  true,
  "Narrative authored blocks should guide authors with reader-facing placeholder copy.",
);

console.log("reportBuilderDocumentBlockDialogCoverage ✓ dialog emphasizes source, projection, and narrative authoring");
