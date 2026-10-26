import XCTest
@testable import ForgeIOSRuntime

final class ToolbarTargetResolutionTests: XCTestCase {
    func testLayoutAcceptsNumericAndUnitBearingSpacing() throws {
        let numeric = try JSONDecoder().decode(LayoutDef.self, from: Data(#"{"gap":8,"rowGap":4.5}"#.utf8))
        XCTAssertEqual(numeric.gap, "8.0")
        XCTAssertEqual(numeric.rowGap, "4.5")
        let units = try JSONDecoder().decode(LayoutDef.self, from: Data(#"{"gap":"8px","rowGap":"1rem"}"#.utf8))
        XCTAssertEqual(units.gap, "8px")
        XCTAssertEqual(units.rowGap, "1rem")
    }

    // Independently authored offline fixture: no application fetch or record data.
    private let payload = #"""
{"view":{"content":{"containers":[{"id":"contacts","table":{"columns":[{"id":"contactName","field":"contactName","label":"Contact"}],"toolbar":{"items":[{"id":"search","type":"quicksearch","properties":{"field":"email"}}]}},"targetOverrides":{"phone":{"table":{"toolbar":{"items":[{"id":"search","type":"quicksearch","properties":{"field":"contactName"}}]}}}}}]}}}
"""#
    func testPhoneToolbarResolvesFromUntypedMetadata() throws {
        let raw = try JSONDecoder().decode(JSONValue.self, from: Data(payload.utf8))
        let projected = try XCTUnwrap(MetadataResolver.resolveValue(raw, for: ForgeTargetContext(platform: "ios", formFactor: "phone", surface: "app")))
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: JSONEncoder().encode(projected))
        let search = metadata.view?.content?.containers.first?.table?.toolbar?.items.first { $0.type?.lowercased() == "quicksearch" }
        XCTAssertEqual(search?.properties["field"], .string("contactName"))
    }
    func testPhoneToolbarOverrideSurvivesTypedResolution() throws {
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let resolved = MetadataResolver.resolve(metadata, for: ForgeTargetContext(platform: "ios", formFactor: "phone", surface: "app"))
        let search = resolved.view?.content?.containers.first?.table?.toolbar?.items.first { $0.type?.lowercased() == "quicksearch" }
        XCTAssertEqual(search?.properties["field"], .string("contactName"))
    }
}
