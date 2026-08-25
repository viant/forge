import XCTest
import ForgeIOSRuntime
@testable import ForgeIOSUI

final class FilePreviewBrowserTests: XCTestCase {
    func testRowsDedupeByURIAndKeepCompactParentForDuplicateNames() {
        let config = FileBrowserDef(dedupeBy: "url", display: "tree", pathField: "url")
        let rows: [[String: JSONValue]] = [
            ["url": .string("/repo/src/config.json"), "kind": .string("updated")],
            ["url": .string("/repo/test/config.json")],
            ["url": .string("/repo/src/config.json"), "kind": .string("created")],
        ]
        let result = filePreviewRows(rows, config: config)
        XCTAssertEqual(result.count, 2)
        XCTAssertEqual(result.map(\.name), ["config.json", "config.json"])
        XCTAssertEqual(result.map(\.parent), ["repo/test", "repo/src"])
        XCTAssertEqual(result.last?.source["kind"]?.stringValue, "created")
    }

    func testPreviousTextIsReconstructedFromUnifiedDiff() {
        let current = "first changed\nsecond\nthird added\n"
        let diff = """
        --- previous
        +++ current
        @@ -1,2 +1,3 @@
        -first
        +first changed
         second
        +third added
        """
        XCTAssertEqual(previousTextFromUnifiedDiff(current: current, diff: diff), "first\nsecond\n")
    }
}
