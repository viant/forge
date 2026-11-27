import XCTest

@testable import ForgeIOSRuntime

private actor GroupJournal {
    private var first: CheckedContinuation<Void, Never>?
    private var dispatchGoal = 1
    private var release: [CheckedContinuation<Void, Never>] = []
    private var released = false
    private(set) var calls: [(String, [String: JSONValue])] = []
    private(set) var confirmations: [String] = []
    private(set) var transportIDs: [String: String] = [:]
    private(set) var uncached: Set<String> = []

    func record(_ request: ForgeRuntime.DataSourceFetchRequest) {
        calls.append((request.dataSourceRef, request.input.parameters))
        transportIDs[request.dataSourceRef] = request.invocationId
        if request.bypassCache { uncached.insert(request.dataSourceRef) }
        if calls.count >= dispatchGoal {
            first?.resume()
            first = nil
        }
    }

    func confirm(_ message: String) -> Bool {
        confirmations.append(message)
        return true
    }

    func waitForDispatch(_ count: Int = 1) async {
        guard calls.count < count else { return }
        dispatchGoal = count
        await withCheckedContinuation { first = $0 }
    }

    func waitForRelease() async {
        guard !released else { return }
        await withCheckedContinuation { release.append($0) }
    }

    func completeWrite() {
        released = true
        release.forEach { $0.resume() }
        release.removeAll()
    }
}

final class GroupedMutationCommandTests: XCTestCase {
    private func command(_ body: [String: Any]) throws -> MutationCommandDef {
        try JSONDecoder().decode(MutationCommandDef.self, from: JSONSerialization.data(withJSONObject: body))
    }

    private func fixture() async throws -> (ForgeRuntime, String) {
        let runtime = ForgeRuntime()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"""
            {"view":{"content":{}},"dialogs":[{"id":"edit"}],"namespace":"Documents",
             "actions":{"code":"({seed: ({parameters, extras}) => { if (parameters.bound !== 'original' || extras.bound !== 'extras' || parameters.ids !== undefined) throw Error('Root snapshots were merged'); const stamp = String(Math.random()); if(extras.badKey) return {other:{}}; return {one:{archive:{pixelIds:[42]},stamp},three:{archive:{pixelIds:extras.ids},stamp}}; }})"},
             "dataSource":{
              "draft": {}, "one": {}, "two": {}, "three": {}, "off": {}, "list": {}, "summary": {}
            }}
            """#.utf8))
        let id = await runtime.openWindowInline(key: "documents", title: "Documents", metadata: metadata).id
        return (runtime, id)
    }

    private func member(_ id: String, extras: [String: Any] = [:]) -> [String: Any] {
        var fields: [String: Any] = ["commandId": id, "label": id.capitalized, "dataSourceRef": id]
        fields.merge(extras) { _, replacement in replacement }
        return ["command": fields]
    }

    func testMixedGroupUsesOneConfirmationAndContinuesAfterKnownAndUnknownFailures() async throws {
        let (runtime, id) = try await fixture()
        let journal = GroupJournal()
        await runtime.registerDataSourceLoader { request in
            await journal.record(request)
            switch request.dataSourceRef {
            case "one": return .init(rows: [["status": .string("rejected"), "message": .string("Entry is read only.")]])
            case "two": return .init(rows: [["status": .string("queued")]])
            default: return .init(rows: [["id": .number(42)]])
            }
        }
        let receipt = ["source": "collection", "field": "0.status", "equals": "committed"]
        let root = try command([
            "commandId": "group", "serializationGroup": "documents", "confirm": "Proceed?",
            "pendingState": ["pending": true], "indeterminateState": ["pending": false, "unverified": true],
            "refresh": [["dataSourceRef": "list", "bypassCache": true]],
            "group": [
                member("one", extras: ["receiptWhen": receipt,
                    "rejectedWhen": ["source": "collection", "field": "0.status", "equals": "rejected"]]),
                member("two", extras: ["receiptWhen": receipt]),
                member("three", extras: ["invocationParameter": "attempt"]),
                ["when": ["source": "windowForm", "field": "enabled", "equals": true], "command": ["commandId": "off", "dataSourceRef": "off"]],
            ],
        ])
        let result = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: root,
            extras: ["name": .string("Example")], confirm: { await journal.confirm($0) })
        let calls = await journal.calls
        let state = await runtime.mutationCommandState(windowID: id, command: root)
        XCTAssertEqual(result.status, "indeterminate")
        XCTAssertTrue(result.accepted)
        XCTAssertEqual(result.members, state.members)
        XCTAssertEqual(result.members?["one"]?.status, "failed")
        XCTAssertEqual(result.members?["one"]?.error, "Entry is read only.")
        XCTAssertEqual(result.members?["two"]?.status, "indeterminate")
        XCTAssertEqual(result.members?["off"]?.status, "skipped")
        XCTAssertEqual(result.members?["three"]?.rows, [.object(["id": .number(42)])])
        XCTAssertEqual(Set(calls.dropLast().map(\.0)), ["one", "two", "three"])
        XCTAssertEqual(calls.last?.0, "list")
        XCTAssertEqual(calls.first(where: { $0.0 == "three" })?.1["attempt"], result.members?["three"]?.invocationId.map(JSONValue.string))
        XCTAssertEqual(Set(result.members?.values.compactMap(\.invocationId) ?? []).count, 3)
        let transportIDs = await journal.transportIDs
        let uncached = await journal.uncached
        XCTAssertEqual(transportIDs, ["one": result.members?["one"]?.invocationId,
                                      "two": result.members?["two"]?.invocationId,
                                      "three": result.members?["three"]?.invocationId].compactMapValues { $0 })
        XCTAssertEqual(uncached, ["one", "two", "three", "list"])
        XCTAssertTrue(state.guarded)
        XCTAssertFalse(state.retryAllowed)
        XCTAssertTrue(state.message.contains("One: Entry is read only."))
        XCTAssertTrue(state.message.contains("Two: verify the outcome"))
        XCTAssertTrue(state.message.contains("Three: completed"))
        let form = await runtime.windowFormJSONValue(windowID: id)
        XCTAssertEqual(form["unverified"], .bool(true))

        let retry = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: root,
            confirm: { await journal.confirm($0) })
        let confirmations = await journal.confirmations
        XCTAssertEqual(retry.status, "suppressed")
        XCTAssertEqual(confirmations, ["Proceed?"])
        let independent = try command(["commandId": "recover", "dataSourceRef": "two"])
        let blocked = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: independent)
        XCTAssertEqual(blocked.status, "transport_busy")
        let reconciled = await runtime.resolveIndeterminateMutationCommand(windowID: id, command: root)
        XCTAssertTrue(reconciled)
        let released = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: independent)
        XCTAssertEqual(released.status, "succeeded")
    }

    func testPreparesMemberInputsOnceAndChecksScalarIdentitiesBeforeDispatch() async throws {
        let (runtime, id) = try await fixture()
        let journal = GroupJournal()
        await runtime.registerDataSourceLoader { request in
            await journal.record(request)
            return .init(rows: [["id": .number(42)]])
        }
        let identity = ["field": "id", "submittedValues": "archive.pixelIds"]
        let root = try command(["commandId": "group", "prepare": "Documents.seed", "confirm": "Proceed?",
            "parameters": [["name": "bound", "in": "windowForm", "location": "bound"]],
            "group": [member("one", extras: ["receiptIdentity": identity,
                      "parameters": [["name": "stamp", "value": "child"], ["name": "childOnly", "value": "child"]]]), member("two"),
                      member("three", extras: ["receiptIdentity": identity])]])
        await runtime.setWindowFormValue(windowID: id, values: ["bound": .string("original")])
        for extras: [String: JSONValue] in [
            ["badKey": .bool(true), "bound": .string("extras")],
            ["ids": .array([.number(42), .number(42)]), "bound": .string("extras")],
        ] {
            let result = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: root,
                extras: extras, confirm: { _ in true })
            XCTAssertEqual(result.status, "invalid_payload")
        }
        let preflightCalls = await journal.calls
        XCTAssertTrue(preflightCalls.isEmpty)
        let result = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: root,
            extras: ["ids": .array([.number(42)]), "bound": .string("extras")], confirm: { _ in
                await runtime.setWindowFormValue(windowID: id, values: ["bound": .string("changed")])
                return true
            })
        XCTAssertEqual(result.status, "succeeded", result.error ?? "")
        XCTAssertEqual(result.members?["two"]?.status, "skipped")
        let calls = await journal.calls
        XCTAssertEqual(Set(calls.map(\.0)), ["one", "three"])
        XCTAssertEqual(calls.count, 2)
        XCTAssertEqual(Set(calls.compactMap { $0.1["stamp"]?.stringValue }).count, 1)
        XCTAssertTrue(calls.allSatisfy { $0.1["archive"] == .object(["pixelIds": .array([.number(42)])]) && $0.1["ids"] == nil })
        XCTAssertEqual(calls.first(where: { $0.0 == "one" })?.1["childOnly"], .string("child"))
    }

    func testKnownPartialCompletionRequiresExplicitReconciliation() async throws {
        let (runtime, id) = try await fixture()
        let journal = GroupJournal()
        await runtime.registerDataSourceLoader { request in
            await journal.record(request)
            if request.dataSourceRef == "two" {
                throw NSError(domain: "Forge.DataSource.HTTP", code: 422, userInfo: [NSLocalizedDescriptionKey: "Invalid entry"])
            }
            return .init(rows: [["id": .number(42)]])
        }
        let root = try command(["commandId": "group", "group": [member("one"), member("two")],
            "refresh": [["dataSourceRef": "list"]], "errorState": ["failed": true]])
        let result = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: root)
        let state = await runtime.mutationCommandState(windowID: id, command: root)
        let form = await runtime.windowFormJSONValue(windowID: id)
        XCTAssertEqual(result.status, "partial_failure")
        XCTAssertEqual(result.members?["two"]?.error, "Invalid entry")
        XCTAssertEqual(state.phase, .partialFailure)
        XCTAssertTrue(state.guarded)
        XCTAssertFalse(state.retryAllowed)
        XCTAssertEqual(form["failed"], .bool(true))
        let retry = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: root)
        XCTAssertEqual(retry.status, "suppressed")
        let calls = await journal.calls
        XCTAssertEqual(calls.count, 3)
        XCTAssertEqual(calls.last?.0, "list")
        let resolved = await runtime.resolveIndeterminateMutationCommand(windowID: id, command: root)
        XCTAssertTrue(resolved)
    }

    func testInvalidGroupAndCancelledConfirmationDoNotWrite() async throws {
        let (runtime, id) = try await fixture()
        let journal = GroupJournal()
        await runtime.registerDataSourceLoader { request in
            await journal.record(request)
            return .init(rows: [])
        }
        for args: [String: Any] in [
            ["group": [member("one"), member("two", extras: ["dataSourceRef": "one"])]],
            ["group": [member("one")], "refresh": [["dataSourceRef": "one"]]],
            ["group": [member("one")], "refresh": [["dataSourceRef": "list"], ["dataSourceRef": "list"]]],
            ["group": [member("one")], "refresh": [["dataSourceRef": "list"],
                                                     ["dataSourceRef": "list", "bypassCache": true]]],
        ] {
            let invalid = try command(args.merging(["commandId": "group"]) { current, _ in current })
            let invalidResult = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: invalid)
            XCTAssertEqual(invalidResult.status, "invalid_payload")
        }
        let root = try command(["commandId": "group", "confirm": "Proceed?", "group": [member("one"), member("two")]])
        let cancelled = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: root,
            confirm: { _ in false })
        XCTAssertEqual(cancelled.status, "cancelled")
        let calls = await journal.calls
        XCTAssertTrue(calls.isEmpty)
    }

    func testReplacementDoesNotSynchronizeTheNewPresentation() async throws {
        let (runtime, id) = try await fixture()
        let journal = GroupJournal()
        await runtime.registerDataSourceLoader { request in
            await journal.record(request)
            if request.dataSourceRef != "list" { await journal.waitForRelease() }
            return .init(rows: [["id": .number(42)]])
        }
        let root = try command(["commandId": "group", "group": [member("one"), member("two")],
            "refresh": [["dataSourceRef": "list"]], "successState": ["confirmed": true]])
        _ = await runtime.presentDialog(windowID: id, dialogID: "edit")
        let submitting = Task {
            await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: root, dialogID: "edit")
        }
        await journal.waitForDispatch(2)
        await runtime.closeDialogPublic(windowID: id, dialogID: "edit")
        _ = await runtime.presentDialog(windowID: id, dialogID: "edit")
        await journal.completeWrite()
        let result = await submitting.value
        let calls = await journal.calls
        XCTAssertEqual(result.status, "succeeded")
        XCTAssertEqual(result.members?["one"]?.status, "succeeded")
        XCTAssertEqual(result.members?["two"]?.status, "succeeded")
        XCTAssertEqual(Set(calls.map(\.0)), ["one", "two"])
        let commandState = await runtime.mutationCommandState(windowID: id, command: root)
        XCTAssertEqual(commandState.message, "")
        let form = await runtime.windowFormJSONValue(windowID: id)
        XCTAssertNil(form["confirmed"])
    }

    func testReservesAllWritersBeforeDispatchingAnyMember() async throws {
        let (runtime, id) = try await fixture()
        let journal = GroupJournal()
        await runtime.registerDataSourceLoader { request in
            await journal.record(request)
            if request.dataSourceRef == "two" { await journal.waitForRelease() }
            return .init(rows: [])
        }
        let ordinary = try command(["commandId": "single", "dataSourceRef": "two"])
        let active = Task {
            await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: ordinary)
        }
        await journal.waitForDispatch()
        let root = try command(["commandId": "group", "group": [member("one"), member("two")],
            "pendingState": ["groupPending": true]])
        let result = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: root)
        let calls = await journal.calls
        let form = await runtime.windowFormJSONValue(windowID: id)
        XCTAssertFalse(result.accepted)
        XCTAssertEqual(result.status, "transport_busy")
        XCTAssertEqual(calls.map(\.0), ["two"])
        XCTAssertNil(form["groupPending"])
        await journal.completeWrite()
        _ = await active.value
    }

    func testOwnSelectionClearAllowsAllConfiguredRefreshes() async throws {
        let (runtime, id) = try await fixture()
        let journal = GroupJournal()
        await runtime.registerDataSourceLoader { request in
            await journal.record(request)
            return .init(rows: [["id": .number(42)]])
        }
        await runtime.setDataSourceSelection(windowID: id, dataSourceRef: "draft", selected: ["id": .number(7)])
        let root = try command(["commandId": "group",
            "parameters": [["name": "bound", "value": "root"], ["name": "rootOnly", "value": "root"]],
            "group": [member("one", extras: ["parameters": [["name": "bound", "value": "child"]]])],
            "refresh": [["dataSourceRef": "draft", "clearSelection": true], ["dataSourceRef": "list"]]])
        let result = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: root,
            extras: ["bound": .string("extras")])
        let calls = await journal.calls
        let selection = await runtime.dataSourceSelectionState(windowID: id, dataSourceRef: "draft")
        XCTAssertEqual(result.status, "succeeded")
        XCTAssertTrue(result.warnings.isEmpty)
        XCTAssertEqual(selection, SelectionState())
        XCTAssertEqual(calls.map(\.0), ["one", "draft", "list"])
        XCTAssertEqual(calls.first?.1, ["bound": .string("extras"), "rootOnly": .string("root")])
    }

    func testReplacementWhileRefreshingDiscardsStalePayloadAndLaterReaders() async throws {
        let (runtime, id) = try await fixture()
        let journal = GroupJournal()
        await runtime.registerDataSourceLoader { request in
            await journal.record(request)
            if request.dataSourceRef == "list" { await journal.waitForRelease() }
            return .init(rows: [["id": .number(42)]])
        }
        let root = try command(["commandId": "group", "group": [member("one")],
            "refresh": [["dataSourceRef": "list"], ["dataSourceRef": "summary"]]])
        _ = await runtime.presentDialog(windowID: id, dialogID: "edit")
        let submitting = Task {
            await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: root, dialogID: "edit")
        }
        await journal.waitForDispatch(2)
        await runtime.closeDialogPublic(windowID: id, dialogID: "edit")
        _ = await runtime.presentDialog(windowID: id, dialogID: "edit")
        await runtime.setDataSourceCollection(windowID: id, dataSourceRef: "list", rows: [["id": .number(900)]])
        await journal.completeWrite()
        let result = await submitting.value
        let calls = await journal.calls
        let rows = await runtime.dataSourceCollection(windowID: id, dataSourceRef: "list")
        let state = await runtime.mutationCommandState(windowID: id, command: root)
        XCTAssertEqual(result.status, "succeeded")
        XCTAssertEqual(result.members?["one"]?.status, "succeeded")
        XCTAssertEqual(calls.map(\.0), ["one", "list"])
        XCTAssertEqual(rows, [["id": .number(900)]])
        XCTAssertEqual(state.message, "")
    }

    func testCancellationDuringDispatchGuardsUnconfirmedWriters() async throws {
        let (runtime, id) = try await fixture()
        let journal = GroupJournal()
        await runtime.registerDataSourceLoader { request in
            await journal.record(request)
            await journal.waitForRelease()
            return .init(rows: [["id": .number(42)]])
        }
        let root = try command(["commandId": "group", "group": [member("one"), member("two")]])
        let submitting = Task {
            await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: root)
        }
        await journal.waitForDispatch(2)
        submitting.cancel()
        let result = await submitting.value
        await journal.completeWrite()
        let state = await runtime.mutationCommandState(windowID: id, command: root)
        let calls = await journal.calls
        XCTAssertEqual(result.status, "indeterminate")
        XCTAssertEqual(result.members?["one"]?.status, "indeterminate")
        XCTAssertEqual(result.members?["two"]?.status, "indeterminate")
        XCTAssertTrue(state.guarded)
        XCTAssertEqual(Set(calls.map(\.0)), ["one", "two"])
    }
}
