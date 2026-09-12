import XCTest
@testable import ForgeIOSRuntime

final class ClientFilterRuntimeTests: XCTestCase {
    func testAuthoredScalarAndMembershipOperators() throws {
        XCTAssertTrue(try ClientFilterRuntime.matches(.string("Synthetic Report"), expected: .string("REPORT"), operation: "contains"))
        XCTAssertTrue(try ClientFilterRuntime.matches(.number(2), expected: .string("2"), operation: "equal"))
        XCTAssertTrue(try ClientFilterRuntime.matches(.string("Active"), expected: .array([.string("Active"), .string("Paused")]), operation: "in"))
        XCTAssertTrue(try ClientFilterRuntime.matches(.number(10), expected: .number(5), operation: ">="))
        XCTAssertFalse(try ClientFilterRuntime.matches(nil, expected: .string("anything"), operation: "contains"))
    }
    func testRejectsUnknownOperatorsAndInvalidNumbers() {
        XCTAssertThrowsError(try ClientFilterRuntime.matches(.string("anything"), expected: .object([:]), operation: "contains"))
        XCTAssertThrowsError(try ClientFilterRuntime.matches(.string("anything"), expected: .array([]), operation: "contains"))
        XCTAssertThrowsError(try ClientFilterRuntime.matches(.number(2), expected: .number(1), operation: "invented"))
        XCTAssertThrowsError(try ClientFilterRuntime.matches(.string("not numeric"), expected: .number(1), operation: ">"))
        XCTAssertThrowsError(try ClientFilterRuntime.matches(.string("Active"), expected: .string("Active"), operation: "in"))
    }
}
