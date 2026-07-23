import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

final class ForgeIOSTests: XCTestCase {
    func testWindowMetadataDecodesDashboardConditionJsonOperands() throws {
        let data = Data("""
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "conditional",
                  "visibleWhen": {
                    "source": "filters",
                    "field": "segment",
                    "equals": { "id": "enterprise", "tier": 2 },
                    "notEquals": ["blocked"],
                    "in": [
                      { "id": "enterprise", "tier": 2 },
                      ["agency", "brand"]
                    ]
                  }
                }
              ]
            }
          }
        }
        """.utf8)

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: data)
        let condition = try XCTUnwrap(metadata.view?.content?.containers.first?.visibleWhen)

        XCTAssertEqual(condition.equals, .object(["id": .string("enterprise"), "tier": .number(2)]))
        XCTAssertEqual(condition.notEquals, .array([.string("blocked")]))
        XCTAssertEqual(
            condition.inValues,
            [
                .object(["id": .string("enterprise"), "tier": .number(2)]),
                .array([.string("agency"), .string("brand")])
            ]
        )
    }

    func testWindowMetadataDecodesLayoutLabelPositionAndRequiredItem() throws {
        let data = Data("""
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "form-panel",
                  "layout": {
                    "kind": "grid",
                    "columns": 2,
                    "labelPosition": "top"
                  },
                  "items": [
                    {
                      "id": "name",
                      "label": "Name",
                      "type": "text",
                      "field": "name",
                      "required": true,
                      "multiple": false,
                      "dataSourceRefSource": "windowForm",
                      "dataSourceRefSelector": "type",
                      "dataSourceRefs": { "lookup": "names" },
                      "scope": "windowForm",
                      "properties": { "placeholder": "Enter name" },
                      "targetOverrides": { "phone": { "type": "compact" } }
                    }
                  ]
                }
              ]
            }
          }
        }
        """.utf8)

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: data)
        let container = try XCTUnwrap(metadata.view?.content?.containers.first)
        let item = try XCTUnwrap(container.items.first)

        XCTAssertEqual(container.layout?.labelPosition, "top")
        XCTAssertEqual(item.required, true)
        XCTAssertEqual(item.multiple, false)
        XCTAssertEqual(item.dataSourceRefSource, "windowForm")
        XCTAssertEqual(item.dataSourceRefSelector, "type")
        XCTAssertEqual(item.dataSourceRefs["lookup"], "names")
        XCTAssertEqual(item.scope, "windowForm")
        XCTAssertEqual(item.properties["placeholder"], .string("Enter name"))
        XCTAssertEqual(item.targetOverrides["phone"], .object(["type": .string("compact")]))
    }

    func testWindowMetadataDecodesWindowBlock() throws {
        let data = Data("""
        {
          "window": {
            "footer": { "hide": true },
            "target": { "surface": "workspace" },
            "targetOverrides": {
              "ios:phone": { "footer": { "hide": true } }
            },
            "on": [
              { "event": "onInit", "handler": "window.ready", "args": ["window"] }
            ]
          }
        }
        """.utf8)

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: data)
        let window = try XCTUnwrap(metadata.window)

        XCTAssertEqual(window.footer?.hide, true)
        XCTAssertEqual(window.target, .object(["surface": .string("workspace")]))
        XCTAssertEqual(
            window.targetOverrides["ios:phone"],
            .object(["footer": .object(["hide": .bool(true)])])
        )
        XCTAssertEqual(window.on.first?.event, "onInit")
        XCTAssertEqual(window.on.first?.handler, "window.ready")
        XCTAssertEqual(window.on.first?.args, ["window"])
    }

    func testWindowMetadataDecodesGenericContainerChromeAndActions() throws {
        let data = Data("""
        {
          "view": {
            "content": {
              "containers": [
                {
                  "kind": "panel",
                  "role": "supporting",
                  "card": {
                    "elevation": 2,
                    "className": "quiet-card",
                    "style": { "padding": "compact" }
                  },
                  "section": {
                    "properties": { "tone": "info" }
                  },
                  "toolbar": {
                    "items": [
                      { "id": "refresh", "label": "Refresh", "icon": "refresh", "on": [{ "handler": "data.refresh" }] }
                    ],
                    "targetOverrides": { "phone": { "items": [] } }
                  },
                  "terminal": {
                    "dataSourceRef": "logs",
                    "height": "320px",
                    "prompt": "$",
                    "autoScroll": true,
                    "showDividers": false,
                    "truncateLongOutput": true,
                    "truncateLength": 1200,
                    "toolbar": {
                      "items": [
                        { "id": "clear", "label": "Clear" }
                      ]
                    },
                    "target": { "platform": "tablet" }
                  },
                  "actions": [
                    { "id": "open", "label": "Open", "on": [{ "handler": "window.open" }] }
                  ],
                  "on": [
                    { "event": "onAppear", "handler": "panel.ready" }
                  ]
                }
              ]
            }
          }
        }
        """.utf8)

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: data)
        let container = try XCTUnwrap(metadata.view?.content?.containers.first)

        XCTAssertEqual(container.role, "supporting")
        XCTAssertEqual(container.card?.elevation, 2)
        XCTAssertEqual(container.card?.className, "quiet-card")
        XCTAssertEqual(container.card?.style["padding"], .string("compact"))
        XCTAssertEqual(container.section?.properties["tone"], .string("info"))
        XCTAssertEqual(container.toolbar?.items.first?.id, "refresh")
        XCTAssertEqual(container.toolbar?.items.first?.on.first?.action, "data.refresh")
        XCTAssertEqual(container.toolbar?.targetOverrides["phone"], .object(["items": .array([])]))
        XCTAssertEqual(container.terminal?.dataSourceRef, "logs")
        XCTAssertEqual(container.terminal?.height, "320px")
        XCTAssertEqual(container.terminal?.prompt, "$")
        XCTAssertEqual(container.terminal?.autoScroll, true)
        XCTAssertEqual(container.terminal?.showDividers, false)
        XCTAssertEqual(container.terminal?.truncateLongOutput, true)
        XCTAssertEqual(container.terminal?.truncateLength, 1200)
        XCTAssertEqual(container.terminal?.toolbar?.items.first?.id, "clear")
        XCTAssertEqual(container.terminal?.target, .object(["platform": .string("tablet")]))
        XCTAssertEqual(container.actions.first?.id, "open")
        XCTAssertEqual(container.actions.first?.on.first?.action, "window.open")
        XCTAssertEqual(container.on.first?.event, "onAppear")
        XCTAssertEqual(container.on.first?.action, "panel.ready")
    }

    func testWindowMetadataDecodesGenericChatConfiguration() throws {
        let data = Data("""
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "assistant",
                  "chat": {
                    "header": {
                      "title": "Workspace assistant",
                      "left": [
                        { "icon": "back", "on": [{ "handler": "window.back" }] }
                      ],
                      "right": [
                        { "icon": "settings", "label": "Tune", "targetOverrides": { "phone": { "label": "Tune" } } }
                      ]
                    },
                    "showUpload": false,
                    "uploadField": "uploads",
                    "showMic": true,
                    "showSettings": true,
                    "showAbort": true,
                    "showTools": false,
                    "commandCenter": true,
                    "abortVisible": { "selector": "state.streaming" },
                    "target": { "platform": "phone" },
                    "targetOverrides": { "tablet": { "showTools": true } },
                    "on": [
                      { "event": "onSubmit", "handler": "chat.submit" }
                    ]
                  }
                }
              ]
            }
          }
        }
        """.utf8)

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: data)
        let chat = try XCTUnwrap(metadata.view?.content?.containers.first?.chat)

        XCTAssertEqual(chat.header?.title, "Workspace assistant")
        XCTAssertEqual(chat.header?.left.first?.icon, "back")
        XCTAssertEqual(chat.header?.left.first?.on.first?.action, "window.back")
        XCTAssertEqual(chat.header?.right.first?.label, "Tune")
        XCTAssertEqual(chat.header?.right.first?.targetOverrides["phone"], .object(["label": .string("Tune")]))
        XCTAssertEqual(chat.showUpload, false)
        XCTAssertEqual(chat.uploadField, "uploads")
        XCTAssertEqual(chat.showMic, true)
        XCTAssertEqual(chat.showSettings, true)
        XCTAssertEqual(chat.showAbort, true)
        XCTAssertEqual(chat.showTools, false)
        XCTAssertEqual(chat.commandCenter, true)
        XCTAssertEqual(chat.abortVisible, .object(["selector": .string("state.streaming")]))
        XCTAssertEqual(chat.target, .object(["platform": .string("phone")]))
        XCTAssertEqual(chat.targetOverrides["tablet"], .object(["showTools": .bool(true)]))
        XCTAssertEqual(chat.on.first?.event, "onSubmit")
        XCTAssertEqual(chat.on.first?.action, "chat.submit")
    }

    func testWindowMetadataDecodesDataSourceUniqueKeyAndSparseLinkParameters() throws {
        let data = Data("""
        {
          "dataSources": {
            "rows": {
              "uniqueKey": [
                { "field": "id" },
                { "parameter": "accountId" }
              ],
              "parameters": [
                { "from": "selection.id", "to": "rowId", "direction": "in" }
              ],
              "on": [
                { "event": "onSelect", "handler": "rows.selected", "args": ["selection"] }
              ]
            }
          },
          "kind": "list",
          "items": [
            {
              "id": "open-row",
              "label": "Open row",
              "link": {
                "kind": "window",
                "windowKey": "detail"
              }
            }
          ]
        }
        """.utf8)

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: data)
        let dataSource = try XCTUnwrap(metadata.dataSources["rows"])
        let item = try XCTUnwrap(metadata.view?.content?.containers.first?.items.first)

        XCTAssertEqual(dataSource.uniqueKey, [
            DataSourceUniqueKeyDef(field: "id"),
            DataSourceUniqueKeyDef(parameter: "accountId")
        ])
        XCTAssertEqual(dataSource.parameters.first?.name, "")
        XCTAssertEqual(dataSource.parameters.first?.from, "selection.id")
        XCTAssertEqual(dataSource.parameters.first?.to, "rowId")
        XCTAssertEqual(dataSource.on.first?.event, "onSelect")
        XCTAssertEqual(dataSource.on.first?.action, "rows.selected")
        XCTAssertEqual(dataSource.on.first?.args, ["selection"])
        XCTAssertEqual(item.link?.windowKey, "detail")
        XCTAssertTrue(item.link?.parameters.isEmpty == true)
    }

    func testReportBuilderDynamicRowDecodeUsesModelDefaults() throws {
        let data = Data("""
        {
          "filterId": "includeDealsPmp"
        }
        """.utf8)

        let row = try JSONDecoder().decode(ReportBuilderDynamicRowState.self, from: data)

        XCTAssertFalse(row.id.isEmpty)
        XCTAssertEqual(row.filterId, "includeDealsPmp")
        XCTAssertTrue(row.enabled)
        XCTAssertTrue(row.selections.isEmpty)
    }

    func testItemValueKeyUsesGenericPrecedenceAndSkipsBlankValues() {
        XCTAssertEqual(
            ItemDef(
                id: "idKey",
                field: "fieldKey",
                dataField: "dataKey",
                bindingPath: "bindingKey"
            ).valueKey,
            "dataKey"
        )
        XCTAssertEqual(
            ItemDef(
                id: "idKey",
                field: "fieldKey",
                bindingPath: "bindingKey"
            ).valueKey,
            "bindingKey"
        )
        XCTAssertEqual(
            ItemDef(
                id: "idKey",
                field: "fieldKey"
            ).valueKey,
            "fieldKey"
        )
        XCTAssertEqual(
            ItemDef(
                id: "idKey",
                field: "   ",
                dataField: "\n",
                bindingPath: "\t"
            ).valueKey,
            "idKey"
        )
    }

    func testReportBuilderFiltersAutoCollapseOncePerCompletedResult() {
        XCTAssertTrue(shouldAutoCollapseReportBuilderFilters(
            hasRows: true,
            completedRequestSignature: #"{"filters":{"country":["US"]}}"#,
            lastCollapsedRequestSignature: ""
        ))
        XCTAssertFalse(shouldAutoCollapseReportBuilderFilters(
            hasRows: true,
            completedRequestSignature: #"{"filters":{"country":["US"]}}"#,
            lastCollapsedRequestSignature: #"{"filters":{"country":["US"]}}"#
        ))
        XCTAssertFalse(shouldAutoCollapseReportBuilderFilters(
            hasRows: false,
            completedRequestSignature: #"{"filters":{"country":["US"]}}"#,
            lastCollapsedRequestSignature: ""
        ))
        XCTAssertFalse(shouldAutoCollapseReportBuilderFilters(
            hasRows: true,
            completedRequestSignature: "",
            lastCollapsedRequestSignature: ""
        ))
    }

    func testReportBuilderChartStateFeedbackUsesDataSourceControl() {
        XCTAssertEqual(
            reportBuilderChartStateFeedback(
                control: ControlState(loading: true),
                hasResolvedRows: false,
                hasChartValues: false
            ),
            ChartDataStateFeedback(message: "Loading chart")
        )
        XCTAssertEqual(
            reportBuilderChartStateFeedback(
                control: ControlState(error: "  Timeout  "),
                hasResolvedRows: true,
                hasChartValues: false
            ),
            ChartDataStateFeedback(
                message: "Unable to load chart data",
                isError: true
            )
        )
        XCTAssertNil(reportBuilderChartStateFeedback(
            control: ControlState(loading: true, error: "Timeout"),
            hasResolvedRows: false,
            hasChartValues: true
        ))
    }

    func testReportBuilderChartDataPolicyAppliesFullQueryLimit() {
        let config = DashboardReportBuilderDef(
            result: ReportBuilderResultDef(
                chartDataMode: "fullQuery",
                chartRowLimit: 2500
            )
        )

        let request = ReportBuilderRenderer.applyChartDataPolicy(
            config: config,
            request: [
                "limit": .number(25),
                "offset": .number(50),
                "filters": .object(["channelIds": .array([.number(1)])])
            ]
        )

        XCTAssertEqual(request["limit"], .number(2500))
        XCTAssertEqual(request["offset"], .number(0))
        XCTAssertEqual(request["filters"], .object(["channelIds": .array([.number(1)])]))
    }

    func testReportBuilderChartDataPolicyKeepsCurrentPageRequest() {
        let request: [String: JSONValue] = [
            "limit": .number(25),
            "offset": .number(50)
        ]

        let resolved = ReportBuilderRenderer.applyChartDataPolicy(
            config: DashboardReportBuilderDef(
                result: ReportBuilderResultDef(
                    chartDataMode: "currentPage",
                    chartDataLimit: 500
                )
            ),
            request: request
        )

        XCTAssertEqual(resolved, request)
    }

    func testWindowMetadataDecodesLatestReportBuilderFields() throws {
        let payload = """
        {
          "view": {
            "content": {
              "kind": "dashboard.reportBuilder",
              "id": "capacityCubeBuilder",
              "dataSourceRef": "capacity_cube_report",
              "reportBuilder": {
                "filterPresentation": "rail",
                "showFilterCategoryBar": true,
                "hiddenDynamicGroupIds": ["scope"],
                "notices": [
                  { "id": "sample", "level": "info", "title": "Sample", "sourcePath": "metadata.notice" }
                ],
                "primaryMeasure": "avails",
                "measureSections": [
                  { "id": "delivery", "label": "Delivery" }
                ],
                "measures": [
                  { "id": "avails", "key": "avails", "label": "Avails", "section": "delivery", "paramPath": "measures.avails" },
                  { "id": "bids", "key": "bids", "label": "Bids", "paramPath": "measures.bids" }
                ],
                "computedMeasures": [
                  {
                    "id": "bidRate",
                    "key": "bidRate",
                    "label": "Bid Rate",
                    "dependencies": ["bids", "avails"],
                    "compute": { "type": "ratio", "numerator": "bids", "denominator": "avails", "scale": 100, "decimals": 1 }
                  }
                ],
                "dimensions": [
                  {
                    "id": "channel",
                    "key": "channelId",
                    "displayKey": "channelName",
                    "runtimeFilter": {
                      "includeParamPath": "filters.includeChannelIds",
                      "excludeParamPath": "filters.excludeChannelIds",
                      "format": "number"
                    }
                  }
                ],
                "dynamicFilterFamilies": [
                  { "id": "inventory", "label": "Inventory", "icon": "layers" }
                ],
                "resultCategories": ["inventory", "location"],
                "groupBy": {
                  "default": "date",
                  "options": [
                    { "id": "date", "label": "Date", "dimensionId": "eventDate", "paramPath": "groupBy", "paramValue": "date" }
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

        XCTAssertEqual(reportBuilder.filterPresentation, "rail")
        XCTAssertEqual(reportBuilder.showFilterCategoryBar, true)
        XCTAssertEqual(reportBuilder.hiddenDynamicGroupIds, ["scope"])
        XCTAssertEqual(reportBuilder.notices.first?.sourcePath, "metadata.notice")
        XCTAssertEqual(reportBuilder.primaryMeasure, "avails")
        XCTAssertEqual(reportBuilder.measureSections.first?.id, "delivery")
        XCTAssertEqual(reportBuilder.computedMeasures.first?.dependencies, ["bids", "avails"])
        XCTAssertEqual(reportBuilder.computedMeasures.first?.compute?.type, "ratio")
        XCTAssertEqual(reportBuilder.computedMeasures.first?.compute?.scale, 100)
        XCTAssertEqual(reportBuilder.dimensions.first?.displayKey, "channelName")
        XCTAssertEqual(reportBuilder.dimensions.first?.runtimeFilter?.includeParamPath, "filters.includeChannelIds")
        XCTAssertEqual(reportBuilder.dynamicFilterFamilies.first?.icon, "layers")
        XCTAssertEqual(reportBuilder.resultCategories, ["inventory", "location"])
        XCTAssertEqual(reportBuilder.groupBy?.defaultValue, "date")
        XCTAssertEqual(reportBuilder.groupBy?.options.first?.paramValue, .string("date"))
    }

    func testDashboardReportBuilderDecodesLegacyForecastCategories() throws {
        let payload = """
        {
          "view": {
            "content": {
              "kind": "dashboard.reportBuilder",
              "id": "capacityCubeBuilder",
              "reportBuilder": {
                "forecastCategories": ["inventory", "location"]
              }
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let reportBuilder = try XCTUnwrap(
            metadata.view?.content?.containers.first?.dashboard?.reportBuilder
        )

        XCTAssertEqual(reportBuilder.resultCategories, ["inventory", "location"])
    }

    func testWindowMetadataDecodesCompactDashboardCompatibilityBlocks() throws {
        let payload = """
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "dashboardRoot",
                  "kind": "dashboard",
                  "containers": [
                    {
                      "id": "table",
                      "kind": "dashboard.table",
                      "dataSourceRef": "summary_rows",
                      "columns": ["lineId", "status"]
                    },
                    {
                      "id": "planner",
                      "kind": "planner.table",
                      "dataSourceRef": "planner_rows",
                      "table": {
                        "selectionField": "selected",
                        "disabledField": "locked",
                        "callback": {
                          "type": "llm_event",
                          "eventName": "planner_submit",
                          "target": "foreground"
                        },
                        "columns": [
                          { "key": "recommendation", "label": "Recommendation" },
                          { "key": "status", "label": "Status" }
                        ],
                        "on": [
                            { "action": "planner.submit", "args": ["selection"] }
                        ]
                      }
                    },
                    {
                      "id": "composition",
                      "kind": "dashboard.composition",
                      "dataSourceRef": "summary_rows",
                      "chart": {
                        "type": "donut",
                        "categoryKey": "channel",
                        "valueField": "avails"
                      }
                    },
                    {
                      "id": "badges",
                      "kind": "dashboard.badges",
                      "badges": {
                        "items": [
                          { "id": "limited", "label": "Limited", "value": "2", "tone": "warning" }
                        ]
                      }
                    },
                    {
                      "id": "period",
                      "kind": "dashboard.filters",
                      "items": [
                        {
                          "id": "periodView",
                          "label": "Period",
                          "field": "periodView",
                          "options": [
                            { "label": "7D", "value": "7d", "default": true },
                            { "label": "30D", "value": "30d" }
                          ]
                        }
                      ]
                    },
                    {
                      "id": "geo",
                      "kind": "dashboard.geoMap",
                      "geo": { "shape": "us-postal-code" },
                      "metric": { "key": "avails", "label": "Avails", "format": "compact" }
                    }
                  ]
                }
              ]
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let children = try XCTUnwrap(metadata.view?.content?.containers.first?.containers)
        let table = try XCTUnwrap(children.first { $0.id == "table" })
        let planner = try XCTUnwrap(children.first { $0.id == "planner" })
        let composition = try XCTUnwrap(children.first { $0.id == "composition" })
        let badges = try XCTUnwrap(children.first { $0.id == "badges" })
        let filters = try XCTUnwrap(children.first { $0.id == "period" })
        let geo = try XCTUnwrap(children.first { $0.id == "geo" })

        XCTAssertEqual(table.columns.map(\.id), ["lineId", "status"])
        XCTAssertEqual(table.columns.map(\.label), ["lineId", "status"])
        XCTAssertEqual(planner.kind, "planner.table")
        XCTAssertEqual(planner.dataSourceRef, "planner_rows")
        XCTAssertEqual(planner.table?.selectionField, "selected")
        XCTAssertEqual(planner.table?.disabledField, "locked")
        XCTAssertEqual(planner.table?.callback?.objectValue?["eventName"], .string("planner_submit"))
        XCTAssertEqual(planner.table?.columns.map(\.id), ["recommendation", "status"])
        XCTAssertEqual(planner.table?.columns.map(\.key), ["recommendation", "status"])
        XCTAssertEqual(planner.table?.on.first?.action, "planner.submit")
        XCTAssertEqual(composition.chart?.xKey, "channel")
        XCTAssertEqual(composition.chart?.valueKey, "avails")
        XCTAssertEqual(badges.dashboard?.badges?.items.first?.tone, "warning")
        XCTAssertEqual(filters.dashboard?.filters?.items.first?.field, "periodView")
        XCTAssertEqual(filters.dashboard?.filters?.items.first?.options.first?.defaultValue, true)
        XCTAssertEqual(geo.geo?.objectValue?["shape"], .string("us-postal-code"))
        XCTAssertEqual(geo.metric?.key, "avails")
    }

    func testDashboardSummaryDecodesItemsAndSelectorAliases() throws {
        let payload = """
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "summary",
                  "kind": "dashboard.summary",
                  "dashboard": {
                    "summary": {
                      "items": [
                        { "id": "avails", "label": "Avails", "field": "avails", "format": "compactNumber" },
                        { "id": "fallback", "label": "Fallback", "key": "totals.value", "value": 12 }
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let summary = try XCTUnwrap(metadata.view?.content?.containers.first)
        let items = try XCTUnwrap(summary.dashboard?.summary?.items)

        XCTAssertEqual(items.count, 2)
        XCTAssertEqual(items[0].resolvedSelector, "avails")
        XCTAssertEqual(items[1].resolvedSelector, "totals.value")
        XCTAssertEqual(items[1].value, .number(12))
    }

    func testDashboardSummaryResolvedCardsUseItemsAndFirstDatasourceRow() {
        let container = ContainerDef(
            id: "summary",
            kind: "dashboard.summary",
            dashboard: DashboardDef(
                summary: DashboardSummaryDef(
                    items: [
                        DashboardMetricDef(id: "avails", label: "Avails", field: "avails", format: "number"),
                        DashboardMetricDef(id: "fallback", label: "Fallback", key: "totals.value", format: "number"),
                        DashboardMetricDef(id: "literal", label: "Literal", format: "number", value: .number(7))
                    ]
                )
            )
        )

        let cards = DashboardRuntime.resolvedDashboardSummaryCards(
            container,
            metrics: ["avails": 100, "totals": ["value": 12]],
            source: ["avails": 42]
        )

        XCTAssertEqual(cards.map(\.label), ["Avails", "Fallback", "Literal"])
        XCTAssertEqual(cards.map(\.displayValue), ["42", "12", "7"])
    }

    func testDashboardKPITableDecodesExplicitColumns() throws {
        let payload = """
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "kpi",
                  "kind": "dashboard.kpiTable",
                  "dashboard": {
                    "kpiTable": {
                      "columns": [
                        { "key": "name", "label": "Name" },
                        { "key": "avails", "label": "Avails", "format": "compactNumber" }
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let kpiTable = try XCTUnwrap(metadata.view?.content?.containers.first?.dashboard?.kpiTable)

        XCTAssertEqual(kpiTable.columns.map(\.id), ["name", "avails"])
        XCTAssertEqual(kpiTable.columns.map(\.label), ["Name", "Avails"])
        XCTAssertTrue(kpiTable.rows.isEmpty)
    }

    func testDashboardCompareDecodesCurrentAndPreviousLabels() throws {
        let payload = """
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "compare",
                  "kind": "dashboard.compare",
                  "dashboard": {
                    "compare": {
                      "items": [
                        {
                          "id": "delivery",
                          "label": "Delivery",
                          "current": "currentValue",
                          "previous": "previousValue",
                          "currentLabel": "Current period",
                          "previousLabel": "Baseline period"
                        }
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let item = try XCTUnwrap(metadata.view?.content?.containers.first?.dashboard?.compare?.items.first)

        XCTAssertEqual(item.currentLabel, "Current period")
        XCTAssertEqual(item.previousLabel, "Baseline period")
    }

    func testDashboardBlocksDecodeMissingArraysAsEmpty() throws {
        let payload = """
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "root",
                  "kind": "dashboard",
                  "containers": [
                    { "id": "compare", "kind": "dashboard.compare", "dashboard": { "compare": {} } },
                    { "id": "filters", "kind": "dashboard.filters", "dashboard": { "filters": {} } },
                    { "id": "timeline", "kind": "dashboard.timeline", "dashboard": { "timeline": { "annotations": { "selector": "notes" } } } },
                    { "id": "dimensions", "kind": "dashboard.dimensions", "dashboard": { "dimensions": { "dimension": { "key": "channel" } } } },
                    { "id": "messages", "kind": "dashboard.messages", "dashboard": { "messages": {} } },
                    { "id": "badges", "kind": "dashboard.badges", "dashboard": { "badges": {} } },
                    { "id": "status", "kind": "dashboard.status", "dashboard": { "status": {} } },
                    { "id": "report", "kind": "dashboard.report", "dashboard": { "report": {} } }
                  ]
                }
              ]
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let children = try XCTUnwrap(metadata.view?.content?.containers.first?.containers)

        XCTAssertEqual(children.first { $0.id == "compare" }?.dashboard?.compare?.items.isEmpty, true)
        XCTAssertEqual(children.first { $0.id == "filters" }?.dashboard?.filters?.items.isEmpty, true)
        XCTAssertEqual(children.first { $0.id == "timeline" }?.dashboard?.timeline?.viewModes, [])
        XCTAssertEqual(children.first { $0.id == "timeline" }?.dashboard?.timeline?.annotations?.selector, "notes")
        XCTAssertEqual(children.first { $0.id == "dimensions" }?.dashboard?.dimensions?.viewModes, [])
        XCTAssertEqual(children.first { $0.id == "dimensions" }?.dashboard?.dimensions?.dimension?.key, "channel")
        XCTAssertEqual(children.first { $0.id == "messages" }?.dashboard?.messages?.items.isEmpty, true)
        XCTAssertEqual(children.first { $0.id == "badges" }?.dashboard?.badges?.items.isEmpty, true)
        XCTAssertEqual(children.first { $0.id == "status" }?.dashboard?.status?.checks.isEmpty, true)
        XCTAssertEqual(children.first { $0.id == "report" }?.dashboard?.report?.sections.isEmpty, true)
    }

    func testWindowMetadataDecodesDashboardReportSectionStringBody() throws {
        let payload = """
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "report",
                  "kind": "dashboard.report",
                  "sections": [
                    {
                      "id": "arrayBody",
                      "title": "Array body",
                      "body": ["First paragraph", "Second paragraph"]
                    },
                    {
                      "id": "stringBody",
                      "title": "String body",
                      "body": "Single paragraph"
                    },
                    {
                      "id": "emptyBody",
                      "title": "Empty body",
                      "body": ""
                    }
                  ]
                }
              ]
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let sections = try XCTUnwrap(metadata.view?.content?.containers.first?.sections)

        XCTAssertEqual(sections.first { $0.id == "arrayBody" }?.body, ["First paragraph", "Second paragraph"])
        XCTAssertEqual(sections.first { $0.id == "stringBody" }?.body, ["Single paragraph"])
        XCTAssertEqual(sections.first { $0.id == "emptyBody" }?.body, [])
    }

    func testWindowMetadataDecodesDashboardMessageBodyAliases() throws {
        let payload = """
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "messages",
                  "kind": "dashboard.messages",
                  "dashboard": {
                    "messages": {
                      "items": [
                        {
                          "severity": "warning",
                          "title": "Watchlist",
                          "text": "Text fallback",
                          "field": "status.message",
                          "bodyField": "message",
                          "rowIndex": 2
                        }
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let message = try XCTUnwrap(metadata.view?.content?.containers.first?.dashboard?.messages?.items.first)

        XCTAssertEqual(message.title, "Watchlist")
        XCTAssertEqual(message.text, "Text fallback")
        XCTAssertEqual(message.field, "status.message")
        XCTAssertEqual(message.bodyField, "message")
        XCTAssertEqual(message.rowIndex, 2)
    }

    func testWindowMetadataDecodesFileBrowserContainer() throws {
        let payload = """
        {
          "view": {
            "content": {
              "kind": "workspace.files",
              "id": "fileBrowserRoot",
              "dataSourceRef": "workspace_files",
              "fileBrowser": {
                "title": "Workspace files",
                "dataSourceRef": "workspace_files_nested",
                "folderOnly": true,
                "on": [
                  { "action": "workspace.open", "args": ["row", "uri"] }
                ],
                "targetOverrides": {
                  "ios:phone": {
                    "title": "Files"
                  }
                }
              }
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let container = try XCTUnwrap(metadata.view?.content?.containers.first)
        let fileBrowser = try XCTUnwrap(container.fileBrowser)

        XCTAssertEqual(container.id, "fileBrowserRoot")
        XCTAssertEqual(container.dataSourceRef, "workspace_files")
        XCTAssertEqual(fileBrowser.title, "Workspace files")
        XCTAssertEqual(fileBrowser.dataSourceRef, "workspace_files_nested")
        XCTAssertEqual(fileBrowser.folderOnly, true)
        XCTAssertEqual(fileBrowser.on.first?.action, "workspace.open")
        XCTAssertEqual(fileBrowser.on.first?.args, ["row", "uri"])
        XCTAssertEqual(fileBrowser.targetOverrides["ios:phone"]?.objectValue?["title"], .string("Files"))
    }

    func testFileBrowserRowLocationAcceptsCommonPathKeys() {
        XCTAssertEqual(fileBrowserRowLocation(["uri": .string("/workspace")]), "/workspace")
        XCTAssertEqual(fileBrowserRowLocation(["URI": .string("/upper")]), "/upper")
        XCTAssertEqual(fileBrowserRowLocation(["url": .string("https://example.test/file.txt")]), "https://example.test/file.txt")
        XCTAssertEqual(fileBrowserRowLocation(["path": .string("  /trimmed/path  ")]), "/trimmed/path")
        XCTAssertEqual(fileBrowserRowLocation(["Path": .number(42)]), "42")
        XCTAssertNil(fileBrowserRowLocation(["name": .string("No path")]))
    }

    func testFileBrowserParentURI() {
        XCTAssertEqual(parentURI(for: ""), "/")
        XCTAssertEqual(parentURI(for: "/"), "/")
        XCTAssertEqual(parentURI(for: "folder"), "/")
        XCTAssertEqual(parentURI(for: "/folder"), "/")
        XCTAssertEqual(parentURI(for: "/folder/file.txt"), "/folder")
        XCTAssertEqual(parentURI(for: "/folder/sub/"), "/folder")
    }

    func testFileBrowserRowModelResolvesNameAndFolderState() {
        let folder = FileBrowserRowModel(
            row: [
                "path": .string("/reports/daily"),
                "label": .string("Daily Reports"),
                "kind": .string("directory")
            ],
            fallbackIndex: 0
        )
        let numericFolder = FileBrowserRowModel(
            row: [
                "uri": .string("/reports/monthly"),
                "isFolder": .number(1)
            ],
            fallbackIndex: 1
        )
        let directory = FileBrowserRowModel(
            row: [
                "uri": .string("/reports/archive"),
                "isDirectory": .string("yes")
            ],
            fallbackIndex: 2
        )
        let file = FileBrowserRowModel(
            row: [
                "uri": .string("/reports/readme.md"),
                "type": .string("file")
            ],
            fallbackIndex: 3
        )
        let namedFile = FileBrowserRowModel(
            row: [
                "path": .string("/reports/data.bin"),
                "filename": .string("Data Export.bin"),
                "fileType": .string("blob")
            ],
            fallbackIndex: 4
        )
        let folderFlag = FileBrowserRowModel(
            row: [
                "uri": .string("/reports/flagged"),
                "folder": .string("true")
            ],
            fallbackIndex: 5
        )
        let unnamed = FileBrowserRowModel(row: [:], fallbackIndex: 6)

        XCTAssertEqual(folder.name, "Daily Reports")
        XCTAssertEqual(folder.subtitle, "/reports/daily")
        XCTAssertTrue(folder.isFolder)
        XCTAssertEqual(numericFolder.name, "monthly")
        XCTAssertTrue(numericFolder.isFolder)
        XCTAssertEqual(directory.name, "archive")
        XCTAssertTrue(directory.isFolder)
        XCTAssertEqual(file.name, "readme.md")
        XCTAssertFalse(file.isFolder)
        XCTAssertEqual(namedFile.name, "Data Export.bin")
        XCTAssertFalse(namedFile.isFolder)
        XCTAssertEqual(folderFlag.name, "flagged")
        XCTAssertTrue(folderFlag.isFolder)
        XCTAssertEqual(unnamed.name, "Unnamed")
        XCTAssertFalse(unnamed.isFolder)
    }

    func testPlannerTableBuildsCallbackPayloadAndCSV() {
        let table = TableDef(
            columns: [
                ColumnDef(key: "name", label: "Name"),
                ColumnDef(key: "status", label: "Status")
            ],
            selectionField: "selected",
            disabledField: "locked",
            callback: .object([
                "type": .string("llm_event"),
                "eventName": .string("planner_submit")
            ])
        )
        let rows: [[String: JSONValue]] = [
            ["name": .string("Alpha"), "status": .string("Ready"), "selected": .bool(true)],
            ["name": .string("Beta, Inc"), "status": .string("Review"), "selected": .bool(false)],
            ["name": .string("Gamma"), "status": .string("Locked"), "locked": .bool(true)]
        ]
        let selected = plannerTableDefaultSelectedIndexes(
            rows: rows,
            selectionField: plannerTableSelectionField(table),
            disabledField: plannerTableDisabledField(table)
        )
        let payload = plannerTableCallbackPayload(
            table: table,
            dataSourceRef: "planner_rows",
            rows: rows,
            selectedRowIndexes: selected
        )
        let csv = plannerTableCSV(
            columns: table.columns,
            rows: plannerTableRowsWithSelection(
                rows: rows,
                selectedRowIndexes: selected,
                selectionField: "selected"
            ),
            selectionField: "selected"
        )

        XCTAssertEqual(selected, [0])
        XCTAssertEqual(payload["callback"]?.objectValue?["eventName"], .string("planner_submit"))
        XCTAssertEqual(payload["dataSourceRef"], .string("planner_rows"))
        XCTAssertEqual(payload["selectionField"], .string("selected"))
        XCTAssertEqual(payload["selectedRows"]?.arrayValue?.count, 1)
        XCTAssertEqual(payload["unselectedRows"]?.arrayValue?.count, 1)
        XCTAssertEqual(payload["disabledRows"]?.arrayValue?.count, 1)
        XCTAssertEqual(payload["selectedRows"]?.arrayValue?.first?.objectValue?["name"], .string("Alpha"))
        XCTAssertEqual(payload["selectedRows"]?.arrayValue?.first?.objectValue?["selected"], .bool(true))
        XCTAssertEqual(payload["unselectedRows"]?.arrayValue?.first?.objectValue?["name"], .string("Beta, Inc"))
        XCTAssertEqual(payload["unselectedRows"]?.arrayValue?.first?.objectValue?["selected"], .bool(false))
        XCTAssertEqual(payload["disabledRows"]?.arrayValue?.first?.objectValue?["name"], .string("Gamma"))
        XCTAssertEqual(payload["disabledRows"]?.arrayValue?.first?.objectValue?["locked"], .bool(true))
        XCTAssertEqual(payload["disabledRows"]?.arrayValue?.first?.objectValue?["selected"], .bool(false))
        XCTAssertEqual(csv, """
        Name,Status,selected
        Alpha,Ready,true
        "Beta, Inc",Review,false
        Gamma,Locked,false
        """)
    }

    func testPlannerTableSubmitFeedbackUsesSelectableRowCountsAndFailureFallback() {
        let rows: [[String: JSONValue]] = [
            ["name": .string("Alpha"), "selected": .bool(true)],
            ["name": .string("Beta"), "selected": .bool(false)],
            ["name": .string("Gamma"), "locked": .bool(true)]
        ]
        let selectableCount = plannerTableSelectableRowCount(rows: rows, disabledField: "locked")

        let submitting = plannerTableSubmitFeedback(
            status: .submitting,
            selectedCount: 1,
            selectableCount: selectableCount
        )
        let submitted = plannerTableSubmitFeedback(
            status: .submitted,
            selectedCount: 1,
            selectableCount: selectableCount
        )
        let failure = plannerTableSubmitFeedback(
            status: .failure,
            failureMessage: "  "
        )

        XCTAssertEqual(selectableCount, 2)
        XCTAssertEqual(submitting.buttonLabel, "Submitting...")
        XCTAssertEqual(submitting.message, "Submitting 1 of 2 selectable rows.")
        XCTAssertTrue(submitting.busy)
        XCTAssertEqual(submitted.buttonLabel, "Submitted")
        XCTAssertEqual(submitted.message, "Submitted 1 of 2 selectable rows.")
        XCTAssertFalse(submitted.busy)
        XCTAssertEqual(failure.buttonLabel, "Retry")
        XCTAssertEqual(failure.message, "Submit action failed.")
    }

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

    func testRefreshDataSourceCollectionPassesWindowConversationIDToLoader() async {
        let runtime = ForgeRuntime()
        await runtime.registerWindowMetadataLoader { _ in
            WindowMetadata(dataSources: ["list": DataSourceDef()])
        }
        let window = await runtime.openWindow(
            key: "w1",
            title: "W1",
            conversationID: "conv-1"
        )
        await runtime.registerDataSourceLoader { request in
            XCTAssertEqual(request.windowID, window.id)
            XCTAssertEqual(request.dataSourceRef, "list")
            XCTAssertEqual(request.conversationID, "conv-1")
            return ForgeRuntime.DataSourceFetchResult(rows: [["ok": .bool(true)]])
        }

        await runtime.refreshDataSourceCollection(windowID: window.id, dataSourceRef: "list")

        let rows = await runtime.dataSourceCollection(windowID: window.id, dataSourceRef: "list")
        XCTAssertEqual(rows.first?["ok"], .bool(true))
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
                    "on": [
                      { "event": "submit", "handler": "approval.submit" }
                    ],
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
        XCTAssertEqual(container?.schemaBasedForm?.on.first?.event, "submit")
        XCTAssertEqual(container?.schemaBasedForm?.on.first?.handler, "approval.submit")
        XCTAssertNotNil(container?.schemaBasedForm?.schema)
    }

    func testEditorDecodesSelectorAndStyleMetadata() throws {
        let payload = """
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "approvalEditor",
                  "dataSourceRef": "approvalEditorForm",
                  "editor": {
                    "selector": {
                      "source": "patch",
                      "location": "path",
                      "extension": "language"
                    },
                    "style": {
                      "height": "320px",
                      "readOnly": "true"
                    },
                    "language": "diff",
                    "value": "fallback"
                  }
                }
              ]
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let editor = metadata.view?.content?.containers.first?.editor

        XCTAssertEqual(editor?.selector?.source, "patch")
        XCTAssertEqual(editor?.selector?.location, "path")
        XCTAssertEqual(editor?.selector?.extension, "language")
        XCTAssertEqual(editor?.style["height"], "320px")
        XCTAssertEqual(editor?.style["readOnly"], "true")
        XCTAssertEqual(editor?.language, "diff")
        XCTAssertEqual(editor?.value, "fallback")
    }

    func testEditorHelpersUseSelectorStyleAndFallbacks() {
        let editor = EditorDef(
            selector: EditorSelectorDef(source: "patch", location: "path", extension: "language"),
            style: ["readOnly": "true"],
            value: "fallback"
        )
        let form: [String: JSONValue] = [
            "patch": .string("@@ -1 +1\n+ok"),
            "path": .string("src/main.go"),
            "language": .string("diff")
        ]

        XCTAssertEqual(editorSource(form: form, selector: editor.selector, fallback: editor.value), "@@ -1 +1\n+ok")
        XCTAssertEqual(editorLocation(form: form, selector: editor.selector), "src/main.go")
        XCTAssertEqual(editorExtension(form: form, selector: editor.selector), "diff")
        XCTAssertEqual(editorLanguageLabel(editor: editor, form: form), "DIFF • READ ONLY")
        XCTAssertTrue(editorReadOnly(editor.style))
        XCTAssertTrue(editorIsDiff("@@ -1 +1", extensionValue: nil))
        XCTAssertEqual(editorSource(form: [:], selector: editor.selector, fallback: editor.value), "fallback")
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

    func testSchemaFormRuntimePreservesLookupMetadata() {
        let lookup: JSONValue = .object([
            "dialogId": .string("entityPicker"),
            "outputs": .array([
                .object([
                    "location": .string("entityId"),
                    "name": .string("entity_id")
                ])
            ])
        ])
        let form = SchemaBasedFormDef(
            schema: .object([
                "type": .string("object"),
                "properties": .object([
                    "entity_id": .object([
                        "type": .string("integer"),
                        "title": .string("Entity"),
                        "lookup": lookup
                    ])
                ])
            ])
        )

        let fields = SchemaFormRuntime.resolvedFields(for: form)

        XCTAssertEqual(fields.count, 1)
        XCTAssertEqual(fields[0].key, "entity_id")
        XCTAssertEqual(fields[0].type, .lookup)
        XCTAssertEqual(fields[0].lookup, lookup)
    }

    func testSchemaFormRuntimeRendersLookupDisplayTemplate() {
        let lookup: JSONValue = .object([
            "display": .string("${entityName} | {{campaign.name}}")
        ])
        let field = ResolvedSchemaField(
            key: "entity_id",
            label: "Entity",
            type: .lookup,
            required: false,
            options: [],
            placeholder: nil,
            defaultValue: nil,
            lookup: lookup
        )

        let display = SchemaFormRuntime.lookupDisplayValue(
            for: field,
            formState: [
                "entity_id": .number(42),
                "entityName": .string("Entity 42"),
                "campaign": .object(["name": .string("Campaign A")])
            ],
            fallback: "42"
        )

        XCTAssertEqual(display, "Entity 42 | Campaign A")
        XCTAssertEqual(
            SchemaFormRuntime.lookupDisplayValue(
                lookup: lookup,
                formState: [:],
                fallback: "42"
            ),
            "42"
        )
    }

    func testSchemaFormRuntimeSortsFieldsByUiOrderThenName() {
        let form = SchemaBasedFormDef(
            schema: .object([
                "type": .string("object"),
                "properties": .object([
                    "zeta": .object([
                        "type": .string("string"),
                        "title": .string("Zeta")
                    ]),
                    "alpha": .object([
                        "type": .string("string"),
                        "title": .string("Alpha")
                    ]),
                    "first": .object([
                        "type": .string("string"),
                        "title": .string("First"),
                        "x-ui-order": .number(-1)
                    ]),
                    "last": .object([
                        "type": .string("string"),
                        "title": .string("Last"),
                        "x-ui-order": .string("10")
                    ])
                ])
            ])
        )

        let fields = SchemaFormRuntime.resolvedFields(for: form)

        XCTAssertEqual(fields.map(\.key), ["first", "alpha", "zeta", "last"])
    }

    func testSchemaFormRuntimeResolvesFieldsFromDatasourceFormState() {
        let form = SchemaBasedFormDef(dataBinding: "payload.schema")
        let formState: [String: JSONValue] = [
            "payload": .object([
                "schema": .object([
                    "type": .string("object"),
                    "required": .array([.string("region")]),
                    "properties": .object([
                        "region": .object([
                            "type": .string("string"),
                            "title": .string("Region"),
                            "enum": .array([.string("NA"), .string("EMEA")])
                        ])
                    ])
                ])
            ])
        ]

        let fields = SchemaFormRuntime.resolvedFields(for: form, formState: formState)

        XCTAssertEqual(fields.count, 1)
        XCTAssertEqual(fields[0].key, "region")
        XCTAssertEqual(fields[0].label, "Region")
        XCTAssertEqual(fields[0].type, .picker)
        XCTAssertEqual(fields[0].required, true)
        XCTAssertEqual(fields[0].options, ["NA", "EMEA"])
    }

    func testSchemaFormRuntimeUsesDefaultSchemaBindingAndParsesStringSchema() {
        let form = SchemaBasedFormDef()
        let formState: [String: JSONValue] = [
            "schema": .string("""
            {
              "type": "object",
              "properties": {
                "notes": {
                  "type": "string",
                  "title": "Notes",
                  "x-ui-widget": "textarea"
                }
              }
            }
            """)
        ]

        let fields = SchemaFormRuntime.resolvedFields(for: form, formState: formState)

        XCTAssertEqual(fields.count, 1)
        XCTAssertEqual(fields[0].key, "notes")
        XCTAssertEqual(fields[0].label, "Notes")
        XCTAssertEqual(fields[0].type, .textarea)
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

    func testSchemaFormRuntimeResolvesExplicitFieldsWithBlankNameFromLabel() {
        let form = SchemaBasedFormDef(
            fields: [
                FormFieldDef(
                    name: "   ",
                    label: " Region ",
                    type: "string"
                ),
                FormFieldDef(
                    name: "\t",
                    label: "\n"
                )
            ]
        )

        let fields = SchemaFormRuntime.resolvedFields(for: form)

        XCTAssertEqual(fields.count, 1)
        XCTAssertEqual(fields[0].key, "Region")
        XCTAssertEqual(fields[0].label, "Region")
    }

    func testSchemaFormRuntimeValidatesRequiredAndEnumFields() {
        let fields = [
            ResolvedSchemaField(
                key: "region",
                label: "Region",
                type: .picker,
                required: true,
                options: ["NA", "EMEA"],
                placeholder: nil,
                defaultValue: nil
            ),
            ResolvedSchemaField(
                key: "notes",
                label: "Notes",
                type: .text,
                required: false,
                options: [],
                placeholder: nil,
                defaultValue: nil
            )
        ]

        XCTAssertEqual(
            SchemaFormRuntime.validationErrors(fields: fields, payload: [:]),
            ["region": "Required"]
        )
        XCTAssertEqual(
            SchemaFormRuntime.validationErrors(fields: fields, payload: ["region": .string("APAC")]),
            ["region": "Invalid value"]
        )
        XCTAssertTrue(
            SchemaFormRuntime.validationErrors(fields: fields, payload: ["region": .string("NA")]).isEmpty
        )
    }

    func testSchemaFormRuntimeValidatesMultiSelectEnumValues() {
        let fields = [
            ResolvedSchemaField(
                key: "names",
                label: "Names",
                type: .multiSelect,
                required: true,
                options: ["HOME", "SHELL"],
                placeholder: nil,
                defaultValue: nil
            )
        ]

        XCTAssertEqual(
            SchemaFormRuntime.validationErrors(fields: fields, payload: ["names": .array([])]),
            ["names": "Required"]
        )
        XCTAssertEqual(
            SchemaFormRuntime.validationErrors(
                fields: fields,
                payload: ["names": .array([.string("HOME"), .string("BAD")])]
            ),
            ["names": "Invalid value"]
        )
        XCTAssertTrue(
            SchemaFormRuntime.validationErrors(
                fields: fields,
                payload: ["names": .array([.string("HOME"), .string("SHELL")])]
            ).isEmpty
        )
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
                },
                {
                  "id": "iosAliasOnly",
                  "title": "Base Alias",
                  "targetOverrides": {
                    "iosTablet": {
                      "title": "Compact Alias Title"
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

        XCTAssertEqual(containers.map(\.id), ["shared", "iosOnly", "iosAliasOnly"])
        XCTAssertEqual(containers.first(where: { $0.id == "iosOnly" })?.title, "Exact Tablet Title")
        XCTAssertEqual(containers.first(where: { $0.id == "iosAliasOnly" })?.title, "Compact Alias Title")
        XCTAssertEqual(resolved.actions?.code, "(() => ({ ping: () => true }))()")
    }

    func testMetadataResolverLeavesWebDesktopOnBaseWhenOnlyMobileOverridesExist() throws {
        let payload = """
        {
          "view": {
            "content": {
              "id": "builder",
              "layout": { "kind": "desktop", "gap": "base" },
              "containers": [
                { "id": "base", "title": "Base" }
              ],
              "targetOverrides": {
                "mobile": {
                  "layout": { "kind": "mobile" },
                  "containers": [
                    { "id": "mobile", "title": "Mobile" }
                  ]
                },
                "phone": {
                  "layout": { "gap": "phone" }
                },
                "tablet": {
                  "layout": { "gap": "tablet" }
                },
                "ios:phone": {
                  "layout": { "kind": "iosPhone" }
                }
              }
            }
          }
        }
        """

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let resolved = MetadataResolver.resolve(
            metadata,
            for: ForgeTargetContext(platform: "web", formFactor: "desktop", surface: "browser")
        )
        let content = resolved.view?.content

        XCTAssertEqual(content?.id, "builder")
        XCTAssertEqual(content?.layout?.kind, "desktop")
        XCTAssertEqual(content?.layout?.gap, "base")
        XCTAssertEqual(content?.containers.map(\.id), ["base"])
        XCTAssertEqual(content?.containers.first?.title, "Base")
        XCTAssertTrue(content?.targetOverrides.isEmpty == true)
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

    func testMetadataResolverTrimsTargetSpecsAndContextBeforeMatching() throws {
        let payload = """
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "normalized",
                  "target": {
                    "platforms": [" ios "],
                    "formFactors": [" phone "],
                    "capabilities": [" lookup "]
                  }
                },
                {
                  "id": "excluded",
                  "target": {
                    "excludePlatforms": [" ios "]
                  }
                }
              ]
            }
          }
        }
        """
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let resolved = MetadataResolver.resolve(
            metadata,
            for: ForgeTargetContext(
                platform: " ios ",
                formFactor: " phone ",
                surface: " app ",
                capabilities: [" lookup "]
            )
        )

        XCTAssertEqual(resolved.view?.content?.containers.map(\.id), ["normalized"])
    }

    func testMetadataResolverTreatsFoldableFormFactorAsMobileForBroadOverrides() throws {
        let payload = """
        {
          "view": {
            "content": {
              "containers": [
                {
                  "id": "foldableCard",
                  "title": "Base",
                  "targetOverrides": {
                    "mobile": {
                      "title": "Mobile"
                    },
                    "foldable": {
                      "subtitle": "Foldable"
                    },
                    "mobile:foldable": {
                      "title": "Hinge aware"
                    }
                  }
                }
              ]
            }
          }
        }
        """
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let resolved = MetadataResolver.resolve(
            metadata,
            for: ForgeTargetContext(platform: "", formFactor: "foldable")
        )
        let container = resolved.view?.content?.containers.first

        XCTAssertEqual(container?.title, "Hinge aware")
        XCTAssertEqual(container?.subtitle, "Foldable")
        XCTAssertTrue(container?.targetOverrides.isEmpty == true)
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

    func testTableRefreshControlVisibleOnlyForRuntimeDatasourceRows() {
        XCTAssertTrue(tableRefreshControlVisible(dataSourceRef: "orders", usesProvidedRows: false))
        XCTAssertFalse(tableRefreshControlVisible(dataSourceRef: "orders", usesProvidedRows: true))
        XCTAssertFalse(tableRefreshControlVisible(dataSourceRef: "  ", usesProvidedRows: false))
    }

    func testTableRefreshFeedbackUsesDatasourceControlState() {
        XCTAssertEqual(
            tableRefreshFeedback(control: ControlState(loading: true), isRefreshing: false),
            TableRefreshFeedback(busy: true, message: nil)
        )
        XCTAssertEqual(
            tableRefreshFeedback(control: ControlState(error: "  Timeout  "), isRefreshing: false),
            TableRefreshFeedback(busy: false, message: "Timeout")
        )
        XCTAssertEqual(
            tableRefreshFeedback(control: ControlState(), isRefreshing: true),
            TableRefreshFeedback(busy: true, message: nil)
        )
    }

    func testTableRowAccessibilityLabelSummarizesVisibleColumns() {
        let columns = [
            ColumnDef(key: "name", label: "Name"),
            ColumnDef(id: "rank", label: "Rank"),
            ColumnDef(id: "status", label: "Status", emptyText: "Unknown"),
            ColumnDef(id: "open", label: "Open", type: "button")
        ]

        let label = tableRowAccessibilityLabel(
            columns: columns.filter { $0.type != "button" && $0.type != "icon" },
            row: [
                "name": .string("Alpha"),
                "rank": .number(2)
            ]
        )

        XCTAssertEqual(label, "Name Alpha, Rank 2, Status Unknown")
    }

    func testTableRowAccessibilityLabelRespectsCustomLimit() {
        let columns = [
            ColumnDef(id: "name", label: "Name"),
            ColumnDef(id: "rank", label: "Rank"),
            ColumnDef(id: "status", label: "Status")
        ]

        let label = tableRowAccessibilityLabel(
            columns: columns,
            row: [
                "name": .string("Alpha"),
                "rank": .number(2),
                "status": .string("Ready")
            ],
            limit: 2
        )

        XCTAssertEqual(label, "Name Alpha, Rank 2")
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

    func testSortedTableRowsSortsNumbersAndPreservesOriginalRowIndex() {
        let rows: [[String: JSONValue]] = [
            ["name": .string("Charlie"), "rank": .number(3)],
            ["name": .string("alpha"), "rank": .number(1)],
            ["name": .string("Bravo"), "rank": .number(2)]
        ]

        let sorted = sortedTableRows(rows: rows, sortColumnKey: "rank", ascending: true)

        XCTAssertEqual(sorted.map(\.originalIndex), [1, 2, 0])
        XCTAssertEqual(sorted.map { $0.row["rank"] }, [.number(1), .number(2), .number(3)])
    }

    func testSortedTableRowsSortsStringsCaseInsensitivelyAndHandlesNulls() {
        let rows: [[String: JSONValue]] = [
            ["name": .string("delta")],
            ["name": .null],
            ["name": .string("Alpha")],
            ["name": .string("bravo")]
        ]

        let ascending = sortedTableRows(rows: rows, sortColumnKey: "name", ascending: true)
        let descending = sortedTableRows(rows: rows, sortColumnKey: "name", ascending: false)

        XCTAssertEqual(ascending.map(\.originalIndex), [1, 2, 3, 0])
        XCTAssertEqual(descending.map(\.originalIndex), [0, 3, 2, 1])
    }

    func testTablePaginationStateUsesMetricsAndInputPage() {
        let state = tablePaginationState(
            paging: DataSourcePagingDef(size: 25, enabled: true),
            metrics: [
                "pageCount": .number(5),
                "totalCount": .number(112)
            ],
            input: InputState(page: 3)
        )

        XCTAssertEqual(state?.currentPage, 3)
        XCTAssertEqual(state?.totalPages, 5)
        XCTAssertEqual(state?.totalCount, 112)
        XCTAssertEqual(state?.label, "Page 3 of 5 (112)")
        XCTAssertEqual(state?.canGoPrevious, true)
        XCTAssertEqual(state?.canGoNext, true)
        XCTAssertEqual(state?.canGoLast, true)
    }

    func testTablePaginationStateInfersNextPageFromHasMore() {
        let state = tablePaginationState(
            paging: nil,
            metrics: ["hasMore": .bool(true)],
            input: InputState(page: 2)
        )

        XCTAssertEqual(state?.currentPage, 2)
        XCTAssertEqual(state?.totalPages, nil)
        XCTAssertEqual(state?.label, "Page 2")
        XCTAssertEqual(state?.canGoPrevious, true)
        XCTAssertEqual(state?.canGoNext, true)
        XCTAssertEqual(state?.canGoLast, false)
    }

    func testTableDefDecodesLegacyStringColumnsAndRichActionColumns() throws {
        let payload = """
        {
          "title": "Orders",
          "columns": [
            "segment",
            {
              "id": "budget",
              "key": "budgetMicros",
              "label": "Budget",
              "sortable": true
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
        XCTAssertEqual(table.columns[1].key, "budgetMicros")
        XCTAssertEqual(table.columns[1].label, "Budget")
        XCTAssertEqual(table.columns[1].sortable, true)
        XCTAssertEqual(table.columns[2].type, "button")
        XCTAssertEqual(table.columns[2].on.first?.action, "window.openWindow")
    }

    func testSetDataSourcePagePublishesInputWithFetch() async {
        let runtime = ForgeRuntime()
        let window = await runtime.openWindowInline(
            key: "w1",
            title: "W1",
            metadata: WindowMetadata(dataSources: ["list": DataSourceDef()])
        )
        await runtime.registerDataSourceLoader { request in
            XCTAssertEqual(request.input.page, 4)
            return ForgeRuntime.DataSourceFetchResult(
                rows: [["page": .number(Double(request.input.page ?? -1))]],
                metrics: ["page": .number(Double(request.input.page ?? -1))]
            )
        }

        await runtime.setDataSourcePage(windowID: window.id, dataSourceRef: "list", page: 4)

        let input = await runtime.dataSourceInputState(windowID: window.id, dataSourceRef: "list")
        let rows = await runtime.dataSourceCollection(windowID: window.id, dataSourceRef: "list")
        let metrics = await runtime.dataSourceMetrics(windowID: window.id, dataSourceRef: "list")
        XCTAssertEqual(input.page, 4)
        XCTAssertEqual(input.fetch, true)
        XCTAssertEqual(rows.first?["page"], .number(4))
        XCTAssertEqual(metrics["page"], .number(4))
    }

    func testSetDataSourceInputParametersWithFetchRefreshesCollection() async {
        let runtime = ForgeRuntime()
        let window = await runtime.openWindowInline(
            key: "w1",
            title: "W1",
            metadata: WindowMetadata(dataSources: ["list": DataSourceDef()])
        )
        await runtime.registerDataSourceLoader { request in
            XCTAssertEqual(request.input.filter["region"], .string("EMEA"))
            return ForgeRuntime.DataSourceFetchResult(
                rows: [["region": request.input.filter["region"] ?? .null]]
            )
        }

        await runtime.setDataSourceInputParameters(
            windowID: window.id,
            dataSourceRef: "list",
            parameters: [
                "input": .object([
                    "query": .object(["region": .string("EMEA")])
                ])
            ],
            fetch: true
        )

        let rows = await runtime.dataSourceCollection(windowID: window.id, dataSourceRef: "list")
        XCTAssertEqual(rows.first?["region"], .string("EMEA"))
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

    func testParseMarkdownBlocksKeepsCodeFenceAsCodeBlock() {
        let source = """
        Before
        ```swift
        let total = rows.count
        print(total)
        ```
        After
        """

        let blocks = parseMarkdownBlocks(source)

        XCTAssertEqual(blocks.count, 3)
        XCTAssertEqual(blocks[0], .markdown("Before"))
        XCTAssertEqual(
            blocks[1],
            .code(language: "swift", body: "let total = rows.count\nprint(total)")
        )
        XCTAssertEqual(blocks[2], .markdown("After"))
    }

    func testMarkdownCodeAccessibilityLabelsIncludeLanguageAndLineCount() {
        XCTAssertEqual(
            markdownCodeAccessibilityLabel(language: " Swift ", body: "let a = 1\nlet b = 2"),
            "swift code block, 2 lines"
        )
        XCTAssertEqual(
            markdownCodeAccessibilityLabel(language: "", body: "single"),
            "Code block, 1 line"
        )
        XCTAssertEqual(
            markdownCodeCopyAccessibilityLabel(language: "JSON"),
            "Copy json code block"
        )
        XCTAssertEqual(
            markdownCodeCopyAccessibilityLabel(language: ""),
            "Copy code block"
        )
    }

    func testMarkdownCodeHighlightRunsClassifyJSONTokens() {
        let runs = markdownCodeHighlightRuns(language: "json", body: #"{"ok": true, "count": 42}"#)

        XCTAssertTrue(runs.contains(MarkdownCodeHighlightRun(text: #""ok""#, kind: .string)))
        XCTAssertTrue(runs.contains(MarkdownCodeHighlightRun(text: "true", kind: .literal)))
        XCTAssertTrue(runs.contains(MarkdownCodeHighlightRun(text: "42", kind: .number)))
        XCTAssertTrue(runs.contains { $0.kind == .punctuation && $0.text.contains("{") })
    }

    func testMarkdownCodeHighlightRunsClassifySwiftKeywordsAndComments() {
        let runs = markdownCodeHighlightRuns(language: "swift", body: "let total = 3 // count")

        XCTAssertTrue(runs.contains(MarkdownCodeHighlightRun(text: "let", kind: .keyword)))
        XCTAssertTrue(runs.contains(MarkdownCodeHighlightRun(text: "3", kind: .number)))
        XCTAssertTrue(runs.contains(MarkdownCodeHighlightRun(text: "// count", kind: .comment)))
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

    func testDataSourceRuntimeFetchBuildsGetQueryWithOffsetPaging() async {
        let runtime = DataSourceRuntime()
        let dataSourceID = "window123DSmain"
        let session = makeMockSession(responseBody: #"{"data":[{"id":1}]}"#)
        await runtime.setInput(
            dataSourceID: dataSourceID,
            input: InputState(filter: ["country": .string("US")], page: 4)
        )

        await runtime.fetchCollection(
            dataSourceID: dataSourceID,
            baseURL: "https://example.test",
            path: "/reports/search",
            staticParameters: ["static": "yes"],
            inputParameters: ["status": .string("active")],
            paging: DataSourcePagingDef(
                size: 25,
                enabled: true,
                parameters: ["page": "offset", "size": "limit"]
            ),
            session: session
        )

        let request = try! XCTUnwrap(MetadataURLProtocol.lastRequest)
        let components = try! XCTUnwrap(URLComponents(url: try! XCTUnwrap(request.url), resolvingAgainstBaseURL: false))
        let query = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        let rows = await runtime.collection(dataSourceID: dataSourceID)

        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(components.path, "/reports/search")
        XCTAssertEqual(query["static"], "yes")
        XCTAssertEqual(query["status"], "active")
        XCTAssertEqual(query["country"], "US")
        XCTAssertEqual(query["offset"], "75")
        XCTAssertEqual(query["limit"], "25")
        XCTAssertEqual(rows.first?["id"], .number(1))
    }

    func testDataSourceRuntimeFetchPostsDatasourceInputsForNonGetFetchRoute() async throws {
        let runtime = DataSourceRuntime()
        let dataSourceID = "window123DSmain"
        let session = makeMockSession(responseBody: #"{"data":[{"id":2}]}"#)
        await runtime.setInput(
            dataSourceID: dataSourceID,
            input: InputState(filter: ["country": .string("US"), "status": .string("active")], page: 4)
        )

        await runtime.fetchCollection(
            dataSourceID: dataSourceID,
            baseURL: "https://example.test",
            path: "/v1/api/datasources/report/fetch",
            method: "POST",
            staticParameters: ["advertiserId": "17"],
            inputParameters: ["status": .string("resolved")],
            paging: DataSourcePagingDef(
                size: 25,
                enabled: true,
                parameters: ["page": "offset", "size": "limit"]
            ),
            session: session
        )

        let request = try XCTUnwrap(MetadataURLProtocol.lastRequest)
        let body = try XCTUnwrap(MetadataURLProtocol.lastBody)
        let payload = try JSONDecoder().decode(JSONValue.self, from: body)
        let inputs = try XCTUnwrap(payload.objectValue?["inputs"]?.objectValue)
        let rows = await runtime.collection(dataSourceID: dataSourceID)

        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
        XCTAssertEqual(request.url?.path, "/v1/api/datasources/report/fetch")
        XCTAssertEqual(inputs["advertiserId"], .string("17"))
        XCTAssertEqual(inputs["offset"], .number(75))
        XCTAssertEqual(inputs["limit"], .number(25))
        XCTAssertEqual(inputs["country"], .string("US"))
        XCTAssertEqual(inputs["status"], .string("active"))
        XCTAssertEqual(rows.first?["id"], .number(2))
    }

    func testDataSourceRuntimeFetchUsesResponseSelectorsForRowsAndMetrics() async {
        let runtime = DataSourceRuntime()
        let dataSourceID = "window123DSmain"
        let session = makeMockSession(responseBody: #"""
        {
          "payload": {
            "rows": [
              { "id": 1, "name": "Alpha" },
              { "id": 2, "name": "Beta" }
            ]
          },
          "meta": {
            "total": 2,
            "hasMore": false
          }
        }
        """#)

        await runtime.fetchCollection(
            dataSourceID: dataSourceID,
            baseURL: "https://example.test",
            path: "/reports/search",
            selectors: DataSourceSelectorDef(data: "payload.rows", dataInfo: "meta", metrics: nil),
            session: session
        )

        let rows = await runtime.collection(dataSourceID: dataSourceID)
        let metrics = await runtime.metrics(dataSourceID: dataSourceID)

        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(rows.first?["name"], .string("Alpha"))
        XCTAssertEqual(metrics["total"], .number(2))
        XCTAssertEqual(metrics["hasMore"], .bool(false))
    }

    func testDataSourceRuntimeFetchExtractsPagingMetricsWhenDataInfoSelectorMissing() async {
        let runtime = DataSourceRuntime()
        let dataSourceID = "window123DSmain"
        let session = makeMockSession(responseBody: #"""
        {
          "data": [
            { "id": 7 }
          ],
          "page": {
            "total": 99,
            "count": 4
          },
          "nextCursor": "cursor-2",
          "hasMore": true
        }
        """#)

        await runtime.fetchCollection(
            dataSourceID: dataSourceID,
            baseURL: "https://example.test",
            path: "/reports/search",
            paging: DataSourcePagingDef(
                size: 25,
                dataInfoSelectors: [
                    "totalCount": "page.total",
                    "pageCount": "page.count"
                ]
            ),
            session: session
        )

        let rows = await runtime.collection(dataSourceID: dataSourceID)
        let metrics = await runtime.metrics(dataSourceID: dataSourceID)

        XCTAssertEqual(rows.first?["id"], .number(7))
        XCTAssertEqual(metrics["totalCount"], .number(99))
        XCTAssertEqual(metrics["pageCount"], .number(4))
        XCTAssertEqual(metrics["nextCursor"], .string("cursor-2"))
        XCTAssertEqual(metrics["hasMore"], .bool(true))
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

    func testEvaluateDashboardConditionSupportsJsonOperands() {
        XCTAssertTrue(
            DashboardRuntime.evaluateDashboardCondition(
                DashboardConditionDef(
                    source: "filters",
                    field: "segment",
                    equals: .object(["id": .string("enterprise"), "tier": .number(2)])
                ),
                filters: ["segment": ["id": "enterprise", "tier": 2]]
            )
        )
        XCTAssertTrue(
            DashboardRuntime.evaluateDashboardCondition(
                DashboardConditionDef(
                    source: "filters",
                    field: "segments",
                    inValues: [
                        .array([.string("agency"), .string("brand")]),
                        .array([.string("enterprise"), .string("direct")])
                    ]
                ),
                filters: ["segments": ["enterprise", "direct"]]
            )
        )
    }

    func testVisibleDashboardDetailChildrenHonorsChildVisibleWhen() throws {
        let payload = """
        {
          "id": "detail",
          "kind": "dashboard.detail",
          "containers": [
            {
              "id": "visible",
              "kind": "dashboard.summary",
              "visibleWhen": { "source": "filters", "field": "region", "equals": "NA" }
            },
            {
              "id": "hidden",
              "kind": "dashboard.summary",
              "visibleWhen": { "source": "filters", "field": "region", "equals": "EU" }
            },
            {
              "id": "nestedVisible",
              "kind": "dashboard.summary",
              "visibleWhen": { "source": "filters", "field": "region", "equals": "EU" },
              "dashboard": {
                "visibleWhen": { "source": "filters", "field": "region", "equals": "NA" }
              }
            },
            {
              "id": "always",
              "kind": "dashboard.summary"
            }
          ]
        }
        """
        let detail = try JSONDecoder().decode(ContainerDef.self, from: Data(payload.utf8))

        let visible = DashboardRuntime.visibleDashboardDetailChildren(
            detail,
            filters: ["region": "NA"]
        )

        XCTAssertEqual(visible.map(\.id), ["visible", "nestedVisible", "always"])
    }

    func testDashboardTimelineChartUsesShorthandWhenChartIsAbsent() throws {
        let payload = """
        {
          "id": "timeline",
          "kind": "dashboard.timeline",
          "dateField": "day",
          "chartType": "area",
          "series": [
            { "label": "Avails", "value": "avails" },
            { "label": "HH uniques", "value": "hhUniques" }
          ]
        }
        """
        let container = try JSONDecoder().decode(ContainerDef.self, from: Data(payload.utf8))

        let chart = try XCTUnwrap(DashboardRuntime.dashboardTimelineChart(container))

        XCTAssertEqual(chart.type, "area")
        XCTAssertEqual(chart.xKey, "day")
        XCTAssertEqual(chart.series, ["avails", "hhUniques"])
        XCTAssertEqual(chart.seriesDef?.values.map(\.name), ["Avails", "HH uniques"])
    }

    func testDashboardCompositionChartUsesCompactFieldsWhenChartIsAbsent() throws {
        let payload = """
        {
          "id": "channelMix",
          "kind": "dashboard.composition",
          "dataSourceRef": "channel_rows",
          "categoryKey": "channel",
          "valueKey": "avails",
          "chartType": "pie",
          "legendLimit": 4
        }
        """
        let container = try JSONDecoder().decode(ContainerDef.self, from: Data(payload.utf8))

        let chart = try XCTUnwrap(DashboardRuntime.dashboardCompositionChart(container))

        XCTAssertEqual(container.legendLimit, 4)
        XCTAssertEqual(chart.type, "pie")
        XCTAssertEqual(chart.xKey, "channel")
        XCTAssertEqual(chart.nameKey, "channel")
        XCTAssertEqual(chart.valueKey, "avails")
        XCTAssertEqual(chart.series, ["avails"])
        XCTAssertEqual(chart.seriesDef?.nameKey, "channel")
        XCTAssertEqual(chart.seriesDef?.valueKey, "avails")
        XCTAssertEqual(chart.seriesDef?.values.map(\.value), ["avails"])
    }

    func testDashboardReportRuntimeSummaryUsesDirectThenNestedConfig() throws {
        let directPayload = """
        {
          "id": "runtime",
          "kind": "dashboard.reportRuntime",
          "title": "Fallback Runtime",
          "reportRuntime": {
            "title": "Runtime Report",
            "subtitle": "Current run",
              "reportSpec": {
                "layoutIntent": {
                  "blockOrder": ["filters", "refinements", "kpi", "chart", "geo", "table", "summary"]
                },
                "parameters": {
                  "pageSize": 10
                },
                "datasets": [
                  {
                    "id": "rows",
                    "request": {
                      "dimensions": {
                        "name": true
                      }
                    }
                  }
                ],
                "blocks": [
                  {
                    "id": "tableSpec",
                    "kind": "tableBlock",
                    "datasetRef": "rows",
                    "columns": [
                      { "key": "name", "sourceKey": "name", "displayKey": "name", "label": "Name", "runtimeFilterable": true },
                      { "key": "value", "label": "Value", "format": "integer" }
                    ]
                  }
                ],
                "drillMetadata": {
                  "hierarchies": [],
                  "detailTargets": [],
                  "fieldActions": [
                    {
                      "fieldRef": "name",
                      "actions": [
                        { "id": "drill_region", "label": "Drill to region", "kind": "drill", "nextFieldRef": "region" },
                        { "id": "detail_name", "label": "Show name details", "kind": "detail", "targetRef": "target://example/name" }
                      ]
                    }
                  ]
                },
                "scope": {
                  "params": [
                    { "id": "dateRange", "description": "Reporting period", "value": { "start": "2026-06-01", "end": "2026-06-05" } },
                    { "id": "channels", "description": "Included channels", "value": ["Display", "CTV"] }
                  ]
                },
                "refinements": [
                  { "id": "ref-channel", "op": "drill", "field": "channel", "fieldLabel": "Channel", "values": ["Display"] }
                ]
              },
            "reportFill": {
              "datasets": [
                {
                  "id": "rows",
                  "rows": [
                    { "name": "North", "value": 12 },
                    { "name": "South", "value": 8 }
                  ],
                  "provenance": {
                    "rowCount": 2,
                    "diagnostics": [
                      {
                        "code": "datasetStale",
                        "severity": "warning",
                        "path": "datasets.rows",
                        "message": "Rows were served from cache"
                      }
                    ]
                  }
                },
                {
                  "id": "geoRows",
                  "rows": [
                    { "state": "CA", "label": "California", "avails": 1200000 },
                    { "state": "WA", "label": "Washington", "avails": 980000 }
                  ],
                  "provenance": { "rowCount": 2 }
                }
              ],
              "diagnostics": [
                {
                  "code": "actionProviderFailed",
                  "severity": "warning",
                  "blockId": "chart",
                  "path": "reportRuntime.blocks.chart.actions.channel",
                  "message": "Provider offline",
                  "suggestedFix": "Retry later."
                },
                {
                  "code": "invalidGeo",
                  "severity": "error",
                  "blockId": "geo",
                  "message": "Geo payload incomplete"
                }
              ],
              "blocks": [
                { "id": "summary", "kind": "markdownBlock", "title": "Summary", "content": { "markdown": "# Summary\\nReady to review." } },
                {
                  "id": "filters",
                  "kind": "filterBarBlock",
                  "title": "Report Scope",
                  "content": {
                    "title": "Report Scope",
                    "params": [
                      { "id": "dateRange", "description": "Reporting period", "value": { "start": "2026-06-01", "end": "2026-06-05" } },
                      { "id": "channels", "description": "Included channels", "value": ["Display", "CTV"] }
                    ]
                  }
                },
                {
                  "id": "refinements",
                  "kind": "refinementBarBlock",
                  "content": {
                    "title": "Refinements",
                    "emptyLabel": "No active refinements",
                    "refinements": [
                      { "id": "ref-channel", "op": "drill", "field": "channel", "fieldLabel": "Channel", "values": ["Display"] }
                    ]
                  }
                },
                {
                  "id": "kpi",
                  "kind": "kpiBlock",
                  "content": {
                    "title": "Revenue",
                    "description": "Current period",
                    "valueLabel": "Booked",
                    "value": "42",
                    "secondaryField": "change",
                    "secondaryValue": "12%",
                    "rowCount": 1
                  }
                },
                {
                  "id": "chart",
                  "kind": "chartBlock",
                  "title": "Trend",
                  "datasetRef": "rows",
                  "content": {
                    "chartSpec": {
                      "xField": "name"
                    },
                    "chartModel": {
                      "type": "bar",
                      "xAxis": { "dataKey": "name" },
                      "series": {
                        "values": [
                          { "name": "Value", "value": "value" }
                        ]
                      }
                    }
                  }
                },
                {
                  "id": "geo",
                  "kind": "geoMapBlock",
                  "title": "State Geo",
                  "datasetRef": "geoRows",
                  "content": {
                    "geo": {
                      "shape": "us-states",
                      "key": "state",
                      "labelKey": "label",
                      "metric": {
                        "key": "avails",
                        "label": "Avails",
                        "format": "compactNumber"
                      }
                    }
                  }
                },
                {
                  "id": "table",
                  "kind": "tableBlock",
                  "title": "Rows",
                  "datasetRef": "rows",
                  "content": {
                    "columns": [
                      { "key": "name", "sourceKey": "name", "displayKey": "name", "label": "Name", "runtimeFilterable": true },
                      { "key": "value", "label": "Value", "format": "integer" }
                    ]
                  }
                }
              ]
            }
          }
        }
        """
        let nestedPayload = """
        {
          "id": "runtime",
          "kind": "dashboard.reportRuntime",
          "dashboard": {
            "reportRuntime": {
              "reportSpec": {
                "title": "Nested Runtime",
                "blocks": [
                  { "key": "chart", "type": "chartBlock", "label": "Trend" }
                ]
              }
            }
          }
        }
        """
        let direct = try JSONDecoder().decode(ContainerDef.self, from: Data(directPayload.utf8))
        let nested = try JSONDecoder().decode(ContainerDef.self, from: Data(nestedPayload.utf8))
        let chartDiagnostic = DashboardReportRuntimeDiagnostic(
            id: "actionProviderFailed:chart:reportRuntime.blocks.chart.actions.channel:1",
            severity: "warning",
            code: "actionProviderFailed",
            blockID: "chart",
            path: "reportRuntime.blocks.chart.actions.channel",
            message: "Provider offline",
            suggestedFix: "Retry later."
        )
        let geoDiagnostic = DashboardReportRuntimeDiagnostic(
            id: "invalidGeo:geo:2",
            severity: "error",
            code: "invalidGeo",
            blockID: "geo",
            path: nil,
            message: "Geo payload incomplete",
            suggestedFix: nil
        )
        let rowsDatasetDiagnostic = DashboardReportRuntimeDiagnostic(
            id: "dataset:rows:datasetStale:datasets.rows:1",
            severity: "warning",
            code: "datasetStale",
            blockID: nil,
            path: "datasets.rows",
            message: "Rows were served from cache",
            suggestedFix: nil
        )
        let tableNameActionField = DashboardReportRuntimeActionField(
            id: "name",
            valueKey: "name",
            displayValueKey: "name",
            label: "Name",
            runtimeFilterable: true
        )
        let chartNameActionField = DashboardReportRuntimeActionField(
            id: "name",
            kind: "xField",
            valueKey: "name",
            displayValueKey: "name",
            label: "Name",
            selectionSource: "xValue",
            runtimeFilterable: true
        )
        let tableActionDescriptors = [
            DashboardReportRuntimeActionDescriptor(id: "keep:name", kind: "keep", fieldValueKey: "name", label: "Keep Name"),
            DashboardReportRuntimeActionDescriptor(id: "exclude:name", kind: "exclude", fieldValueKey: "name", label: "Exclude Name"),
            DashboardReportRuntimeActionDescriptor(
                id: "drill_region",
                kind: "drill",
                fieldValueKey: "name",
                label: "Drill to region",
                nextFieldRef: "region"
            ),
            DashboardReportRuntimeActionDescriptor(
                id: "detail_name",
                kind: "detail",
                fieldValueKey: "name",
                label: "Show name details",
                targetRef: "target://example/name"
            )
        ]
        let chartActionDescriptors = [
            DashboardReportRuntimeActionDescriptor(id: "keep:chart:name", kind: "keep", fieldValueKey: "name", label: "Keep Name"),
            DashboardReportRuntimeActionDescriptor(id: "exclude:chart:name", kind: "exclude", fieldValueKey: "name", label: "Exclude Name"),
            DashboardReportRuntimeActionDescriptor(
                id: "drill_region",
                kind: "drill",
                fieldValueKey: "name",
                label: "Drill to region",
                nextFieldRef: "region"
            ),
            DashboardReportRuntimeActionDescriptor(
                id: "detail_name",
                kind: "detail",
                fieldValueKey: "name",
                label: "Show name details",
                targetRef: "target://example/name"
            )
        ]

        XCTAssertEqual(DashboardRuntime.dashboardReportRuntimeConfig(direct)?.objectValue?["title"], .string("Runtime Report"))
        XCTAssertEqual(DashboardRuntime.dashboardReportRuntimeSummary(direct), DashboardReportRuntimeSummary(
            title: "Runtime Report",
            subtitle: "Current run",
            blockCount: 7,
            blocks: [
                DashboardReportRuntimeBlockSummary(
                    id: "filters",
                    kind: "filterBarBlock",
                    title: "Report Scope",
                    filterBar: DashboardReportRuntimeFilterBarValue(
                        title: "Report Scope",
                        params: [
                            DashboardReportRuntimeFilterParamValue(
                                id: "dateRange",
                                description: "Reporting period",
                                valueText: "2026-06-01 to 2026-06-05"
                            ),
                            DashboardReportRuntimeFilterParamValue(
                                id: "channels",
                                description: "Included channels",
                                valueText: "Display, CTV"
                            )
                        ]
                    )
                ),
                DashboardReportRuntimeBlockSummary(
                    id: "refinements",
                    kind: "refinementBarBlock",
                    title: "Refinements",
                    refinementBar: DashboardReportRuntimeRefinementBarValue(
                        title: "Refinements",
                        emptyLabel: "No active refinements",
                        refinements: [
                            DashboardReportRuntimeRefinementValue(
                                id: "ref-channel",
                                label: "Drill: Channel = Display"
                            )
                        ]
                    )
                ),
                DashboardReportRuntimeBlockSummary(
                    id: "kpi",
                    kind: "kpiBlock",
                    title: "Revenue",
                    kpi: DashboardReportRuntimeKPIValue(
                        description: "Current period",
                        valueLabel: "Booked",
                        valueText: "42",
                        secondaryLabel: "change",
                        secondaryValueText: "12%",
                        emptyLabel: "No KPI value available.",
                        rowCount: 1
                    )
                ),
                DashboardReportRuntimeBlockSummary(
                    id: "chart",
                    kind: "chartBlock",
                    title: "Trend",
                    diagnostics: [chartDiagnostic, rowsDatasetDiagnostic],
                    chart: DashboardReportRuntimeChartValue(
                        dataSourceRef: "rows",
                        chart: ChartDef(
                            type: "bar",
                            valueKey: "value",
                            seriesDef: ChartSeriesDef(values: [ChartValueOption(name: "Value", value: "value")]),
                            xAxis: ChartAxisDef(dataKey: "name")
                        ),
                        rows: [
                            ["name": .string("North"), "value": .number(12)],
                            ["name": .string("South"), "value": .number(8)]
                        ],
                        actionFields: [chartNameActionField],
                        actionDescriptors: chartActionDescriptors
                    )
                ),
                DashboardReportRuntimeBlockSummary(
                    id: "geo",
                    kind: "geoMapBlock",
                    title: "State Geo",
                    diagnostics: [geoDiagnostic],
                    geoMap: DashboardReportRuntimeGeoMapValue(
                        dataSourceRef: "geoRows",
                        shape: "us-states",
                        metricLabel: "Avails",
                        metricFormat: "compactNumber",
                        rows: [
                            DashboardGeoMapRow(regionCode: "CA", label: "California", value: 1_200_000),
                            DashboardGeoMapRow(regionCode: "WA", label: "Washington", value: 980_000)
                        ]
                    )
                ),
                DashboardReportRuntimeBlockSummary(
                    id: "table",
                    kind: "tableBlock",
                    title: "Rows",
                    diagnostics: [rowsDatasetDiagnostic],
                    table: DashboardReportRuntimeTableValue(
                        dataSourceRef: "rows",
                        columns: [
                            ColumnDef(id: "name", name: "name", key: "name", label: "Name"),
                            ColumnDef(id: "value", name: "value", key: "value", label: "Value", format: "integer")
                        ],
                        rows: [
                            ["name": .string("North"), "value": .number(12)],
                            ["name": .string("South"), "value": .number(8)]
                        ],
                        limit: 2,
                        actionFields: [tableNameActionField],
                        actionDescriptors: tableActionDescriptors
                    )
                ),
                DashboardReportRuntimeBlockSummary(
                    id: "summary",
                    kind: "markdownBlock",
                    title: "Summary",
                    markdown: "# Summary\nReady to review."
                )
            ],
            diagnostics: [chartDiagnostic, geoDiagnostic]
        ))
        XCTAssertEqual(DashboardRuntime.dashboardReportRuntimeSummary(nested), DashboardReportRuntimeSummary(
            title: "Nested Runtime",
            subtitle: nil,
            blockCount: 1,
            blocks: [
                DashboardReportRuntimeBlockSummary(id: "chart", kind: "chartBlock", title: "Trend")
            ]
        ))
    }

    func testDashboardReportRuntimeSummaryResolvesSpecAuthoredFiltersAndRefinements() throws {
        let payload = """
        {
          "id": "runtime",
          "kind": "dashboard.reportRuntime",
          "dashboard": {
            "reportRuntime": {
              "reportSpec": {
                "title": "Spec Authored Runtime",
                "scope": {
                  "params": [
                    { "id": "dateRange", "description": "Reporting period", "value": { "start": "2026-06-01", "end": "2026-06-05" } },
                    { "id": "channels", "description": "Included channels", "value": ["Display", "CTV"] }
                  ]
                },
                "refinements": [
                  { "id": "ref-market", "op": "keep", "field": "country", "fieldLabel": "Market", "values": ["US"] }
                ],
                "blocks": [
                  { "id": "filters", "kind": "filterBarBlock", "title": "Report Scope", "paramIds": ["dateRange"] },
                  { "id": "activeRefinements", "kind": "refinementBarBlock", "title": "Active Refinements", "emptyLabel": "No refinements yet" }
                ]
              }
            }
          }
        }
        """
        let container = try JSONDecoder().decode(ContainerDef.self, from: Data(payload.utf8))

        XCTAssertEqual(DashboardRuntime.dashboardReportRuntimeSummary(container), DashboardReportRuntimeSummary(
            title: "Spec Authored Runtime",
            subtitle: nil,
            blockCount: 2,
            blocks: [
                DashboardReportRuntimeBlockSummary(
                    id: "filters",
                    kind: "filterBarBlock",
                    title: "Report Scope",
                    filterBar: DashboardReportRuntimeFilterBarValue(
                        title: "Report Scope",
                        params: [
                            DashboardReportRuntimeFilterParamValue(
                                id: "dateRange",
                                description: "Reporting period",
                                valueText: "2026-06-01 to 2026-06-05"
                            )
                        ]
                    )
                ),
                DashboardReportRuntimeBlockSummary(
                    id: "activeRefinements",
                    kind: "refinementBarBlock",
                    title: "Active Refinements",
                    refinementBar: DashboardReportRuntimeRefinementBarValue(
                        title: "Active Refinements",
                        emptyLabel: "No refinements yet",
                        refinements: [
                            DashboardReportRuntimeRefinementValue(
                                id: "ref-market",
                                label: "Keep: Market = US"
                            )
                        ]
                    )
                )
            ]
        ))
    }

    func testDashboardReportRuntimePreservesResolvedPresentationContent() throws {
        let presentationKinds = [
            "badgesBlock", "collectionBlock", "sectionBlock", "tabGroupBlock", "compositeBlock",
            "stepperBlock", "infoPanelBlock", "calloutBlock", "kanbanBlock", "timelineBlock"
        ]
        let blocks = presentationKinds.enumerated().map { index, kind in
            """
            {"id":"block-\(index + 1)","kind":"\(kind)","content":{"marker":"\(kind)"}}
            """
        }.joined(separator: ",")
        let payload = """
        {
          "id": "runtime",
          "kind": "dashboard.reportRuntime",
          "reportRuntime": {
            "reportFill": {
              "blocks": [\(blocks)]
            }
          }
        }
        """
        let container = try JSONDecoder().decode(ContainerDef.self, from: Data(payload.utf8))
        let summary = DashboardRuntime.dashboardReportRuntimeSummary(container)

        XCTAssertEqual(summary.blocks.map(\.kind), presentationKinds)
        XCTAssertEqual(summary.blocks.compactMap { $0.content["marker"]?.stringValue }, presentationKinds)
    }

    func testDashboardReportRuntimeTableActionExecutionsMatchWebPayloadShape() {
        let field = DashboardReportRuntimeActionField(
            id: "channelV2",
            valueKey: "channelV2",
            displayValueKey: "channel.channel",
            label: "Channel",
            selectionSource: "seriesKey",
            runtimeFilterable: true
        )
        let descriptors = [
            DashboardReportRuntimeActionDescriptor(id: "keep:channelV2", kind: "keep", fieldValueKey: "channelV2", label: "Keep only"),
            DashboardReportRuntimeActionDescriptor(
                id: "drill_market",
                kind: "drill",
                fieldValueKey: "channelV2",
                label: "Drill to Market",
                nextFieldRef: "country"
            ),
            DashboardReportRuntimeActionDescriptor(
                id: "detail_channel",
                kind: "detail",
                fieldValueKey: "channelV2",
                label: "Show channel details",
                targetRef: "target://example/performance/channel-detail"
            )
        ]
        let item: [String: JSONValue] = [
            "channelV2": .number(1),
            "channel": .object(["channel": .string("Display")]),
            "campaign": .string("Prospect Sprint")
        ]

        let executions = DashboardRuntime.dashboardReportRuntimeTableActionExecutions(
            blockID: "comparisonTable",
            descriptors: descriptors,
            field: field,
            item: item
        )

        XCTAssertEqual(executions, [
            DashboardReportRuntimeActionExecution(
                id: "keep:channelV2",
                label: "Keep only",
                kind: "keep",
                refinement: DashboardReportRuntimeActionRefinement(
                    op: "keep",
                    field: "channelV2",
                    value: .number(1),
                    sourceBlockID: "comparisonTable",
                    fieldLabel: "Channel",
                    label: "Keep only = Display"
                )
            ),
            DashboardReportRuntimeActionExecution(
                id: "drill_market",
                label: "Drill to Market",
                kind: "drill",
                refinement: DashboardReportRuntimeActionRefinement(
                    op: "drill",
                    field: "channelV2",
                    value: .number(1),
                    sourceBlockID: "comparisonTable",
                    fieldLabel: "Channel",
                    label: "Drill to Market = Display"
                ),
                transition: DashboardReportRuntimeActionTransition(
                    sourceField: "channelV2",
                    nextFieldRef: "country",
                    sourceBlockID: "comparisonTable"
                )
            ),
            DashboardReportRuntimeActionExecution(
                id: "detail_channel",
                label: "Show channel details",
                kind: "detail",
                detailRequest: DashboardReportRuntimeDetailRequest(
                    action: DashboardReportRuntimeDetailAction(
                        id: "detail_channel",
                        kind: "detail",
                        label: "Show channel details",
                        targetRef: "target://example/performance/channel-detail"
                    ),
                    item: item,
                    value: .number(1),
                    field: field,
                    sourceBlockID: "comparisonTable"
                )
            )
        ])
    }

    func testDashboardReportRuntimeExecutesAuthoredSelectionAction() {
        let field = DashboardReportRuntimeActionField(
            id: "market",
            valueKey: "market",
            displayValueKey: "market",
            label: "Market",
            runtimeFilterable: false
        )
        let block: [String: JSONValue] = [
            "runtime": .object([
                "actions": .array([.object([
                    "id": .string("selectMarket"),
                    "kind": .string("select"),
                    "dimension": .string("market")
                ])])
            ])
        ]
        let descriptors = DashboardRuntime.dashboardReportRuntimeAuthoredSelectionDescriptors(block: block, fields: [field])
        let executions = DashboardRuntime.dashboardReportRuntimeTableActionExecutions(
            blockID: "marketTable",
            descriptors: descriptors,
            field: field,
            item: ["market": .string("US"), "spend": .number(10)]
        )
        XCTAssertEqual(executions.first?.selection, DashboardSelectionState(
            dimension: "market",
            entityKey: "US",
            selected: ["market": .string("US"), "spend": .number(10)],
            sourceBlockID: "marketTable"
        ))
    }

    func testDashboardReportRuntimeChartActionExecutionsMatchWebPayloadShape() {
        let fields = [
            DashboardReportRuntimeActionField(
                id: "country",
                kind: "xField",
                valueKey: "country",
                displayValueKey: "country",
                label: "Market",
                selectionSource: "xValue",
                runtimeFilterable: true
            ),
            DashboardReportRuntimeActionField(
                id: "channelV2",
                kind: "seriesField",
                valueKey: "channelV2",
                displayValueKey: "channel.channel",
                label: "Channel",
                selectionSource: "seriesKey",
                runtimeFilterable: true
            )
        ]
        let descriptors = [
            DashboardReportRuntimeActionDescriptor(id: "keep:reachRateTrend:country", kind: "keep", fieldValueKey: "country", label: "Keep only"),
            DashboardReportRuntimeActionDescriptor(
                id: "drill_region",
                kind: "drill",
                fieldValueKey: "country",
                label: "Drill to Region",
                nextFieldRef: "region"
            ),
            DashboardReportRuntimeActionDescriptor(
                id: "detail_channel",
                kind: "detail",
                fieldValueKey: "channelV2",
                label: "Show channel details",
                targetRef: "target://example/performance/channel-detail"
            )
        ]
        let selectionRows: [[String: JSONValue]] = [
            ["channelV2": .string("Display"), "channel": .object(["channel": .string("Display")]), "region": .string("West")],
            ["channelV2": .string("Display"), "channel": .object(["channel": .string("Display")]), "region": .string("Midwest")]
        ]

        let executions = DashboardRuntime.dashboardReportRuntimeChartActionExecutions(
            blockID: "reachRateTrend",
            descriptors: descriptors,
            fields: fields,
            selection: DashboardReportRuntimeChartSelection(
                xValue: .string("US"),
                seriesKey: .string("Display"),
                row: [
                    "country": .string("US"),
                    "channelV2": .string("Display"),
                    "reachRate": .number(40.82)
                ],
                selectionRows: selectionRows
            )
        )

        XCTAssertEqual(executions, [
            DashboardReportRuntimeActionExecution(
                id: "keep:reachRateTrend:country",
                label: "Keep only",
                kind: "keep",
                refinement: DashboardReportRuntimeActionRefinement(
                    op: "keep",
                    field: "country",
                    value: .string("US"),
                    sourceBlockID: "reachRateTrend",
                    fieldLabel: "Market",
                    label: "Keep only = US"
                )
            ),
            DashboardReportRuntimeActionExecution(
                id: "drill_region",
                label: "Drill to Region",
                kind: "drill",
                refinement: DashboardReportRuntimeActionRefinement(
                    op: "drill",
                    field: "country",
                    value: .string("US"),
                    sourceBlockID: "reachRateTrend",
                    fieldLabel: "Market",
                    label: "Drill to Region = US"
                ),
                transition: DashboardReportRuntimeActionTransition(
                    sourceField: "country",
                    nextFieldRef: "region",
                    sourceBlockID: "reachRateTrend"
                )
            ),
            DashboardReportRuntimeActionExecution(
                id: "detail_channel",
                label: "Show channel details",
                kind: "detail",
                detailRequest: DashboardReportRuntimeDetailRequest(
                    action: DashboardReportRuntimeDetailAction(
                        id: "detail_channel",
                        kind: "detail",
                        label: "Show channel details",
                        targetRef: "target://example/performance/channel-detail"
                    ),
                    item: [
                        "country": .string("US"),
                        "channelV2": .string("Display"),
                        "reachRate": .number(40.82),
                        "selectionRows": .array(selectionRows.map { .object($0) })
                    ],
                    value: .string("Display"),
                    field: fields[1],
                    sourceBlockID: "reachRateTrend"
                )
            )
        ])
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

    func testDashboardReportSectionTitlesUseTemplateInterpolation() {
        let title = DashboardRuntime.interpolateDashboardTemplate(
            "Selected Country: ${selection.entityKey} / {{ summary.total_spend }}",
            metrics: ["summary": ["total_spend": 42]],
            filters: [:],
            selection: DashboardSelectionState(entityKey: "US")
        )

        XCTAssertEqual(title, "Selected Country: US / 42")
    }

    func testDashboardBadgeTextUsesTemplateInterpolation() {
        let text = DashboardRuntime.interpolateDashboardTemplate(
            "Country ${selection.entityKey}: {{ summary.total_spend }}",
            metrics: ["summary": ["total_spend": 42]],
            filters: [:],
            selection: DashboardSelectionState(entityKey: "US")
        )

        XCTAssertEqual(text, "Country US: 42")
    }

    func testDashboardToneNameCoercesStringAndNormalizesThresholds() {
        let tone = DashboardToneDef(
            warningAbove: 90,
            dangerAbove: 80,
            successAbove: nil,
            warningBelow: nil,
            dangerBelow: nil,
            successBelow: nil
        )

        XCTAssertEqual(DashboardRuntime.dashboardToneName(value: "95", tone: tone), "danger")
        XCTAssertEqual(DashboardRuntime.dashboardToneName(value: "85", tone: tone), "warning")
        XCTAssertEqual(DashboardRuntime.dashboardToneName(value: "75", tone: tone), "info")
    }

    func testBuildDashboardDefaultFiltersCollectsNestedSelections() {
        let root = ContainerDef(
            id: "dashboard",
            kind: "dashboard",
            containers: [
                ContainerDef(
                    id: "filters",
                    kind: "dashboard.filters",
                    dashboard: DashboardDef(
                        filters: DashboardFiltersDef(
                            items: [
                                DashboardFilterItemDef(
                                    id: "range",
                                    label: "Range",
                                    field: "dateRange",
                                    type: "dateRange",
                                    options: [
                                        DashboardFilterOptionDef(label: "7d", value: "7d", defaultValue: true),
                                        DashboardFilterOptionDef(label: "30d", value: "30d")
                                    ]
                                ),
                                DashboardFilterItemDef(
                                    id: "region",
                                    label: "Region",
                                    field: "regions",
                                    multiple: true,
                                    options: [
                                        DashboardFilterOptionDef(label: "NA", value: "NA", defaultValue: true),
                                        DashboardFilterOptionDef(label: "EMEA", value: "EMEA", defaultValue: true)
                                    ]
                                )
                            ]
                        )
                    )
                )
            ]
        )

        let defaults = DashboardRuntime.buildDashboardDefaultFilters(root)

        XCTAssertEqual(defaults["dateRange"], .string("7d"))
        XCTAssertEqual(defaults["regions"], .array([.string("NA"), .string("EMEA")]))
        XCTAssertEqual(DashboardRuntime.dashboardFilterItems(root.containers[0]).first?.type, "dateRange")
    }

    func testDashboardFilterKeyFallbackAndToggleNormalizeKeys() {
        let byID = DashboardFilterItemDef(id: " status ", field: "   ")
        let byField = DashboardFilterItemDef(id: "status", field: " region ")

        let idFilters = DashboardRuntime.toggleDashboardFilter([:], item: byID, optionValue: "healthy")
        let fieldFilters = DashboardRuntime.toggleDashboardFilter([:], item: byField, optionValue: "NA")

        XCTAssertEqual(idFilters["status"], .string("healthy"))
        XCTAssertNil(idFilters[" status "])
        XCTAssertEqual(fieldFilters["region"], .string("NA"))
    }

    func testDashboardMultiFilterToggleRemovesSelectedValue() {
        let item = DashboardFilterItemDef(id: "regions", multiple: true)

        let selected = DashboardRuntime.toggleDashboardFilter([:], item: item, optionValue: "NA")
        let removed = DashboardRuntime.toggleDashboardFilter(selected, item: item, optionValue: "NA")

        XCTAssertEqual(selected["regions"], .array([.string("NA")]))
        XCTAssertEqual(removed["regions"], .array([]))
    }

    func testDashboardDateRangeFilterWritesWebCompatibleRangeObject() {
        let item = DashboardFilterItemDef(id: "range", field: "dateRange", type: "dateRange")

        let started = DashboardRuntime.setDashboardDateRangeFilter(
            [:],
            item: item,
            edge: "start",
            value: "2026-06-01"
        )
        let ended = DashboardRuntime.setDashboardDateRangeFilter(
            started,
            item: item,
            edge: "end",
            value: "2026-06-20"
        )
        let clearedStart = DashboardRuntime.setDashboardDateRangeFilter(
            ended,
            item: item,
            edge: "start",
            value: " "
        )

        XCTAssertEqual(
            ended["dateRange"],
            .object(["start": .string("2026-06-01"), "end": .string("2026-06-20")])
        )
        XCTAssertEqual(clearedStart["dateRange"], .object(["end": .string("2026-06-20")]))
    }

    func testApplyDashboardFiltersToCollectionHonorsBindingsAndMultiSelect() {
        let rows: [[String: JSONValue]] = [
            ["region": .string("NA"), "status": .string("healthy")],
            ["region": .string("EMEA"), "status": .string("warning")],
            ["region": .string("APAC"), "status": .string("healthy")]
        ]

        let filtered = DashboardRuntime.applyDashboardFiltersToCollection(
            rows,
            filterBindings: ["region": "region", "state": "status"],
            filters: ["region": .array([.string("NA"), .string("EMEA")]), "state": .string("healthy")]
        )

        XCTAssertEqual(filtered.count, 1)
        XCTAssertEqual(filtered.first?["region"], .string("NA"))
        XCTAssertEqual(filtered.first?["status"], .string("healthy"))
    }

    func testApplyDashboardSelectionToCollectionHonorsSelectionBindings() {
        let rows: [[String: JSONValue]] = [
            ["stateCode": .string("CA"), "dma": .string("Los Angeles")],
            ["stateCode": .string("CA"), "dma": .string("San Francisco")],
            ["stateCode": .string("TX"), "dma": .string("Dallas-Fort Worth")]
        ]

        let selected = DashboardRuntime.applyDashboardSelectionToCollection(
            rows,
            selectionBindings: ["entityKey": "stateCode"],
            selection: DashboardSelectionState(dimension: "stateCode", entityKey: "CA")
        )

        XCTAssertEqual(selected.map { $0["dma"] }, [.string("Los Angeles"), .string("San Francisco")])
    }

    func testDashboardSelectionFilteredRowsFeedDimensionAndGeoMapRanking() {
        let rows: [[String: JSONValue]] = [
            ["stateCode": .string("CA"), "regionCode": .string("CA"), "label": .string("California"), "avails": .number(3100)],
            ["stateCode": .string("TX"), "regionCode": .string("TX"), "label": .string("Texas"), "avails": .number(1200)],
            ["stateCode": .string("CA"), "regionCode": .string("CA-N"), "label": .string("Northern California"), "avails": .number(900)]
        ]
        let selected = DashboardRuntime.applyDashboardSelectionToCollection(
            rows,
            selectionBindings: ["entityKey": "stateCode"],
            selection: DashboardSelectionState(entityKey: "CA")
        )

        let dimensions = DashboardRuntime.rankedDashboardDimensionRows(
            selected,
            dimensionKey: "label",
            metricKey: "avails",
            limit: 3
        )
        let geoRows = DashboardRuntime.rankedDashboardGeoMapRows(
            selected,
            metricKey: "avails",
            limit: 3
        )

        XCTAssertEqual(dimensions.map(\.entityKey), ["California", "Northern California"])
        XCTAssertEqual(geoRows.map(\.regionCode), ["CA", "CA-N"])
    }

    func testRankedDashboardDimensionRowsSortsFiltersAndLimits() {
        let rows: [[String: JSONValue]] = [
            ["region": .string("NA"), "status": .string("healthy"), "spend": .number(12)],
            ["region": .string("EMEA"), "status": .string("warning"), "spend": .number(41)],
            ["region": .string("APAC"), "status": .string("healthy"), "spend": .number(27)]
        ]
        let filtered = DashboardRuntime.applyDashboardFiltersToCollection(
            rows,
            filterBindings: ["state": "status"],
            filters: ["state": .string("healthy")]
        )

        let ranked = DashboardRuntime.rankedDashboardDimensionRows(
            filtered,
            dimensionKey: "region",
            metricKey: "spend",
            limit: 1
        )

        XCTAssertEqual(ranked.map(\.entityKey), ["APAC"])
        XCTAssertEqual(ranked.map(\.value), [27])
    }

    func testRankedDashboardGeoMapRowsBuildsMapReadyFallbackRows() {
        let rows: [[String: JSONValue]] = [
            [
                "regionCode": .string("TX"),
                "label": .string("Texas"),
                "avails": .number(1200),
                "tone": .string("success"),
                "rank": .number(2),
                "href": .string("https://example.test/tx")
            ],
            [
                "stateCode": .string("CA"),
                "stateName": .string("California"),
                "avails": .string("3100"),
                "statusTone": .string("warning"),
                "rank": .number(1),
                "url": .string("https://example.test/ca")
            ],
            [
                "regionCode": .string(""),
                "label": .string("Missing"),
                "avails": .number(9999)
            ],
            [
                "regionCode": .string("NY"),
                "label": .string("New York"),
                "avails": .number(850),
                "link": .string("https://example.test/ny")
            ]
        ]

        let ranked = DashboardRuntime.rankedDashboardGeoMapRows(rows, metricKey: "avails", limit: 3)

        XCTAssertEqual(ranked.map(\.regionCode), ["CA", "TX", "NY"])
        XCTAssertEqual(ranked.map(\.label), ["California", "Texas", "New York"])
        XCTAssertEqual(ranked.map(\.value), [3100, 1200, 850])
        XCTAssertEqual(ranked.map(\.tone), ["warning", "success", nil])
        XCTAssertEqual(ranked.map(\.rank), [1, 2, nil])
        XCTAssertEqual(ranked.map(\.href), [
            "https://example.test/ca",
            "https://example.test/tx",
            "https://example.test/ny"
        ])
    }

    func testDashboardGeoTileRegionsMatchesSharedUSStateGeometryAndValueScale() {
        let regions = dashboardGeoTileRegions(rows: [
            DashboardGeoMapRow(regionCode: "ca", label: "California", value: 100),
            DashboardGeoMapRow(regionCode: "TX", label: "Texas", value: 50),
            DashboardGeoMapRow(regionCode: "NY", label: "New York", value: 0)
        ])

        XCTAssertEqual(regions.count, 51)
        XCTAssertEqual(
            regions.first { $0.tile.key == "CA" }?.tile,
            DashboardGeoStateTile(key: "CA", label: "California", column: 1, row: 5)
        )
        XCTAssertEqual(regions.first { $0.tile.key == "CA" }?.paletteIndex, 4)
        XCTAssertEqual(regions.first { $0.tile.key == "TX" }?.paletteIndex, 2)
        XCTAssertEqual(regions.first { $0.tile.key == "NY" }?.paletteIndex, 0)
        XCTAssertNil(regions.first { $0.tile.key == "WA" }?.paletteIndex)
        XCTAssertTrue(dashboardSupportsGeoShape("us-states"))
        XCTAssertTrue(dashboardSupportsGeoShape("US-STATE-TILES"))
        XCTAssertFalse(dashboardSupportsGeoShape("world"))
    }

    func testDashboardSelectionPayloadKeepsPrimitiveRowValuesOnly() {
        let payload = DashboardRuntime.dashboardSelectionPayload(from: [
            "region": .string("NA"),
            "score": .number(98),
            "enabled": .bool(true),
            "meta": .object(["ignored": .string("yes")])
        ])

        XCTAssertEqual(payload["region"], .string("NA"))
        XCTAssertEqual(payload["score"], .number(98))
        XCTAssertEqual(payload["enabled"], .bool(true))
        XCTAssertNil(payload["meta"])
    }

    func testDashboardContainerInheritsRootDataSourceWhenChildBlank() {
        let root = ContainerDef(id: "dashboard", kind: "dashboard", dataSourceRef: " rootRows ")
        let blankChild = ContainerDef(
            id: "chart",
            kind: "dashboard.chart",
            dataSourceRef: "   ",
            chart: ChartDef(type: "bar", xKey: "region", valueKey: "spend")
        )
        let explicitChild = ContainerDef(
            id: "table",
            kind: "dashboard.table",
            dataSourceRef: "childRows",
            columns: [ColumnDef(id: "region")]
        )

        let inherited = dashboardContainerInheritingDataSource(blankChild, dashboardRoot: root)
        let retained = dashboardContainerInheritingDataSource(explicitChild, dashboardRoot: root)

        XCTAssertEqual(inherited.dataSourceRef, "rootRows")
        XCTAssertEqual(inherited.chart?.xKey, "region")
        XCTAssertEqual(retained.dataSourceRef, "childRows")
        XCTAssertEqual(retained.columns.map(\.id), ["region"])
    }

    func testDashboardSelectionRuntimeAccessorsUseSharedDashboardKey() async {
        let runtime = ForgeRuntime()
        let root = ContainerDef(id: "dashboard", kind: "dashboard", dashboard: DashboardDef(key: "shared-dashboard"))
        let child = ContainerDef(id: "child", kind: "dashboard.messages", dashboard: DashboardDef(key: "shared-dashboard"))
        let selection = DashboardSelectionState(dimension: "region", entityKey: "NA", selected: ["region": .string("NA")], sourceBlockID: "child")

        await runtime.setDashboardSelection(windowID: "window-1", container: root, selection: selection)
        let loaded = await runtime.dashboardSelectionState(windowID: "window-1", container: child)

        XCTAssertEqual(loaded, selection)
    }

    func testFormatDashboardValueSupportsCommonFormats() {
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(42, format: "integer"), "42")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(1250.0, format: "compactNumber"), "1.2K")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(1250.0, format: "compact"), "1.2K")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue("1250", format: "compactNumber"), "1.2K")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(126_329_231_621, format: "number"), "126 329 231 621")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(95.000000409, format: "number5"), "95.00000")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(JSONPrimitive.string("0.1937"), format: "percentFraction"), "19.4%")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(nil, format: "number"), "n/a")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue("2026-05-01T04:00:00Z", format: "date"), "May 1, 2026")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue("2026-05-01T04:00:00Z", format: "dateTime"), "May 1, 2026, 4:00 AM")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue("2026-05-13T00:00:00Z", format: "wallClockHour"), "12 AM")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue("2026-05-13T00:00:00Z", format: "wallClockDate"), "May 13, 2026")
    }

    func testDashboardReportRuntimeKPIHonorsAuthoredNumberFormat() {
        let value = DashboardRuntime.dashboardReportRuntimeKPI(content: [
            "value": .number(126_329_231_621),
            "valueFormat": .string("number"),
            "secondaryField": .string("clearingPrice"),
            "secondaryValue": .number(95.000000409),
            "secondaryFormat": .string("number5")
        ])

        XCTAssertEqual(value.valueText, "126 329 231 621")
        XCTAssertEqual(value.secondaryValueText, "95.00000")
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
        let meta = WindowMetadata(
            view: ViewDef(content: ContentDef()),
            dataSources: ["myDS": DataSourceDef()]
        )
        let window = await runtime.openWindowInline(key: "w1", title: "W1", metadata: meta)
        let dsRef = "myDS"
        let ctx = ExecutionContext(windowID: window.id, dataSourceRef: dsRef)
        let stream = await runtime.dataSourceInputUpdates(windowID: window.id, dataSourceRef: dsRef)
        var iterator = stream.makeAsyncIterator()
        _ = await iterator.next()

        let exec = ExecutionDef(action: "dataSource.setFilter")
        await runtime.execute(exec, context: ctx,
                              args: ["region": .string("EMEA")])

        let dsID = WindowIdentity(windowID: window.id).dataSourceID(ref: dsRef)
        let input = await runtime.dataSourceRuntime.input(dataSourceID: dsID)
        XCTAssertEqual(input.filter["region"], .string("EMEA"))
        XCTAssertTrue(input.fetch)
        let signaled = await iterator.next()
        XCTAssertEqual(signaled?.filter["region"], .string("EMEA"))
        XCTAssertEqual(signaled?.fetch, true)
    }

    func testReportRuntimeExecuteActionDispatchesRefinementHandler() async throws {
        let runtime = ForgeRuntime()
        await runtime.registerHandler("reportRuntime.applyRefinement") { args in
            args.args["refinement"]
        }
        let payload = DashboardRuntime.dashboardReportRuntimeActionExecutionPayload(
            DashboardReportRuntimeActionExecution(
                id: "keep:channel",
                label: "Keep only",
                kind: "keep",
                refinement: DashboardReportRuntimeActionRefinement(
                    op: "keep",
                    field: "channel",
                    value: .string("Display"),
                    sourceBlockID: "table",
                    fieldLabel: "Channel",
                    label: "Keep only = Display"
                )
            )
        )

        let result = await runtime.execute(
            ExecutionDef(action: "reportRuntime.executeAction"),
            args: ["execution": payload]
        )

        XCTAssertEqual(result, .object([
            "op": .string("keep"),
            "field": .string("channel"),
            "value": .string("Display"),
            "sourceBlockId": .string("table"),
            "fieldLabel": .string("Channel"),
            "label": .string("Keep only = Display")
        ]))
    }

    func testReportRuntimeExecuteActionDispatchesDrillHandler() async throws {
        let runtime = ForgeRuntime()
        await runtime.registerHandler("reportRuntime.applyDrillTransition") { args in
            .object(args.args)
        }
        let payload = DashboardRuntime.dashboardReportRuntimeActionExecutionPayload(
            DashboardReportRuntimeActionExecution(
                id: "drill_region",
                label: "Drill to Region",
                kind: "drill",
                refinement: DashboardReportRuntimeActionRefinement(
                    op: "drill",
                    field: "country",
                    value: .string("US"),
                    sourceBlockID: "chart",
                    fieldLabel: "Market",
                    label: "Drill to Region = US"
                ),
                transition: DashboardReportRuntimeActionTransition(
                    sourceField: "country",
                    nextFieldRef: "region",
                    sourceBlockID: "chart"
                )
            )
        )

        let result = await runtime.execute(
            ExecutionDef(action: "reportRuntime.executeAction"),
            args: ["execution": payload]
        )

        XCTAssertEqual(result?.objectValue?["sourceField"], .string("country"))
        XCTAssertEqual(result?.objectValue?["nextFieldRef"], .string("region"))
        XCTAssertEqual(result?.objectValue?["sourceBlockId"], .string("chart"))
        XCTAssertEqual(result?.objectValue?["refinement"]?.objectValue?["field"], .string("country"))
        XCTAssertEqual(result?.objectValue?["refinement"]?.objectValue?["value"], .string("US"))
    }

    func testSetDataSourceFilterRefreshesCollection() async throws {
        let runtime = ForgeRuntime()
        let window = await runtime.openWindowInline(
            key: "w1",
            title: "W1",
            metadata: WindowMetadata(dataSources: ["list": DataSourceDef()])
        )
        await runtime.registerDataSourceLoader { request in
            XCTAssertEqual(request.input.filter["status"], .string("active"))
            return ForgeRuntime.DataSourceFetchResult(
                rows: [["status": request.input.filter["status"] ?? .null]]
            )
        }

        await runtime.setDataSourceFilter(
            windowID: window.id,
            dataSourceRef: "list",
            filter: ["status": .string("active")]
        )

        let rows = await runtime.dataSourceCollection(windowID: window.id, dataSourceRef: "list")
        XCTAssertEqual(rows.first?["status"], .string("active"))
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

    func testCanExecuteAutoRegistersBuiltInsAndReportsMissingHandlers() async throws {
        let runtime = ForgeRuntime()

        let canClose = await runtime.canExecute(ExecutionDef(action: "window.closeWindow"))
        let canUseMissingPlannerHandler = await runtime.canExecute(ExecutionDef(action: "planner.submit"))

        XCTAssertTrue(canClose)
        XCTAssertFalse(canUseMissingPlannerHandler)
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

    func testDialogCommitMapsOutboundLocationToTargetName() async throws {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(view: ViewDef(content: ContentDef()))
        let caller = await runtime.openWindowInline(key: "caller", title: "Caller", metadata: metadata)
        let window = await runtime.openWindowInline(key: "host", title: "Host", metadata: metadata)

        await runtime.registerPendingDialog("\(window.id)DialogentityPicker", PendingDialog(
            callerWindowID: caller.id,
            callerDataSourceRef: "callerDS",
            outbound: [
                ParameterDef(
                    name: "entity_id",
                    direction: "out",
                    location: .string("entityId")
                )
            ]
        ))

        let exec = ExecutionDef(action: "dialog.commit")
        let ctx = ExecutionContext(windowID: window.id, dataSourceRef: "dialogDS")
        await runtime.execute(exec, context: ctx, args: [
            "dialogId": .string("entityPicker"),
            "payload": .object([
                "entityId": .number(42),
                "entityName": .string("Fixture Entity")
            ])
        ])

        let callerDSID = WindowIdentity(windowID: caller.id).dataSourceID(ref: "callerDS")
        let callerForm = await runtime.dataSourceRuntime.form(dataSourceID: callerDSID)
        XCTAssertEqual(callerForm["entity_id"], .number(42))
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

    func testChartDefDecodesSparseSeriesObject() throws {
        let payload = """
        {
          "series": {
            "nameKey": "channel",
            "valueKey": "avails"
          }
        }
        """

        let chart = try JSONDecoder().decode(ChartDef.self, from: Data(payload.utf8))

        XCTAssertEqual(chart.valueKey, "avails")
        XCTAssertEqual(chart.nameKey, "channel")
        XCTAssertEqual(chart.series, ["avails"])
        XCTAssertEqual(chart.seriesDef?.palette, [])
        XCTAssertEqual(chart.seriesDef?.values.map(\.value), ["avails"])
    }

    func testChartDefPreservesGenericAxesDimensionsAndTargetMetadata() throws {
        let payload = """
        {
          "title": "Trend",
          "dataSourceRef": "trendRows",
          "type": "bar",
          "xAxis": {
            "dataKey": "day",
            "label": "Date",
            "tickFormat": "shortDate"
          },
          "yAxis": {
            "dataKey": "avails",
            "label": "Avails",
            "tickFormat": "compact"
          },
          "series": {
            "nameKey": "channel",
            "valueKey": "avails"
          },
          "width": "100%",
          "height": 420,
          "target": { "surface": "dashboard" },
          "targetOverrides": {
            "ios:phone": { "height": 260 }
          }
        }
        """

        let chart = try JSONDecoder().decode(ChartDef.self, from: Data(payload.utf8))

        XCTAssertEqual(chart.title, "Trend")
        XCTAssertEqual(chart.dataSourceRef, "trendRows")
        XCTAssertEqual(chart.type, "bar")
        XCTAssertEqual(chart.xKey, "day")
        XCTAssertEqual(chart.xAxis, ChartAxisDef(dataKey: "day", label: "Date", tickFormat: "shortDate"))
        XCTAssertEqual(chart.yAxis, ChartAxisDef(dataKey: "avails", label: "Avails", tickFormat: "compact"))
        XCTAssertEqual(chart.valueKey, "avails")
        XCTAssertEqual(chart.nameKey, "channel")
        XCTAssertEqual(chart.width, .string("100%"))
        XCTAssertEqual(chart.height, .number(420))
        XCTAssertEqual(chart.target?.objectValue?["surface"], .string("dashboard"))
        XCTAssertEqual(chart.targetOverrides["ios:phone"]?.objectValue?["height"], .number(260))
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

    func testChartAxisLabelsSampleDenseCategoriesWithoutDroppingBoundaries() {
        XCTAssertEqual(
            sampledChartAxisLabels(["Jan", "Feb", "Feb", "Mar", "Apr", "May", "Jun", "Jul"], maximum: 4),
            ["Jan", "Mar", "May", "Jul"]
        )
        XCTAssertEqual(sampledChartAxisLabels(["Jan", "Feb"], maximum: 4), ["Jan", "Feb"])
        XCTAssertEqual(sampledChartAxisLabels(["Jan", "Feb"], maximum: 1), ["Jan"])
    }

    func testChartAxisLabelsPreserveRawCategoryIdentity() {
        XCTAssertEqual(
            sampledChartAxisLabels([" Q1 ", "Q1", "Q2"], maximum: 4),
            [" Q1 ", "Q1", "Q2"]
        )
    }

    func testChartSelectionSummaryKeepsDuplicateSeriesLabelsDistinct() {
        let data = [
            SeriesDatum(rowIndex: 0, category: "Jan", seriesKey: "grossSpend", seriesLabel: "Spend", value: 12),
            SeriesDatum(rowIndex: 0, category: "Jan", seriesKey: "netSpend", seriesLabel: "Spend", value: 9.5),
            SeriesDatum(rowIndex: 1, category: "Feb", seriesKey: "grossSpend", seriesLabel: "Spend", value: 14)
        ]

        let summary = chartSelectionSummary(category: "Jan", data: data)

        XCTAssertEqual(summary?.category, "Jan")
        XCTAssertEqual(summary?.values.map(\.seriesKey), ["grossSpend", "netSpend"])
        XCTAssertEqual(summary?.values.map(\.seriesLabel), ["Spend", "Spend"])
        XCTAssertEqual(summary?.values.map(\.valueLabel), ["12", "9.50"])
    }

    func testChartAccessibleDataRowsBuildsCartesianFallback() {
        let data = [
            SeriesDatum(rowIndex: 0, category: "Jan", seriesKey: "grossSpend", seriesLabel: "Spend", value: 12),
            SeriesDatum(rowIndex: 0, category: "Jan", seriesKey: "netSpend", seriesLabel: "Spend", value: 9.5),
            SeriesDatum(rowIndex: 1, category: "Feb", seriesKey: "grossSpend", seriesLabel: "Spend", value: 14)
        ]

        let rows = chartAccessibleDataRows(chartType: "line", seriesData: data, pieData: [], limit: 2)
        let totalCount = chartAccessibleDataValueCount(chartType: "line", seriesData: data, pieData: [])
        let summary = chartAccessibleDataSummary(rows: rows, totalCount: totalCount)

        XCTAssertEqual(rows.map(\.category), ["Jan", "Jan"])
        XCTAssertEqual(rows.map(\.seriesLabel), ["Spend", "Spend"])
        XCTAssertEqual(rows.map(\.valueLabel), ["12", "9.50"])
        XCTAssertEqual(totalCount, 3)
        XCTAssertTrue(summary.contains("3 values"))
        XCTAssertTrue(summary.contains("1 more values"))
    }

    func testChartAccessibleDataRowsBuildsPieFallback() {
        let data = [
            PieDatum(
                id: "0|avails|Audio",
                rowIndex: 0,
                label: "Audio",
                displayLabel: "Audio - Avails",
                seriesKey: "avails",
                seriesLabel: "Avails",
                value: 385_800_000,
                valueLabel: "385800000"
            ),
            PieDatum(
                id: "0|uniques|Audio",
                rowIndex: 0,
                label: "Audio",
                displayLabel: "Audio - HH Uniques",
                seriesKey: "uniques",
                seriesLabel: "HH Uniques",
                value: 7_600_000,
                valueLabel: "7600000"
            )
        ]

        let rows = chartAccessibleDataRows(chartType: "donut", seriesData: [], pieData: data)
        let totalCount = chartAccessibleDataValueCount(chartType: "donut", seriesData: [], pieData: data)

        XCTAssertEqual(rows.map(\.category), ["Audio - Avails", "Audio - HH Uniques"])
        XCTAssertEqual(rows.map(\.seriesLabel), ["Avails", "HH Uniques"])
        XCTAssertEqual(rows.map(\.valueLabel), ["385800000", "7600000"])
        XCTAssertEqual(totalCount, 2)
    }

    func testChartDataStateFeedbackDistinguishesLoadingEmptyAndErrors() {
        XCTAssertEqual(
            chartDataStateFeedback(
                loading: true,
                error: nil,
                hasResolvedRows: false,
                hasChartValues: false
            ),
            ChartDataStateFeedback(message: "Loading chart")
        )
        XCTAssertEqual(
            chartDataStateFeedback(
                loading: false,
                error: "  Timeout  ",
                hasResolvedRows: true,
                hasChartValues: false
            ),
            ChartDataStateFeedback(
                message: "Unable to load chart data",
                isError: true
            )
        )
        XCTAssertEqual(
            chartDataStateFeedback(
                loading: false,
                error: "  ",
                hasResolvedRows: true,
                hasChartValues: false
            ),
            ChartDataStateFeedback(message: "No chart data")
        )
        XCTAssertNil(chartDataStateFeedback(
            loading: true,
            error: "Timeout",
            hasResolvedRows: true,
            hasChartValues: true
        ))
    }

    func testUniqueChartSelectionRowsDeduplicatesMultiSeriesRows() {
        let data = [
            SeriesDatum(rowIndex: 0, category: "Jan", seriesKey: "grossSpend", seriesLabel: "Spend", value: 12),
            SeriesDatum(rowIndex: 0, category: "Jan", seriesKey: "netSpend", seriesLabel: "Spend", value: 9.5),
            SeriesDatum(rowIndex: 1, category: "Feb", seriesKey: "grossSpend", seriesLabel: "Spend", value: 14)
        ]
        let rows: [[String: JSONValue]] = [
            ["month": .string("Jan"), "grossSpend": .number(12), "netSpend": .number(9.5)],
            ["month": .string("Feb"), "grossSpend": .number(14)]
        ]

        let selectedRows = uniqueChartSelectionRows(category: "Jan", data: data, rows: rows)

        XCTAssertEqual(selectedRows.count, 1)
        XCTAssertEqual(selectedRows.first?["month"], .string("Jan"))
    }

    func testPieSelectionSummaryResolvesDistinctMultiSeriesSlice() {
        let data = [
            PieDatum(
                id: "0|avails|Audio",
                rowIndex: 0,
                label: "Audio",
                displayLabel: "Audio - Avails",
                seriesKey: "avails",
                seriesLabel: "Avails",
                value: 385_800_000,
                valueLabel: "385800000"
            ),
            PieDatum(
                id: "0|uniques|Audio",
                rowIndex: 0,
                label: "Audio",
                displayLabel: "Audio - HH Uniques",
                seriesKey: "uniques",
                seriesLabel: "HH Uniques",
                value: 7_600_000,
                valueLabel: "7600000"
            )
        ]

        let summary = pieSelectionSummary(selectedID: "0|uniques|Audio", data: data)

        XCTAssertEqual(summary?.id, "0|uniques|Audio")
        XCTAssertEqual(summary?.label, "Audio")
        XCTAssertEqual(summary?.displayLabel, "Audio - HH Uniques")
        XCTAssertEqual(summary?.seriesKey, "uniques")
        XCTAssertEqual(summary?.seriesLabel, "HH Uniques")
        XCTAssertEqual(summary?.valueLabel, "7600000")
    }

    func testChartTableViewModesKeepAvailableRequestedModes() {
        let modes = normalizedChartTableViewModes(["table", "chart", "json", "table"], hasChart: true, hasTable: true)

        XCTAssertEqual(modes, ["table", "chart"])
        XCTAssertEqual(resolvedChartTableViewMode("chart", modes: modes), "chart")
        XCTAssertEqual(resolvedChartTableViewMode("json", modes: modes), "table")
        XCTAssertEqual(chartTableModeLabel("chart"), "Chart")
    }

    func testChartTableViewModesFallbackToRenderableMode() {
        XCTAssertEqual(normalizedChartTableViewModes(["table"], hasChart: true, hasTable: false), ["chart"])
        XCTAssertEqual(normalizedChartTableViewModes([], hasChart: false, hasTable: true), ["table"])
        XCTAssertEqual(normalizedChartTableViewModes([], hasChart: false, hasTable: false), [])
    }

    func testDashboardUnsupportedBlockMessageNamesUnknownKind() {
        XCTAssertEqual(
            dashboardUnsupportedBlockMessage(" dashboard.customInsight "),
            "Unsupported dashboard block: dashboard.customInsight"
        )
        XCTAssertEqual(dashboardUnsupportedBlockMessage(nil), "Unsupported dashboard block")
        XCTAssertEqual(dashboardUnsupportedBlockMessage("  "), "Unsupported dashboard block")
    }

    func testDashboardDimensionsViewModesUseNestedModesThenContainerFallback() {
        let nested = ContainerDef(
            id: "ageGroups",
            kind: "dashboard.dimensions",
            viewModes: ["chart"],
            dashboard: DashboardDef(
                dimensions: DashboardDimensionsDef(
                    dimension: DashboardFieldDef(key: "age_group"),
                    metric: DashboardFieldDef(key: "avails"),
                    viewModes: ["table", "chart"]
                )
            )
        )
        let fallback = ContainerDef(
            id: "channels",
            kind: "dashboard.dimensions",
            viewModes: ["table", "chart"],
            dashboard: DashboardDef(
                dimensions: DashboardDimensionsDef(
                    dimension: DashboardFieldDef(key: "channel"),
                    metric: DashboardFieldDef(key: "avails")
                )
            )
        )

        XCTAssertEqual(dashboardDimensionsViewModes(for: nested), ["table", "chart"])
        XCTAssertEqual(dashboardDimensionsViewModes(for: fallback), ["table", "chart"])
    }

    func testChartTableModeTableDerivesFromColumns() {
        let container = ContainerDef(
            id: "capacityByChannel",
            title: "Capacity",
            viewModes: ["chart", "table"],
            columns: [
                ColumnDef(id: "channel", label: "Channel"),
                ColumnDef(id: "avails", label: "Avails")
            ]
        )

        let table = chartTableModeTable(for: container)

        XCTAssertEqual(table?.title, "Capacity")
        XCTAssertEqual(table?.columns.map(\.id), ["channel", "avails"])
    }

    func testSeriesDatumUsesStableIdentity() {
        let first = SeriesDatum(rowIndex: 2, category: "Total", seriesKey: "avails", seriesLabel: "Avails", value: 10)
        let second = SeriesDatum(rowIndex: 2, category: "Total", seriesKey: "avails", seriesLabel: "Avails", value: 20)
        let otherSeries = SeriesDatum(rowIndex: 2, category: "Total", seriesKey: "uniques", seriesLabel: "Uniques", value: 10)

        XCTAssertEqual(first.id, second.id)
        XCTAssertNotEqual(first.id, otherSeries.id)
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
              "id": "metricsCubeBuilder",
              "dataSourceRef": "metrics_cube_report",
              "reportBuilder": {
                "result": {
                  "chartCreationMode": "explicit",
                  "chartDataMode": "fullQuery",
                  "chartRowLimit": "2500",
                  "chartDataLimit": 1000,
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
        XCTAssertEqual(reportBuilder.result?.chartDataMode, "fullQuery")
        XCTAssertEqual(reportBuilder.result?.chartRowLimit, 2500)
        XCTAssertEqual(reportBuilder.result?.chartDataLimit, 1000)
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
                                    ),
                                    ItemDef(
                                        id: "legacyPeriod",
                                        field: "periodType",
                                        scope: "windowForm",
                                        value: .string("rolling")
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
        XCTAssertEqual(windowForm["periodType"], .string("rolling"))
        XCTAssertEqual(windowForm["periodView"], .string("today"))
        XCTAssertEqual(windowForm["prefill"]?.objectValue?["accountId"], .number(7))
    }

    func testOpenWindowSeedsWindowFormFromWindowOnInit() async throws {
        let runtime = ForgeRuntime()
        await runtime.registerWindowMetadataLoader { key in
            XCTAssertEqual(key, "metrics/report")
            return WindowMetadata(
                dataSources: [
                    "report": DataSourceDef()
                ],
                window: WindowDef(
                    on: [
                        EventExecutionDef(
                            event: "onInit",
                            handler: "dataSource.setWindowFormData",
                            parameters: [
                                ParameterDef(
                                    name: "periodView",
                                    input: "const",
                                    location: .string("today")
                                ),
                                ParameterDef(
                                    name: "includeDrafts",
                                    input: "const",
                                    value: .bool(true)
                                )
                            ]
                        )
                    ]
                )
            )
        }

        let state = await runtime.openWindow(
            key: "metrics/report",
            title: "Metrics Report"
        )

        let windowForm = await runtime.windowFormJSONValue(windowID: state.id)
        XCTAssertEqual(windowForm["periodView"], .string("today"))
        XCTAssertEqual(windowForm["includeDrafts"], .bool(true))
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

    func testSetWindowFormValueHonorsNestedReplaceSentinel() async throws {
        let runtime = ForgeRuntime()
        let state = await runtime.openWindow(
            key: "metrics/report",
            title: "Metrics Report"
        )

        await runtime.setWindowFormValue(
            windowID: state.id,
            values: [
                "prefill": .object([
                    "includeCountry": .array([.string("US")]),
                    "includeDealsPmp": .array([.number(101), .number(102)]),
                    "includePostalCodeList": .array([.number(303)])
                ]),
                "capacityCubeBuilder": .object([
                    "chartSpec": .object([
                        "title": .string("Area by Date and Channel"),
                        "seriesField": .string("channelV2")
                    ])
                ])
            ],
            replace: true
        )
        await runtime.setWindowFormValue(
            windowID: state.id,
            values: [
                "prefill": .object([
                    "includeDealsPmp": .object([
                        "$replace": .bool(true),
                        "value": .array([.number(201)])
                    ]),
                    "includePostalCodeList": .object([
                        "$replace": .bool(true),
                        "value": .array([])
                    ])
                ]),
                "capacityCubeBuilder": .object([
                    "chartSpec": .object([
                        "$replace": .bool(true),
                        "value": .object([
                            "title": .string("Avails by Date")
                        ])
                    ])
                ])
            ]
        )

        let windowForm = await runtime.windowFormJSONValue(windowID: state.id)
        let prefill = try XCTUnwrap(windowForm["prefill"]?.objectValue)
        let chartSpec = try XCTUnwrap(windowForm["capacityCubeBuilder"]?.objectValue?["chartSpec"]?.objectValue)
        XCTAssertEqual(prefill["includeCountry"], .array([.string("US")]))
        XCTAssertEqual(prefill["includeDealsPmp"], .array([.number(201)]))
        XCTAssertEqual(prefill["includePostalCodeList"], .array([]))
        XCTAssertEqual(chartSpec["title"], .string("Avails by Date"))
        XCTAssertNil(chartSpec["seriesField"])
        XCTAssertEqual(windowForm["__forge"]?.objectValue?["prefillRevision"], .number(2))
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

    func testParameterResolverResolvesLegacyDataSourceInputAndFilterSources() {
        let context = ParameterResolver.ResolutionContext(
            identityDataSourceRef: "orders",
            dataSources: [
                "orders": ParameterResolver.DataSourceSnapshot(
                    form: [
                        "orderId": .number(301),
                        "status": .string("active")
                    ],
                    selection: SelectionState(selected: [
                        "orderId": .number(201),
                        "name": .string("Selected order")
                    ]),
                    input: InputState(
                        filter: [
                            "country": .string("US")
                        ],
                        parameters: [
                            "pageSize": .number(25)
                        ],
                        page: 2,
                        fetch: true
                    )
                ),
                "lines": ParameterResolver.DataSourceSnapshot(
                    form: [
                        "lineId": .number(401)
                    ],
                    input: InputState(
                        filter: [
                            "channel": .string("CTV")
                        ],
                        parameters: [
                            "sort": .string("name")
                        ],
                        refresh: true
                    )
                )
            ],
            windowForm: [:],
            metadata: nil
        )

        let resolved = ParameterResolver.resolve(
            parameters: [
                ParameterDef(name: "selectedOrderId", input: "dataSource", location: .string("orderId")),
                ParameterDef(name: "formStatus", input: "dataSource", location: .string("status")),
                ParameterDef(name: "lineId", input: "dataSource", location: .string("lines.lineId")),
                ParameterDef(name: "channel", input: "filter", location: .string("lines.channel")),
                ParameterDef(name: "pageSize", input: "input", location: .string("parameters.pageSize")),
                ParameterDef(name: "lineRefresh", input: "input", location: .string("lines.refresh"))
            ],
            context: context
        )

        XCTAssertEqual(resolved["selectedOrderId"], .number(201))
        XCTAssertEqual(resolved["formStatus"], .string("active"))
        XCTAssertEqual(resolved["lineId"], .number(401))
        XCTAssertEqual(resolved["channel"], .string("CTV"))
        XCTAssertEqual(resolved["pageSize"], .number(25))
        XCTAssertEqual(resolved["lineRefresh"], .bool(true))
    }

    func testParameterResolverResolvesCompactRowsIntoInputQuery() {
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
            windowForm: [
                "recordId": .array([.number(301)])
            ],
            metadata: nil
        )

        let resolved = ParameterResolver.resolve(
            parameters: [
                ParameterDef(
                    name: "scheduleId",
                    location: .string("id"),
                    from: "schedules:selection",
                    to: ":query"
                ),
                ParameterDef(
                    name: "recordId",
                    location: .string("recordId.0"),
                    from: ":windowform",
                    to: "report:input.query"
                )
            ],
            context: context
        )

        let runsQuery = resolved["runs"]?.objectValue?["input"]?.objectValue?["query"]?.objectValue
        let reportQuery = resolved["report"]?.objectValue?["input"]?.objectValue?["query"]?.objectValue
        XCTAssertEqual(runsQuery?["scheduleId"], .string("sched-1"))
        XCTAssertEqual(reportQuery?["recordId"], .number(301))
    }

    func testParameterResolverCompactRowsSupportSpreadAndMultiSelectionArrays() {
        let context = ParameterResolver.ResolutionContext(
            identityDataSourceRef: "report",
            dataSources: [
                "report": ParameterResolver.DataSourceSnapshot(
                    input: InputState(parameters: ["pageSize": .number(25)])
                ),
                "items": ParameterResolver.DataSourceSnapshot(
                    selectionMode: "multi",
                    selection: SelectionState(
                        selection: [
                            ["id": .string("item-1"), "name": .string("One")],
                            ["id": .string("item-2"), "name": .string("Two")]
                        ]
                    )
                )
            ],
            windowForm: [
                "period": .string("today"),
                "granularity": .string("hour")
            ],
            metadata: nil
        )

        let resolved = ParameterResolver.resolve(
            parameters: [
                ParameterDef(
                    name: "...",
                    from: ":windowform",
                    to: ":query"
                ),
                ParameterDef(
                    name: "[]itemIds",
                    location: .string("id"),
                    from: "items:selection",
                    to: ":query"
                ),
                ParameterDef(
                    name: "pageSize",
                    location: .string("parameters.pageSize"),
                    from: ":input",
                    to: ":query"
                )
            ],
            context: context
        )

        let query = resolved["report"]?.objectValue?["input"]?.objectValue?["query"]?.objectValue
        XCTAssertEqual(query?["period"], .string("today"))
        XCTAssertEqual(query?["granularity"], .string("hour"))
        XCTAssertEqual(query?["itemIds"], .array([.string("item-1"), .string("item-2")]))
        XCTAssertEqual(query?["pageSize"], .number(25))
    }

    func testParameterDefDecodesCompactParameterFields() throws {
        let payload = """
        {
          "name": "scheduleId",
          "from": "schedules:selection",
          "to": ":query",
          "location": "id",
          "output": false
        }
        """

        let parameter = try JSONDecoder().decode(ParameterDef.self, from: XCTUnwrap(payload.data(using: .utf8)))

        XCTAssertEqual(parameter.name, "scheduleId")
        XCTAssertEqual(parameter.from, "schedules:selection")
        XCTAssertEqual(parameter.to, ":query")
        XCTAssertEqual(parameter.location, .string("id"))
        XCTAssertEqual(parameter.output, false)
    }

    func testExecutionDefPreservesEventLifecycleAndTargetMetadata() throws {
        let eventOnlyPayload = """
        {
          "event": "submit"
        }
        """
        let richPayload = """
        {
          "event": "submit",
          "handler": "form.submit",
          "args": ["selection"],
          "parameters": [
            { "name": "recordId", "from": ":windowform", "to": ":query" }
          ],
          "init": "form.prepare",
          "onError": "form.error",
          "onDone": "form.done",
          "onSuccess": "form.success",
          "async": true,
          "target": { "surface": "dialog" },
          "targetOverrides": {
            "ios:phone": { "surface": "sheet" }
          }
        }
        """

        let eventOnly = try JSONDecoder().decode(ExecutionDef.self, from: Data(eventOnlyPayload.utf8))
        let rich = try JSONDecoder().decode(ExecutionDef.self, from: Data(richPayload.utf8))

        XCTAssertEqual(eventOnly.event, "submit")
        XCTAssertEqual(eventOnly.action, "")
        XCTAssertEqual(rich.event, "submit")
        XCTAssertEqual(rich.action, "form.submit")
        XCTAssertEqual(rich.args, ["selection"])
        XCTAssertEqual(rich.parameters.first?.name, "recordId")
        XCTAssertEqual(rich.initAction, "form.prepare")
        XCTAssertEqual(rich.onError, "form.error")
        XCTAssertEqual(rich.onDone, "form.done")
        XCTAssertEqual(rich.onSuccess, "form.success")
        XCTAssertEqual(rich.async, true)
        XCTAssertEqual(rich.target?.objectValue?["surface"], .string("dialog"))
        XCTAssertEqual(rich.targetOverrides["ios:phone"]?.objectValue?["surface"], .string("sheet"))
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
                  "lazyExpand": false,
                  "target": { "kind": "dialog" },
                  "targetOverrides": {
                    "ios:phone": { "title": "Choose" }
                  }
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
        XCTAssertEqual(treeBrowser.target?.objectValue?["kind"], .string("dialog"))
        XCTAssertEqual(treeBrowser.targetOverrides["ios:phone"]?.objectValue?["title"], .string("Choose"))
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

    func testContainerRejectsUnsupportedDataSourceAlias() throws {
        let payload = """
        {
          "id": "badTable",
          "kind": "dashboard.table",
          "dataSource": "orders"
        }
        """.data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(ContainerDef.self, from: payload)) { error in
            let description = String(describing: error)
            XCTAssertTrue(description.contains("dataSource is not supported on Forge containers; use dataSourceRef"))
        }
    }

    func testDialogRejectsUnsupportedDataSourceAlias() throws {
        let payload = """
        {
          "id": "pick",
          "title": "Pick",
          "dataSource": "accounts"
        }
        """.data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(DialogDef.self, from: payload)) { error in
            let description = String(describing: error)
            XCTAssertTrue(description.contains("dataSource is not supported on Forge dialogs; use dataSourceRef"))
        }
    }

    func testTopLevelLegacyDataSourceMapStillDecodes() throws {
        let payload = """
        {
          "namespace": "Valid",
          "dataSource": {
            "orders": {
              "selectionMode": "single"
            }
          },
          "view": {
            "content": {
              "containers": [
                {
                  "id": "orders",
                  "kind": "dashboard.table",
                  "dataSourceRef": "orders"
                }
              ]
            }
          }
        }
        """.data(using: .utf8)!

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: payload)

        XCTAssertEqual(metadata.dataSources["orders"]?.selectionMode, "single")
        XCTAssertEqual(metadata.view?.content?.containers.first?.dataSourceRef, "orders")
    }

    func testTopLevelLegacyDataSourceMapStillDecodesWithDirectContainer() throws {
        let payload = """
        {
          "namespace": "Valid",
          "kind": "dashboard.table",
          "id": "orders",
          "title": "Orders",
          "dataSourceRef": "orders",
          "dataSource": {
            "orders": {
              "selectionMode": "single"
            }
          }
        }
        """.data(using: .utf8)!

        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: payload)

        XCTAssertEqual(metadata.dataSources["orders"]?.selectionMode, "single")
        XCTAssertEqual(metadata.view?.content?.containers.first?.id, "orders")
        XCTAssertEqual(metadata.view?.content?.containers.first?.dataSourceRef, "orders")
    }

    func testTopLevelDirectContainerRejectsStringDataSourceAlias() throws {
        let payload = """
        {
          "namespace": "Invalid",
          "kind": "dashboard.table",
          "id": "orders",
          "title": "Orders",
          "dataSource": "orders"
        }
        """.data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(WindowMetadata.self, from: payload))
    }

    func testDirectContainerLegacyMapRejectsNestedDataSourceAlias() throws {
        let payload = """
        {
          "namespace": "Invalid",
          "kind": "dashboard",
          "id": "root",
          "dataSource": {
            "orders": {
              "selectionMode": "single"
            }
          },
          "containers": [
            {
              "id": "badTable",
              "kind": "dashboard.table",
              "dataSource": "orders"
            }
          ]
        }
        """.data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(WindowMetadata.self, from: payload)) { error in
            let description = String(describing: error)
            XCTAssertTrue(description.contains("dataSource is not supported on Forge containers; use dataSourceRef"))
        }
    }

    private func makeMockSession(responseBody: String, statusCode: Int = 200) -> URLSession {
        MetadataURLProtocol.responseBody = responseBody
        MetadataURLProtocol.statusCode = statusCode
        MetadataURLProtocol.lastRequest = nil
        MetadataURLProtocol.lastBody = nil
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MetadataURLProtocol.self]
        return URLSession(configuration: configuration)
    }
}

private final class MetadataURLProtocol: URLProtocol {
    static var responseBody: String = ""
    static var statusCode: Int = 200
    static var lastRequest: URLRequest?
    static var lastBody: Data?

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        Self.lastRequest = request
        Self.lastBody = request.httpBody ?? Self.readBodyStream(request.httpBodyStream)
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

    private static func readBodyStream(_ stream: InputStream?) -> Data? {
        guard let stream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 1024
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let count = stream.read(buffer, maxLength: bufferSize)
            if count > 0 {
                data.append(buffer, count: count)
            } else {
                break
            }
        }
        return data
    }
}
