import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

final class MetadataDisplayTests: XCTestCase {
    func testMappedLabelKeepsTypedValuesAndExplicitEmptyTextAfterTargetDecoding() throws {
        let data = Data(#"{"type":"label","scope":"metrics","dataField":"kind","valueMap":{"1":"One","true":"Yes","2.5":"Fraction","0.000001":"Small","1e-7":"Exponent","a,1":"List"},"emptyText":"—"}"#.utf8)
        let item = try JSONDecoder().decode(ItemDef.self, from: data)
        let decoded = try JSONDecoder().decode(ItemDef.self, from: JSONEncoder().encode(item))
        for (value, expected): (JSONValue?, String) in [
            (.number(1), "One"), (.string("1"), "One"), (.bool(true), "Yes"), (.number(2.5), "Fraction"),
            (.number(0.000001), "Small"), (.number(0.0000001), "Exponent"), (.array([.string("a"), .number(1)]), "List"),
            (.string("Other"), "Other"), (.null, "—"), (nil, "—"), (.string(" "), "—")
        ] {
            XCTAssertEqual(menuLabelPresentation(decoded, value: value), expected)
        }
    }

    func testTableFormatsUnknownValuesAndPreservesRawRecord() throws {
        let data = Data(#"{"id":"kind","valueMap":{"1":"One"},"format":"raw","emptyText":"Unassigned"}"#.utf8)
        let decoded = try JSONDecoder().decode(ColumnDef.self, from: data)
        let column = try JSONDecoder().decode(ColumnDef.self, from: JSONEncoder().encode(decoded))
        let row: [String: JSONValue] = ["kind": .number(1)]
        XCTAssertEqual(tableCellPresentation(row["kind"], column: column), "One")
        let hooked = try JSONDecoder().decode(ColumnDef.self, from: Data(#"{"id":"kind","valueMap":{"1":"Mapped"},"on":[{"event":"onValue","handler":"Records.same"}]}"#.utf8))
        let override = try TableValueProjection.override(row: row, column: hooked, code: "({same: ({value}) => value})", namespace: "Records")
        XCTAssertEqual(tableCellPresentation(row["kind"], column: hooked, override: override), "1")
        let absent = try TableValueProjection.override(row: row, column: hooked, code: "({same: () => undefined})", namespace: "Records")
        XCTAssertEqual(tableCellPresentation(row["kind"], column: hooked, override: absent), "Mapped")
        XCTAssertEqual(tableCellPresentation(.string("other"), column: column), "other")
        XCTAssertEqual(tableCellPresentation(.null, column: column), "Unassigned")
        XCTAssertEqual(tableCellPresentation(nil, column: column), "Unassigned")
        XCTAssertEqual(tableRowAccessibilityLabel(columns: [column], row: row), "kind One")
        XCTAssertEqual(row["kind"], .number(1))
    }
}
