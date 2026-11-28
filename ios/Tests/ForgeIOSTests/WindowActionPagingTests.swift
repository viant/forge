import XCTest
@testable import ForgeIOSRuntime

final class WindowActionPagingTests: XCTestCase {
    func testOrdinaryActionReadsTheCurrentRegisteredPage() async {
        let code = """
        ({
            inspect: ({context}) => {
                const rows = context.Context('rows'), ds = rows.handlers.dataSource;
                const control = rows.signals.control.peek(), input = ds.peekInput();
                return {loaded: control.loaded, stale: control.stale, error: control.error,
                    page: ds.getPage(), size: ds.getPageSize(), info: ds.getCollectionInfo(),
                    fetch: input.fetch, refresh: input.refresh, unknown: !!context.Context('other')};
            }
        })
        """
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(namespace: "Workspace", dataSources: [
            "button": DataSourceDef(), "rows": DataSourceDef(paging: DataSourcePagingDef(size: 40))
        ], actions: ActionsDef(code: code))
        let window = await runtime.openWindowInline(key: "paging", title: "Paging", metadata: metadata)
        let context = ExecutionContext(windowID: window.id, dataSourceRef: "button")
        let action = ExecutionDef(action: "Workspace.inspect")
        let id = WindowIdentity(windowID: window.id).dataSourceID(ref: "rows")
        let info: [String: JSONValue] = ["totalCount": .number(0), "pageCount": .number(1)]
        let unresolved = await runtime.execute(action, context: context)
        XCTAssertEqual(unresolved?.objectValue?["loaded"], .bool(false))

        let input = InputState(page: 1, fetch: true, refresh: true)
        await runtime.dataSourceRuntime.setInput(dataSourceID: id, input: input)
        await runtime.dataSourceRuntime.setCollection(dataSourceID: id, rows: [], forInput: input)
        await runtime.dataSourceRuntime.setCollectionInfo(dataSourceID: id, values: info)
        await runtime.setDataSourceMetrics(windowID: window.id, dataSourceRef: "rows", values: ["totalCount": .number(99)])
        let loaded = await runtime.execute(action, context: context)
        XCTAssertEqual(loaded, .object([
            "loaded": .bool(true), "stale": .bool(false), "error": .null, "page": .number(1),
            "size": .number(40), "info": .object(info), "fetch": .bool(true), "refresh": .bool(true),
            "unknown": .bool(false)
        ]))

        await runtime.dataSourceRuntime.setInput(dataSourceID: id, input: InputState(page: 2))
        await runtime.dataSourceRuntime.setControl(dataSourceID: id, control: ControlState(error: "Unavailable"))
        let stale = await runtime.execute(action, context: context)
        XCTAssertEqual(stale?.objectValue?["stale"], .bool(true))
        XCTAssertEqual(stale?.objectValue?["error"], .string("Unavailable"))
        XCTAssertEqual(stale?.objectValue?["page"], .number(2))
    }
}
