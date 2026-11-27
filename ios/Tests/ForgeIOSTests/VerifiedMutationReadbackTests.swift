import XCTest

@testable import ForgeIOSRuntime

private actor ReadbackJournal {
    private(set) var requests: [ForgeRuntime.DataSourceFetchRequest] = []
    private var readerRelease: CheckedContinuation<Void, Never>?
    private var readerStarted: CheckedContinuation<Void, Never>?

    func blockReader() async {
        await withCheckedContinuation {
            readerRelease = $0
            readerStarted?.resume()
            readerStarted = nil
        }
    }

    func waitUntilReaderBlocked() async {
        guard readerRelease == nil else { return }
        await withCheckedContinuation { readerStarted = $0 }
    }

    func releaseReader() {
        readerRelease?.resume()
        readerRelease = nil
    }

    func record(_ request: ForgeRuntime.DataSourceFetchRequest) -> Int {
        requests.append(request)
        return requests.filter { $0.dataSourceRef == request.dataSourceRef }.count
    }
}

final class VerifiedMutationReadbackTests: XCTestCase {
    private let goodRow: [String: JSONValue] = ["key": .number(42), "tenant": .number(9), "division": .string("A"), "label": .null]

    private func metadata(actor: String = "user", httpReaderMethod: String? = nil, preparedFooter: ActionDef? = nil) throws -> WindowMetadata {
        var sources: [String: [String: Any]] = ["draft": [:], "writer": [:], "reader": [:], "related": [:]]
        if let method = httpReaderMethod {
            sources["writer"] = ["service": ["uri": "/v1/api/datasources/writer/fetch", "method": "POST"]]
            sources["reader"] = ["service": ["uri": "/v1/api/datasources/reader/fetch", "method": method], "params": ["unrelated": "excluded"]]
            sources["related"] = ["service": ["uri": "/v1/api/datasources/related/fetch", "method": "POST"]]
        }
        var dialog: [String: Any] = ["id": "edit"]
        if let preparedFooter {
            sources["list"] = ["selectionMode": "multi"]
            sources["prepareReader"] = [:]
            dialog["dataSourceRef"] = "draft"
            dialog["actions"] = [try JSONSerialization.jsonObject(with: JSONEncoder().encode(preparedFooter))]
        }
        return try JSONDecoder().decode(WindowMetadata.self, from: JSONSerialization.data(withJSONObject: [
            "view": ["content": [:]], "authorizationSnapshot": ["principal": ["subject": actor]],
            "dataSource": sources, "dialogs": [dialog],
            "actions": ["code": "({seed: ({rows}) => ({prepared: rows.length}), submit: () => ({items:[{id:42,name:null}]})})"],
        ]))
    }

    private func footer(generated: Bool, timeoutMs: Int = 30_000) throws -> ActionDef {
        var verify: [String: Any] = [
            "idsParameter": "acknowledgedIds", "fields": ["name": "label", "absent": "missingInReader"],
            "scope": [
                ["field": "tenant", "parameter": ["name": "tenantId", "in": "windowForm", "location": "tenantId"], "passToReader": true],
                ["field": "division", "parameter": ["name": "division", "in": "windowForm", "location": "division", "to": "reader"]],
            ],
        ]
        if generated { verify["submittedRows"] = "items" }
        let receiptIdentity: [String: Any] = generated ? ["field": "id", "generated": true] : ["field": "id", "submittedRows": "items"]
        return try JSONDecoder().decode(ActionDef.self, from: JSONSerialization.data(withJSONObject: [
            "id": "submit", "close": true,
            "mutationCommand": [
                "commandId": "submit", "dataSourceRef": "writer", "prepare": "submit", "timeoutMs": timeoutMs,
                "receiptIdentity": receiptIdentity,
                "reconcile": ["mode": "refetch", "dataSourceRef": "reader", "identityField": "key", "resultPath": "0.data", "verify": verify],
                "resultState": ["writerWarning": ["0.warning"]], "successState": ["completed": true], "refresh": [["dataSourceRef": "related"]],
            ],
        ]))
    }

    private func seeded() async throws -> (ForgeRuntime, String, ReadbackJournal) {
        let runtime = ForgeRuntime()
        let window = await runtime.openWindowInline(key: "items", title: "Items", metadata: try metadata())
        _ = await runtime.presentDialog(windowID: window.id, dialogID: "edit")
        await runtime.setWindowFormValue(windowID: window.id, values: ["tenantId": .number(9), "division": .string("A")], bumpPrefillRevision: false)
        return (runtime, window.id, ReadbackJournal())
    }

    private func submit(_ runtime: ForgeRuntime, _ id: String, _ action: ActionDef) async -> MutationCommandResult? {
        await runtime.activateDialogFooter(windowID: id, dialogID: "edit", sourceDataSourceRef: "draft", action: action)
    }

    private func writerReceipt() -> ForgeRuntime.DataSourceFetchResult {
        .init(rows: [["data": .array([.object(["id": .number(42)])]), "warning": .string("retained")]])
    }

    func testSingletonScopeIsForwardedUnchangedAndComparedWithTheRowScalar() async throws {
        let (runtime, id, journal) = try await seeded()
        let action = try footer(generated: false)
        let receipt = writerReceipt(), row = goodRow
        await runtime.registerDataSourceLoader { request in
            _ = await journal.record(request)
            if request.dataSourceRef == "writer" { return receipt }
            if request.dataSourceRef == "related" { return .init() }
            XCTAssertEqual(request.resolvedInputs["tenantId"], .array([.number(9)]))
            return .init(rows: [row])
        }
        await runtime.setWindowFormValue(windowID: id, values: ["tenantId": .array([.number(8), .number(9)])], bumpPrefillRevision: false)
        let invalid = await submit(runtime, id, action)
        XCTAssertEqual(invalid?.accepted, false)
        await runtime.setWindowFormValue(windowID: id, values: ["tenantId": .array([.number(9)])], bumpPrefillRevision: false)
        let verified = await submit(runtime, id, action)
        XCTAssertEqual(verified?.status, "succeeded", verified?.error ?? "")
        XCTAssertEqual(verified?.readbackRows, [row])
    }

    func testReadFailureAndMissingNullRetryWithoutWriterReplayAndPreserveEnvelope() async throws {
        let (runtime, id, journal) = try await seeded()
        let action = try footer(generated: true)
        let row = goodRow, receipt = writerReceipt()
        let fullCollection: [[String: JSONValue]] = [["key": .number(10)], ["key": .number(11)]]
        await runtime.setDataSourceCollection(windowID: id, dataSourceRef: "reader", rows: fullCollection)
        await runtime.registerDataSourceLoader { request in
            let call = await journal.record(request)
            if request.dataSourceRef == "writer" { return receipt }
            if request.dataSourceRef == "related" { return .init() }
            XCTAssertTrue(request.bypassCache)
            XCTAssertEqual(request.input.parameters, ["acknowledgedIds": .array([.number(42)]), "tenantId": .number(9)])
            XCTAssertEqual(request.resolvedInputs, request.input.parameters)
            switch call {
            case 1: throw URLError(.timedOut)
            case 2: return .init(rows: [row.filter { $0.key != "label" }])
            default: return .init(rows: [row])
            }
        }

        for _ in 0..<2 {
            let result = await submit(runtime, id, action)
            XCTAssertEqual(result?.status, "verification_failed")
            XCTAssertEqual(result?.accepted, true)
            XCTAssertNil(result?.readbackRows)
            XCTAssertEqual(result?.writerRecords, receipt.rows.map(JSONValue.object))
            let state = await runtime.mutationCommandState(windowID: id, command: try XCTUnwrap(action.footerCommand))
            XCTAssertEqual(state.writerStatus, .succeeded)
            XCTAssertEqual(state.syncStatus, .verificationFailed)
            XCTAssertTrue(state.retryAllowed)
            let dialog = await runtime.dialogState(windowID: id, dialogID: "edit")
            XCTAssertTrue(dialog.open)
            let fields = await runtime.windowFormJSONValue(windowID: id)
            XCTAssertNil(fields["completed"])
        }

        let result = await submit(runtime, id, action)
        XCTAssertEqual(result?.status, "succeeded", result?.error ?? "")
        XCTAssertEqual(result?.readbackRows, [goodRow])
        XCTAssertEqual(result?.writerRecords, receipt.rows.map(JSONValue.object))
        let calls = await journal.requests.map(\.dataSourceRef)
        XCTAssertEqual(calls, ["writer", "reader", "reader", "reader", "related"])
        let collection = await runtime.dataSourceCollection(windowID: id, dataSourceRef: "reader")
        XCTAssertEqual(collection, fullCollection)
        let state = await runtime.windowFormJSONValue(windowID: id)
        XCTAssertEqual(state["writerWarning"], .string("retained"))
        XCTAssertEqual(state["completed"], .bool(true))
        let dialog = await runtime.dialogState(windowID: id, dialogID: "edit")
        XCTAssertFalse(dialog.open)
    }

    func testEveryScopeAndExactIDsAreRequired() async throws {
        let (runtime, id, journal) = try await seeded()
        let action = try footer(generated: false)
        let row = goodRow, receipt = writerReceipt()
        await runtime.registerDataSourceLoader { request in
            let call = await journal.record(request)
            if request.dataSourceRef == "writer" { return receipt }
            if request.dataSourceRef == "related" { return .init() }
            switch call {
            case 1: return .init(rows: [row.filter { $0.key != "division" }])
            case 2: return .init(rows: [row.merging(["division": .string("B")]) { _, value in value }])
            case 3: return .init(rows: [row, row])
            case 4: return .init(rows: [row.merging(["key": .string("42")]) { _, value in value }])
            default: return .init(rows: [row])
            }
        }
        for _ in 0..<4 {
            let result = await submit(runtime, id, action)
            XCTAssertEqual(result?.status, "verification_failed")
        }
        let result = await submit(runtime, id, action)
        XCTAssertEqual(result?.status, "succeeded")
        let calls = await journal.requests.map(\.dataSourceRef)
        XCTAssertEqual(calls, ["writer", "reader", "reader", "reader", "reader", "reader", "related"])
    }

    func testChangedScopeOrActorCannotVerifyOrReplayAcknowledgedWrite() async throws {
        for changeActor in [false, true] {
            let (runtime, id, journal) = try await seeded()
            let action = try footer(generated: false)
            let changedActor = try metadata(actor: "replacement")
            let row = goodRow, receipt = writerReceipt()
            await runtime.registerDataSourceLoader { request in
                _ = await journal.record(request)
                if request.dataSourceRef == "writer" { return receipt }
                if changeActor {
                    _ = await runtime.updateWindowInline(id: id, title: "Items", metadata: changedActor)
                } else {
                    await runtime.setWindowFormValue(windowID: id, values: ["tenantId": .number(10), "division": .string("A")], bumpPrefillRevision: false)
                }
                return .init(rows: [row])
            }

            let first = await submit(runtime, id, action)
            XCTAssertEqual(first?.status, "verification_failed")
            XCTAssertNil(first?.writerRecords)
            let state = await runtime.mutationCommandState(windowID: id, command: try XCTUnwrap(action.footerCommand))
            XCTAssertEqual(state.writerStatus, .succeeded)
            XCTAssertFalse(state.retryAllowed)
            _ = await submit(runtime, id, action)
            _ = await runtime.presentDialog(windowID: id, dialogID: "edit")
            let displaced = await runtime.activateDialogFooter(windowID: id, dialogID: "edit", sourceDataSourceRef: "draft", action: action,
                retryVerificationInvocationId: first?.invocationId)
            XCTAssertEqual(displaced?.status, "suppressed")
            let calls = await journal.requests.map(\.dataSourceRef)
            XCTAssertEqual(calls, ["writer", "reader"])
            let windowForm = await runtime.windowFormJSONValue(windowID: id)
            XCTAssertNil(windowForm["completed"])
        }
    }
    func testReplacementDialogCanSubmitAfterStaleRetryIsSuppressed() async throws {
        let (runtime, id, journal) = try await seeded()
        let action = try footer(generated: true)
        let row = goodRow, receipt = writerReceipt()
        await runtime.registerDataSourceLoader { request in
            let call = await journal.record(request)
            if request.dataSourceRef == "writer" {
                if call == 1 { return receipt }
                return .init(rows: [["data": .array([.object(["id": .number(43)])])]])
            }
            if request.dataSourceRef == "related" { return .init() }
            if call == 1 { throw URLError(.timedOut) }
            return .init(rows: [row.merging(["key": .number(43)]) { _, value in value }])
        }

        let first = await submit(runtime, id, action)
        XCTAssertEqual(first?.status, "verification_failed")
        let retryId = try XCTUnwrap(first?.invocationId)
        _ = await runtime.presentDialog(windowID: id, dialogID: "edit")
        let stale = await runtime.activateDialogFooter(windowID: id, dialogID: "edit", sourceDataSourceRef: "draft", action: action,
            retryVerificationInvocationId: retryId)
        XCTAssertEqual(stale?.status, "suppressed")
        let fresh = await submit(runtime, id, action)
        XCTAssertEqual(fresh?.status, "succeeded")
        XCTAssertEqual(fresh?.readbackRows?.first?["key"], .number(43))
        let requests = await journal.requests
        XCTAssertEqual(requests.map(\.dataSourceRef), ["writer", "reader", "writer", "reader", "related"])
        XCTAssertEqual(requests[3].input.parameters["acknowledgedIds"], .array([.number(43)]))
    }

    func testPreparedDialogFencesParentSelectionEvenWhenTheDraftDidNotChange() async throws {
        for change in ["label", "duringRead", "beforeRetry", "beforeWrite"] {
            let action = try footer(generated: false)
            let runtime = ForgeRuntime()
            let metadata = try metadata(preparedFooter: action)
            let id = await runtime.openWindowInline(key: "items", title: "Items", metadata: metadata).id
            let journal = ReadbackJournal()
            let receipt = writerReceipt(), goodRow = goodRow
            let selection: @Sendable (Double, String, Int) async -> Void = { key, label, index in
                let row: [String: JSONValue] = ["id": .number(key), "label": .string(label)]
                await runtime.setDataSourceSelectionState(windowID: id, dataSourceRef: "list",
                    selection: SelectionState(selected: row, selection: [row], rowIndex: index))
            }
            await selection(42, "Original", 0)
            await runtime.setWindowFormValue(windowID: id, values: ["tenantId": .number(9), "division": .string("A")], bumpPrefillRevision: false)
            await runtime.registerDataSourceLoader { request in
                let count = await journal.record(request)
                switch request.dataSourceRef {
                case "prepareReader": return .init(rows: [["id": .number(42), "label": .string("Original")]])
                case "writer": return receipt
                case "related": return .init()
                default:
                    if change == "label" { await selection(42, "Updated caption", 10) }
                    if change == "duringRead" {
                        await selection(43, "Other", 1)
                        await selection(42, "Original again", 0)
                    }
                    if change == "beforeRetry" && count == 1 { throw URLError(.timedOut) }
                    return .init(rows: [goodRow])
                }
            }
            let operation = EditableCollectionOperationSpec(id: "edit", label: "Edit", dialogId: "edit",
                prepareSelection: .init(dataSourceRef: "prepareReader", idsParameter: "Ids", identityField: "id", prepare: "seed"))
            let prepared = await runtime.prepareEditableSelection(windowID: id, sourceDataSourceRef: "list",
                collection: .init(dataSourceRef: "list", operations: [operation]), operation: operation)
            XCTAssertEqual(prepared.status, "opened", prepared.error ?? "")
            if change == "beforeWrite" {
                await selection(43, "Other", 1)
                await selection(42, "Original again", 0)
            }
            let result = await submit(runtime, id, action)
            if change == "beforeWrite" {
                XCTAssertEqual(result?.accepted, false)
            } else if change == "label" {
                XCTAssertEqual(result?.status, "succeeded")
                XCTAssertEqual(result?.readbackRows, [goodRow])
            } else {
                XCTAssertEqual(result?.status, "verification_failed")
                if change == "beforeRetry" {
                    await selection(43, "Other", 1)
                    await selection(42, "Original again", 0)
                }
                let retry = await runtime.activateDialogFooter(windowID: id, dialogID: "edit", sourceDataSourceRef: "draft",
                    action: action, retryVerificationInvocationId: result?.invocationId)
                XCTAssertEqual(retry?.status, "verification_failed")
                XCTAssertNil(retry?.readbackRows)
                let state = await runtime.mutationCommandState(windowID: id, command: try XCTUnwrap(action.footerCommand))
                XCTAssertEqual(state.writerStatus, .succeeded)
                XCTAssertFalse(state.retryAllowed)
            }
            let calls = await journal.requests.map(\.dataSourceRef)
            switch change {
            case "beforeWrite": XCTAssertEqual(calls, ["prepareReader"])
            case "label": XCTAssertEqual(calls, ["prepareReader", "writer", "reader", "related"])
            default: XCTAssertEqual(calls, ["prepareReader", "writer", "reader"])
            }
        }
    }

    func testHTTPReadbackSendsExactScopedEnvelopeAndRejectsUnencodableGet() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [VerifiedReadbackURLProtocol.self]
        let session = URLSession(configuration: configuration)
        for method in ["POST", "GET", "DELETE"] {
            let runtime = ForgeRuntime(windowMetadataBaseURL: URL(string: "https://fixture.test")!, session: session)
            let window = await runtime.openWindowInline(key: "items", title: "Items", metadata: try metadata(httpReaderMethod: method))
            _ = await runtime.presentDialog(windowID: window.id, dialogID: "edit")
            await runtime.setWindowFormValue(windowID: window.id, values: ["tenantId": .number(9), "division": .string("A")], bumpPrefillRevision: false)
            let result = await submit(runtime, window.id, try footer(generated: true))
            if method == "POST" {
                XCTAssertEqual(result?.status, "succeeded", result?.error ?? "")
                XCTAssertEqual(result?.readbackRows, [goodRow])
            } else if method == "GET" {
                XCTAssertEqual(result?.status, "verification_failed")
                XCTAssertEqual(result?.accepted, true)
                XCTAssertNil(result?.readbackRows)
            } else {
                XCTAssertEqual(result?.accepted, false)
                XCTAssertNil(result?.readbackRows)
            }
        }
    }

    func testConcurrentFooterActivationCannotStartAnotherReadOrWriter() async throws {
        let (runtime, id, journal) = try await seeded()
        let action = try footer(generated: false)
        let row = goodRow, receipt = writerReceipt()
        await runtime.registerDataSourceLoader { request in
            let call = await journal.record(request)
            if request.dataSourceRef == "writer" { return receipt }
            if request.dataSourceRef == "related" { return .init() }
            await journal.blockReader()
            if call == 1 { throw URLError(.timedOut) }
            return .init(rows: [row])
        }

        for readAttempt in 1...2 {
            async let background = runtime.activateDialogFooter(windowID: id, dialogID: "edit", sourceDataSourceRef: "draft", action: action)
            await journal.waitUntilReaderBlocked()
            let duplicate = await submit(runtime, id, action)
            XCTAssertEqual(duplicate?.status, "suppressed")
            await journal.releaseReader()
            let result = await background
            XCTAssertEqual(result?.status, readAttempt == 1 ? "verification_failed" : "succeeded")
        }
        let calls = await journal.requests.map(\.dataSourceRef)
        XCTAssertEqual(calls, ["writer", "reader", "reader", "related"])
    }

    func testReaderDeadlinePreservesAcknowledgementWhenLoaderIgnoresCancellation() async throws {
        let (runtime, id, journal) = try await seeded()
        let action = try footer(generated: true, timeoutMs: 1000)
        let row = goodRow, receipt = writerReceipt()
        await runtime.registerDataSourceLoader { request in
            let attempt = await journal.record(request)
            if request.dataSourceRef == "writer" { return receipt }
            if request.dataSourceRef == "related" { return .init() }
            if attempt == 1 { await journal.blockReader() }
            return .init(rows: [row])
        }
        let timedOut = await submit(runtime, id, action)
        XCTAssertEqual(timedOut?.status, "verification_failed")
        XCTAssertTrue(timedOut?.error?.contains("timed out") == true)
        let verified = await submit(runtime, id, action)
        XCTAssertEqual(verified?.status, "succeeded")
        await journal.releaseReader()
        let calls = await journal.requests.map(\.dataSourceRef)
        XCTAssertEqual(calls, ["writer", "reader", "reader", "related"])
    }

}


private final class VerifiedReadbackURLProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url else { return }
        let result: String
        switch url.path {
        case "/v1/api/datasources/writer/fetch":
            result = #"{"rows":[{"data":[{"id":42}],"warning":"retained"}]}"#
        case "/v1/api/datasources/reader/fetch":
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Cache-Control"), "no-cache")
            var body = request.httpBody ?? Data()
            if body.isEmpty, let stream = request.httpBodyStream {
                stream.open()
                defer { stream.close() }
                var chunk = [UInt8](repeating: 0, count: 1024)
                while true {
                    let count = stream.read(&chunk, maxLength: chunk.count)
                    if count <= 0 { break }
                    body.append(contentsOf: chunk.prefix(count))
                }
            }
            var envelope = (try? JSONDecoder().decode(JSONValue.self, from: body))?.objectValue ?? [:]
            let readInvocation = envelope.removeValue(forKey: "invocationId")?.stringValue ?? ""
            XCTAssertNotNil(UUID(uuidString: readInvocation))
            XCTAssertEqual(envelope, [
                "inputs": .object(["acknowledgedIds": .array([.number(42)]), "tenantId": .number(9)]),
                "cache": .object(["bypassCache": .bool(true)]),
            ])
            result = #"{"rows":[{"key":42,"tenant":9,"division":"A","label":null}]}"#
        case "/v1/api/datasources/related/fetch":
            result = #"{"rows":[]}"#
        default:
            XCTFail("Unexpected HTTP path: \(url.path)")
            result = #"{"rows":[]}"#
        }
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: [:])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(result.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
