import XCTest
@testable import ForgeIOSRuntime

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

    func testWindowOpensInline() async throws {
        let runtime = ForgeRuntime()
        let state = await runtime.openWindowInline(
            key: "test",
            title: "Test",
            metadata: WindowMetadata()
        )
        XCTAssertEqual(state.key, "test")
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
}
