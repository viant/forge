import XCTest
@testable import ForgeIOSUI
import ForgeIOSRuntime

final class TableCSVFilenameTests: XCTestCase {
    func testAuthoredFilenameAndExtension() throws {
        let toolbar = try JSONDecoder().decode(ToolbarDef.self, from: Data(#"{"items":[{"type":"tableExport","properties":{"filename":"advertiser_orders"}}]}"#.utf8))
        XCTAssertEqual(tableCSVFilename(toolbar), "advertiser_orders.csv")
        let existing = try JSONDecoder().decode(ToolbarDef.self, from: Data(#"{"items":[{"type":"tableExport","properties":{"filename":"History.CSV"}}]}"#.utf8))
        XCTAssertEqual(tableCSVFilename(existing), "History.CSV")
        XCTAssertEqual(tableCSVFilename(nil), "table.csv")
    }
}
