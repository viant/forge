import XCTest
@testable import ForgeIOSRuntime

final class DataSourceFilterMetadataTests: XCTestCase {
    func testFilterDefinitionsPreserveFieldMappingAndOperators() throws {
        let json = #"{"filterMode":"client","quickFilterSet":"table","filterSet":[{"name":"table","default":true,"template":[{"id":"Name","field":"reportName","operator":"contains","type":"string"},{"id":"Status","field":"status","operator":"in","type":"string[]","options":[{"value":"Active","label":"Active"}]}]}]}"#
        let source = try JSONDecoder().decode(DataSourceDef.self, from: Data(json.utf8))
        let copy = try JSONDecoder().decode(DataSourceDef.self, from: JSONEncoder().encode(source))
        XCTAssertEqual(copy.filterSet, source.filterSet)
        XCTAssertEqual(copy.quickFilterSet, "table")
        XCTAssertEqual(copy.filterField(for: "Name"), "reportName")
        XCTAssertEqual(copy.filterField(for: "name"), "reportName")
        XCTAssertEqual(copy.filterField(for: "reportName"), "reportName")
        XCTAssertEqual(copy.filterField(for: "unknown"), "unknown")
        let fields = copy.filterSet.first?.objectValue?["template"]?.arrayValue
        XCTAssertEqual(fields?.first?.objectValue?["field"], .string("reportName"))
        XCTAssertEqual(fields?.last?.objectValue?["operator"], .string("in"))
    }
}
