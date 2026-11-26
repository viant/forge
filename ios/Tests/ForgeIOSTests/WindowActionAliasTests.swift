import XCTest
@testable import ForgeIOSRuntime

final class WindowActionAliasTests: XCTestCase {
    func testProjectedEventsResolveNestedActionsWithinTheirWindow() async {
        let code = """
        ({
            lookup: ({context, name, record}) => context.lookupHandler(name)({context, record}),
            select: ({context, record}) => { context.signals.windowForm.value = {chosen: record.id}; return record; },
            'ordinary.with.dot': () => 17,
            'Other.select': () => ({foreign: true})
        })
        """
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(namespace: "Workspace", dataSources: ["draft": DataSourceDef()],
                                      actions: ActionsDef(code: code), actionAliases: ["Shared"])
        let window = await runtime.openWindowInline(key: "records", title: "Records", metadata: metadata)
        let context = ExecutionContext(windowID: window.id, dataSourceRef: "draft")
        let lookup = ExecutionDef(action: "Workspace.lookup", event: "onLookup")
        for (index, name) in ["Shared.select", "Workspace.select", "select"].enumerated() {
            let record: JSONValue = .object(["id": .number(Double(index + 1)), "flag": .bool(false), "note": .null])
            let selected = await runtime.execute(lookup, context: context, args: ["name": .string(name), "record": record])
            XCTAssertEqual(selected, record, name)
            let stored = await runtime.windowFormJSONValue(windowID: window.id)
            XCTAssertEqual(stored["chosen"], .number(Double(index + 1)), name)
        }
        let direct = await runtime.execute(ExecutionDef(action: "Shared.ordinary.with.dot"), context: context)
        XCTAssertEqual(direct, .number(17))
        for name in ["Other.select", "Shared.missing", "Shared.toString"] {
            let result = await runtime.execute(lookup, context: context, args: ["name": .string(name), "record": .object([:])])
            XCTAssertNil(result, name)
        }
        let visible = ExecutionDef(action: "Workspace.lookup", event: "onVisible")
        _ = await runtime.execute(visible, context: context, args: ["name": .string("Shared.select"), "record": .object(["id": .number(99)])])
        let stored = await runtime.windowFormJSONValue(windowID: window.id)
        XCTAssertEqual(stored["chosen"], .number(3))
    }
}
