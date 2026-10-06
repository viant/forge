import XCTest
@testable import ForgeIOSRuntime

final class ReportColumnFormatCompatibilityTests: XCTestCase {
    func testReaderAcceptsValueFormatButCanonicalNonemptyFormatWins() throws {
        let raw: [JSONValue] = [
            .object(["key": .string("target"), "valueFormat": .string("percentFraction")]),
            .object(["key": .string("observed"), "format": .string("percentFraction3"), "valueFormat": .string("currency")]),
            .object(["key": .string("blank"), "format": .string("  "), "valueFormat": .string("percentFraction2")])
        ]
        let original = raw
        let columns = DashboardRuntime.dashboardReportRuntimeColumns(raw)
        XCTAssertEqual(columns.map(\.format), ["percentFraction", "percentFraction3", "percentFraction2"])
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(0.25, format: columns[0].format), "25.0%")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(0.0008, format: columns[0].format), "0.1%")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(0.000392287, format: columns[0].format), "0.0%")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(0.000392287, format: columns[1].format), "0.039%")
        XCTAssertEqual(DashboardRuntime.formatDashboardValue(0.0008, format: columns[2].format), "0.08%")
        XCTAssertEqual(raw, original, "Reader normalization must not rewrite authored source or hash inputs")
    }
    func testPortableAuthoredTableKeepsAliasForReaderWithoutMutatingDocument() throws {
        let source = try JSONDecoder().decode(JSONValue.self, from: Data(#"{"blocks":[{"id":"goal","kind":"tableBlock","datasetRef":"goal","columns":[{"key":"target","valueFormat":"percentFraction"}]}]}"#.utf8))
        let report = TranscriptCanonicalReport(scope: "message", id: "report", grammar: "report-document-v1", status: "committed", source: source, dataSources: ["goal": TranscriptCanonicalData(id: "goal", format: "json", payload: .array([.object(["target": .number(0.0008)])]))])
        let artifact = try InlineReportRuntimeCompiler.compile(report)
        let summary = DashboardRuntime.dashboardReportRuntimeSummary(ContainerDef(id: "runtime", kind: "dashboard.reportRuntime", reportRuntime: .object(["reportFill": artifact.reportFill, "reportSpec": artifact.reportSpec])))
        XCTAssertEqual(summary.blocks.first?.table?.columns.first?.format, "percentFraction")
        XCTAssertEqual(report.source, source)
    }
}
