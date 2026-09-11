import XCTest
@testable import ForgeIOSRuntime

final class ReportRuntimeStructureTests: XCTestCase {
    func testSharedCompositeOwnershipContract() throws {
        let root = URL(fileURLWithPath: #filePath).resolvingSymlinksInPath().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let data = try Data(contentsOf: root.appendingPathComponent("src/reporting/fixtures/report-runtime-structure-conformance.v1.json"))
        let fixture = try JSONDecoder().decode(JSONValue.self, from: data)
        for value in fixture.objectValue?["cases"]?.arrayValue ?? [] {
            let scenario = try XCTUnwrap(value.objectValue)
            let blocks = DashboardRuntime.dashboardReportRuntimeBlocks(scenario["blocks"]?.arrayValue ?? [])
            let parents = Dictionary(uniqueKeysWithValues: blocks.compactMap { block in block.compositeParentID.map { (block.id, JSONValue.string($0)) } })
            XCTAssertEqual(.object(parents), scenario["parents"])
            XCTAssertEqual(.array(blocks.filter { $0.compositeParentID == nil }.map { .string($0.id) }), scenario["roots"])
            for block in blocks { XCTAssertTrue(block.children.allSatisfy { $0.compositeParentID == block.id }) }
        }
    }
}
