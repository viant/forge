import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);
const outlineSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/reportBuilderDocumentOutline.js"),
  "utf8",
);

assert.equal(
  source.includes("!showAuthoredReportSurface && !designWorkspaceMode && !compactMode && config.showResultHeader !== false"),
  true,
  "ReportBuilder should keep the raw desktop results header out of Design mode and out of authored Report mode.",
);

assert.equal(
  source.includes("!designWorkspaceMode ? (\n                        <>"),
  true,
  "ReportBuilder should gate the live result frame and runtime preview behind non-Design modes.",
);

assert.equal(
  source.includes("renderDesignWorkspaceOverview()"),
  true,
  "ReportBuilder should render a dedicated design overview surface when Design mode is active.",
);

assert.equal(
  source.includes("Authoring surface"),
  false,
  "ReportBuilder should not repeat an authoring banner headline inside the Design tab.",
);

assert.equal(
  source.includes("Preview and Report show the live output."),
  false,
  "ReportBuilder should not repeat tutorial copy inside the Design tab.",
);

assert.equal(
  source.includes('{ id: "runtime", label: "Filters" }'),
  true,
  "ReportBuilder should keep the compact design focus strip centered on document and runtime phases.",
);

assert.equal(
  source.includes('{ id: "drill", label: "Drill Downs" }'),
  false,
  "ReportBuilder should not expose a separate Drill Downs tab once drill setup lives inside the shared data editor.",
);

assert.equal(
  source.includes('{ id: "projection", label: "Data" }'),
  false,
  "ReportBuilder should not expose a separate top-level Data tab once shared data editing lives inside the document stage.",
);

assert.equal(
  source.includes("Shared data view"),
  false,
  "ReportBuilder should not duplicate a shared-data card inside the document stage.",
);

assert.equal(
  source.includes("Shared report data"),
  false,
  "ReportBuilder should not label the inline data editor as shared report data.",
);

assert.equal(
  source.includes("Data Sources"),
  true,
  "ReportBuilder should expose a source-manager surface rather than implying one report-level source selection.",
);

assert.equal(
  source.includes("activationCount: semanticImportedArtifactCount"),
  true,
  "ReportBuilder should surface the semantic Model control when imported semantic reopen artifacts are available, even before live provider binding is active.",
);

assert.equal(
  source.includes('pendingDocumentInsertionAfterId === "primaryBuilder"\n            ? ""'),
  true,
  "ReportBuilder should not describe first authored-block insertion as happening after a shared-data node once Design mode is block-first.",
);

assert.equal(
  source.includes("Current source"),
  true,
  "ReportBuilder should expose which source is the live builder-backed source inside the source manager.",
);

assert.equal(
  source.includes("Data Sources"),
  true,
  "ReportBuilder should keep the source manager framed as a list of sources rather than a report-level chooser.",
);

assert.equal(
  source.includes("Edit the same report predicates used on the report surface."),
  true,
  "ReportBuilder should describe the filter editor as the same predicate system used by the report surface.",
);

assert.equal(
  source.includes("Import source"),
  true,
  "ReportBuilder should expose a generic import-source control instead of hardcoding CSV in the visible toolbar label.",
);

assert.equal(
  source.includes("removeStaticDataset(inspectedReportDataSourceDetails.sourceCardId)"),
  true,
  "ReportBuilder should let authors remove imported static datasets from the designer data-source catalog.",
);

assert.equal(
  source.includes("Replace file"),
  true,
  "ReportBuilder should let authors replace an imported static dataset from the source manager.",
);

assert.equal(
  source.includes("View details for"),
  true,
  "ReportBuilder should let authors inspect source details from the source manager without binding the source at report level.",
);

assert.equal(
  source.includes("Add block"),
  true,
  "ReportBuilder should expose a compact add-block action from each dataset row instead of separate block-type buttons.",
);

assert.equal(
  source.includes("key={reportBuilderSourceCardId(card)}"),
  true,
  "ReportBuilder should key source rows by authored dataset identity when several datasets share one backend source.",
);

assert.equal(
  source.includes("designSourceAddMenuRef === reportBuilderSourceCardId(card)"),
  true,
  "ReportBuilder should open add-block menus by authored dataset identity rather than a shared backend source reference.",
);

assert.equal(
  source.includes('text="Table"'),
  true,
  "ReportBuilder should keep Table as an explicit dataset-scoped add-block menu choice.",
);

assert.equal(
  source.includes('text="Chart"') && source.includes('text="KPI"'),
  true,
  "ReportBuilder should keep Chart and KPI as explicit dataset-scoped add-block menu choices.",
);

assert.equal(
  source.includes("const resolvedTemplateBlocks = resolveReportBuilderDocumentBlockList(result.nextState);"),
  true,
  "ReportBuilder should resolve the applied template's authored block order before resetting selection and insertion anchors.",
);

assert.equal(
  source.includes("authoredBlocks: resolvedTemplateBlocks"),
  true,
  "ReportBuilder should reset the insertion anchor against the newly applied template blocks instead of reusing stale document state.",
);

assert.equal(
  source.includes("Apply report preset") && source.includes("Switch report preset..."),
  true,
  "ReportBuilder should distinguish complete authored report presets from lightweight quick views.",
);

assert.equal(
  source.includes("const [pendingDocumentInsertionAfterId, setPendingDocumentInsertionAfterId] = useState(() => resolveDefaultReportBuilderInsertionAfterId({"),
  true,
  "ReportBuilder should initialize the insertion anchor from the current authored document instead of hardcoding primaryBuilder.",
);

assert.equal(
  source.includes("const closeReportDocumentShellPanels = React.useCallback(() => {"),
  true,
  "ReportBuilder should centralize the shell-panel reset logic used when the current report document is replaced.",
);

assert.equal(
  source.includes("setPendingDocumentInsertionPlacement(\"after\");\n                closeReportDocumentShellPanels();"),
  true,
  "ReportBuilder should also close stale shell panels when an imported starter auto-replaces the current blank document.",
);

assert.equal(
  source.includes("setPendingDocumentInsertionPlacement(\"after\");\n        closeReportDocumentShellPanels();"),
  true,
  "ReportBuilder should also close stale shell panels when resetting the current report back to a blank document.",
);

assert.equal(
  source.includes("runtimePreviewInteraction.clearInteractionState();\n                setSelectedDocumentOutlineEntryId(\"\");\n                setPendingDocumentInsertionAfterId(resolveDefaultReportBuilderInsertionAfterId({"),
  true,
  "ReportBuilder should also reset shell selection and insertion state when a blank starter is auto-applied.",
);

assert.equal(
  source.includes("Edit source"),
  true,
  "ReportBuilder should expose a source editor action from inspected source details for editable published or MCP-backed datasets.",
);

assert.equal(
  source.includes("ReportBuilderSourceDialog"),
  true,
  "ReportBuilder should render the shared source editor dialog component instead of inlining that UI.",
);

assert.equal(
  source.includes("Current source"),
  true,
  "ReportBuilder should mark the live builder-backed source with a compact current-source status.",
);

assert.equal(
  source.includes("detailGroups"),
  true,
  "ReportBuilder should organize source details into grouped fields and inputs instead of one long metadata string.",
);

assert.equal(
  source.includes("buildReportBuilderSourceDetailGroup"),
  true,
  "ReportBuilder should normalize source-detail groups through a capped helper instead of rendering every field label directly.",
);

assert.equal(
  source.includes("builderSource: inspectedReportDataSourceCard.active === true"),
  true,
  "ReportBuilder should only mark the actually active published source as the current source inside source details.",
);

assert.equal(
  source.includes("overflowCount"),
  true,
  "ReportBuilder should cap long field lists in source details and expose a remaining-count summary.",
);

assert.equal(
  source.includes("Published source available to authored blocks."),
  false,
  "ReportBuilder should avoid generic filler copy in source details when the field groups already explain the source.",
);

assert.equal(
  source.includes("Manage drill paths"),
  false,
  "ReportBuilder should keep drill authoring out of source details because drill setup belongs to authored result blocks and the data editor.",
);

assert.equal(
  source.includes("!designWorkspaceMode ? renderCompileDiagnosticsNotice(authoredDocumentCompileDiagnosticsNotice"),
  true,
  "ReportBuilder should route authored-block validation through the compact compile-diagnostics notice outside Design mode.",
);

assert.equal(
  source.includes("Show details"),
  true,
  "ReportBuilder should collapse multi-issue authored validation into a compact summary with an explicit details toggle.",
);

assert.equal(
  source.includes("{renderMeasuresPanel()}"),
  true,
  "ReportBuilder should render the real measures controls inline inside the data editor panel.",
);

assert.equal(
  source.includes("{renderBreakdownPanel()}"),
  true,
  "ReportBuilder should render the real breakdown controls inline inside the data editor panel.",
);

assert.equal(
  source.includes("Current data selection"),
  true,
  "ReportBuilder should frame ad hoc selections as a current data selection rather than a default projection.",
);

assert.equal(
  source.includes("Current builder selection"),
  true,
  "ReportBuilder should label the live authored-table starter projection as the current builder selection.",
);

assert.equal(
  source.includes("Data editor"),
  true,
  "ReportBuilder should label the inline measure and breakdown editor as a data editor.",
);

assert.equal(
  source.includes("Report blocks"),
  true,
  "ReportBuilder should expose report blocks through the compact tree header instead of a verbose document-outline explainer.",
);

assert.equal(
  source.includes("{renderSelectedOutlineInspector()}"),
  false,
  "ReportBuilder should keep block actions in the outline toolbar instead of rendering a second selected-item inspector under the tree.",
);

assert.equal(
  source.includes("Start from"),
  true,
  "ReportBuilder should expose a compact starter selector inside the Report Document stage.",
);

assert.equal(
  source.includes("Available report starters"),
  true,
  "ReportBuilder should render report starters as a compact list instead of a narrative-heavy chooser.",
);

assert.equal(
  source.includes("New report"),
  true,
  "ReportBuilder should expose a first-class new report starter in the chooser.",
);

assert.equal(
  source.includes('disabled={isActive}'),
  false,
  "ReportBuilder should not keep the old disabled selected-action pattern in the starter chooser.",
);

assert.equal(
  source.includes("Use"),
  true,
  "ReportBuilder should keep starter actions limited to the alternate report choices.",
);

assert.equal(
  source.includes("Choose starter"),
  false,
  "ReportBuilder should show the compact starter list directly in blank state instead of hiding it behind another toggle.",
);

assert.equal(
  source.includes("Reset to blank..."),
  true,
  "ReportBuilder should expose a direct reset-to-blank path for authored reports through compact report actions.",
);

assert.equal(
  source.includes("Switch report preset..."),
  true,
  "ReportBuilder should expose switching the authored report through the compact report actions menu.",
);

assert.equal(
  source.includes("Report actions"),
  true,
  "ReportBuilder should collapse rare whole-report actions behind a compact labeled menu trigger.",
);

assert.equal(
  source.includes('requestFingerprintRef.current = "";'),
  true,
  "ReportBuilder should clear the request replay fingerprint when applying starters so committed-state auto-fetch can rerun even if the starter keeps the same effective request.",
);

assert.equal(
  source.includes('lastManualRunFingerprintRef.current = "";')
    && source.includes('executeOnOpenRunKeyRef.current = "";'),
  true,
  "ReportBuilder should clear completed-run and hosted execute identities when applying a starter so the authored document executes after commit.",
);

assert.equal(
  source.includes("const resolvedHostedReportStarterId = useMemo(")
    && source.includes("findReportBuilderStarterTemplate(hostedReportStarterId, reportDocumentTemplates)?.id")
    && source.includes("&& hostedReportStarterReady"),
  true,
  "ReportBuilder should resolve hosted starter labels to stable ids before gating authored runtime dataset fetches.",
);

assert.equal(
  source.includes("canShowResults: authoredRuntimePreviewState?.canRenderRuntime")
    && source.includes("const shouldCollapseHostedExecution = hostedExecuteOnOpen"),
  true,
  "ReportBuilder should collapse live filters after authored runtime datasets complete, not only after primary collection rows render.",
);

assert.equal(
  source.includes('beginReportRunLifecycle({ reuseCurrent: true });')
    && source.includes('emitRunLifecycleEvent("report.run", {')
    && source.includes('status: authoredRuntimePreviewState?.errorState ? "failed" : "succeeded"'),
  true,
  "hosted authored execution should emit correlated run start and completion events from resolved runtime datasets.",
);

assert.equal(
  source.includes("dispatchReportRequest(result.nextState, { forceFetch: true })"),
  false,
  "ReportBuilder should not fire starter fetches against pre-commit state because the committed-state request effect owns starter auto-fetch replay.",
);

assert.equal(
  source.includes("authoredPreviewAutoFetchKeyRef"),
  true,
  "ReportBuilder should keep a one-shot authored-preview fetch replay key so valid report starters can fetch once on Preview/Report entry without thrashing.",
);

assert.equal(
  source.includes("currentSourceRef: normalizeString(") && source.includes("authoredDocumentFieldOptions.datasetOptions || []"),
  true,
  "ReportBuilder should route authored dataset options through the prepared document field-options model so published and secondary sources carry their current fetch contract and field catalogs.",
);

assert.equal(
  source.includes("const layoutTitle = designWorkspaceFlowState.presentation.rows[0]?.value || \"Report\";"),
  true,
  "ReportBuilder should promote the authored report title into the layout stage heading instead of repeating a generic report-layout label.",
);

assert.equal(
  source.includes("workspaceSettingsLabel"),
  true,
  "ReportBuilder should derive the settings-button label from the active builder title instead of hardcoding a product-specific name.",
);

assert.equal(
  source.includes("Composition flow"),
  false,
  "ReportBuilder should remove the old composition-flow explainer once the add-block toolbar lives directly in the report tree.",
);

assert.equal(
  source.includes("Use the block toolbar above to add the first block."),
  true,
  "ReportBuilder should keep the empty-state prompt compact and focused on the next authoring action.",
);

assert.equal(
  source.includes("forge-report-builder__settings-anchor--metadata"),
  true,
  "ReportBuilder should expose report metadata from a compact icon trigger instead of another full-width action row.",
);

assert.equal(
  source.includes("Edit report metadata"),
  true,
  "ReportBuilder should label the compact metadata trigger clearly for accessibility.",
);

assert.equal(
  source.includes(">Edit metadata<"),
  false,
  "ReportBuilder should not repeat a full-width Edit metadata button inside the document composition surface.",
);

assert.equal(
  source.includes("pendingDocumentInsertionPlacement === \"before\" ? \"Before\" : \"After\""),
  false,
  "ReportBuilder should not repeat an insertion subtitle in the report outline header once the user asked to remove that noise.",
);

assert.equal(
  source.includes("selectedDocumentInsertionTarget"),
  true,
  "ReportBuilder should resolve insertion context from the selected report outline leaf.",
);

assert.equal(
  source.includes("setSelectedDocumentOutlineEntryId(entry.id)"),
  true,
  "ReportBuilder should keep the selected report outline leaf in local state.",
);

assert.equal(
  source.includes("renderSelectedOutlineInspector"),
  true,
  "ReportBuilder should keep the selected-item inspector logic internal until the old path is fully deleted.",
);

assert.equal(
  source.includes("Block Composer"),
  false,
  "ReportBuilder should merge add-block actions into the report outline workflow instead of rendering a separate Block Composer panel.",
);

assert.equal(
  source.includes('title="Add block"')
    && source.includes('aria-label="Add block"')
    && source.includes("Add block"),
  true,
  "ReportBuilder should expose one compact add-block menu from the report outline composition flow instead of a dense icon strip.",
);

assert.equal(
  source.includes("Shared Data"),
  false,
  "ReportBuilder should not label the primary data editor as shared data.",
);

assert.equal(
  source.includes("Shared report data"),
  false,
  "ReportBuilder should not label the primary builder leaf with shared-data terminology.",
);

assert.equal(
  source.includes("aria-label=\"Report document metadata\""),
  false,
  "ReportBuilder should not repeat report metadata as a separate pill row inside the designer surface.",
);

assert.equal(
  source.includes("Selected report item summary"),
  false,
  "ReportBuilder should not leave generic selected-item accessibility text in the contextual lower inspector.",
);

assert.equal(
  source.includes("forge-report-builder__design-outline-toolbar"),
  true,
  "ReportBuilder should render an inline toolbar on selected authored outline rows.",
);

assert.equal(
  source.includes("More actions for"),
  true,
  "ReportBuilder should demote destructive selected-row actions behind a compact overflow affordance.",
);

assert.equal(
  source.includes("buildReportBuilderSelectedSemanticBindingViewState"),
  true,
  "ReportBuilder should expose semantic binding in the selected-item inspector for data-bearing tree leaves.",
);

assert.equal(
  source.includes("resolveReportBuilderSelectedInsertionGroupIds"),
  true,
  "ReportBuilder should derive contextual add groups from the selected tree leaf kind.",
);

assert.equal(
  source.includes("resolveReportBuilderSelectedDrillBindings"),
  true,
  "ReportBuilder should derive selected drill-branch detail actions from a pure helper.",
);

assert.equal(
  source.includes("preserveInputState: true"),
  true,
  "ReportBuilder should preserve meaningful incoming prefill state when applying a predefined report starter.",
);

assert.equal(
  source.includes("baseState: state"),
  true,
  "ReportBuilder should pass the current builder state into template instantiation so predefined reports can keep prefilled filter values.",
);

assert.equal(
  source.includes("shouldDeferReportBuilderRequestForPrefill({"),
  true,
  "ReportBuilder should defer starter auto-application until the current prefill has been applied.",
);

assert.equal(
  source.includes('requestedReportStarterId === "__blank__"'),
  true,
  "ReportBuilder should recognize the explicit blank-report starter path.",
);

assert.equal(
  source.includes("buildBlankReportBuilderDocumentState"),
  true,
  "ReportBuilder should build a real blank report state instead of treating blank as a no-op.",
);

assert.equal(
  source.includes("resolveReportBuilderPreferredSelectedEntryId"),
  true,
  "ReportBuilder should be able to prefer the chart leaf when a chart selection already exists.",
);

assert.equal(
  source.includes("chartSpec: normalized,\n            viewMode: \"chart\",\n        });\n        setSelectedBuilderChartSelection(null);"),
  true,
  "ReportBuilder should clear stale chart selections when applying a new chart spec.",
);

assert.equal(
  source.includes("setSelectedBuilderChartSelection(null);") && source.includes("const nextPreparedState = applyQuickChartToAuthoredDocument"),
  true,
  "ReportBuilder should also clear stale chart selections when applying quick-chart presets that bypass the explicit chart dialog path.",
);

assert.equal(
  source.includes("hierarchies: authoredDrillMetadata.hierarchies"),
  true,
  "ReportBuilder should resolve selected drill-branch detail actions from the full authored drill metadata, not the summarized hierarchy view.",
);

assert.equal(
  source.includes("Remove drill branch"),
  true,
  "ReportBuilder should let selected drill hierarchy nodes remove their branch directly from the selected-item inspector.",
);

assert.equal(
  source.includes("Capture current path"),
  true,
  "ReportBuilder should let selected drill placeholder nodes capture the current drill path directly from the selected-item inspector.",
);

assert.equal(
  source.includes("Add detail actions"),
  true,
  "ReportBuilder should let selected drill hierarchy nodes add missing detail actions directly from the selected-item inspector.",
);

assert.equal(
  source.includes("beginAuthoredDetailTargetDraft"),
  true,
  "ReportBuilder should seed drill detail-action authoring from the selected drill branch inspector.",
);

assert.equal(
  source.includes("Start draft from chart selection"),
  true,
  "ReportBuilder should let the selected chart leaf start a local draft from the current chart selection.",
);

assert.equal(
  source.includes("Clear chart selection"),
  true,
  "ReportBuilder should let the selected chart leaf clear the current chart selection directly from the inspector.",
);

assert.equal(
  source.includes("selectedBuilderTableRow"),
  true,
  "ReportBuilder should keep local selected-row state for the primary table leaf.",
);

assert.equal(
  source.includes("Row actions"),
  true,
  "ReportBuilder should let the selected table leaf expose current row runtime actions.",
);

assert.equal(
  source.includes("is no longer available in the current drill authoring fields"),
  true,
  "ReportBuilder should not let selected drill branches seed detail actions for hierarchy fields that are no longer present in the current breakdown options.",
);

assert.equal(
  source.includes("Next insert {insertionPlacement}"),
  true,
  "ReportBuilder should keep insertion context available for selected tree leaves.",
);

assert.equal(
  source.includes("Add the next narrative or presentation block ${insertionPlacement}"),
  true,
  "ReportBuilder should route document-block creation through the selected-item inspector.",
);

assert.equal(
  source.includes("Add the next runtime control ${insertionPlacement}"),
  true,
  "ReportBuilder should route runtime-block creation through the selected-item inspector.",
);

assert.equal(
  source.includes("Add the first authored block from Layout, then return here to compose runtime controls in context."),
  true,
  "ReportBuilder should avoid exposing a second first-block add surface from the runtime tab.",
);

assert.equal(
  source.includes("pendingDocumentInsertionAfterId"),
  true,
  "ReportBuilder should carry insertion context into the authored block dialogs.",
);

assert.equal(
  source.includes("pendingDocumentInsertionPlacement"),
  true,
  "ReportBuilder should carry before/after insertion placement into the authored block dialogs.",
);

assert.equal(
  source.includes("Insert before"),
  true,
  "ReportBuilder should let the selected tree item switch insertion to before the selected anchor.",
);

assert.equal(
  source.includes("Insert after"),
  true,
  "ReportBuilder should let the selected tree item switch insertion to after the selected anchor.",
);

assert.equal(
  source.includes("designDocumentOutlineEntries"),
  true,
  "ReportBuilder should filter the visible design outline separately from the full runtime-backed document outline.",
);

assert.equal(
  source.includes("moveReportBuilderDocumentBlockRelativeState"),
  true,
  "ReportBuilder should support relative block reordering so drag-and-drop can place blocks before or after another block.",
);

assert.equal(
  source.includes('data-testid="report-builder-outline-node"'),
  true,
  "ReportBuilder should expose real drag surfaces on report-tree nodes for block reordering.",
);

assert.equal(
  outlineSource.includes("Add drill branch"),
  true,
  "ReportBuilder should expose drill branches as child nodes in the report outline.",
);

assert.equal(
  outlineSource.includes("resolveReportBuilderDocumentInsertionTarget"),
  true,
  "ReportBuilder should expose a pure helper that resolves insertion anchors from the report tree.",
);

assert.equal(
  source.includes("kind: \"chartView\""),
  true,
  "ReportBuilder should add chart view children under the primary result node.",
);

assert.equal(
  source.includes("kind: \"tableView\""),
  true,
  "ReportBuilder should add table view children under the primary result node.",
);

assert.equal(
  source.includes("measures: false"),
  true,
  "ReportBuilder should keep the left rail out of the document data-view flow so the center designer owns inline data editing.",
);

assert.equal(
  source.includes("filters: false"),
  true,
  "ReportBuilder should keep filter editing out of the design left rail so the runtime focus center stage is the single predicate editing surface.",
);

assert.equal(
  source.includes('data-testid="report-builder-runtime-filter-editor"'),
  true,
  "ReportBuilder should render the real predicate editor directly in the Filters design focus center stage.",
);

assert.equal(
  /data-testid="report-builder-runtime-filter-editor"[\s\S]*?renderFilterCategoryControls\(\)[\s\S]*?renderFilterBody\(\)/.test(source),
  true,
  "ReportBuilder should reuse the real filter category chips and filter body inside the runtime design focus stage.",
);

assert.equal(
  source.includes("renderFilterRailControls"),
  false,
  "ReportBuilder should no longer host a rail filter launcher in Design mode.",
);

assert.equal(
  source.includes("showOverlayBody"),
  false,
  "ReportBuilder should no longer split design-mode filter editing into a center overlay.",
);

assert.equal(
  source.includes("forge-report-builder__overlay-shell"),
  false,
  "ReportBuilder should not render an overlay shell for design-mode filters.",
);

assert.equal(
  source.includes("workspaceModeStorageReadyRef"),
  true,
  "ReportBuilder should guard workspace-mode persistence so compact/desktop breakpoint changes do not overwrite the just-loaded mode.",
);

assert.equal(
  source.includes('className="forge-report-builder__settings-dialog"'),
  true,
  "ReportBuilder should render toolbar settings in a dedicated dialog surface instead of only an inline popover.",
);

assert.equal(
  source.includes("renderSettingsDialog()"),
  true,
  "ReportBuilder should route the shared settings controls through an explicit dialog renderer.",
);

assert.equal(
  source.includes("renderRuntimeDataViewControls"),
  true,
  "Report-mode settings should expose runtime measure and breakdown selection without entering Design mode.",
);

assert.equal(
  source.includes('aria-label="Table measures"') && source.includes('aria-label="Add table breakdown"'),
  true,
  "The web table settings dialog should expose accessible measure and breakdown controls.",
);

assert.equal(
  source.includes("designRailHasCollapsiblePanels"),
  true,
  "ReportBuilder should avoid misleading left-rail panel counts when only the runtime filter launcher is visible.",
);

assert.equal(
  source.includes("4. Drill Downs"),
  true,
  "ReportBuilder should keep drill summary metadata available even after drill setup moves into the shared data flow.",
);

assert.equal(
  source.includes('forge-report-builder__design-mode-control forge-report-builder__action-button')
    && source.includes('forge-report-builder__run-button forge-report-builder__action-button')
    && source.includes('className="forge-report-builder__action-menu-button"'),
  true,
  "Run, Design, and export controls should share the unified green report-action styling.",
);

assert.equal(
  source.includes('eventSourceKind: activeReportEventSourceKind'),
  true,
  "Draft export events should retain the canonical active report source kind.",
);

console.log("reportBuilderDesignWorkspaceCoverage ✓ design mode keeps live results on the report surface only");
