import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

final class TerminalRendererTests: XCTestCase {
    func testTerminalTextResolutionAndTruncation() {
        let row: [String: JSONValue] = [
            "input": .string("git status --short"),
            "stdout": .string("?? notes.md"),
            "stderr": .string("warning"),
        ]
        XCTAssertEqual(terminalCommandText(row), "$ git status --short")
        XCTAssertEqual(terminalOutputText(row), "?? notes.md\nwarning")
        XCTAssertEqual(terminalPreview("abcdef", truncate: true, limit: 3), "abc…")
        XCTAssertEqual(terminalPreview("abcdef", truncate: false, limit: 3), "abcdef")
    }
}
