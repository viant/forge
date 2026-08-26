import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

final class ReportBuilderAuthoredRuntimeTests: XCTestCase {
    func testRestoredIntegerFilterSelectionIsCoercedBeforeFetch() throws {
        let filter = try JSONDecoder().decode(
            ReportBuilderDynamicFilterDef.self,
            from: Data(#"{"id":"order","manualValueType":"int"}"#.utf8)
        )

        XCTAssertEqual(
            ReportBuilderRenderer.coerceSelectionValue(filter: filter, rawValue: .string("2672373")),
            .number(2672373)
        )
        XCTAssertEqual(
            ReportBuilderRenderer.coerceSelectionValue(filter: filter, rawValue: .number(2672373)),
            .number(2672373)
        )
    }

    func testWindowPrefillScopesPublishedRequestWhenLegacySelectionIsDepthLimited() throws {
        let config = try JSONDecoder().decode(
            DashboardReportBuilderDef.self,
            from: Data(#"{"dataSources":[{"id":"delivery_summary","dataSourceRef":"metrics_ad_cube_report"}],"predicates":[{"id":"dateRange","kind":"dateRange","startParamPath":"filters.From","endParamPath":"filters.To"},{"id":"orderIds","kind":"dynamic","bucket":"scope","paramPath":"filters.orderIds","multiple":true,"emitArray":true,"manualValueType":"int"}]}"#.utf8)
        )
        let lowered = lowerReportBuilderPredicates(config)
        XCTAssertEqual(lowered.dataSources.map(\.id), ["delivery_summary"])
        let request = ReportBuilderRenderer.applyWindowFormPrefill(
            config: lowered,
            request: [:],
            windowForm: [
                "prefill": .object([
                    "from": .string("2026-07-27"),
                    "to": .string("2026-08-03"),
                    "orderIds": .array([.number(2672373)])
                ])
            ]
        )

        let filters = try XCTUnwrap(request["filters"]?.objectValue)
        XCTAssertEqual(filters["From"], .string("2026-07-27"))
        XCTAssertEqual(filters["To"], .string("2026-08-03"))
        XCTAssertEqual(filters["orderIds"], .array([.number(2672373)]))
    }

    func testReportBuilderDecodesPublishedDataSources() throws {
        let value: JSONValue = .object([
            "dataSources": .array([
                .object([
                    "id": .string("delivery_today"),
                    "dataSourceRef": .string("metrics_ad_cube_report"),
                    "request": .object([
                        "measures": .object(["totalSpend": .bool(true)]),
                        "dimensions": .object([:]),
                        "limit": .number(1)
                    ]),
                    "scope": .object([
                        "mode": .string("override"),
                        "relativeDateRange": .object([
                            "preset": .string("today"),
                            "startParamPath": .string("filters.From"),
                            "endParamPath": .string("filters.To")
                        ])
                    ]),
                    "fields": .array([
                        .object(["key": .string("eventDate"), "kind": .string("dimension")]),
                        .object(["key": .string("totalSpend"), "kind": .string("measure")])
                    ]),
                    "scopeParams": .array([
                        .object(["key": .string("orderIds"), "paramPath": .string("filters.orderIds")])
                    ])
                ])
            ])
        ])
        let config = try JSONDecoder().decode(
            DashboardReportBuilderDef.self,
            from: JSONEncoder().encode(value)
        )

        XCTAssertEqual(config.dataSources.count, 1)
        XCTAssertEqual(config.dataSources.first?.id, "delivery_today")
        XCTAssertEqual(config.dataSources.first?.dataSourceRef, "metrics_ad_cube_report")
        XCTAssertEqual(config.dataSources.first?.request["limit"], .number(1))
        XCTAssertEqual(config.dataSources.first?.fields.count, 2)
        XCTAssertEqual(config.dataSources.first?.scopeParams.count, 1)
    }

    func testAuthoredDocumentPrefersStateBlocksOverDepthLimitedDefinition() {
        let windowForm: [String: JSONValue] = [
            "reportDefinition": .object([
                "documentPatch": .object([
                    "title": .string("Operations"),
                    "blocks": .array([.object(["id": .string("truncated")])])
                ])
            ]),
            "reportBuilderState": .object([
                "reportDocumentBlocks": .array([
                    .object([
                        "id": .string("chart"),
                        "kind": .string("chartBlock"),
                        "chartSpec": .object(["xField": .string("eventDate")])
                    ])
                ])
            ])
        ]

        let document = reportBuilderAuthoredDocument(windowForm)

        XCTAssertEqual(document?["title"], .string("Operations"))
        XCTAssertEqual(document?["blocks"]?.arrayValue?.first?.objectValue?["id"], .string("chart"))
    }

    func testAuthoredDocumentRestoresNestedLegacyBuilderDocument() {
        let form: [String: JSONValue] = [
            "reportBuilder:metricsCubeBuilder": .object([
                "reportDocument": .object([
                    "title": .string("Order Performance Report"),
                    "blocks": .array([
                        .object(["id": .string("overview"), "kind": .string("sectionBlock")])
                    ])
                ]),
                "reportDocumentBlocks": .array([
                    .object(["id": .string("overview"), "kind": .string("sectionBlock"), "title": .string("Overview")])
                ])
            ])
        ]

        let document = reportBuilderAuthoredDocument(form)

        XCTAssertEqual(document?["title"], .string("Order Performance Report"))
        XCTAssertEqual(document?["blocks"]?.arrayValue?.first?.objectValue?["title"], .string("Overview"))
    }

    func testPublishedSourcesFollowDocumentOrderButFetchCheapKPIsFirst() {
        let document: [String: JSONValue] = [
            "blocks": .array([
                .object(["datasetRef": .string("detail")]),
                .object(["datasetRef": .string("today")]),
                .object(["datasetRef": .string("yesterday")])
            ])
        ]
        let config = DashboardReportBuilderDef(dataSources: [
            ReportBuilderPublishedDataSourceDef(
                id: "detail",
                dataSourceRef: "cube",
                request: ["dimensions": .object(["channel": .bool(true)]), "limit": .number(100)]
            ),
            ReportBuilderPublishedDataSourceDef(
                id: "today",
                dataSourceRef: "cube",
                request: ["dimensions": .object([:]), "limit": .number(1)]
            ),
            ReportBuilderPublishedDataSourceDef(
                id: "yesterday",
                dataSourceRef: "cube",
                request: ["dimensions": .object([:]), "limit": .number(1)]
            )
        ])

        XCTAssertEqual(
            reportBuilderPublishedSources(config: config, document: document).map(\.id),
            ["today", "yesterday", "detail"]
        )
    }

    func testPublishedSourcesDeduplicateRepeatedAuthoredDatasetReferences() {
        let document: [String: JSONValue] = [
            "blocks": .array([
                .object(["datasetRef": .string("delivery_summary_active_range")]),
                .object(["datasetRef": .string("delivery_summary_active_range")]),
                .object(["datasetRef": .string("delivery_summary_active_range")])
            ])
        ]
        let config = DashboardReportBuilderDef(dataSources: [
            ReportBuilderPublishedDataSourceDef(
                id: "delivery_summary_active_range",
                dataSourceRef: "metrics_ad_cube_report"
            ),
            ReportBuilderPublishedDataSourceDef(
                id: "delivery_summary_active_range",
                dataSourceRef: "metrics_ad_cube_report"
            )
        ])

        XCTAssertEqual(
            reportBuilderPublishedSources(config: config, document: document).map(\.id),
            ["delivery_summary_active_range"]
        )
    }

    func testPublishedSourcesPrioritizeFieldOnlyAggregateBeforeDetail() {
        let document: [String: JSONValue] = [
            "blocks": .array([
                .object(["datasetRef": .string("detail")]),
                .object(["datasetRef": .string("summary")])
            ])
        ]
        let config = DashboardReportBuilderDef(dataSources: [
            ReportBuilderPublishedDataSourceDef(
                id: "detail",
                dataSourceRef: "cube",
                fields: [
                    ["key": .string("eventDate"), "kind": .string("dimension")],
                    ["key": .string("totalSpend"), "kind": .string("measure")]
                ]
            ),
            ReportBuilderPublishedDataSourceDef(
                id: "summary",
                dataSourceRef: "cube",
                fields: [
                    ["key": .string("totalSpend"), "kind": .string("measure")],
                    ["key": .string("impressions"), "kind": .string("measure")]
                ]
            )
        ])

        XCTAssertEqual(
            reportBuilderPublishedSources(config: config, document: document).map(\.id),
            ["summary", "detail"]
        )
    }

    func testPublishedRequestRetainsEntityFiltersAndOverridesRelativeDateWindow() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-08-13T12:00:00Z"))
        let declaration = ReportBuilderPublishedDataSourceDef(
            id: "last7",
            dataSourceRef: "cube",
            request: [
                "measures": .object(["totalSpend": .bool(true)]),
                "filters": .object(["channelId": .array([.number(6)])])
            ],
            scope: [
                "mode": .string("override"),
                "relativeDateRange": .object([
                    "preset": .string("last_7_days"),
                    "startParamPath": .string("filters.From"),
                    "endParamPath": .string("filters.To")
                ])
            ]
        )

        let request = reportBuilderPublishedRequest(
            primaryRequest: [
                "filters": .object([
                    "orderId": .array([.number(2676237)]),
                    "From": .string("2026-01-01"),
                    "To": .string("2026-01-31")
                ])
            ],
            declaration: declaration,
            now: now,
            calendar: calendar
        )

        let filters = try XCTUnwrap(request["filters"]?.objectValue)
        XCTAssertEqual(filters["orderId"], .array([.number(2676237)]))
        XCTAssertEqual(filters["channelId"], .array([.number(6)]))
        XCTAssertEqual(filters["From"], .string("2026-08-07"))
        XCTAssertEqual(filters["To"], .string("2026-08-13"))
    }

    func testPublishedRequestDerivesDatasetShapeFromPublishedFieldCatalog() throws {
        let declaration = ReportBuilderPublishedDataSourceDef(
            id: "daily",
            dataSourceRef: "cube",
            fields: [
                ["key": .string("eventDate"), "kind": .string("dimension")],
                ["key": .string("totalSpend"), "kind": .string("measure")],
                ["key": .string("impressions"), "kind": .string("measure")],
                ["key": .string("ecpm"), "kind": .string("computedMeasure")]
            ]
        )

        let request = reportBuilderPublishedRequest(
            primaryRequest: [
                "dimensions": .object(["channelId": .bool(true)]),
                "measures": .object(["clicks": .bool(true)]),
                "filters": .object(["orderIds": .array([.number(2672373)])]),
                "limit": .number(25),
                "semanticSelection": .object(["entity": .string("line_delivery")])
            ],
            declaration: declaration
        )

        XCTAssertEqual(request["dimensions"], .object(["eventDate": .bool(true)]))
        XCTAssertEqual(request["measures"], .object([
            "totalSpend": .bool(true),
            "impressions": .bool(true)
        ]))
        XCTAssertEqual(request["filters"]?.objectValue?["orderIds"], .array([.number(2672373)]))
        XCTAssertNil(request["semanticSelection"])
        XCTAssertEqual(request["orderBy"], .array([.string("totalSpend desc")]))
    }

    func testPublishedComputedRowsMaterializeCtrAndEcpm() throws {
        let rows = reportBuilderMaterializeComputedRows(
            [[
                "clicks": .number(20),
                "impressions": .number(1_000),
                "totalSpend": .number(15)
            ]],
            fields: [
                ["key": .string("ctr"), "kind": .string("computedMeasure")],
                ["key": .string("ecpm"), "kind": .string("computedMeasure")]
            ],
            config: DashboardReportBuilderDef(computedMeasures: [
                ReportBuilderMeasureDef(
                    key: "ctr",
                    compute: ReportBuilderComputeDef(type: "ratio", numerator: "clicks", denominator: "impressions")
                ),
                ReportBuilderMeasureDef(
                    key: "ecpm",
                    compute: ReportBuilderComputeDef(type: "ratio", numerator: "totalSpend", denominator: "impressions", scale: 1_000)
                )
            ])
        )

        XCTAssertEqual(rows.first?["ctr"], .number(0.02))
        XCTAssertEqual(rows.first?["ecpm"], .number(15))
    }

    func testMaterializesAuthoredChartSpecForNativeReportRuntime() {
        let document: [String: JSONValue] = [
            "blocks": .array([
                .object([
                    "id": .string("delivery"),
                    "kind": .string("chartBlock"),
                    "title": .string("Delivery"),
                    "chartSpec": .object([
                        "type": .string("horizontal_bar"),
                        "xField": .string("channel"),
                        "yFields": .array([.string("spend"), .string("impressions")]),
                        "yLabel": .string("Observed")
                    ])
                ])
            ])
        ]

        let result = materializeReportBuilderAuthoredDocument(document)
        let chart = result["blocks"]?.arrayValue?.first?.objectValue?["chartModel"]?.objectValue

        XCTAssertEqual(chart?["type"], .string("bar"))
        XCTAssertEqual(chart?["xAxis"]?.objectValue?["dataKey"], .string("channel"))
        XCTAssertEqual(chart?["series"]?.objectValue?["values"]?.arrayValue?.count, 2)
    }

    func testAuthoredReportErrorsStayUserFacing() {
        XCTAssertEqual(
            authoredReportLoadErrorMessage("upstream returned 504 Gateway Time-out"),
            "Report data took too long to load. Try refreshing."
        )
        XCTAssertEqual(
            authoredReportLoadErrorMessage("EOFException"),
            "Some report data could not be loaded. Try refreshing."
        )
    }
}
