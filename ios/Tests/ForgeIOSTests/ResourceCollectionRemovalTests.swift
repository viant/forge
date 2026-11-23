import XCTest
@testable import ForgeIOSRuntime

final class ResourceCollectionRemovalTests: XCTestCase {
    func testExplicitRemovalUsesIdentityAndMarkerWithoutInferringOmissions() throws {
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"""
        {"schemas":{"root":{"type":"object","identity":["id"],"properties":{"id":{"type":"integer"},"rows":{"type":"array"}}},
                    "row":{"type":"object","identity":["id"],"properties":{"id":{"type":"integer","nullable":true},"label":{"type":"string"},"remove":{"type":"boolean"}}}},
         "resourceModels":{"root":{"schemaRef":"root","write":{"mode":"changed"},"fields":{"id":{"write":"id"},"rows":{"collection":{"modelRef":"row","deleteMarker":"remove"}}}},
                           "row":{"schemaRef":"row","fields":{"id":{"write":"Id"},"label":{"write":"Label"},"remove":{"write":"toBeDeleted"}}}}}
        """#.utf8))
        let left = JSONValue.object(["id": .number(1), "label": .string("Left")])
        let right = JSONValue.object(["id": .number(2), "label": .string("Right")])
        let baseline = JSONValue.object(["id": .number(7), "rows": .array([left, right])])
        func write(_ rows: [JSONValue]?) throws -> [String: JSONValue] {
            var value: [String: JSONValue] = ["id": .number(7)]
            if let rows { value["rows"] = .array(rows) }
            return try ResourceModelRuntime.marshal(draft: .object(value), baseline: baseline, modelRef: "root", schemas: metadata.schemas, models: metadata.resourceModels)
        }
        XCTAssertEqual(try write(nil), ["id": .number(7)])
        XCTAssertEqual(try write([right]), ["id": .number(7)])
        let change: [JSONValue] = [.object(["id": .number(1), "remove": .bool(true)]), right, .object(["label": .string("New")])]
        let expected = JSONValue.array([.object(["Id": .number(1), "toBeDeleted": .bool(true)]), .object(["Label": .string("New")])])
        XCTAssertEqual(try write(change)["rows"], expected)
        XCTAssertEqual(try write(change)["rows"], expected)
        XCTAssertThrowsError(try write([.object(["remove": .bool(true)])]))
    }
}
