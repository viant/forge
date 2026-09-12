import XCTest
@testable import ForgeIOSRuntime

final class TableValueProjectionTests: XCTestCase {
    func testPrincipalColumnProjectsBothUserAndGroupNames() throws {
        let column = try JSONDecoder().decode(ColumnDef.self, from: Data(#"{"id":"contactName","on":[{"event":"onValue","handler":"principal"}]}"#.utf8))
        let code = "({principal: ({row}) => row.contactName || row.groupName || '—'})"
        XCTAssertEqual(try TableValueProjection.value(row: ["contactName": .string("Reviewer")], column: column, code: code), .string("Reviewer"))
        XCTAssertEqual(try TableValueProjection.value(row: ["contactName": .string(""), "groupName": .string("Operations")], column: column, code: code), .string("Operations"))
    }

    func testFillRemainingWidthSurvivesMetadataRoundTrip() throws {
        let table = try JSONDecoder().decode(TableDef.self, from: Data(#"{"fillRemainingWidth":true,"columns":[{"id":"name"}]}"#.utf8))
        XCTAssertEqual(table.fillRemainingWidth, true)
        let roundTrip = try JSONDecoder().decode(TableDef.self, from: JSONEncoder().encode(table))
        XCTAssertEqual(roundTrip.fillRemainingWidth, true)
    }

    func testNamespacedDisplayHookPreservesRawRecord() throws {
        let column = try JSONDecoder().decode(ColumnDef.self, from: Data(#"{"id":"eventName","on":[{"event":"onValue","handler":"Advertiser Workspace.label"}]}"#.utf8))
        let row: [String: JSONValue] = ["eventName": .string("ORDER_CREATED")]
        let code = #"({label: ({value, row}) => value.toLowerCase().replaceAll('_', ' ')})"#
        XCTAssertEqual(try TableValueProjection.value(row: row, column: column, code: code, namespace: "Advertiser Workspace"), .string("order created"))
        XCTAssertEqual(row["eventName"], .string("ORDER_CREATED"))
    }

    func testStructuredResultIsNotFlattened() throws {
        let column = try JSONDecoder().decode(ColumnDef.self, from: Data(#"{"id":"details","on":[{"event":"onValue","handler":"summary"}]}"#.utf8))
        let result = try TableValueProjection.value(row: ["details": .string("Details")], column: column, code: #"({summary: ({row}) => ({title: 'Event', body: row.details})})"#)
        XCTAssertEqual(result, .object(["title": .string("Event"), "body": .string("Details")]))
    }

    func testMissingHookIsReportedInsteadOfPassingRawValueAsSuccess() throws {
        let column = try JSONDecoder().decode(ColumnDef.self, from: Data(#"{"id":"created","on":[{"event":"onValue","handler":"missing"}]}"#.utf8))
        XCTAssertThrowsError(try TableValueProjection.value(row: [:], column: column, code: "({})"))
    }
}
