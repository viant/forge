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
        let projection = try DataSourceHookProjection.invoke(code: code, function: "Workspace.load", namespace: "Workspace", source: "source", snapshots: snapshots, collection: [])
        let effects = projection.effects
        XCTAssertEqual(effects.map { $0.objectValue?["kind"]?.stringValue }, ["form", "input", "fetch"])
        XCTAssertEqual(effects[1].objectValue?["ref"], .string("labels"))
        XCTAssertEqual(snapshots["source"]?.objectValue?["form"]?.objectValue?["loading"], nil)
    }

    func testRejectsDelayedWorkInsteadOfExecutingItEarly() {
        XCTAssertThrowsError(try DataSourceHookProjection.invoke(code: "({load: () => setTimeout(() => {}, 1000)})", function: "load", namespace: nil, source: "source", snapshots: ["source": .object([:])], collection: []))
    }

    func testOnFetchReturnsTransformedRowsAlongsideOrderedEffects() throws {
        let projection = try DataSourceHookProjection.invoke(
            code: "({transform: ({context,collection}) => {context.signals.form.value={status:'projected'}; return collection.map(row => ({...row,label:String(row.label).toUpperCase()}));}})",
            function: "Test.transform", namespace: "Test", source: "source",
            snapshots: ["source": .object(["form": .object([:]), "collection": .array([])])],
            collection: [["id": .number(1), "label": .string("ready")]]
        )
        XCTAssertEqual(projection.result?.arrayValue?.first?.objectValue?["label"], .string("READY"))
        XCTAssertEqual(projection.effects.first?.objectValue?["kind"], .string("form"))
    }

    func testRegisteredLoaderPublishesOnFetchRowsBeforeOnSuccess() async throws {
        let payload = #"{"namespace":"Test","actions":{"code":"({transform: ({collection}) => collection.map(row => ({...row,label:String(row.label).toUpperCase()})), success: ({context}) => {context.signals.form.value={seen:context.handlers.dataSource.getCollection()[0].label};}})"},"dataSource":{"source":{"on":[{"event":"onFetch","handler":"Test.transform"},{"event":"onSuccess","handler":"Test.success"}]}}}"#
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let runtime = ForgeRuntime()
        await runtime.registerWindowMetadataLoader { _ in metadata }
        await runtime.registerDataSourceLoader { _ in .init(rows: [["id": .number(1), "label": .string("ready")]]) }
        let window = await runtime.openWindow(key: "test", title: "Test")

        await runtime.refreshDataSourceCollection(windowID: window.id, dataSourceRef: "source")

        let rows = await runtime.dataSourceCollection(windowID: window.id, dataSourceRef: "source")
        let form = await runtime.dataSourceForm(windowID: window.id, dataSourceRef: "source")
        XCTAssertEqual(rows.first?["label"], .string("READY"))
        XCTAssertEqual(form["seen"], .string("READY"))
    }

    func testNilAndThrowingOnFetchHooksPreserveRegisteredRows() async throws {
        let payload = #"{"namespace":"Test","actions":{"code":"({noop: () => undefined, broken: () => {throw new Error('bad transform');}})"},"dataSource":{"source":{"on":[{"event":"onFetch","handler":"Test.noop"},{"event":"onFetch","handler":"Test.broken"}]}}}"#
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let runtime = ForgeRuntime()
        await runtime.registerWindowMetadataLoader { _ in metadata }
        await runtime.registerDataSourceLoader { _ in .init(rows: [["id": .number(1), "label": .string("raw")]]) }
        let window = await runtime.openWindow(key: "test", title: "Test")

        await runtime.refreshDataSourceCollection(windowID: window.id, dataSourceRef: "source")

        let rows = await runtime.dataSourceCollection(windowID: window.id, dataSourceRef: "source")
        XCTAssertEqual(rows.first?["label"], .string("raw"))
    }

    func testDirectFetchPathPublishesOnFetchTransformation() async throws {
        let payload = #"{"namespace":"Test","actions":{"code":"({transform: ({collection}) => collection.map(row => ({...row,label:String(row.label).toUpperCase()}))})"},"dataSource":{"source":{"service":{"uri":"/source","method":"GET"},"on":[{"event":"onFetch","handler":"Test.transform"}]}}}"#
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [HookProjectionURLProtocol.self]
        HookProjectionURLProtocol.body = #"{"data":[{"id":1,"label":"direct"}]}"#
        let runtime = ForgeRuntime(windowMetadataBaseURL: URL(string: "https://preview.test")!, session: URLSession(configuration: configuration))
        await runtime.registerWindowMetadataLoader { _ in metadata }
        let window = await runtime.openWindow(key: "test", title: "Test")

        await runtime.refreshDataSourceCollection(windowID: window.id, dataSourceRef: "source")

        let rows = await runtime.dataSourceCollection(windowID: window.id, dataSourceRef: "source")
        XCTAssertEqual(rows.first?["label"], .string("DIRECT"))
    }

    func testNamespacedUIActionsReturnPredicatesAndApplyBoundedEffects() async throws {
        let payload = #"{"namespace":"Test","actions":{"code":"({allowed: ({context}) => {const allowed=context.signals.windowForm.peek().enabled===true;context.signals.windowForm.value={shouldNotApply:true};return allowed;}, open: ({context,row}) => {context.signals.windowForm.value={...context.signals.windowForm.peek(),opened:true};return context.handlers.window.openDialog({execution:{args:['detail']},parameters:{Id:row.id}});}, external: () => window.open('https://example.test/help'), unsafe: () => window.open('javascript:alert(1)')})"},"dataSource":{"source":{}},"dialogs":[{"id":"detail"}]}"#
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let runtime = ForgeRuntime()
        let openedURLs = UIActionURLCapture()
        await runtime.registerExternalURLHandler { url in await openedURLs.add(url) }
        await runtime.registerWindowMetadataLoader { _ in metadata }
        let window = await runtime.openWindow(key: "test", title: "Test")
        await runtime.setWindowFormValue(windowID: window.id, values: ["enabled": .bool(true)])
        let context = ExecutionContext(windowID: window.id, dataSourceRef: "source")

        let allowed = await runtime.execute(ExecutionDef(action: "Test.allowed", event: "onVisible"), context: context)
        XCTAssertEqual(allowed, .bool(true))
        let predicateWindowForm = await runtime.windowFormJSONValue(windowID: window.id)
        XCTAssertNil(predicateWindowForm["shouldNotApply"])
        _ = await runtime.execute(ExecutionDef(action: "Test.open", event: "onClick"), context: context, args: ["row": .object(["id": .number(7)])])

        let actionWindowForm = await runtime.windowFormJSONValue(windowID: window.id)
        let dialog = await runtime.dialogState(windowID: window.id, dialogID: "detail")
        XCTAssertEqual(actionWindowForm["opened"], .bool(true))
        XCTAssertEqual(dialog.props["Id"], .number(7))
        _ = await runtime.execute(ExecutionDef(action: "Test.external", event: "onClick"), context: context)
        _ = await runtime.execute(ExecutionDef(action: "Test.unsafe", event: "onClick"), context: context)
        let capturedURLs = await openedURLs.values()
        XCTAssertEqual(capturedURLs, [URL(string: "https://example.test/help")!])
    }

    func testProjectedUIActionsApplyCollectionSelectionAndWindowFieldEffects() async throws {
        let payload = #"{"namespace":"Test","actions":{"code":"({mutate: ({context}) => {context.handlers.dataSource.setWindowFormField({item:{dataField:'mode'},value:'review'});context.handlers.dataSource.setCollection([{id:2,name:'updated'}]);context.handlers.dataSource.setSelected({selection:[{id:2,name:'updated'}]});return true;}})"},"dataSource":{"source":{}}}"#
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let runtime = ForgeRuntime()
        await runtime.registerWindowMetadataLoader { _ in metadata }
        let window = await runtime.openWindow(key: "test", title: "Test")
        let context = ExecutionContext(windowID: window.id, dataSourceRef: "source")

        _ = await runtime.execute(ExecutionDef(action: "Test.mutate", event: "onClick"), context: context)

        let windowForm = await runtime.windowFormJSONValue(windowID: window.id)
        let rows = await runtime.dataSourceCollection(windowID: window.id, dataSourceRef: "source")
        let selection = await runtime.dataSourceSelectionState(windowID: window.id, dataSourceRef: "source")
        XCTAssertEqual(windowForm["mode"], .string("review"))
        XCTAssertEqual(rows.first?["id"], .number(2))
        XCTAssertEqual(selection.selected?["id"], .number(2))
    }
}

private final class HookProjectionURLProtocol: URLProtocol {
    nonisolated(unsafe) static var body = "{}"
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(Self.body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

private actor UIActionURLCapture {
    private var urls: [URL] = []
    func add(_ url: URL) { urls.append(url) }
    func values() -> [URL] { urls }
}
