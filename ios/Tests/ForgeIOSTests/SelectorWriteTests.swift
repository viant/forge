import XCTest
@testable import ForgeIOSRuntime

final class SelectorWriteTests: XCTestCase {
    func testNestedWritePreservesSiblingsAndDoesNotCreateLiteralPath() throws {
        let root: JSONValue = .object(["groups": .object(["language": .array([.string("English")]), "device": .string("Mobile")]), "id": .number(7)])
        let changed = try XCTUnwrap(SelectorUtil.setting(.array([]), in: root, selector: "groups.language"))
        XCTAssertEqual(changed.objectValue?["groups"]?.objectValue?["language"], .array([]))
        XCTAssertEqual(changed.objectValue?["groups"]?.objectValue?["device"], .string("Mobile"))
        XCTAssertEqual(changed.objectValue?["id"], .number(7))
        XCTAssertNil(changed.objectValue?["groups.language"])
    }

    func testArrayWriteAndInvalidTraversal() {
        let root: JSONValue = .object(["rows": .array([.object(["name": .string("old")])])])
        XCTAssertEqual(SelectorUtil.setting(.string("new"), in: root, selector: "rows.0.name")?.objectValue?["rows"]?.arrayValue?.first?.objectValue?["name"], .string("new"))
        XCTAssertNil(SelectorUtil.setting(.null, in: root, selector: "rows.9.name"))
        XCTAssertNil(SelectorUtil.setting(.null, in: root, selector: "rows..name"))
        XCTAssertNil(SelectorUtil.setting(.null, in: .object(["x": .number(1)]), selector: "x.y"))
    }
}
