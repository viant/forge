import XCTest
@testable import ForgeIOSRuntime

final class ResourceInvariantTests: XCTestCase {
    typealias Object = [String: JSONValue]

    private func schema(_ assertion: String, when: String? = nil) throws -> ResourceSchemaDef {
        let rule = """
        {"assert":\(assertion),"message":"Invalid combination"\(when.map { ",\"when\":\($0)" } ?? "")}
        """
        let definition = """
        {"type":"object","properties":{"value":{"nullable":true},"count":{"nullable":true},"enabled":{"type":"boolean"},"locked":{"type":"boolean"},"range":{"type":"array","items":{"nullable":true}}},"invariants":[\(rule)]}
        """
        return try JSONDecoder().decode(ResourceSchemaDef.self,from:Data(definition.utf8))
    }

    private func accepts(_ schema: ResourceSchemaDef, _ data: Object) -> Bool {
        (try? ResourceModelRuntime.validate(value:.object(data),schemaRef:"entry",schemas:["entry":schema])) != nil
    }

    func testStrictOperandsPreserveMissingNullZeroFalseAndWhitespace() throws {
        let explicitNull = try schema(#"{"field":"value","equals":null}"#)
        XCTAssertTrue(accepts(explicitNull, ["value":.null]))
        XCTAssertFalse(accepts(explicitNull, [:]))
        let nonNull = try schema(#"{"field":"value","notEquals":null}"#)
        XCTAssertTrue(accepts(nonNull, [:]))
        XCTAssertFalse(accepts(nonNull, ["value":.null]))
        let choices = try schema(#"{"source":"form","field":"value","in":[false,2]}"#)
        XCTAssertTrue(accepts(choices, ["value":.bool(false)]))
        XCTAssertFalse(accepts(choices, ["value":.number(0)]))
        XCTAssertFalse(accepts(choices, ["value":.string("2")]))
        let present = try schema(#"{"field":"value","exists":true}"#)
        let nonempty = try schema(#"{"field":"value","notEmpty":true}"#)
        for value in [JSONValue.number(0), .bool(false), .string(" ")] {
            XCTAssertTrue(accepts(present, ["value":value]))
            XCTAssertTrue(accepts(nonempty, ["value":value]))
        }
        XCTAssertFalse(accepts(present, ["value":.null]))
        XCTAssertFalse(accepts(present, [:]))
        let empty = try schema(#"{"field":"value","empty":true}"#)
        for data: Object in [[:], ["value":.null], ["value":.string("")], ["value":.array([])], ["value":.object([:])]] {
            XCTAssertTrue(accepts(empty, data))
        }
    }

    func testGroupConditionsAndFiniteDecimalBounds() throws {
        let rule = try schema(
            #"{"all":[{"field":"range.0","gte":1,"lt":5},{"any":[{"field":"count","equals":0},{"not":{"field":"locked","equals":true}}]}]}"#,
            when:#"{"field":"enabled","equals":true}"#)
        XCTAssertTrue(accepts(rule, ["enabled":.bool(false)]))
        XCTAssertTrue(accepts(rule, [:]))
        for valid in [JSONValue.string(" +2.5e0 "), .number(1)] {
            XCTAssertTrue(accepts(rule, ["enabled":.bool(true),"range":.array([valid]),"count":.number(0),"locked":.bool(true)]))
        }
        for invalid in [JSONValue.string(""), .string("0x2"), .string("NaN"), .string("1e999"), .null, .bool(true), .number(5)] {
            XCTAssertFalse(accepts(rule, ["enabled":.bool(true),"range":.array([invalid])]))
        }
        XCTAssertFalse(accepts(rule, ["enabled":.bool(true),"range":.array([.number(3)]),"count":.bool(false),"locked":.bool(true)]))
    }

    func testPeerFieldBoundsResolveTheSameNestedObjectAndRejectInvalidOperands() throws {
        let raw = #"""
        {"type":"object","properties":{"interval":{"type":"object","properties":{"start":{"nullable":true},"end":{"nullable":true}}},"limit":{"nullable":true}},"invariants":[{"assert":{"all":[{"field":"interval.end","gtField":"interval.start","lteField":"limit","gt":0},{"field":"interval.start","ltField":"interval.end","gteField":"interval.start"}]},"path":"interval.end","message":"Provide a valid interval"}]}
        """#
        let range = try JSONDecoder().decode(ResourceSchemaDef.self,from:Data(raw.utf8))
        let start = 1_900_000_000_000.0, end = start + 86_400_000
        func data(_ from: JSONValue?, _ to: JSONValue?, limit: JSONValue? = nil) -> Object {
            var interval: Object = [:]
            interval["start"] = from
            interval["end"] = to
            return ["interval":.object(interval),"limit":limit ?? .number(end)]
        }
        XCTAssertTrue(accepts(range, data(.number(start),.number(end))))
        XCTAssertTrue(accepts(range, data(.string("1.9e12"),.number(end),limit:.string(" 1900086400000 "))))
        XCTAssertFalse(accepts(range, data(.number(start),.number(start))))
        XCTAssertFalse(accepts(range, data(.number(end),.number(start))))
        XCTAssertFalse(accepts(range, data(.number(start),.number(end),limit:.number(end-1))))
        for bad: JSONValue? in [nil,.null,.bool(false),.string("  "),.string("0x20"),.string("Infinity"),.string("1e999")] {
            XCTAssertFalse(accepts(range, data(bad,.number(end))))
            XCTAssertFalse(accepts(range, data(.number(start),bad)))
        }
    }

    func testInlineAndReferencedObjectInvariantsRetainNestedPathAndOrder() throws {
        let raw = #"""
        {"entry":{"type":"object","properties":{"rows":{"type":"array","items":{"type":"object","properties":{"reference":{"$ref":"detail"},"label":{"type":"string"}},"invariants":[{"assert":{"field":"label","notEmpty":true},"path":"label","message":"Provide a label"}]}}}},
         "detail":{"type":"object","properties":{"owner":{"type":"object","properties":{"id":{"type":"integer"}}},"label":{"type":"string"}},"invariants":[{"assert":{"field":"owner.id","exists":true},"path":"owner.id","message":"Provide an owner"},{"assert":{"field":"label","exists":true},"message":"Other failure"}]}}
        """#
        let schemas = try JSONDecoder().decode([String: ResourceSchemaDef].self,from:Data(raw.utf8))
        let sample: JSONValue = .object(["rows":.array([.object(["reference":.object([:])])])])
        XCTAssertThrowsError(try ResourceModelRuntime.validate(value:sample,schemaRef:"entry",schemas:schemas)) { error in
            XCTAssertEqual(error.localizedDescription,"$.rows.0.reference.owner.id: Provide an owner")
        }
        XCTAssertThrowsError(try ResourceModelRuntime.validate(value:.object(["rows":.array([.object([:])])]),schemaRef:"entry",schemas:schemas)) { error in
            XCTAssertEqual(error.localizedDescription,"$.rows.0.label: Provide a label")
        }
        let old = try JSONDecoder().decode(ResourceSchemaDef.self,from:Data(#"{"type":"object"}"#.utf8))
        XCTAssertTrue(accepts(old, [:]))
        let roundtrip = try JSONDecoder().decode([String: ResourceSchemaDef].self,from:JSONEncoder().encode(schemas))
        XCTAssertThrowsError(try ResourceModelRuntime.validate(value:sample,schemaRef:"entry",schemas:roundtrip))
    }

    func testCanonicalConditionsRejectUnsupportedScopesAndAmbiguousOperators() {
        for invalid in [
            #"{"source":"authorization","field":"roles","exists":true}"#,
            #"{"field":"name","matches":"."}"#,
            #"{"field":"value","equals":true,"gt":0}"#,
            #"{"field":"value","in":[{}]}"#,
            #"{"field":"value","gtField":3}"#,
            #"{"field":"value","ltField":"limit","empty":false}"#,
            #"{"any":[]}"#,
            #"{"not":{"field":"value","exists":true},"field":"other"}"#
        ] { XCTAssertThrowsError(try schema(invalid), invalid) }
    }

    func testNormalMutationChecksCanonicalValuesBeforeWriterDispatch() async throws {
        let raw = #"""
        {"view":{"content":{}},"dataSource":{"draft":{},"writer":{}},"schemas":{"record":{"type":"object","properties":{"enabled":{"type":"boolean"},"quantity":{"type":"integer"}},"invariants":[{"when":{"field":"enabled","equals":true},"assert":{"field":"quantity","gt":0},"path":"quantity","message":"A quantity is required"}]}},"resourceModels":{"record":{"schemaRef":"record","write":{"dataSourceRef":"writer","mode":"full"},"fields":{"enabled":{"write":"enabled"},"quantity":{"write":"quantity"}}}}}
        """#
        let metadata = try JSONDecoder().decode(WindowMetadata.self,from:Data(raw.utf8))
        let command = try JSONDecoder().decode(MutationCommandDef.self,from:Data(#"{"dataSourceRef":"writer","payload":{"modelRef":"record","source":{"scope":"form"},"mode":"full"}}"#.utf8))
        let runtime = ForgeRuntime(), calls = InvariantWrites()
        let window = await runtime.openWindowInline(key:"records",title:"Records",metadata:metadata)
        await runtime.registerDataSourceLoader { request in await calls.add(request.input.parameters); return .init(rows:[]) }
        let form: Object = ["enabled":.bool(true),"quantity":.number(0)]
        await runtime.setDataSourceForm(windowID:window.id,dataSourceRef:"draft",values:form)
        let rejected = await runtime.executeMutationCommand(windowID:window.id,sourceDataSourceRef:"draft",command:command)
        XCTAssertEqual(rejected.status,"invalid_payload")
        XCTAssertEqual(rejected.error,"$.quantity: A quantity is required")
        let writes = await calls.rows
        XCTAssertTrue(writes.isEmpty)
        let retained = await runtime.formJSONValue(windowID:window.id,dataSourceRef:"draft")
        XCTAssertEqual(retained,form)
        let valid: Object = ["enabled":.bool(false),"quantity":.number(0)]
        await runtime.setDataSourceForm(windowID:window.id,dataSourceRef:"draft",values:valid)
        let saved = await runtime.executeMutationCommand(windowID:window.id,sourceDataSourceRef:"draft",command:command)
        XCTAssertEqual(saved.status,"succeeded")
        let actual = await calls.rows
        XCTAssertEqual(actual,[valid])
    }
}

private actor InvariantWrites {
    var rows: [[String: JSONValue]] = []
    func add(_ row: [String: JSONValue]) { rows.append(row) }
}
