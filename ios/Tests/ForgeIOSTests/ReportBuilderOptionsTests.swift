import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

final class ReportBuilderOptionsTests: XCTestCase {
    let payload = #"{"reportOptions":[{"name":"exposurePerspective","label":"First vs. Last Exposure","type":"string","default":"Last","values":["First","Last"],"presentation":{"anchorBlockId":"pathways","placement":"header"}},{"name":"lookback","type":"integer","default":30},{"name":"organic","type":"boolean","default":false},{"name":"campaignId","default":"forbidden"}]}"#

    func testDefinitionsDefaultsValidationAndPresentationSurviveLowering() throws {
        let config = try JSONDecoder().decode(DashboardReportBuilderDef.self, from: Data(payload.utf8))
        let definitions = lowerReportBuilderPredicates(config).reportOptions
        let normalized = ReportBuilderOptions.normalize(definitions)
        XCTAssertEqual(normalized.count, 3)
        XCTAssertEqual(normalized.first?.anchorBlockId, "pathways")
        XCTAssertEqual(ReportBuilderOptions.effective(definitions, selected: [:]), ["exposurePerspective": .string("Last"), "lookback": .number(30), "organic": .bool(false)])
        XCTAssertEqual(ReportBuilderOptions.effective(definitions, selected: ["exposurePerspective": .string("invalid"), "lookback": .string("7"), "organic": .string("true"), "unknown": .number(1)]), ["exposurePerspective": .string("Last"), "lookback": .number(7), "organic": .bool(true)])
        let roundTrip = try JSONDecoder().decode(DashboardReportBuilderDef.self, from: JSONEncoder().encode(config))
        XCTAssertEqual(roundTrip.reportOptions, config.reportOptions)
    }

    func testLegacyStateAndHookRoundTrip() throws {
        let legacy = #"{"selectedMeasures":[],"selectedDimensions":[],"viewMode":"table","staticFilters":{},"dynamicGroups":{},"dynamicFilterDrafts":{}}"#
        var stored = try JSONDecoder().decode(StoredReportBuilderState.self, from: Data(legacy.utf8))
        XCTAssertNil(stored.reportOptions)
        stored.reportOptions = ["exposurePerspective": .string("First")]
        let encoded = try JSONDecoder().decode(StoredReportBuilderState.self, from: JSONEncoder().encode(stored))
        XCTAssertEqual(encoded.reportOptions, stored.reportOptions)
        let hook = try XCTUnwrap(ReportBuilderRenderer.reportBuilderHookStateValue(from: stored))
        XCTAssertEqual(ReportBuilderRenderer.reportBuilderState(fromHookResult: hook, fallback: stored).reportOptions, stored.reportOptions)
    }

    func testPDFExportCarriesOptionContextWithoutFormatting() throws {
        let config = try JSONDecoder().decode(DashboardReportBuilderDef.self, from: Data(payload.utf8))
        let report = TranscriptCanonicalReport(scope: "test", id: "test", grammar: "report-document-v1", status: "ready", source: .object(["blocks": .array([])]))
        let artifact = try InlineReportRuntimeCompiler.compile(report, reportOptions: config.reportOptions, optionValues: ["exposurePerspective": .string("First")])
        let container = try XCTUnwrap(artifact.metadata.view?.content?.containers.first)
        let execution = try XCTUnwrap(DashboardRuntime.dashboardReportRuntimeExportExecution(container))
        let fences = try XCTUnwrap(execution.exportRequest?["fences"]?.arrayValue)
        let start = try XCTUnwrap(fences.first?.objectValue?["payload"]?.objectValue)
        XCTAssertEqual(start["metadata"]?.objectValue?["options"]?.objectValue?["exposurePerspective"], .string("First"))
        XCTAssertEqual(start["metadata"]?.objectValue?["reportOptions"], .array(config.reportOptions))
        XCTAssertEqual(start["blocks"]?.arrayValue?.count, 0, "Clients do not compose PDF summary blocks")
    }
}
