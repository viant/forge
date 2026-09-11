import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

final class NativeWidgetContractTests: XCTestCase {
    private func fixtures() throws -> [String: JSONValue] {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        return try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: root.appendingPathComponent("src/components/primitives/nativeWidgetContract.fixtures.json"))).objectValue!
    }
    func testSharedWidgetClassificationAndValues() throws {
        let fixture = try fixtures()
        for entry in fixture["booleans"]!.arrayValue!.compactMap(\.objectValue) { XCTAssertEqual(NativeWidgetContract.truthy(entry["value"]), entry["expected"]?.boolValue) }
        for widget in fixture["widgets"]!.arrayValue! {
            let item = ItemDef(widget: widget.stringValue!, id: "field")
            XCTAssertTrue(NativeWidgetContract.kinds.contains(NativeWidgetContract.kind(item)))
        }
        for value in fixture["classification"]!.arrayValue! {
            let entry = value.objectValue!
            let item = try JSONDecoder().decode(ItemDef.self, from: JSONEncoder().encode(entry["item"]!))
            XCTAssertEqual(NativeWidgetContract.kind(item), entry["expected"]?.stringValue)
        }
        for value in fixture["inputs"]!.arrayValue! {
            let entry = value.objectValue!
            let parsed = NativeWidgetContract.input(entry["text"]!.stringValue!, kind: entry["kind"]!.stringValue!)
            if entry["invalid"] == .bool(true) { XCTAssertNil(parsed) } else { XCTAssertEqual(parsed, entry["expected"]) }
        }
    }
    func testSharedDatePresetsAndTabPolicy() throws {
        let fixture = try fixtures()
        for value in fixture["presets"]!.arrayValue! {
            let entry = value.objectValue!
            let actual = NativeDateRangePreset.resolve(entry["value"]!.stringValue!, now: ISO8601DateFormatter().date(from: entry["now"]!.stringValue!)!, timeZone: entry["timeZone"]?.stringValue ?? "UTC")
            XCTAssertEqual(actual.map(JSONValue.object) ?? .null, entry["expected"])
        }
        for value in fixture["tabs"]!.arrayValue! {
            let entry = value.objectValue!
            let ids = entry["ids"]!.arrayValue!.compactMap(\.stringValue)
            let selected = StableTabsState.selected(ids: ids, requested: entry["requested"]?.stringValue, fallback: entry["default"]?.stringValue)
            XCTAssertEqual(selected, entry["selected"]?.stringValue)
            XCTAssertEqual(StableTabsState.mounted(ids: ids, selected: selected, visited: Set(entry["visited"]!.arrayValue!.compactMap(\.stringValue)), keepVisited: entry["keepVisited"] == .bool(true), activeOnly: entry["activeOnly"] == .bool(true)), entry["mounted"]!.arrayValue!.compactMap(\.stringValue))
        }
    }
    func testPrimitiveScopesAndTypedOptionsSurviveRoundTrip() throws {
        let raw = #"{"id":"root","dataSourceRef":"reader","resourceHeader":{"dataSourceRef":"identity"},"draftForm":{"dataSourceRef":"editor"},"mutationCommand":{"dataSourceRef":"writer"}}"#
        let container = try JSONDecoder().decode(ContainerDef.self, from: Data(raw.utf8))
        let parts = PrimitivePairing.scopedContainers(container)
        XCTAssertEqual(parts.first { $0.resourceHeader != nil }?.dataSourceRef, "identity")
        XCTAssertEqual(parts.first { $0.draftForm != nil }?.dataSourceRef, "editor")
        XCTAssertEqual(parts.first { $0.mutationCommand != nil }?.dataSourceRef, "reader")
        XCTAssertTrue(parts.allSatisfy { ($0.resourceHeader != nil ? 1 : 0) + ($0.draftForm != nil ? 1 : 0) + ($0.mutationCommand != nil ? 1 : 0) == 1 })
        let item = try JSONDecoder().decode(ItemDef.self, from: Data(#"{"widget":"select","disabled":true,"options":[{"value":2,"label":"Two"},{"value":false,"label":"No"}]}"#.utf8))
        XCTAssertEqual(NativeWidgetContract.options(item).map(\.0), [.number(2), .bool(false)])
        XCTAssertTrue(NativeWidgetContract.disabled(item))
        let decoded = try JSONDecoder().decode(ItemDef.self, from: JSONEncoder().encode(item))
        XCTAssertEqual(NativeWidgetContract.options(decoded).map(\.0), [.number(2), .bool(false)])
    }
    func testDraftBaselineResetAndSuccessfulSaveContract() {
        let initial: [String: JSONValue] = ["id": .number(1), "name": .string("Before")]
        let edited: [String: JSONValue] = ["id": .number(1), "name": .string("After")]
        var state = NativeDraftState(baseline: initial)
        XCTAssertFalse(state.dirty(initial))
        XCTAssertTrue(state.dirty(edited))
        XCTAssertEqual(NativeDraftState.submitExtras(edited), ["data": .object(edited)])
        XCTAssertEqual(state.resetExtras(edited), ["values": .object(initial)])
        state.baseline = edited // Only the succeeded callback advances the baseline.
        XCTAssertFalse(state.dirty(edited))
        XCTAssertTrue(state.dirty(["id": .number(1), "name": .string("Edited during save")]))
    }

    func testSchemaDispatchPreservesTextSecureAndArrayEditors() throws {
        let form = try JSONDecoder().decode(SchemaBasedFormDef.self, from: Data(#"{"schema":{"type":"object","properties":{"name":{"type":"string"},"secret":{"type":"string","format":"password"},"data":{"type":"array"},"number":{"type":"number","enum":[1,2]}}}}"#.utf8))
        let kinds = Dictionary(uniqueKeysWithValues: SchemaFormRuntime.resolvedFields(for: form).map { ($0.key, NativeWidgetContract.kind(SchemaFormRuntime.nativeItem(for: $0))) })
        XCTAssertEqual(kinds["name"], "text")
        XCTAssertEqual(kinds["secret"], "password")
        XCTAssertEqual(kinds["data"], "object")
        XCTAssertEqual(kinds["number"], "select")
    }

    func testRootWidgetAttributesAreNotLostWhenMetadataIsExported() throws {
        let item = try JSONDecoder().decode(ItemDef.self, from: Data(#"{"id":"amount","widget":"currency","default":12,"min":0,"accept":".csv","timeZone":"America/Los_Angeles"}"#.utf8))
        let encoded = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(item)).objectValue!
        XCTAssertEqual(encoded["default"], .number(12))
        XCTAssertEqual(encoded["min"], .number(0))
        XCTAssertEqual(encoded["timeZone"], .string("America/Los_Angeles"))
    }

}
