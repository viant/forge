import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

final class ToolbarSelectorTests: XCTestCase {
    func testWindowSelectorValueReachesDatasourceRequest() async throws {
        let json = #"{"dataSource":{"exchange":{"parameters":[{"name":"PublisherId","in":"windowForm","location":"creativePublisherId","codec":{"name":"int"}}]}}}"#
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(json.utf8))
        let runtime = ForgeRuntime()
        await runtime.registerWindowMetadataLoader { _ in metadata }
        let window = await runtime.openWindow(key: "test", title: "Test")
        await runtime.setWindowFormValue(windowID: window.id, values: ["creativePublisherId": .number(45)])
        actor Requests {
            var inputs: [[String: JSONValue]] = []
            func add(_ value: [String: JSONValue]) { inputs.append(value) }
        }
        let requests = Requests()
        await runtime.registerDataSourceLoader { request in
            await requests.add(request.resolvedInputs)
            return .init(rows: [])
        }
        await runtime.refreshDataSourceCollection(windowID: window.id, dataSourceRef: "exchange")
        let inputs = await requests.inputs
        XCTAssertEqual(inputs.count, 1)
        XCTAssertEqual(inputs.first?["PublisherId"], .number(45))
    }

    func testNumericOptionMatchesSerializedWindowValue() {
        XCTAssertTrue(toolbarOptionMatches(.number(8), .string("8")))
        XCTAssertFalse(toolbarOptionMatches(.number(8), .string("45")))
        XCTAssertFalse(toolbarOptionMatches(.number(1), .bool(true)))
        XCTAssertFalse(toolbarOptionMatches(nil, nil))
    }

    func testSelectorRetainsBindingDefaultAndOptions() throws {
        let json = #"{"id":"exchange","type":"select","field":"creativePublisherId","scope":"windowForm","value":8,"options":[{"value":8,"label":"Xandr"},{"value":45,"label":"Google"}]}"#
        let item = try JSONDecoder().decode(ToolbarItemDef.self, from: Data(json.utf8))
        let decoded = try JSONDecoder().decode(ToolbarItemDef.self, from: JSONEncoder().encode(item))
        XCTAssertEqual(decoded.field, "creativePublisherId")
        XCTAssertEqual(decoded.scope, "windowForm")
        XCTAssertEqual(decoded.value, .number(8))
        XCTAssertEqual(decoded.options.count, 2)
        XCTAssertEqual(decoded.options[1].objectValue?["value"], .number(45))
    }
}
