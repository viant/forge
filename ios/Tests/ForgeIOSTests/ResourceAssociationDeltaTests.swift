import XCTest
@testable import ForgeIOSRuntime

final class ResourceAssociationDeltaTests: XCTestCase {
    private let schema = #"""
    {
      "member": {"type":"object","identity":["id"],"properties":{
        "id":{"type":"integer"}, "complete":{"type":"boolean","readOnly":true},
        "ids":{"type":"array","items":{"type":"integer"}}
      }},
      "group": {"type":"object","properties":{"rows":{"type":"array","items":{"$ref":"member"}}}},
      "operation": {"type":"object","identity":["id"],"properties":{
        "id":{"type":"integer"},
        "edits":{"type":"object","properties":{
          "added":{"type":"array","items":{"type":"string"}},
          "deleted":{"type":"array","items":{"type":"string"}}
        }}
      }}
    }
    """#
    private let models = #"""
    {
      "member": {"schemaRef":"member","write":{"inputPath":"records","collection":true},"fields":{
        "id":{"write":"id"},
        "ids":{"associationDelta":{"mode":"diff","baselineComplete":"complete","added":"changes.add","deleted":"changes.delete"}}
      }},
      "group": {"schemaRef":"group","write":{"inputPath":"$"},"fields":{
        "rows":{"write":"rows","collection":{"modelRef":"member","mode":"merge"}}
      }},
      "operation": {"schemaRef":"operation","write":{"inputPath":"records","collection":true},"fields":{
        "id":{"write":"id"},
        "edits":{"associationDelta":{"mode":"explicit","added":"include","deleted":"exclude"}}
      }}
    }
    """#

    private func project(_ draft: String, baseline: String? = nil, model: String, mode: String? = nil) throws -> JSONValue {
        let decoder = JSONDecoder()
        let result = try ResourceModelRuntime.marshal(
            draft: decoder.decode(JSONValue.self, from: Data(draft.utf8)),
            baseline: baseline.map { try decoder.decode(JSONValue.self, from: Data($0.utf8)) },
            modelRef: model, mode: mode,
            schemas: decoder.decode([String: ResourceSchemaDef].self, from: Data(schema.utf8)),
            models: decoder.decode([String: ResourceModelDef].self, from: Data(models.utf8)))
        return .object(result)
    }

    func testDiffPairsReorderedRowsByIdentityAndOmitsUntouchedRows() throws {
        let result = try project(
            #"{"rows":[{"id":6,"ids":[15,16,16]},{"id":3,"ids":[9,12]}]}"#,
            baseline: #"{"rows":[{"id":3,"complete":true,"ids":[4,9]},{"id":6,"complete":true,"ids":[8,15]},{"id":10,"complete":false,"ids":[7]}]}"#,
            model: "group")
        let expected = #"{"rows":[{"id":6,"changes":{"add":[16],"delete":[8]}},{"id":3,"changes":{"add":[12],"delete":[4]}},{"id":10}]}"#
        XCTAssertEqual(result, try JSONDecoder().decode(JSONValue.self, from: Data(expected.utf8)))
    }

    func testDiffDistinguishesOmittedAndEmptyAndRejectsIncompleteBaseline() throws {
        let prior = #"{"id":1,"complete":true,"ids":[4,9,4]}"#
        let omitted = try project(#"{"id":1}"#, baseline: prior, model: "member", mode: "overlayBaseline")
        let empty = try project(#"{"id":1,"ids":[]}"#, baseline: prior, model: "member")
        let same = try project(#"{"id":1,"ids":[9,4]}"#, baseline: prior, model: "member")
        XCTAssertEqual(omitted, .object(["records": .array([.object(["id": .number(1)])])]))
        XCTAssertEqual(omitted, same)
        XCTAssertEqual(empty, .object(["records": .array([.object(["id": .number(1), "changes": .object(["delete": .array([.number(4), .number(9)])])])])]))
        XCTAssertThrowsError(try project(#"{"id":1,"ids":[]}"#, baseline: #"{"id":1,"complete":false,"ids":[4]}"#, model: "member"))
        XCTAssertThrowsError(try project(#"{"id":1,"ids":[9007199254740992]}"#, baseline: prior, model: "member"))
    }

    func testExplicitNeedsNoBaselineAndIgnoresPriorIntent() throws {
        let expected: JSONValue = .object(["records": .array([.object(["id": .number(1), "include": .array([.string("x"), .string("z")])])])])
        let draft = #"{"id":1,"edits":{"added":["x","z","x"]}}"#
        XCTAssertEqual(try project(draft, model: "operation"), expected)
        XCTAssertEqual(try project(draft, baseline: #"{"id":1,"edits":{"deleted":["y"]}}"#, model: "operation", mode: "overlayBaseline"), expected)
        XCTAssertThrowsError(try project(#"{"id":1,"edits":{"added":["x"],"deleted":["x"]}}"#, model: "operation"))
    }
}
