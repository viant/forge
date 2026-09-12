import XCTest
@testable import ForgeIOSRuntime

final class DataSourceHookProjectionTests: XCTestCase {
    func testDependentLoaderFetchUpdatesSourceAndStopsCycle() async throws {
        let payload = #"{"namespace":"Test","actions":{"code":"({load: ({context}) => {const target=context.Context('labels'); target.handlers.dataSource.setInputParameters({Id:7}); target.handlers.dataSource.fetchCollection();}, apply: ({context,collection}) => {const source=context.Context('source'); source.signals.form.value={summary:collection[0].label}; source.handlers.dataSource.fetchCollection();}})"},"dataSource":{"source":{"on":[{"event":"onSuccess","handler":"Test.load"}]},"labels":{"on":[{"event":"onSuccess","handler":"Test.apply"}]}}}"#
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        actor Calls {
            var refs: [String] = []
            func add(_ ref: String) { refs.append(ref) }
        }
        let calls = Calls()
        let runtime = ForgeRuntime()
        await runtime.registerWindowMetadataLoader { _ in metadata }
        let window = await runtime.openWindow(key: "test", title: "Test")
        await runtime.registerDataSourceLoader { request in
            await calls.add(request.dataSourceRef)
            if request.dataSourceRef == "labels" {
                XCTAssertEqual(request.input.parameters["Id"], .number(7))
                return .init(rows: [["label": .string("Resolved targeting")]])
            }
            return .init(rows: [["id": .number(7)]])
        }
        await runtime.refreshDataSourceCollection(windowID: window.id, dataSourceRef: "source")
        let form = await runtime.dataSourceRuntime.form(dataSourceID: WindowIdentity(windowID: window.id).dataSourceID(ref: "source"))
        XCTAssertEqual(form["summary"], .string("Resolved targeting"))
        let requested = await calls.refs
        XCTAssertEqual(requested, ["source", "labels"])
    }

    func testRegisteredLoaderRunsSuccessAndFailureHooks() async throws {
        let payload = #"{"namespace":"Test","actions":{"code":"({success: ({context}) => { context.signals.form.value = {status:'loaded'}; }, failure: ({context}) => { context.signals.form.value = {status:'failed'}; }})"},"dataSource":{"source":{"on":[{"event":"onSuccess","handler":"Test.success"},{"event":"onError","handler":"Test.failure"}]}}}"#
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let runtime = ForgeRuntime()
        await runtime.registerWindowMetadataLoader { _ in metadata }
        let window = await runtime.openWindow(key: "test", title: "Test")
        await runtime.registerDataSourceLoader { _ in .init(rows: [["id": .number(1)]]) }
        await runtime.refreshDataSourceCollection(windowID: window.id, dataSourceRef: "source")
        let id = WindowIdentity(windowID: window.id).dataSourceID(ref: "source")
        let loaded = await runtime.dataSourceRuntime.form(dataSourceID: id)
        XCTAssertEqual(loaded["status"], .string("loaded"))
        await runtime.registerDataSourceLoader { _ in throw URLError(.cannotConnectToHost) }
        await runtime.refreshDataSourceCollection(windowID: window.id, dataSourceRef: "source")
        let failed = await runtime.dataSourceRuntime.form(dataSourceID: id)
        XCTAssertEqual(failed["status"], .string("failed"))
    }

    func testRecordsCrossDatasourceEffectsInOrderWithoutChangingSnapshot() throws {
        let snapshots: [String: JSONValue] = ["source": .object(["form": .object(["id": .number(7)])]), "labels": .object([:])]
        let code = #"({load: ({context}) => { context.signals.form.value = {...context.signals.form.peek(), loading:true}; setTimeout(() => { const target = context.Context('labels'); target.handlers.dataSource.setInputParameters({Id:7}); target.handlers.dataSource.fetchCollection(); }, 0); }})"#
        let effects = try DataSourceHookProjection.invoke(code: code, function: "Workspace.load", namespace: "Workspace", source: "source", snapshots: snapshots, collection: [])
        XCTAssertEqual(effects.map { $0.objectValue?["kind"]?.stringValue }, ["form", "input", "fetch"])
        XCTAssertEqual(effects[1].objectValue?["ref"], .string("labels"))
        XCTAssertEqual(snapshots["source"]?.objectValue?["form"]?.objectValue?["loading"], nil)
    }

    func testRejectsDelayedWorkInsteadOfExecutingItEarly() {
        XCTAssertThrowsError(try DataSourceHookProjection.invoke(code: "({load: () => setTimeout(() => {}, 1000)})", function: "load", namespace: nil, source: "source", snapshots: ["source": .object([:])], collection: []))
    }
}
