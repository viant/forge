import XCTest

@testable import ForgeIOSRuntime

private actor CommandJournal {
    var calls: [(String, [String: JSONValue])] = []
    func append(_ request: ForgeRuntime.DataSourceFetchRequest) {
        calls.append((request.dataSourceRef, request.input.parameters))
    }
}

final class OrderedMutationCommandTests: XCTestCase {
    private let script = #"""
        ({
          record: ({extras, parameters}) => {
            if (Object.keys(extras.steps).length || parameters.steps) throw Error('foreign receipt');
            return {name:'entry'};
          },
          link: ({extras}) => {
            const first = extras.steps.first;
            if (!first.invocationId || first.rows.length !== 0) throw Error('unexpected first receipt');
            return {source:first.invocationId};
          },
          finish: ({extras, parameters}) => {
            if (parameters.steps) throw Error('receipt leaked');
            return {value:extras.steps.second.rows[0].value, link:extras.steps.first.invocationId};
          }
        })
        """#

    private func metadata(refs: [String: Any]? = nil) throws -> WindowMetadata {
        let sources =
            refs
            ?? Dictionary(
                uniqueKeysWithValues: ["draft", "create", "link", "remove", "unlink", "save", "list"].map { ($0, [:] as [String: String]) })
        return try JSONDecoder().decode(
            WindowMetadata.self,
            from: JSONSerialization.data(withJSONObject: [
                "namespace": "Items", "actions": ["code": script], "dataSource": sources, "dialogs": [["id": "editor"]],
            ]))
    }

    private func footer(_ body: [String: Any] = [:]) throws -> ActionDef {
        var command: [String: Any] = [
            "commandId": "complete", "serializationGroup": "editing", "dataSourceRef": "save", "prepare": "Items.finish",
            "pendingState": ["pending": true], "cleanupState": ["cleanup": true], "errorState": ["error": true],
            "indeterminateState": ["uncertain": true], "resultState": ["receipt": ["0.id"]], "refresh": [["dataSourceRef": "list"]],
            "before": [
                [
                    "command": ["commandId": "first", "invocationParameter": "attempt", "dataSourceRef": "create", "prepare": "Items.record"],
                    "cleanup": ["commandId": "undoFirst", "dataSourceRef": "remove", "prepare": "Items.link"],
                ],
                [
                    "command": ["commandId": "second", "dataSourceRef": "link", "prepare": "Items.link"],
                    "cleanup": ["commandId": "undoSecond", "dataSourceRef": "unlink"],
                ],
            ],
        ]
        command.merge(body) { _, replacement in replacement }
        return try JSONDecoder().decode(
            ActionDef.self, from: JSONSerialization.data(withJSONObject: ["id": "save", "mutationCommand": command]))
    }

    private func seeded() async throws -> (ForgeRuntime, String) {
        let runtime = ForgeRuntime()
        let window = await runtime.openWindowInline(key: "items", title: "Items", metadata: try metadata())
        return (runtime, window.id)
    }

    private func run(_ runtime: ForgeRuntime, _ id: String, _ action: ActionDef) async -> MutationCommandResult? {
        await runtime.activateDialogFooter(windowID: id, dialogID: "editor", sourceDataSourceRef: "draft", action: action)
    }

    private func result(_ ref: String) -> ForgeRuntime.DataSourceFetchResult {
        switch ref {
        case "link": return .init(rows: [["value": .number(0)]])
        case "save": return .init(rows: [["id": .number(42)]])
        default: return .init(rows: [])
        }
    }

    func testStagesHaveIndependentImmutableRecordsAndOneFinalRefresh() async throws {
        let (runtime, id) = try await seeded()
        let journal = CommandJournal()
        await runtime.registerDataSourceLoader { request in
            await journal.append(request)
            return self.result(request.dataSourceRef)
        }
        let action = try footer()
        let result = await runtime.executeMutationCommand(
            windowID: id, sourceDataSourceRef: "draft", command: try XCTUnwrap(action.footerCommand),
            extras: ["steps": .object(["spoofed": .bool(true)])])
        let calls = await journal.calls
        XCTAssertEqual(result.status, "succeeded", result.error ?? "")
        XCTAssertEqual(calls.map(\.0), ["create", "link", "save", "list"])
        guard calls.count == 4 else { return }
        let invocation = try XCTUnwrap(calls[0].1["attempt"])
        XCTAssertNotEqual(invocation, .string(result.invocationId))
        XCTAssertEqual(calls[0].1, ["name": .string("entry"), "attempt": invocation])
        XCTAssertEqual(calls[1].1, ["source": invocation])
        XCTAssertEqual(calls[2].1, ["link": invocation, "value": .number(0)])
        let form = await runtime.windowFormJSONValue(windowID: id)
        XCTAssertEqual(form["receipt"], .number(42))
        XCTAssertNil(form["cleanup"])
    }

    func testCleanupReverseOrderOriginalErrorAndNoStateAfterDialogReplacement() async throws {
        let (runtime, id) = try await seeded()
        let action = try footer()
        let root = try XCTUnwrap(action.footerCommand)
        let journal = CommandJournal()
        await runtime.openDialog(windowID: id, dialogID: "editor", parameters: [:])
        await runtime.registerDataSourceLoader { request in
            await journal.append(request)
            switch request.dataSourceRef {
            case "save": throw NSError(domain: "validation", code: 1, userInfo: [NSLocalizedDescriptionKey: "value rejected"])
            case "unlink":
                let state = await runtime.mutationCommandState(windowID: id, command: root)
                XCTAssertEqual(state.phase, .cleaningUp)
                XCTAssertTrue(state.guarded)
                XCTAssertFalse(state.pending)
                XCTAssertEqual(state.error, "value rejected")
                let form = await runtime.windowFormJSONValue(windowID: id)
                XCTAssertEqual(form["cleanup"], .bool(true))
                let other = MutationCommandDef(commandId: "other", serializationGroup: "editing", dataSourceRef: "save")
                let result = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: other)
                XCTAssertEqual(result.status, "group_busy")
                await runtime.closeDialogPublic(windowID: id, dialogID: "editor")
                await runtime.openDialog(windowID: id, dialogID: "editor", parameters: [:])
                throw NSError(domain: "validation", code: 2, userInfo: [NSLocalizedDescriptionKey: "cleanup rejected"])
            default: return self.result(request.dataSourceRef)
            }
        }
        let result = await run(runtime, id, action)
        let calls = await journal.calls
        XCTAssertEqual(calls.map(\.0), ["create", "link", "save", "unlink", "remove"])
        XCTAssertEqual(result?.status, "failed")
        XCTAssertEqual(result?.error, "value rejected")
        XCTAssertEqual(result?.warnings.map(\.stage), ["cleanup"])
        let form = await runtime.windowFormJSONValue(windowID: id)
        XCTAssertNil(form["error"], "A replacement presentation owns its draft")
    }

    func testUnknownStageRetainsActualWriterAndGroupUntilResolution() async throws {
        let (runtime, id) = try await seeded()
        let action = try footer()
        let root = try XCTUnwrap(action.footerCommand)
        let journal = CommandJournal()
        await runtime.registerDataSourceLoader { request in
            await journal.append(request)
            if request.dataSourceRef == "link" { throw URLError(.timedOut) }
            return self.result(request.dataSourceRef)
        }
        let result = await run(runtime, id, action)
        XCTAssertEqual(result?.status, "indeterminate")
        XCTAssertEqual(result?.failedStepId, "second")
        XCTAssertEqual(result?.accepted, true)
        let state = await runtime.mutationCommandState(windowID: id, command: root)
        XCTAssertEqual(state.writerStatus, .notInvoked)
        XCTAssertTrue(state.guarded)
        let peer = MutationCommandDef(commandId: "other", dataSourceRef: "link")
        let competing = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: peer)
        XCTAssertEqual(competing.status, "transport_busy")
        let retry = await run(runtime, id, action)
        XCTAssertEqual(retry?.status, "suppressed")
        let calls = await journal.calls
        XCTAssertEqual(calls.map(\.0), ["create", "link"])
        let resolved = await runtime.resolveIndeterminateMutationCommand(windowID: id, command: root)
        XCTAssertTrue(resolved)
    }

    func testCrossedSelectionStopsFurtherEffectsAndCommittedRefreshFailureNeverCompensates() async throws {
        for changeSelection in [true, false] {
            let (runtime, id) = try await seeded()
            let journal = CommandJournal()
            await runtime.registerDataSourceLoader { request in
                await journal.append(request)
                if changeSelection && request.dataSourceRef == "link" {
                    await runtime.setDataSourceSelection(windowID: id, dataSourceRef: "draft", selected: ["id": .number(2)])
                }
                if request.dataSourceRef == "list" { throw URLError(.networkConnectionLost) }
                return self.result(request.dataSourceRef)
            }
            let result = await run(runtime, id, try footer())
            let calls = await journal.calls
            XCTAssertEqual(calls.map(\.0), changeSelection ? ["create", "link"] : ["create", "link", "save", "list"])
            XCTAssertEqual(result?.status, changeSelection ? "superseded" : "succeeded")
            XCTAssertEqual(result?.warnings.map(\.stage), changeSelection ? [] : ["refresh"])
        }
    }

    func testSkipAndRejectHaveDistinctEffectsAndInvalidPlanStartsNoWriter() async throws {
        let never: [String: Any] = ["source": "form", "field": "enabled", "equals": true]
        let (runtime, id) = try await seeded()
        let journal = CommandJournal()
        await runtime.registerDataSourceLoader { request in
            await journal.append(request)
            return self.result(request.dataSourceRef)
        }
        let one: [String: Any] = ["commandId": "first", "dataSourceRef": "create", "prepare": "Items.record"]
        let blocked: [String: Any] = ["commandId": "blocked", "dataSourceRef": "link", "validateWhen": never]
        let steps: [[String: Any]] = [["when": never, "command": one], ["command": blocked]]
        let result = await run(runtime, id, try footer(["before": steps]))
        XCTAssertEqual(result?.failedStepId, "blocked")
        XCTAssertEqual(result?.accepted, false)
        XCTAssertEqual(result?.status, "invalid")
        let duplicate = await run(runtime, id, try footer(["before": [["command": one], ["when": never, "command": one]]]))
        XCTAssertEqual(duplicate?.status, "invalid_payload")
        let calls = await journal.calls
        XCTAssertTrue(calls.isEmpty)
    }
}

private final class CommandResponseProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let path = request.url!.lastPathComponent
        let status = Int(path) ?? 200
        let body: String
        switch path {
        case "true": body = #"{"rows":[true]}"#
        case "false": body = #"{"rows":[false]}"#
        case "number": body = #"{"rows":[1]}"#
        case "text": body = #"{"rows":["true"]}"#
        case "own": body = #"{"rows":[{"accepted":true}]}"#
        case "refused": body = #"{"rows":[{"accepted":false}]}"#
        case "bad-shape": body = #"{"rows":{}}"#
        case "missing": body = #"{"message":"received"}"#
        case "malformed": body = "invalid"
        default: body = #"{"rows":[]}"#
        }
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: [:])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

extension OrderedMutationCommandTests {
    func testHTTPResponseReceiptAndStatusDistinguishRejectionFromUnknown() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [CommandResponseProtocol.self]
        let session = URLSession(configuration: configuration)
        for (path, expected) in [
            ("400", "failed"), ("401", "failed"), ("403", "failed"), ("422", "failed"),
            ("408", "indeterminate"), ("502", "indeterminate"), ("missing", "indeterminate"),
            ("bad-shape", "indeterminate"), ("malformed", "indeterminate"), ("empty", "succeeded"),
        ] {
            let runtime = ForgeRuntime(windowMetadataBaseURL: URL(string: "https://items.test")!, session: session)
            let definitions: [String: Any] = [
                "draft": [:], "stage": ["service": ["uri": "/" + path, "method": "POST"]],
                "save": ["service": ["uri": "/empty", "method": "POST"]],
            ]
            let window = await runtime.openWindowInline(key: "items", title: "Items", metadata: try metadata(refs: definitions))
            let step = MutationBeforeStepDef(command: .init(commandId: "stage", dataSourceRef: "stage"))
            let root = MutationCommandDef(commandId: "complete", before: [step], dataSourceRef: "save")
            let result = await runtime.executeMutationCommand(windowID: window.id, sourceDataSourceRef: "draft", command: root)
            XCTAssertEqual(result.status, expected, path)
            XCTAssertEqual(result.failedStepId, expected == "succeeded" ? nil : "stage", path)
            let state = await runtime.mutationCommandState(windowID: window.id, command: root)
            XCTAssertEqual(state.guarded, expected == "indeterminate", path)
        }
    }
}

extension OrderedMutationCommandTests {
    func testCleanupReceiptConditionUsesOnlyInvocationRowsAndRetainsThePrimaryError() async throws {
        let condition = try JSONDecoder().decode(
            DashboardConditionDef.self,
            from: Data(
                #"{"any":[{"source":"collection","field":"0.accepted","equals":true},{"source":"collection","field":"0","equals":true}]}"#.utf8))
        for (shape, accepted) in [
            ("true", true), ("own", true), ("false", false), ("refused", false), ("number", false),
            ("text", false), ("empty", false), ("missing", false),
        ] {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [CommandResponseProtocol.self]
            let runtime = ForgeRuntime(
                windowMetadataBaseURL: URL(string: "https://items.test")!, session: URLSession(configuration: configuration))
            let definitions: [String: Any] = [
                "draft": [:], "stage": ["service": ["uri": "/empty", "method": "POST"]],
                "cleanup": ["service": ["uri": "/" + shape, "method": "POST"]],
                "save": ["service": ["uri": "/422", "method": "POST"]],
            ]
            let window = await runtime.openWindowInline(key: "items", title: "Items", metadata: try metadata(refs: definitions))
            await runtime.setDataSourceCollection(windowID: window.id, dataSourceRef: "cleanup", rows: [["accepted": .bool(true)]])
            let step = MutationBeforeStepDef(
                command: .init(commandId: "stage", dataSourceRef: "stage"),
                cleanup: .init(commandId: "remove", dataSourceRef: "cleanup", receiptWhen: condition))
            let command = MutationCommandDef(commandId: "complete", before: [step], dataSourceRef: "save")
            let result = await runtime.executeMutationCommand(windowID: window.id, sourceDataSourceRef: "draft", command: command)
            let state = await runtime.mutationCommandState(windowID: window.id, command: command)
            XCTAssertEqual(result.status, "failed", shape)
            XCTAssertTrue(result.error?.contains("422") == true, shape)
            XCTAssertEqual(result.warnings.map(\.stage), accepted ? [] : ["cleanup"], shape)
            XCTAssertEqual(state.guarded, shape == "missing", shape)
        }
    }
}

extension OrderedMutationCommandTests {
    func testTerminalClearPreservesNewerEditsAndUnknownOrReopenedDrafts() async throws {
        for mode in ["success", "rejected", "timeout", "changed", "replaced", "invalid"] {
            let (runtime, id) = try await seeded()
            let fields = ["attachment", "attachments", "replacement", "absent"]
            let original: [String: JSONValue] = [
                "attachment": .object(["value": .string("submitted")]), "attachments": .array([.string("first")]),
                "replacement": .bool(false), "neighbor": .number(0),
            ]
            await runtime.setDataSourceForm(windowID: id, dataSourceRef: "draft", values: original)
            await runtime.openDialog(windowID: id, dialogID: "editor", parameters: [:])
            let journal = CommandJournal()
            await runtime.registerDataSourceLoader { request in
                await journal.append(request)
                if request.dataSourceRef == "save" {
                    if mode == "timeout" { throw URLError(.timedOut) }
                    if mode == "changed" {
                        var newer = original
                        newer["attachment"] = .object(["value": .string("newer")])
                        await runtime.setDataSourceForm(windowID: id, dataSourceRef: "draft", values: newer)
                    }
                    if mode == "replaced" {
                        await runtime.closeDialogPublic(windowID: id, dialogID: "editor")
                        await runtime.openDialog(windowID: id, dialogID: "editor", parameters: [:])
                    }
                    if mode == "rejected" { throw NSError(domain: "producer", code: 422) }
                }
                return self.result(request.dataSourceRef)
            }
            var override: [String: Any] = ["clearFormFields": fields]
            if mode == "invalid" { override["validateWhen"] = ["source": "form", "field": "absent", "exists": true] }
            let result = await run(runtime, id, try footer(override))
            let current = await runtime.dataSourceForm(windowID: id, dataSourceRef: "draft")
            let stored = await runtime.dataSourceRuntime.form(dataSourceID: WindowIdentity(windowID: id).dataSourceID(ref: "draft"))
            XCTAssertEqual(current, stored, mode)
            var expected = original
            if ["success", "changed", "rejected"].contains(mode) {
                expected["attachment"] = mode == "changed" ? .object(["value": .string("newer")]) : .null
                expected["attachments"] = .array([])
                expected["replacement"] = .null
            }
            XCTAssertEqual(current, expected, mode)
            let calls = await journal.calls
            XCTAssertEqual(calls.filter { $0.0 == "draft" }.count, 0, mode)
            let windowForm = await runtime.windowFormJSONValue(windowID: id)
            XCTAssertNil(windowForm["attachment"], mode)
            if mode == "replaced" {
                XCTAssertEqual(result?.status, "superseded")
                let state = await runtime.mutationCommandState(windowID: id, command: try XCTUnwrap(footer(override).footerCommand))
                XCTAssertEqual(state.writerStatus, .succeeded)
            }
        }
    }
}

extension OrderedMutationCommandTests {
    func testRootEligibilityRemainsLiveWhileIgnoringItsOwnPendingPatch() async throws {
        for revoke in [true,false] {
            let (runtime,id) = try await seeded()
            let capture = CommandJournal()
            let action = try footer(["pendingState":["busy":true], "validateWhen":["all":[
                ["source":"windowForm","field":"busy","notEquals":true],
                ["source":"windowForm","field":"allowed","equals":true]
            ]]])
            await runtime.setWindowFormValue(windowID:id,values:["allowed":.bool(true)])
            await runtime.registerDataSourceLoader { request in
                await capture.append(request)
                if revoke && request.dataSourceRef == "create" {
                    await runtime.setWindowFormValue(windowID:id,values:["allowed":.bool(false)])
                }
                return self.result(request.dataSourceRef)
            }
            let result = await run(runtime,id,action)
            let calls = await capture.calls
            XCTAssertEqual(calls.map(\.0),revoke ? ["create","remove"] : ["create","link","save","list"])
            XCTAssertEqual(result?.status,revoke ? "invalid_payload" : "succeeded")
        }
    }
}
