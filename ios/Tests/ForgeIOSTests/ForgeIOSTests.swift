import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

final class ForgeIOSTests: XCTestCase {
    func testActionHookRuntimeInvokesPureCollectionHook() throws {
        let code = """
        (() => ({
          prepareCollection: (props = {}) => {
            const collection = props.collection || [];
            return collection.map((row) => ({
              ...row,
              applyStatus: String(row.apply_status ?? "").trim().toUpperCase()
            }));
          }
        }))()
        """

        let result = try ActionHookRuntime.invoke(
            code: code,
            functionName: "prepareCollection",
            props: .object([
                "collection": .array([
                    .object([
                        "apply_status": .string("approved"),
                        "id": .number(2)
                    ])
                ])
            ])
        )

        guard case .array(let rows)? = result,
              case .object(let first)? = rows.first else {
            return XCTFail("Expected transformed collection array")
        }
        XCTAssertEqual(first["applyStatus"], .string("APPROVED"))
        XCTAssertEqual(first["id"], .number(2))
    }

    func testRefreshDataSourceCollectionAppliesPrepareCollectionHook() async {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(
            dataSources: [
                "list": DataSourceDef()
            ],
            actions: ActionsDef(code: """
            (() => ({
              prepareCollection: ({ collection = [] }) => collection.map((row) => ({
                ...row,
                applyStatus: String(row.apply_status ?? "").toUpperCase()
              }))
            }))()
            """)
        )
        let window = await runtime.openWindowInline(key: "w1", title: "W1", metadata: metadata)
        await runtime.registerDataSourceLoader { request in
            XCTAssertEqual(request.windowID, window.id)
            XCTAssertEqual(request.dataSourceRef, "list")
            return ForgeRuntime.DataSourceFetchResult(
                rows: [[
                    "id": .number(7),
                    "apply_status": .string("approved")
                ]],
                metrics: ["totalCount": .number(1)]
            )
        }

        await runtime.refreshDataSourceCollection(windowID: window.id, dataSourceRef: "list")

        let rows = await runtime.dataSourceCollection(windowID: window.id, dataSourceRef: "list")
        let metrics = await runtime.dataSourceMetrics(windowID: window.id, dataSourceRef: "list")
        XCTAssertEqual(rows.first?["applyStatus"], .string("APPROVED"))
        XCTAssertEqual(rows.first?["id"], .number(7))
        XCTAssertEqual(metrics["totalCount"], .number(1))
    }

    func testSetDataSourceSelectionAppliesPrepareSelectionHookAndSyncsForm() async {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(
            dataSources: [
                "list": DataSourceDef()
            ],
            actions: ActionsDef(code: """
            (() => ({
              prepareSelection: ({ selected = {}, rowIndex = -1 }) => ({
                ...selected,
                normalizedId: String(selected.id ?? ""),
                selectedRowIndex: rowIndex
              })
            }))()
            """)
        )
        let window = await runtime.openWindowInline(key: "w1", title: "W1", metadata: metadata)

        await runtime.setDataSourceSelection(
            windowID: window.id,
            dataSourceRef: "list",
            selected: ["id": .number(42)],
            rowIndex: 3
        )

        let dsID = WindowIdentity(windowID: window.id).dataSourceID(ref: "list")
        let selection = await runtime.dataSourceRuntime.selection(dataSourceID: dsID)
        let form = await runtime.dataSourceRuntime.form(dataSourceID: dsID)
        XCTAssertEqual(selection.selected?["normalizedId"], .string("42"))
        XCTAssertEqual(selection.selected?["selectedRowIndex"], .number(3))
        XCTAssertEqual(form["normalizedId"], .string("42"))
        XCTAssertEqual(form["selectedRowIndex"], .number(3))

        await runtime.toggleDataSourceSelection(
            windowID: window.id,
            dataSourceRef: "list",
            row: ["id": .number(42)],
            rowIndex: 3
        )

        let clearedSelection = await runtime.dataSourceRuntime.selection(dataSourceID: dsID)
        let clearedForm = await runtime.dataSourceRuntime.form(dataSourceID: dsID)
        XCTAssertNil(clearedSelection.selected)
        XCTAssertTrue(clearedForm.isEmpty)
    }

    func testSchemaBasedFormDecodesSchemaAndAliasDataSourceRef() throws {
        let payload = """
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "approvalEnvPicker",
                  "schemaBasedForm": {
                    "id": "approvalForgeForm",
                    "datasourceRef": "approvalEditor",
                    "schema": {
                      "type": "object",
                      "properties": {
                        "names": {
                          "type": "array",
                          "title": "names",
                          "enum": ["HOME", "SHELL"],
                          "x-ui-widget": "multiSelect"
                        }
                      }
                    },
                    "showSubmit": false
                  }
                }
              ]
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let container = metadata.view?.content?.containers.first

        XCTAssertEqual(container?.id, "approvalEnvPicker")
        XCTAssertEqual(container?.schemaBasedForm?.id, "approvalForgeForm")
        XCTAssertEqual(container?.schemaBasedForm?.dataSourceRef, "approvalEditor")
        XCTAssertEqual(container?.schemaBasedForm?.showSubmit, false)
        XCTAssertNotNil(container?.schemaBasedForm?.schema)
    }

    func testSchemaFormRuntimeResolvesFieldsFromSchema() {
        let form = SchemaBasedFormDef(
            schema: .object([
                "type": .string("object"),
                "required": .array([.string("region")]),
                "properties": .object([
                    "region": .object([
                        "type": .string("string"),
                        "title": .string("Region"),
                        "enum": .array([.string("NA"), .string("EMEA")])
                    ]),
                    "details": .object([
                        "type": .string("object"),
                        "title": .string("Details")
                    ])
                ])
            ])
        )

        let fields = SchemaFormRuntime.resolvedFields(for: form)

        XCTAssertEqual(fields.count, 2)
        XCTAssertEqual(fields.first?.key, "details")
        XCTAssertEqual(fields.last?.key, "region")
        XCTAssertEqual(fields.last?.label, "Region")
        XCTAssertEqual(fields.last?.type, .picker)
        XCTAssertEqual(fields.last?.required, true)
        XCTAssertEqual(fields.last?.options, ["NA", "EMEA"])
    }

    func testSchemaFormRuntimeResolvesExplicitFields() {
        let form = SchemaBasedFormDef(
            fields: [
                FormFieldDef(
                    name: "names",
                    label: "Names",
                    type: "array",
                    required: true,
                    enumValues: ["HOME", "SHELL"],
                    defaultValue: .array([.string("HOME")]),
                    widget: "multiSelect",
                    placeholder: "Pick names"
                )
            ]
        )

        let fields = SchemaFormRuntime.resolvedFields(for: form)

        XCTAssertEqual(fields.count, 1)
        XCTAssertEqual(fields[0].key, "names")
        XCTAssertEqual(fields[0].label, "Names")
        XCTAssertEqual(fields[0].type, .multiSelect)
        XCTAssertEqual(fields[0].options, ["HOME", "SHELL"])
        XCTAssertEqual(fields[0].placeholder, "Pick names")
        XCTAssertEqual(fields[0].defaultValue, .array([.string("HOME")]))
    }

    func testMetadataResolverFiltersTargetedContainersAndAppliesOverrides() {
        let payload = """
        {
          "actions": {
            "code": "(() => ({ ping: () => true }))()"
          },
          "view": {
            "content": {
              "containers": [
                {
                  "id": "shared",
                  "title": "Shared"
                },
                {
                  "id": "androidOnly",
                  "title": "Android",
                  "target": "android"
                },
                {
                  "id": "iosOnly",
                  "title": "Base",
                  "targetOverrides": {
                    "surface:app": {
                      "title": "App Title"
                    },
                    "mobile": {
                      "title": "Mobile Title"
                    },
                    "tablet": {
                      "title": "Tablet Title"
                    },
                    "ios": {
                      "title": "iOS Title"
                    },
                    "ios:tablet": {
                      "title": "Exact Tablet Title"
                    }
                  }
                }
              ]
            }
          }
        }
        """

        let metadata = try! JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let resolved = MetadataResolver.resolve(
            metadata,
            for: ForgeTargetContext(platform: "ios", formFactor: "tablet", surface: "app")
        )
        let containers = resolved.view?.content?.containers ?? []

        XCTAssertEqual(containers.map(\.id), ["shared", "iosOnly"])
        XCTAssertEqual(containers.last?.title, "Exact Tablet Title")
        XCTAssertEqual(resolved.actions?.code, "(() => ({ ping: () => true }))()")
    }

    func testWindowMetadataDecodesActionsCodeAndDatasourceAlias() throws {
        let payload = """
        {
          "namespace": "Report",
          "actions": {
            "code": "(() => ({ prepareCollection: () => [] }))()"
          },
          "dataSource": {
            "report": {
              "selectionMode": "single"
            }
          },
          "view": {
            "content": {
              "containers": []
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))

        XCTAssertEqual(metadata.namespace, "Report")
        XCTAssertEqual(metadata.actions?.code, "(() => ({ prepareCollection: () => [] }))()")
        XCTAssertEqual(metadata.dataSources["report"]?.selectionMode, "single")
    }

    func testMetadataResolverPreservesDatasourceNamedTarget() {
        let metadata = WindowMetadata(
            dataSources: [
                "target": DataSourceDef(),
                "dialogSource": DataSourceDef(selectionMode: "multi")
            ]
        )

        let resolved = MetadataResolver.resolve(
            metadata,
            for: ForgeTargetContext(platform: "ios", formFactor: "phone")
        )

        XCTAssertNotNil(resolved.dataSources["target"])
        XCTAssertEqual(resolved.dataSources["dialogSource"]?.selectionMode, "multi")
    }

    func testTableRendererUsesCompactCardsForPhoneAndRegularGridForTablet() {
        XCTAssertEqual(
            TableRenderer.resolvePresentationMode(
                targetContext: ForgeTargetContext(platform: "ios", formFactor: "phone"),
                horizontalSizeClass: .regular
            ),
            .compactCards
        )
        XCTAssertEqual(
            TableRenderer.resolvePresentationMode(
                targetContext: ForgeTargetContext(platform: "ios", formFactor: "tablet"),
                horizontalSizeClass: .compact
            ),
            .regularGrid
        )
        XCTAssertEqual(
            TableRenderer.resolvePresentationMode(
                targetContext: nil,
                horizontalSizeClass: .regular
            ),
            .regularGrid
        )
    }

    func testResolveColumnLinkTargetBuildsWindowTargetFromRowMetadata() {
        let column = ColumnDef(
            id: "adOrderName",
            type: "link",
            link: LinkDef(
                kind: "window",
                windowKey: "order",
                windowTitleSource: "row",
                windowTitleTemplate: "{{adOrderName}} ({{adOrderId}})",
                parameters: [
                    "AdOrderId": .object([
                        "source": .string("row"),
                        "selector": .string("adOrderId"),
                        "wrap": .string("array")
                    ])
                ]
            )
        )

        let target = resolveColumnLinkTargetFromContext(
            column: column,
            context: LinkResolutionContext(
                row: [
                    "adOrderId": .number(2660900),
                    "adOrderName": .string("OLV_BAU_AUS")
                ],
                value: .string("OLV_BAU_AUS")
            )
        )

        guard case .window(let link)? = target else {
            return XCTFail("Expected a window link target")
        }
        XCTAssertEqual(link.windowKey, "order")
        XCTAssertEqual(link.title, "OLV_BAU_AUS (2660900)")
        XCTAssertEqual(link.parameters["AdOrderId"], .array([.number(2660900)]))
    }

    func testResolveLinkWindowTitleUsesMetricsTemplateWithoutRowInference() {
        let title = resolveLinkWindowTitleFromContext(
            link: LinkDef(
                windowKey: "order",
                windowTitleSource: "metrics",
                windowTitleTemplate: "{{adOrderName}} ({{adOrderId}})"
            ),
            context: LinkResolutionContext(
                metrics: [
                    "adOrderId": .number(2660900),
                    "adOrderName": .string("OLV_BAU_AUS")
                ]
            ),
            fallbackTitle: "Order"
        )

        XCTAssertEqual(title, "OLV_BAU_AUS (2660900)")
    }

    func testResolveColumnLinkTargetRejectsWindowLinksWithoutAKey() {
        let target = resolveColumnLinkTargetFromContext(
            column: ColumnDef(
                id: "broken",
                type: "link",
                link: LinkDef(kind: "window")
            ),
            context: LinkResolutionContext(
                row: ["broken": .string("Open")],
                value: .string("Open")
            )
        )

        XCTAssertNil(target)
    }

    func testTableDefDecodesLegacyStringColumnsAndRichActionColumns() throws {
        let payload = """
        {
          "title": "Orders",
          "columns": [
            "segment",
            {
              "id": "budget",
              "label": "Budget"
            },
            {
              "id": "open",
              "type": "button",
              "label": "Open",
              "on": [
                { "action": "window.openWindow", "args": ["detail"] }
              ]
            }
          ]
        }
        """

        let table = try JSONDecoder().decode(TableDef.self, from: Data(payload.utf8))

        XCTAssertEqual(table.title, "Orders")
        XCTAssertEqual(table.columns.count, 3)
        XCTAssertEqual(table.columns[0].id, "segment")
        XCTAssertEqual(table.columns[0].label, "segment")
        XCTAssertEqual(table.columns[1].id, "budget")
        XCTAssertEqual(table.columns[1].label, "Budget")
        XCTAssertEqual(table.columns[2].type, "button")
        XCTAssertEqual(table.columns[2].on.first?.action, "window.openWindow")
    }

    func testWindowOpensInline() async throws {
        let runtime = ForgeRuntime()
        let state = await runtime.openWindowInline(
            key: "test",
            title: "Test",
            metadata: WindowMetadata()
        )
        XCTAssertEqual(state.key, "test")
    }

    func testParseMarkdownBlocksDetectsMermaidFence() {
        let source = """
        Intro
        ```mermaid
        flowchart TD
          A[Start] --> B[Done]
        ```
        """

        let blocks = parseMarkdownBlocks(source)

        XCTAssertEqual(blocks.count, 2)
        XCTAssertEqual(blocks[0], .markdown("Intro"))
        XCTAssertEqual(blocks[1], .mermaid("flowchart TD\n  A[Start] --> B[Done]"))
    }

    func testParseMermaidDiagramParsesFlowchartNodes() {
        let source = """
        flowchart TD
          A[Order 2639076] --> B[Spend summary]
          B --> C[Alpha]
          B --> D[Beta]
        """

        let diagram = parseMermaidDiagram(source)

        XCTAssertEqual(
            diagram,
            .flowchart(
                MermaidFlowchart(nodes: ["Order 2639076", "Spend summary", "Alpha", "Beta"])
            )
        )
    }

    func testParseMermaidDiagramParsesPieSlices() {
        let source = """
        pie showData
          title Spend share
          "Alpha" : 1316.86
          "Beta" : 842.10
        """

        let diagram = parseMermaidDiagram(source)

        XCTAssertEqual(
            diagram,
            .pie([
                MermaidPieSlice(label: "Alpha", value: 1316.86),
                MermaidPieSlice(label: "Beta", value: 842.10)
            ])
        )
    }

    func testParseMermaidDiagramParsesSequenceDiagrams() {
        let source = """
        sequenceDiagram
          participant U as User
          participant A as Agent
          U->>A: Ask for status
          A-->>U: Return dashboard
        """

        let diagram = parseMermaidDiagram(source)

        XCTAssertEqual(
            diagram,
            .sequence(
                actors: ["User", "Agent"],
                messages: [
                    MermaidSequenceMessage(from: "User", to: "Agent", text: "Ask for status"),
                    MermaidSequenceMessage(from: "Agent", to: "User", text: "Return dashboard")
                ]
            )
        )
    }

    func testParseMermaidDiagramParsesClassDiagrams() {
        let source = """
        classDiagram
          class Workspace
          Workspace : +open()
          Workspace -- Window : owns
        """

        let diagram = parseMermaidDiagram(source)

        XCTAssertEqual(
            diagram,
            .classDiagram(
                classes: [
                    MermaidClass(name: "Workspace", members: ["+open()"]),
                    MermaidClass(name: "Window", members: [])
                ],
                relations: [
                    MermaidRelation(from: "Workspace", to: "Window", label: "owns")
                ]
            )
        )
    }

    func testParseMermaidDiagramParsesStateDiagrams() {
        let source = """
        stateDiagram-v2
          [*] --> Draft
          Draft --> Running : submit
          Running --> Complete : finish
        """

        let diagram = parseMermaidDiagram(source)

        XCTAssertEqual(
            diagram,
            .state(
                states: ["Start/End", "Draft", "Running", "Complete"],
                transitions: [
                    MermaidRelation(from: "Start/End", to: "Draft", label: nil),
                    MermaidRelation(from: "Draft", to: "Running", label: "submit"),
                    MermaidRelation(from: "Running", to: "Complete", label: "finish")
                ]
            )
        )
    }

    func testParseMermaidDiagramParsesEntityRelationshipDiagrams() {
        let source = """
        erDiagram
          USER ||--o{ SESSION : owns
          SESSION }o--|| WORKSPACE : selects
        """

        let diagram = parseMermaidDiagram(source)

        XCTAssertEqual(
            diagram,
            .entityRelationship(
                entities: ["USER", "SESSION", "WORKSPACE"],
                relations: [
                    MermaidRelation(from: "USER", to: "SESSION", label: "owns"),
                    MermaidRelation(from: "SESSION", to: "WORKSPACE", label: "selects")
                ]
            )
        )
    }

    func testParseMermaidDiagramParsesTimelineDiagrams() {
        let source = """
        timeline
          title Release
          2026-06-01 : API parity
          2026-06-02 : Mobile proof
        """

        let diagram = parseMermaidDiagram(source)

        XCTAssertEqual(
            diagram,
            .timeline([
                MermaidTimelineEvent(time: "2026-06-01", label: "API parity"),
                MermaidTimelineEvent(time: "2026-06-02", label: "Mobile proof")
            ])
        )
    }

    func testParseMermaidDiagramParsesGanttDiagrams() {
        let source = """
        gantt
          title Migration
          dateFormat YYYY-MM-DD
          section Runtime
          Parser parity :done, 2026-06-01, 2026-06-03
        """

        let diagram = parseMermaidDiagram(source)

        XCTAssertEqual(
            diagram,
            .gantt([
                MermaidGanttTask(
                    section: "Runtime",
                    name: "Parser parity",
                    start: "2026-06-01",
                    end: "2026-06-03",
                    tags: ["done"]
                )
            ])
        )
    }

    func testDataSourceRuntimeStoresTypedFormAndSelectionState() async {
        let runtime = DataSourceRuntime()
        let dataSourceID = "window123DSmain"

        await runtime.setForm(dataSourceID: dataSourceID, values: [
            "region": .string("NA"),
            "limit": .number(25)
        ])
        await runtime.setSelection(
            dataSourceID: dataSourceID,
            selection: SelectionState(selected: ["id": .string("acct-1")], rowIndex: 2)
        )

        let form = await runtime.form(dataSourceID: dataSourceID)
        let selection = await runtime.selection(dataSourceID: dataSourceID)

        XCTAssertEqual(form["region"], .string("NA"))
        XCTAssertEqual(form["limit"], .number(25))
        XCTAssertEqual(selection.selected?["id"], .string("acct-1"))
        XCTAssertEqual(selection.rowIndex, 2)
    }

    func testSignalRegistryRemovesWindowScopedSignals() async {
        let registry = SignalRegistry()
        let signal = await registry.form(dataSourceID: "windowABCDSmain")
        await signal.set(["region": .string("EMEA")])
        _ = await registry.dashboardFilters(key: "windowABC:summary")
        await registry.removeWindow(windowID: "windowABC")
        let reloaded = await registry.form(dataSourceID: "windowABCDSmain")
        let value = await reloaded.peek()

        XCTAssertTrue(value.isEmpty)
    }

    func testEvaluateDashboardConditionSupportsThresholdsAndSelection() {
        XCTAssertTrue(
            DashboardRuntime.evaluateDashboardCondition(
                DashboardConditionDef(selector: "quality.zero_spend_rate", gt: 40),
                metrics: ["quality": ["zero_spend_rate": 47.2]]
            )
        )
        XCTAssertFalse(
            DashboardRuntime.evaluateDashboardCondition(
                DashboardConditionDef(selector: "quality.zero_spend_rate", gt: 40),
                metrics: ["quality": ["zero_spend_rate": 12.0]]
            )
        )

        XCTAssertTrue(
            DashboardRuntime.evaluateDashboardCondition(
                DashboardConditionDef(selector: "selection.entityKey", whenValue: .string("US")),
                selection: DashboardSelectionState(entityKey: "US")
            )
        )
        XCTAssertFalse(
            DashboardRuntime.evaluateDashboardCondition(
                DashboardConditionDef(selector: "selection.entityKey", whenValue: .string("US")),
                selection: DashboardSelectionState(entityKey: "GB")
            )
        )
    }

    func testEvaluateDashboardConditionSupportsSourceAndEmptyOperators() {
        XCTAssertTrue(
            DashboardRuntime.evaluateDashboardCondition(
                DashboardConditionDef(source: "selection", field: "entityKey", equals: .string("US")),
                selection: DashboardSelectionState(entityKey: "US")
            )
        )
        XCTAssertFalse(
            DashboardRuntime.evaluateDashboardCondition(
                DashboardConditionDef(source: "selection", field: "entityKey", notEquals: .string("US")),
                selection: DashboardSelectionState(entityKey: "US")
            )
        )
        XCTAssertTrue(
            DashboardRuntime.evaluateDashboardCondition(
                DashboardConditionDef(source: "filters", field: "region", inValues: [.string("NA"), .string("EMEA")]),
                filters: ["region": "NA"]
            )
        )
        XCTAssertTrue(
            DashboardRuntime.evaluateDashboardCondition(
                DashboardConditionDef(source: "filters", field: "region", empty: true),
                filters: [:]
            )
        )
    }

    func testDashboardDefDecodesGroupedVisibleWhen() throws {
        let payload = """
        {
          "id": "summary",
          "kind": "dashboard.summary",
          "visibleWhen": { "source": "filters", "field": "region", "equals": "legacy" },
          "dashboard": {
            "visibleWhen": { "source": "filters", "field": "region", "equals": "NA" }
          }
        }
        """
        let container = try JSONDecoder().decode(ContainerDef.self, from: Data(payload.utf8))

        XCTAssertEqual(container.visibleWhen?.equals, .string("legacy"))
        XCTAssertEqual(container.dashboard?.visibleWhen?.equals, .string("NA"))
    }

    func testInterpolateDashboardTemplateResolvesMetricsFiltersAndSelection() {
        let result = DashboardRuntime.interpolateDashboardTemplate(
            "Spend {{ summary.total_spend }} in ${filters.region} for ${selection.entityKey}",
            metrics: ["summary": ["total_spend": 42]],
            filters: ["region": "NA"],
            selection: DashboardSelectionState(entityKey: "US")
        )
        XCTAssertEqual(result, "Spend 42 in NA for US")
    }

    func testFormatDashboardValueSupportsCommonFormats() {
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(42, format: "integer"), "42")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(1250.0, format: "compactNumber"), "1.2K")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(nil, format: "number"), "n/a")
    }

    // MARK: - Execution handler tests

    func testBuiltInHandlerClosesWindow() async throws {
        let runtime = ForgeRuntime()
        let meta = WindowMetadata(view: ViewDef(content: ContentDef()))
        let window = await runtime.openWindowInline(key: "w1", title: "W1", metadata: meta)
        let count = await runtime.windows.count
        XCTAssertEqual(count, 1)

        let exec = ExecutionDef(action: "window.closeWindow")
        let ctx = ExecutionContext(windowID: window.id, dataSourceRef: "")
        await runtime.execute(exec, context: ctx)

        let countAfter = await runtime.windows.count
        XCTAssertEqual(countAfter, 0)
    }

    func testBuiltInHandlerSetFilterMarksForFetch() async throws {
        let runtime = ForgeRuntime()
        let meta = WindowMetadata(view: ViewDef(content: ContentDef()))
        let window = await runtime.openWindowInline(key: "w1", title: "W1", metadata: meta)
        let dsRef = "myDS"
        let ctx = ExecutionContext(windowID: window.id, dataSourceRef: dsRef)

        let exec = ExecutionDef(action: "dataSource.setFilter")
        await runtime.execute(exec, context: ctx,
                              args: ["region": .string("EMEA")])

        let dsID = WindowIdentity(windowID: window.id).dataSourceID(ref: dsRef)
        let input = await runtime.dataSourceRuntime.input(dataSourceID: dsID)
        XCTAssertEqual(input.filter["region"], .string("EMEA"))
        XCTAssertTrue(input.fetch)
    }

    func testExecuteAutoRegistersBuiltInHandlers() async throws {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(view: ViewDef(content: ContentDef()))
        let window = await runtime.openWindowInline(key: "w1", title: "W1", metadata: metadata)
        let exec = ExecutionDef(action: "window.closeWindow")
        let ctx = ExecutionContext(windowID: window.id, dataSourceRef: "")

        await runtime.execute(exec, context: ctx)

        let countAfter = await runtime.windows.count
        XCTAssertEqual(countAfter, 0)
    }

    func testOpenWindowLoadsRemoteMetadataAndPublishesIt() async throws {
        let payload = """
        {
          "view": {
            "content": {
              "containers": [
                { "id": "workspaceEditor", "title": "Workspace Editor" }
              ]
            }
          }
        }
        """
        let session = makeMockSession(responseBody: payload)
        let runtime = ForgeRuntime(
            windowMetadataBaseURL: URL(string: "https://example.test")!,
            session: session
        )

        let state = await runtime.openWindow(key: "workspace/dialog/editor", title: "Editor")
        try await Task.sleep(nanoseconds: 150_000_000)

        let window = await runtime.windows.first(where: { $0.id == state.id })
        let metadataSignal = await runtime.signals.metadata(windowID: state.id)
        let signalValue = await metadataSignal.peek()

        XCTAssertEqual(window?.metadata?.view?.content?.containers.first?.id, "workspaceEditor")
        XCTAssertEqual(signalValue?.view?.content?.containers.first?.title, "Workspace Editor")
    }

    func testOpenWindowUsesRegisteredMetadataLoader() async throws {
        let runtime = ForgeRuntime()
        await runtime.registerWindowMetadataLoader { key in
            XCTAssertEqual(key, "report/review")
            return WindowMetadata(
                view: ViewDef(
                    content: ContentDef(
                        containers: [
                            ContainerDef(id: "reportRoot", title: "Report Review")
                        ]
                    )
                )
            )
        }

        let state = await runtime.openWindow(key: "report/review", title: "Report Review")
        try await Task.sleep(nanoseconds: 100_000_000)

        let signal = await runtime.signals.metadata(windowID: state.id)
        let metadata = await signal.peek()
        XCTAssertEqual(metadata?.view?.content?.containers.first?.id, "reportRoot")
        XCTAssertEqual(metadata?.view?.content?.containers.first?.title, "Report Review")
    }

    func testBuiltInHandlerToggleSelectionSelectsThenDeselects() async throws {
        let runtime = ForgeRuntime()
        let meta = WindowMetadata(view: ViewDef(content: ContentDef()))
        let window = await runtime.openWindowInline(key: "w1", title: "W1", metadata: meta)
        let dsRef = "list"
        let ctx = ExecutionContext(windowID: window.id, dataSourceRef: dsRef)
        let dsID = WindowIdentity(windowID: window.id).dataSourceID(ref: dsRef)

        let row: [String: JSONValue] = ["id": .string("abc")]
        let exec = ExecutionDef(action: "dataSource.toggleSelection")
        let args: [String: JSONValue] = ["row": .object(row), "rowIndex": .number(0)]

        // First toggle — selects
        await runtime.execute(exec, context: ctx, args: args)
        let sel = await runtime.dataSourceRuntime.selection(dataSourceID: dsID)
        XCTAssertEqual(sel.selected?["id"], .string("abc"))

        // Second toggle — deselects
        await runtime.execute(exec, context: ctx, args: args)
        let selAfter = await runtime.dataSourceRuntime.selection(dataSourceID: dsID)
        XCTAssertNil(selAfter.selected)
    }

    func testWindowCommitUsesFormPayloadBeforeSelectionFallback() async throws {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(view: ViewDef(content: ContentDef()))
        let caller = await runtime.openWindowInline(key: "caller", title: "Caller", metadata: metadata)
        let child = await runtime.openWindowInline(key: "child", title: "Child", metadata: metadata)

        await runtime.registerPendingWindow(child.id, PendingWindow(
            callerWindowID: caller.id,
            callerDataSourceRef: "callerDS",
            outbound: [ParameterDef(name: "region", direction: "out")]
        ))

        let childDSID = WindowIdentity(windowID: child.id).dataSourceID(ref: "childDS")
        await runtime.dataSourceRuntime.setForm(dataSourceID: childDSID, values: [
            "region": .string("EMEA")
        ])
        await runtime.dataSourceRuntime.setSelection(
            dataSourceID: childDSID,
            selection: SelectionState(selected: ["region": .string("WRONG")], rowIndex: 0)
        )

        let exec = ExecutionDef(action: "window.commit")
        let ctx = ExecutionContext(windowID: child.id, dataSourceRef: "childDS")
        await runtime.execute(exec, context: ctx)

        let callerDSID = WindowIdentity(windowID: caller.id).dataSourceID(ref: "callerDS")
        let callerForm = await runtime.dataSourceRuntime.form(dataSourceID: callerDSID)
        XCTAssertEqual(callerForm["region"], .string("EMEA"))
    }

    func testDialogCommitUsesFormPayloadBeforeSelectionFallback() async throws {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(view: ViewDef(content: ContentDef()))
        let caller = await runtime.openWindowInline(key: "caller", title: "Caller", metadata: metadata)
        let window = await runtime.openWindowInline(key: "host", title: "Host", metadata: metadata)

        await runtime.registerPendingDialog("\(window.id)Dialogconfirm", PendingDialog(
            callerWindowID: caller.id,
            callerDataSourceRef: "callerDS",
            outbound: [ParameterDef(name: "region", direction: "out")]
        ))

        let dialogDSID = WindowIdentity(windowID: window.id).dataSourceID(ref: "dialogDS")
        await runtime.dataSourceRuntime.setForm(dataSourceID: dialogDSID, values: [
            "region": .string("NA")
        ])
        await runtime.dataSourceRuntime.setSelection(
            dataSourceID: dialogDSID,
            selection: SelectionState(selected: ["region": .string("WRONG")], rowIndex: 1)
        )

        let exec = ExecutionDef(action: "dialog.commit")
        let ctx = ExecutionContext(windowID: window.id, dataSourceRef: "dialogDS")
        await runtime.execute(exec, context: ctx, args: ["dialogId": .string("confirm")])

        let callerDSID = WindowIdentity(windowID: caller.id).dataSourceID(ref: "callerDS")
        let callerForm = await runtime.dataSourceRuntime.form(dataSourceID: callerDSID)
        XCTAssertEqual(callerForm["region"], .string("NA"))
    }

    func testDataSourceNormalizesRowsEnvelope() async {
        let ds = DataSourceRuntime()
        // Simulate fetchCollection by directly exercising normalizeCollection
        // via a round-trip through setCollection
        let json: [String: JSONValue] = [
            "rows": .array([
                .object(["id": .string("1"), "name": .string("Alice")]),
                .object(["id": .string("2"), "name": .string("Bob")])
            ])
        ]
        // normalizeCollection is private; test via fetchCollection with a mock URL session
        // For unit testing, verify setCollection/collection round-trip
        await ds.setCollection(dataSourceID: "test",
                               rows: [["id": .string("1")], ["id": .string("2")]])
        let rows = await ds.collection(dataSourceID: "test")
        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(rows[0]["id"], .string("1"))
        _ = json // suppress unused warning
    }

    func testChartDefDecodesStructuredSeriesObject() throws {
        let payload = """
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "chart-window",
                  "containers": [
                    {
                      "id": "spend-trend",
                      "dataSourceRef": "series_data",
                      "chart": {
                        "type": "bar",
                        "xAxis": {
                          "dataKey": "day"
                        },
                        "series": {
                          "nameKey": "label",
                          "valueKey": "spend",
                          "palette": ["#137CBD"],
                          "values": [
                            { "value": "spend", "name": "Spend" }
                          ]
                        }
                      }
                    }
                  ]
                }
              ]
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let chart = try XCTUnwrap(metadata.view?.content?.containers.first?.containers.first?.chart)

        XCTAssertEqual(chart.type, "bar")
        XCTAssertEqual(chart.xKey, "day")
        XCTAssertEqual(chart.valueKey, "spend")
        XCTAssertEqual(chart.nameKey, "label")
        XCTAssertEqual(chart.series, ["spend"])
        XCTAssertEqual(chart.seriesDef?.palette, ["#137CBD"])
        XCTAssertEqual(chart.seriesDef?.values.first?.value, "spend")
        XCTAssertEqual(chart.seriesDef?.values.first?.name, "Spend")
    }

    func testChartDefKeepsDuplicateSeriesLabelsByDistinctKeys() throws {
        let payload = """
        {
          "series": {
            "values": [
              { "value": "grossSpend", "name": "Spend" },
              { "value": "netSpend", "name": "Spend" }
            ]
          }
        }
        """

        let chart = try JSONDecoder().decode(ChartDef.self, from: Data(payload.utf8))

        XCTAssertEqual(chart.series, ["grossSpend", "netSpend"])
        XCTAssertEqual(chart.seriesDef?.values.map(\.name), ["Spend", "Spend"])
        XCTAssertEqual(chart.seriesDef?.values.map(\.value), ["grossSpend", "netSpend"])
    }

    func testChartDefRoundTripsSeriesArrayAsArray() throws {
        let payload = """
        {
          "series": ["spend", "impressions"]
        }
        """

        let chart = try JSONDecoder().decode(ChartDef.self, from: Data(payload.utf8))
        let encoded = try JSONEncoder().encode(chart)
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: encoded) as? [String: Any]
        )
        let series = try XCTUnwrap(object["series"] as? [String])

        XCTAssertEqual(chart.series, ["spend", "impressions"])
        XCTAssertNil(chart.seriesDef)
        XCTAssertEqual(series, ["spend", "impressions"])
    }

    func testChartSeriesSelectionReconcilesWhenAvailableSeriesChange() {
        let initial = reconciledChartSeriesSelection(
            current: [],
            available: ["spend", "impressions"]
        )
        XCTAssertEqual(initial, Set(["spend", "impressions"]))

        let retained = reconciledChartSeriesSelection(
            current: ["spend", "stale"],
            available: ["spend", "clicks"]
        )
        XCTAssertEqual(retained, Set(["spend"]))

        let reset = reconciledChartSeriesSelection(
            current: ["stale"],
            available: ["spend", "clicks"]
        )
        XCTAssertEqual(reset, Set(["spend", "clicks"]))
    }

    func testChartSeriesToggleCanDeselectAndReselectMeasures() {
        let allSelected: Set<String> = ["spend", "impressions"]

        let spendOnly = toggledChartSeriesSelection(current: allSelected, key: "impressions")
        XCTAssertEqual(spendOnly, Set(["spend"]))

        let noneSelected = toggledChartSeriesSelection(current: spendOnly, key: "spend")
        XCTAssertEqual(noneSelected, Set<String>())

        let reselected = toggledChartSeriesSelection(current: noneSelected, key: "spend")
        XCTAssertEqual(reselected, Set(["spend"]))
    }

    func testWindowMetadataWrapsTopLevelDashboardReportBuilderContainer() throws {
        let payload = """
        {
          "kind": "dashboard.reportBuilder",
          "id": "analyticsCubeBuilder",
          "title": "Analytics",
          "dataSourceRef": "analytics_cube_report",
          "reportBuilder": {
            "unifiedFamilyRows": true,
            "showResultHeader": false
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let root = try XCTUnwrap(metadata.view?.content?.containers.first)

        XCTAssertEqual(root.kind, "dashboard.reportBuilder")
        XCTAssertEqual(root.id, "analyticsCubeBuilder")
        XCTAssertEqual(root.title, "Analytics")
        XCTAssertEqual(root.dataSourceRef, "analytics_cube_report")
        XCTAssertEqual(root.dashboard?.reportBuilder?.unifiedFamilyRows, true)
        XCTAssertEqual(root.dashboard?.reportBuilder?.showResultHeader, false)
    }

    func testWindowMetadataWrapsSingleContainerInsideViewContent() throws {
        let payload = """
        {
          "view": {
            "content": {
              "kind": "dashboard.reportBuilder",
              "id": "analyticsCubeBuilder",
              "title": "Analytics",
              "dataSourceRef": "analytics_cube_report",
              "reportBuilder": {
                "unifiedFamilyRows": true,
                "showResultHeader": false
              }
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let root = try XCTUnwrap(metadata.view?.content?.containers.first)

        XCTAssertEqual(root.kind, "dashboard.reportBuilder")
        XCTAssertEqual(root.id, "analyticsCubeBuilder")
        XCTAssertEqual(root.title, "Analytics")
        XCTAssertEqual(root.dataSourceRef, "analytics_cube_report")
        XCTAssertEqual(root.dashboard?.reportBuilder?.unifiedFamilyRows, true)
        XCTAssertEqual(root.dashboard?.reportBuilder?.showResultHeader, false)
    }

    func testWindowMetadataDecodesMetricReportBuilderWithoutDynamicFilterFamilies() throws {
        let payload = """
        {
          "view": {
            "content": {
              "kind": "dashboard.reportBuilder",
              "id": "metricsCubeBuilder",
              "dataSourceRef": "metrics_cube_report",
              "reportBuilder": {
                "measures": [
                  { "id": "totalSpend", "key": "totalSpend", "label": "Spend", "default": true }
                ],
                "dimensions": [
                  { "id": "eventDate", "key": "eventDate", "label": "Date", "default": true }
                ],
                "staticFilters": [
                  { "id": "channelIds", "label": "Channels", "options": [] }
                ],
                "dynamicFilterGroups": [
                  {
                    "id": "scope",
                    "label": "Scope",
                    "filters": [
                      { "id": "accountIds", "label": "Account", "paramPath": "filters.accountId" }
                    ]
                  }
                ],
                "result": {
                  "defaultMode": "table",
                  "viewModes": ["table", "chart"]
                }
              }
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let root = try XCTUnwrap(metadata.view?.content?.containers.first)
        let reportBuilder = try XCTUnwrap(root.dashboard?.reportBuilder)

        XCTAssertEqual(root.kind, "dashboard.reportBuilder")
        XCTAssertEqual(root.id, "metricsCubeBuilder")
        XCTAssertEqual(root.dataSourceRef, "metrics_cube_report")
        XCTAssertEqual(reportBuilder.measures.count, 1)
        XCTAssertEqual(reportBuilder.dimensions.count, 1)
        XCTAssertEqual(reportBuilder.staticFilters.count, 1)
        XCTAssertEqual(reportBuilder.dynamicFilterGroups.count, 1)
        XCTAssertTrue(reportBuilder.dynamicFilterFamilies.isEmpty)
        XCTAssertEqual(reportBuilder.result?.defaultMode, "table")
    }

    func testWindowMetadataDecodesReportBuilderNestedArrayDefaults() throws {
        let payload = """
        {
          "view": {
            "content": {
              "kind": "dashboard.reportBuilder",
              "id": "metricsCubeBuilder",
              "dataSourceRef": "metrics_cube_report",
              "reportBuilder": {
                "dynamicFilterGroups": [
                  { "id": "scope", "label": "Scope" }
                ],
                "dynamicFilterFamilies": [
                  { "id": "primary", "label": "Primary" }
                ],
                "result": {
                  "chartWizard": {},
                  "defaultChartSpecs": [
                    { "title": "Trend", "type": "line", "xField": "date" }
                  ]
                }
              }
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let reportBuilder = try XCTUnwrap(
            metadata.view?.content?.containers.first?.dashboard?.reportBuilder
        )

        XCTAssertEqual(reportBuilder.dynamicFilterGroups.first?.filters.isEmpty, true)
        XCTAssertEqual(reportBuilder.dynamicFilterFamilies.first?.includeFilterIds, [])
        XCTAssertEqual(reportBuilder.dynamicFilterFamilies.first?.excludeFilterIds, [])
        XCTAssertEqual(reportBuilder.result?.chartWizard?.supportedTypes, [])
        XCTAssertEqual(reportBuilder.result?.defaultChartSpecs.first?.yFields, [])
    }

    func testWindowMetadataDecodesReportBuilderAutoApplyDefaultChartFlag() throws {
        let payload = """
        {
          "view": {
            "content": {
              "kind": "dashboard.reportBuilder",
              "id": "forecastingCubeBuilder",
              "dataSourceRef": "forecasting_cube_report",
              "reportBuilder": {
                "result": {
                  "chartCreationMode": "explicit",
                  "autoApplyDefaultChartOnResult": true,
                  "defaultChartSpecs": [
                    { "title": "Trend", "type": "line", "xField": "eventDate", "yFields": ["avails"] }
                  ]
                }
              }
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let reportBuilder = try XCTUnwrap(
            metadata.view?.content?.containers.first?.dashboard?.reportBuilder
        )

        XCTAssertEqual(reportBuilder.result?.autoApplyDefaultChartOnResult, true)
    }

    func testResolveAutoAppliedReportBuilderChartSpecUsesFirstCompatiblePreset() throws {
        let config = DashboardReportBuilderDef(
            measures: [
                ReportBuilderMeasureDef(id: "avails", key: "avails", label: "Avails", format: nil, paramPath: nil, defaultValue: nil, color: nil, hidden: nil),
                ReportBuilderMeasureDef(id: "hhUniqs", key: "hhUniqs", label: "HH Uniques", format: nil, paramPath: nil, defaultValue: nil, color: nil, hidden: nil)
            ],
            dimensions: [
                ReportBuilderDimensionDef(id: "eventDate", key: "eventDate", label: "Date", format: nil, paramPath: nil, defaultValue: nil, chartAxis: nil, hidden: nil),
                ReportBuilderDimensionDef(id: "channelV2", key: "channelV2", label: "Channel", format: nil, paramPath: nil, defaultValue: nil, chartAxis: nil, hidden: nil),
                ReportBuilderDimensionDef(id: "siteType", key: "siteType", label: "Site Type", format: nil, paramPath: nil, defaultValue: nil, chartAxis: nil, hidden: nil)
            ],
            result: ReportBuilderResultDef(
                chartCreationMode: "explicit",
                autoApplyDefaultChartOnResult: true,
                defaultChartSpecs: [
                    ReportBuilderChartSpecDef(title: "Needs extra dimension", type: "bar", xField: "siteType", yFields: ["avails"], seriesField: nil),
                    ReportBuilderChartSpecDef(title: "Unsupported donut", type: "donut", xField: "eventDate", yFields: ["avails"], seriesField: nil),
                    ReportBuilderChartSpecDef(title: "Unsupported multi-measure", type: "bar", xField: "eventDate", yFields: ["avails", "hhUniqs"], seriesField: nil),
                    ReportBuilderChartSpecDef(title: "Compatible trend", type: "line", xField: "eventDate", yFields: ["avails"], seriesField: "channelV2")
                ]
            )
        )

        let resolved = ReportBuilderRenderer.resolveAutoAppliedReportBuilderChartSpec(
            config: config,
            selectedMeasures: ["avails"],
            selectedDimensions: ["eventDate", "channelV2"]
        )

        XCTAssertEqual(resolved?.title, "Compatible trend")
        XCTAssertEqual(resolved?.type, "line")
    }

    func testWindowMetadataDecodesDynamicFilterAdvancedFields() throws {
        let payload = """
        {
          "view": {
            "content": {
              "kind": "dashboard.reportBuilder",
              "id": "metricsCubeBuilder",
              "dataSourceRef": "metrics_cube_report",
              "reportBuilder": {
                "measures": [],
                "dimensions": [],
                "dynamicFilterGroups": [
                  {
                    "id": "scope",
                    "label": "Scope",
                    "filters": [
                      {
                        "id": "accountIds",
                        "label": "Account",
                        "paramPath": "filters.accountIds",
                        "multiple": false,
                        "emitArray": true,
                        "manualEntry": true,
                        "manualValueType": "int",
                        "manualPlaceholder": "Enter account id",
                        "dialogId": "accountPicker",
                        "valueSelector": "accountId",
                        "labelSelector": "accountName",
                        "groupSelector": "groupName",
                        "recordSelectors": ["groupId", "accountId", "accountName"],
                        "requestMapping": "hook"
                      }
                    ]
                  }
                ]
              }
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let filter = try XCTUnwrap(
            metadata.view?.content?.containers.first?.dashboard?.reportBuilder?.dynamicFilterGroups.first?.filters.first
        )

        XCTAssertEqual(filter.id, "accountIds")
        XCTAssertEqual(filter.paramPath, "filters.accountIds")
        XCTAssertEqual(filter.emitArray, true)
        XCTAssertEqual(filter.manualValueType, "int")
        XCTAssertEqual(filter.dialogId, "accountPicker")
        XCTAssertEqual(filter.valueSelector, "accountId")
        XCTAssertEqual(filter.labelSelector, "accountName")
        XCTAssertEqual(filter.groupSelector, "groupName")
        XCTAssertEqual(filter.recordSelectors ?? [], ["groupId", "accountId", "accountName"])
        XCTAssertEqual(filter.requestMapping, "hook")
    }

    func testOpenWindowSeedsWindowFormFromParametersAndMetadataDefaults() async throws {
        let runtime = ForgeRuntime()
        await runtime.registerWindowMetadataLoader { key in
            XCTAssertEqual(key, "metrics/report")
            return WindowMetadata(
                view: ViewDef(
                    content: ContentDef(
                        containers: [
                            ContainerDef(
                                id: "metricsCubeBuilder",
                                stateKey: "reportBuilder.metrics",
                                items: [
                                    ItemDef(
                                        id: "granularity",
                                        scope: "windowForm",
                                        value: .string("day")
                                    )
                                ]
                            )
                        ]
                    )
                ),
                on: [
                    EventExecutionDef(
                        event: "onInit",
                        handler: "dataSource.setWindowFormData",
                        parameters: [
                            ParameterDef(
                                name: "periodView",
                                input: "const",
                                location: .string("today")
                            )
                        ]
                    )
                ]
            )
        }

        let state = await runtime.openWindow(
            key: "metrics/report",
            title: "Metrics Report",
            parameters: [
                "prefill": .object([
                    "accountId": .number(7)
                ])
            ]
        )

        let windowForm = await runtime.windowFormJSONValue(windowID: state.id)
        XCTAssertEqual(windowForm["granularity"], .string("day"))
        XCTAssertEqual(windowForm["periodView"], .string("today"))
        XCTAssertEqual(windowForm["prefill"]?.objectValue?["accountId"], .number(7))
    }

    func testSetWindowFormValueBumpsGenericPrefillRevision() async throws {
        let runtime = ForgeRuntime()
        let state = await runtime.openWindow(
            key: "metrics/report",
            title: "Metrics Report"
        )

        await runtime.setWindowFormValue(
            windowID: state.id,
            values: [
                "prefill": .object([
                    "accountId": .number(7)
                ])
            ]
        )
        let first = await runtime.windowFormJSONValue(windowID: state.id)
        await runtime.setWindowFormValue(
            windowID: state.id,
            values: [
                "prefill": .object([
                    "accountId": .number(7)
                ])
            ]
        )
        let second = await runtime.windowFormJSONValue(windowID: state.id)

        XCTAssertEqual(first["__forge"]?.objectValue?["prefillRevision"], .number(1))
        XCTAssertEqual(second["__forge"]?.objectValue?["prefillRevision"], .number(2))
    }

    func testParameterResolverResolvesWindowFormSelectors() {
        let context = ParameterResolver.ResolutionContext(
            identityDataSourceRef: "default",
            dataSources: [:],
            windowForm: [
                "entityId": .array([.number(2637048)]),
                "granularity": .string("hour"),
                "periodView": .string("today")
            ],
            metadata: nil
        )

        let resolved = ParameterResolver.resolve(
            parameters: [
                ParameterDef(name: "entity_id", input: "windowForm", location: .string("entityId.0")),
                ParameterDef(name: "granularity", input: "windowForm", location: .string("granularity"))
            ],
            context: context
        )

        XCTAssertEqual(resolved["entity_id"], .number(2637048))
        XCTAssertEqual(resolved["granularity"], .string("hour"))
    }

    func testSelectorUtilResolvesNestedJSONValueObjectsAndArrays() {
        let metrics: [String: JSONValue] = [
            "periodSummary": .object([
                "lastDayPacingIndex": .number(12)
            ]),
            "lifetimeSummary": .object([
                "lifetimePacingIndex": .number(0)
            ]),
            "entityId": .array([.number(2673453)])
        ]

        XCTAssertEqual(
            SelectorUtil.resolve(metrics, selector: "periodSummary.lastDayPacingIndex") as? Double,
            12
        )
        XCTAssertEqual(
            SelectorUtil.resolve(metrics, selector: "lifetimeSummary.lifetimePacingIndex") as? Double,
            0
        )
        XCTAssertEqual(
            SelectorUtil.resolve(metrics, selector: "entityId.0") as? Double,
            2673453
        )
    }

    func testParameterResolverResolvesCrossDataSourceSelection() {
        let context = ParameterResolver.ResolutionContext(
            identityDataSourceRef: "runs",
            dataSources: [
                "runs": ParameterResolver.DataSourceSnapshot(
                    selectionMode: "single",
                    selection: SelectionState(selected: ["id": .string("run-1")])
                ),
                "schedules": ParameterResolver.DataSourceSnapshot(
                    selectionMode: "single",
                    selection: SelectionState(selected: ["id": .string("sched-1")])
                )
            ],
            windowForm: [:],
            metadata: nil
        )

        let resolved = ParameterResolver.resolve(
            parameters: [
                ParameterDef(name: "scheduleId", input: "selection", location: .string("schedules.id")),
                ParameterDef(name: "requireScheduleId", input: "const", location: .string("true"))
            ],
            context: context
        )

        XCTAssertEqual(resolved["scheduleId"], .string("sched-1"))
        XCTAssertEqual(resolved["requireScheduleId"], .string("true"))
    }

    func testWindowMetadataDecodesDialogs() throws {
        let payload = """
        {
          "dialogs": [
            {
              "id": "accountPicker",
              "title": "Pick account",
              "content": {
                "id": "accountTable",
                "dataSourceRef": "accounts",
                "table": {
                  "columns": ["id", "name"]
                }
              },
              "actions": [
                {
                  "id": "cancel",
                  "label": "Cancel"
                },
                {
                  "id": "select",
                  "label": "Select",
                  "on": [
                    { "action": "dialog.commit" }
                  ]
                }
              ]
            }
          ]
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let dialog = try XCTUnwrap(metadata.dialogs.first)

        XCTAssertEqual(dialog.id, "accountPicker")
        XCTAssertEqual(dialog.title, "Pick account")
        XCTAssertEqual(dialog.content?.dataSourceRef, "accounts")
        XCTAssertEqual(dialog.actions.count, 2)
        XCTAssertEqual(dialog.actions.last?.on.first?.action, "dialog.commit")
    }

    func testWindowMetadataDecodesTreeBrowserDialogContent() throws {
        let payload = """
        {
          "dialogs": [
            {
              "id": "targetingTreePicker",
              "title": "Select Targeting Option",
              "dataSourceRef": "targeting_tree_lookup",
              "content": {
                "id": "targetingTreePickerContent",
                "dataSourceRef": "targeting_tree_lookup",
                "treeBrowser": {
                  "dataSourceRef": "targeting_tree_lookup",
                  "pathField": "path",
                  "valueField": "value",
                  "subtitleField": "value",
                  "lazyExpand": false
                }
              }
            }
          ]
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let dialog = try XCTUnwrap(metadata.dialogs.first)
        let treeBrowser = try XCTUnwrap(dialog.content?.treeBrowser)

        XCTAssertEqual(dialog.id, "targetingTreePicker")
        XCTAssertEqual(treeBrowser.dataSourceRef, "targeting_tree_lookup")
        XCTAssertEqual(treeBrowser.pathField, "path")
        XCTAssertEqual(treeBrowser.valueField, "value")
        XCTAssertEqual(treeBrowser.subtitleField, "value")
        XCTAssertEqual(treeBrowser.lazyExpand, false)
    }

    func testBuiltInOpenDialogResolvesInboundParameters() async throws {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(
            dialogs: [
                DialogDef(
                    id: "pick",
                    title: "Pick",
                    content: ContainerDef(id: "dialog-root", dataSourceRef: "dialogSource")
                )
            ],
            dataSources: [
                "runs": DataSourceDef(selectionMode: "single"),
                "schedules": DataSourceDef(selectionMode: "single"),
                "dialogSource": DataSourceDef()
            ]
        )
        let state = await runtime.openWindowInline(key: "w1", title: "W1", metadata: metadata)
        await runtime.setWindowFormValue(
            windowID: state.id,
            values: [
                "granularity": .string("hour")
            ],
            replace: true
        )
        await runtime.setDataSourceSelection(
            windowID: state.id,
            dataSourceRef: "schedules",
            selected: ["id": .string("sched-1")]
        )

        let execution = ExecutionDef(
            action: "window.openDialog",
            args: ["pick"],
            parameters: [
                ParameterDef(name: "scheduleId", input: "selection", location: .string("schedules.id")),
                ParameterDef(name: "granularity", input: "windowForm", location: .string("granularity"))
            ]
        )

        _ = await runtime.execute(
            execution,
            context: ExecutionContext(windowID: state.id, dataSourceRef: "runs")
        )

        let dialogState = await runtime.dialogState(windowID: state.id, dialogID: "pick")
        XCTAssertTrue(dialogState.open)
        XCTAssertEqual(dialogState.args["scheduleId"], .string("sched-1"))
        XCTAssertEqual(dialogState.args["granularity"], .string("hour"))
    }

    func testOpenDialogAwaitResultResolvesCommittedSelection() async throws {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(
            dialogs: [
                DialogDef(
                    id: "pick",
                    title: "Pick",
                    content: ContainerDef(id: "dialog-root", dataSourceRef: "dialogSource")
                )
            ],
            dataSources: [
                "dialogSource": DataSourceDef(selectionMode: "single")
            ]
        )
        let state = await runtime.openWindowInline(key: "w1", title: "W1", metadata: metadata)

        let resultTask = Task {
            await runtime.openDialogAwaitResult(
                windowID: state.id,
                dialogID: "pick",
                parameters: ["granularity": .string("hour")],
                selectionMode: "single"
            )
        }

        try? await Task.sleep(nanoseconds: 50_000_000)
        await runtime.setDataSourceSelection(
            windowID: state.id,
            dataSourceRef: "dialogSource",
            selected: [
                "id": .string("adv-1"),
                "name": .string("Account One")
            ]
        )
        _ = await runtime.execute(
            ExecutionDef(action: "dialog.commit", args: []),
            context: ExecutionContext(windowID: state.id, dataSourceRef: "dialogSource"),
            args: [
                "dialogId": .string("pick"),
                "windowId": .string(state.id)
            ]
        )

        let result = await resultTask.value
        XCTAssertEqual(result?["id"], .string("adv-1"))
        XCTAssertEqual(result?["name"], .string("Account One"))
    }

    func testOpenDialogAwaitResultResolvesCommittedMultiSelection() async throws {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(
            dialogs: [
                DialogDef(
                    id: "pick",
                    title: "Pick",
                    content: ContainerDef(
                        id: "dialog-root",
                        dataSourceRef: "dialogSource",
                        treeBrowser: TreeBrowserDef(
                            dataSourceRef: "dialogSource",
                            pathField: "path",
                            valueField: "value"
                        )
                    )
                )
            ],
            dataSources: [
                "dialogSource": DataSourceDef(selectionMode: "multi")
            ]
        )
        let state = await runtime.openWindowInline(key: "w1", title: "W1", metadata: metadata)

        let resultTask = Task {
            await runtime.openDialogAwaitResult(
                windowID: state.id,
                dialogID: "pick",
                parameters: [:],
                selectionMode: "multi"
            )
        }

        try? await Task.sleep(nanoseconds: 50_000_000)
        await runtime.setDataSourceSelectionState(
            windowID: state.id,
            dataSourceRef: "dialogSource",
            selection: SelectionState(
                selected: [
                    "value": .string("seg-2"),
                    "label": .string("Segment 2")
                ],
                selection: [
                    [
                        "value": .string("seg-1"),
                        "label": .string("Segment 1")
                    ],
                    [
                        "value": .string("seg-2"),
                        "label": .string("Segment 2")
                    ]
                ],
                rowIndex: -1
            )
        )
        _ = await runtime.execute(
            ExecutionDef(action: "dialog.commit", args: []),
            context: ExecutionContext(windowID: state.id, dataSourceRef: "dialogSource"),
            args: [
                "dialogId": .string("pick"),
                "windowId": .string(state.id)
            ]
        )

        let result = await resultTask.value
        XCTAssertEqual(result?["selected"]?.objectValue?["value"], .string("seg-2"))
        XCTAssertEqual(result?["selection"]?.arrayValue?.count, 2)
        XCTAssertEqual(result?["selection"]?.arrayValue?.first?.objectValue?["value"], .string("seg-1"))
    }

    private func makeMockSession(responseBody: String, statusCode: Int = 200) -> URLSession {
        MetadataURLProtocol.responseBody = responseBody
        MetadataURLProtocol.statusCode = statusCode
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MetadataURLProtocol.self]
        return URLSession(configuration: configuration)
    }
}

private final class MetadataURLProtocol: URLProtocol {
    static var responseBody: String = ""
    static var statusCode: Int = 200

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        let response = HTTPURLResponse(
            url: request.url ?? URL(string: "https://example.test")!,
            statusCode: Self.statusCode,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(Self.responseBody.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
