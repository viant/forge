import XCTest
@testable import ForgeIOSRuntime

final class InlineReportRuntimeCompilerTests: XCTestCase {
    func testCompilesCanonicalPrimitivesIntoNativeReportRuntime() throws {
        let source: JSONValue = .object([
            "title": .string("Delivery review"),
            "layout": .object(["items": .array([
                .object(["blockId": .string("tabs")]),
                .object(["blockId": .string("kpi")]),
                .object(["blockId": .string("table")])
            ])]),
            "blocks": .array([
                .object(["id": .string("tabs"), "kind": .string("tabGroupBlock"), "sectionIds": .array([.string("overview")])]),
                .object(["id": .string("overview"), "kind": .string("sectionBlock"), "title": .string("Overview")]),
                .object([
                    "id": .string("kpi"), "kind": .string("kpiBlock"), "title": .string("Spend"),
                    "datasetRef": .string("rows"), "valueField": .string("spend"), "valueLabel": .string("Spend"),
                    "subtitle": .string("Window spend"), "size": .string("large")
                ]),
                .object([
                    "id": .string("table"), "kind": .string("tableBlock"), "title": .string("Detail"),
                    "datasetRef": .string("rows"), "columns": .array([.object(["key": .string("channel"), "label": .string("Channel")])])
                ]),
                .object([
                    "id": .string("chart"), "kind": .string("chartBlock"), "datasetRef": .string("rows"),
                    "xField": .string("channel"), "measures": .array([.string("spend")])
                ]),
                .object([
                    "id": .string("empty-chart"), "kind": .string("chartBlock"), "datasetRef": .string("not-yet-loaded"),
                    "chartSpec": .object(["type": .string("line"), "xField": .string("date"), "yFields": .array([.string("spend")])])
                ]),
                .object([
                    "id": .string("geo"), "kind": .string("geoMapBlock"), "datasetRef": .string("rows"),
                    "regionField": .string("state"), "valueField": .string("spend")
                ]),
                .object([
                    "id": .string("findings"), "kind": .string("collectionBlock"), "datasetRef": .string("rows"),
                    "itemTitleField": .string("channel"), "bodyTemplate": .string("${spend}")
                ]),
                .object([
                    "id": .string("timeline"), "kind": .string("timelineBlock"),
                    "datasetRef": .string("timelineRows"),
                    "timeField": .string("timestamp"), "titleField": .string("event"),
                    "descriptionField": .string("detail"),
                    "columns": .array([.object(["key": .string("impact"), "label": .string("Impact")])])
                ]),
                .object(["id": .string("markdown"), "kind": .string("markdownBlock"), "markdown": .string("## Summary")]),
                .object(["id": .string("filters"), "kind": .string("filterBarBlock")]),
                .object(["id": .string("refinements"), "kind": .string("refinementBarBlock")]),
                .object(["id": .string("badges"), "kind": .string("badgesBlock"), "badges": .array([.string("Ready")])]),
                .object(["id": .string("composite"), "kind": .string("compositeBlock")]),
                .object(["id": .string("stepper"), "kind": .string("stepperBlock")]),
                .object(["id": .string("info"), "kind": .string("infoPanelBlock")]),
                .object(["id": .string("callout"), "kind": .string("calloutBlock"), "body": .string("Review")]),
                .object(["id": .string("kanban"), "kind": .string("kanbanBlock")])
            ])
        ])
        let report = TranscriptCanonicalReport(
            scope: "message",
            id: "delivery",
            grammar: "report-document-v1",
            status: "committed",
            source: source,
            dataSources: [
                "rows": TranscriptCanonicalData(
                    id: "rows",
                    format: "json",
                    payload: .array([.object([
                        "channel": .string("CTV"), "state": .string("CA"), "spend": .number(125),
                        "optionalNote": .string("  ")
                    ])])
                ),
                "timelineRows": TranscriptCanonicalData(
                    id: "timelineRows",
                    format: "json",
                    payload: .array([.object([
                        "timestamp": .string("2026-08-09"),
                        "event": .string("Pacing mode changed"),
                        "detail": .string("ASAP changed to spend-evenly."),
                        "impact": .string("Primary incident contributor")
                    ])])
                )
            ]
        )

        let artifact = try InlineReportRuntimeCompiler.compile(report)
        let runtime = try XCTUnwrap(artifact.metadata.view?.content?.containers.first?.reportRuntime?.objectValue)
        let reportSpec = try XCTUnwrap(runtime["reportSpec"]?.objectValue)
        let reportFill = try XCTUnwrap(runtime["reportFill"]?.objectValue)
        let fences = try XCTUnwrap(runtime["fences"]?.arrayValue)
        XCTAssertEqual(runtime["reportPrint"]?.objectValue?["kind"], .string("reportPrint"))
        XCTAssertEqual(fences.count, 5)
        XCTAssertEqual(fences.first?.objectValue?["kind"], .string("forge-report"))
        XCTAssertEqual(fences.first?.objectValue?["payload"]?.objectValue?["version"], .number(1))
        XCTAssertEqual(fences.last?.objectValue?["payload"]?.objectValue?["mode"], .string("commit"))
        let exportKPI = fences.first?.objectValue?["payload"]?.objectValue?["blocks"]?.arrayValue?
            .first { $0.objectValue?["id"]?.stringValue == "kpi" }?.objectValue
        XCTAssertEqual(exportKPI?["description"], .string("Window spend"))
        XCTAssertNil(exportKPI?["subtitle"])
        XCTAssertNil(exportKPI?["size"])
        let exportKinds = fences.first?.objectValue?["payload"]?.objectValue?["blocks"]?.arrayValue?
            .compactMap { $0.objectValue?["kind"]?.stringValue }
        XCTAssertFalse(exportKinds?.contains("filterBarBlock") ?? true)
        XCTAssertFalse(exportKinds?.contains("refinementBarBlock") ?? true)
        let emptyDataset = fences.first {
            $0.objectValue?["kind"] == .string("forge-data") &&
                $0.objectValue?["payload"]?.objectValue?["id"] == .string("not-yet-loaded")
        }?.objectValue?["payload"]?.objectValue
        XCTAssertEqual(emptyDataset?["data"], .array([]))
        let rowsDataset = fences.first {
            $0.objectValue?["kind"] == .string("forge-data") &&
                $0.objectValue?["payload"]?.objectValue?["id"] == .string("rows")
        }?.objectValue?["payload"]?.objectValue
        XCTAssertEqual(
            rowsDataset?["data"]?.arrayValue?.first?.objectValue?["optionalNote"],
            .string("—")
        )
        XCTAssertEqual(reportSpec["layoutIntent"]?.objectValue?["blockOrder"]?.arrayValue?.compactMap(\.stringValue), ["tabs", "kpi", "table"])
        XCTAssertEqual(reportSpec["blocks"]?.arrayValue?.count, 18)
        XCTAssertEqual(reportFill["datasets"]?.arrayValue?.first?.objectValue?["rows"]?.arrayValue?.count, 1)
        let kpi = reportFill["blocks"]?.arrayValue?.first { $0.objectValue?["id"]?.stringValue == "kpi" }
        XCTAssertEqual(kpi?.objectValue?["content"]?.objectValue?["value"], .number(125))
        let timeline = reportFill["blocks"]?.arrayValue?.first { $0.objectValue?["id"]?.stringValue == "timeline" }
        let event = timeline?.objectValue?["content"]?.objectValue?["events"]?.arrayValue?.first?.objectValue
        XCTAssertEqual(event?["date"], .string("2026-08-09"))
        XCTAssertEqual(event?["title"], .string("Pacing mode changed"))
        XCTAssertEqual(event?["body"], .string("ASAP changed to spend-evenly.\n\nImpact: Primary incident contributor"))
        XCTAssertEqual(DashboardRuntime.dashboardReportRuntimeSummary(artifact.metadata.view!.content!.containers[0]).blockCount, 18)
        let export = try XCTUnwrap(DashboardRuntime.dashboardReportRuntimeExportExecution(
            artifact.metadata.view!.content!.containers[0]
        ))
        XCTAssertEqual(export.exportRequest?["reportId"], .string("delivery"))
        XCTAssertEqual(export.exportRequest?["fences"]?.arrayValue?.count, 5)
    }

    func testExtractsUnmaterializedWorkspaceRequests() {
        let report = TranscriptCanonicalReport(
            scope: "message",
            id: "delivery",
            grammar: "report-document-v1",
            status: "committed",
            source: .object([
                "datasets": .array([.object([
                    "id": .string("delivery"), "kind": .string("workspaceRef"),
                    "dataSourceRef": .string("metrics_delivery"),
                    "request": .object(["orderId": .number(42)])
                ])]),
                "blocks": .array([])
            ])
        )
        XCTAssertEqual(
            InlineReportRuntimeCompiler.workspaceDatasetRequests(report),
            [InlineReportWorkspaceDatasetRequest(id: "delivery", dataSourceRef: "metrics_delivery", inputs: ["orderId": .number(42)])]
        )
    }

    func testMaterializesCanonicalCSVData() throws {
        let report = TranscriptCanonicalReport(
            scope: "message",
            id: "csv-delivery",
            grammar: "report-document-v1",
            status: "committed",
            source: .object([
                "blocks": .array([.object([
                    "id": .string("table"), "kind": .string("tableBlock"), "datasetRef": .string("rows")
                ])])
            ]),
            dataSources: [
                "rows": TranscriptCanonicalData(
                    id: "rows",
                    format: "csv",
                    payload: .string("channel,spend\n\"CTV, Premium\",125\nDisplay,75")
                )
            ]
        )

        let artifact = try InlineReportRuntimeCompiler.compile(report)
        let rows = try XCTUnwrap(artifact.reportFill.objectValue?["datasets"]?.arrayValue?.first?.objectValue?["rows"]?.arrayValue)
        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(rows[0].objectValue?["channel"], .string("CTV, Premium"))
        XCTAssertEqual(rows[0].objectValue?["spend"], .number(125))
    }
}
