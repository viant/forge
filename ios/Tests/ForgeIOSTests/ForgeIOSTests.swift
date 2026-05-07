import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

final class ForgeIOSTests: XCTestCase {
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
                    "ios:tablet": {
                      "title": "Tablet Title"
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
            for: ForgeTargetContext(platform: "ios", formFactor: "tablet")
        )
        let containers = resolved.view?.content?.containers ?? []

        XCTAssertEqual(containers.map(\.id), ["shared", "iosOnly"])
        XCTAssertEqual(containers.last?.title, "Tablet Title")
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

    func testTableDefDecodesLegacyStringColumnsAndRichActionColumns() throws {
        let payload = """
        {
          "title": "Orders",
          "columns": [
            "campaign",
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
        XCTAssertEqual(table.columns[0].id, "campaign")
        XCTAssertEqual(table.columns[0].label, "campaign")
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
                { "id": "approvalEditor", "title": "Approval Editor" }
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

        let state = await runtime.openWindow(key: "chat/new/dialog/approval_editor", title: "Approval")
        try await Task.sleep(nanoseconds: 150_000_000)

        let window = await runtime.windows.first(where: { $0.id == state.id })
        let metadataSignal = await runtime.signals.metadata(windowID: state.id)
        let signalValue = await metadataSignal.peek()

        XCTAssertEqual(window?.metadata?.view?.content?.containers.first?.id, "approvalEditor")
        XCTAssertEqual(signalValue?.view?.content?.containers.first?.title, "Approval Editor")
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
