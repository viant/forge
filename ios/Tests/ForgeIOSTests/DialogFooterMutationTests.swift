import XCTest
@testable import ForgeIOSRuntime

private actor FooterWrites {
    var calls: [(String, [String: JSONValue])] = []
    func record(_ ref: String, _ values: [String: JSONValue]) { calls.append((ref, values)) }
}

final class DialogFooterMutationTests: XCTestCase {
    private let script = #"""
    ({
      normalize: ({value, modelRef, schema, phase, context}) => {
        if (modelRef !== 'entry' || !schema.properties.name || phase !== 'beforeMarshal') throw Error('Unexpected model context');
        return {...value, name:value.name.trim(), number:context.Context('parent').signals.form.peek().number};
      },
      project: ({value, phase}) => { if (phase !== 'afterMarshal') throw Error('Missing phase'); return {entry:value}; },
      prepare: ({context, parameters, extras}) => {
        if (!context.signals.authorization.peek().principal.roles.includes('editor')) throw Error('Access unavailable');
        if (Object.keys(extras).length) throw Error('Unexpected extra arguments');
        return {body:{...parameters.entry, selected:context.handlers.dataSource.getSelection().selected.id, approved:false, optional:null}};
      },
      reject: () => {throw Error('Validation failed')},
      wait: async () => ({}),
      effect: ({context}) => {context.handlers.dataSource.fetchCollection();return {};},
      invalid: () => []
    })
    """#

    private func metadata(_ role: String = "editor") throws -> WindowMetadata {
        let json: [String: Any] = ["namespace":"Records","actionAliases":["Edit"],"view":["content":[:]],
            "dataSource":["draft":[:], "parent":[:], "writer":[:], "list":[:]],
            "authorizationSnapshot":["principal":["subject":"user","roles":[role],"features":[]]],
            "actions":["code":script], "schemas":["entry":["type":"object","properties":["name":["type":"string"],"number":["type":"integer"]]]],
            "resourceModels":["entry":["schemaRef":"entry","write":["dataSourceRef":"writer","mode":"full"],
                "fields":["name":["write":"label"],"number":["write":"number"]],"hooks":["beforeMarshal":"Edit.normalize","afterMarshal":"Records.project"]]]]
        return try JSONDecoder().decode(WindowMetadata.self, from: JSONSerialization.data(withJSONObject: json))
    }

    private func action(prepare: String = "Edit.prepare", confirmation: String? = nil, missingField: Bool = false) throws -> ActionDef {
        var command: [String: Any] = ["dataSourceRef":"writer", "prepare":prepare, "payload":["modelRef":"entry","source":["scope":"form"],"target":"$"],
            "refresh":[["dataSourceRef":"list","bypassCache":true]], "resultState":["receipt":["0.id"]],
            "validateWhen":["source":"authorization","field":"principal.roles","contains":"editor"]]
        if let confirmation { command["confirm"] = confirmation }
        if missingField { command["resultState"] = ["unknown":["0.absent"]] }
        return try JSONDecoder().decode(ActionDef.self, from: JSONSerialization.data(withJSONObject: [
            "id":"submit","label":"Apply","close":true,"on":[["event":"onClick","handler":"legacy.execute"]],
            "visibleWhen":["source":"authorization","field":"principal.subject","matches":"^user$"],
            "disabledWhen":["not":["source":"selection","field":"selected.id","exists":true]],
            "mutationCommand":command
        ]))
    }

    private func seeded(_ role: String = "editor") async throws -> (ForgeRuntime, String, FooterWrites) {
        let runtime = ForgeRuntime()
        let window = await runtime.openWindowInline(key:"record",title:"Record",metadata:try metadata(role))
        let writes = FooterWrites()
        await runtime.registerHandler("legacy.execute") { _ in await writes.record("legacy",[:]); return .bool(true) }
        await runtime.registerDataSourceLoader { request in
            await writes.record(request.dataSourceRef,request.input.parameters)
            return ForgeRuntime.DataSourceFetchResult(rows:[["id":.number(37)]])
        }
        await runtime.setDataSourceForm(windowID:window.id,dataSourceRef:"parent",values:["number":.number(0)])
        await runtime.setDataSourceSelection(windowID:window.id,dataSourceRef:"draft",selected:["id":.number(9)],rowIndex:0)
        await runtime.setDataSourceForm(windowID:window.id,dataSourceRef:"draft",values:["name":.string(" value ")])
        return (runtime,window.id,writes)
    }

    func testFooterRunsScopedHooksAndExactlyOnePreparedWrite() async throws {
        let (runtime, id, capture) = try await seeded()
        let writerID = WindowIdentity(windowID:id).dataSourceID(ref:"writer")
        await runtime.dataSourceRuntime.setInput(dataSourceID:writerID,input:InputState(fetch:true))
        let footer = try action()
        let visible = await runtime.mutationPredicateAllows(windowID:id,dataSourceRef:"draft",condition:footer.visibleWhen)
        let disabled = await runtime.mutationPredicateAllows(windowID:id,dataSourceRef:"draft",condition:footer.disabledWhen)
        let valid = await runtime.mutationPredicateAllows(windowID:id,dataSourceRef:"draft",condition:footer.footerCommand?.validateWhen)
        XCTAssertTrue(visible, "Visible")
        XCTAssertFalse(disabled, "Enabled")
        XCTAssertTrue(valid, "Authorized")
        let result = await runtime.activateDialogFooter(windowID:id,dialogID:"editor",sourceDataSourceRef:"draft",action:footer)
        XCTAssertEqual(footer.footerCommand?.commandId,"submit")
        XCTAssertEqual(result?.status,"succeeded",result?.error ?? "")
        let calls = await capture.calls
        XCTAssertEqual(calls.map(\.0),["writer","list"])
        XCTAssertEqual(calls.first?.1,["body":.object(["label":.string("value"),"number":.number(0),"selected":.number(9),"approved":.bool(false),"optional":.null])])
        let state = await runtime.windowFormJSONValue(windowID:id)
        XCTAssertEqual(state["receipt"],.number(37))
    }

    func testPreparationFailuresAndReadOnlyRoleNeverDispatch() async throws {
        let (runtime,id,capture) = try await seeded()
        for name in ["missing","reject","wait","effect","invalid"] {
            let result = await runtime.activateDialogFooter(windowID:id,dialogID:"editor",sourceDataSourceRef:"draft",action:try action(prepare:"Records."+name))
            XCTAssertEqual(result?.accepted,false,name)
            XCTAssertEqual(result?.status,"invalid_payload",name)
        }
        let calls = await capture.calls
        XCTAssertTrue(calls.isEmpty)
        let (denied,other,deniedCapture) = try await seeded("reader")
        let result = await denied.activateDialogFooter(windowID:other,dialogID:"editor",sourceDataSourceRef:"draft",action:try action())
        XCTAssertEqual(result?.status,"invalid")
        let deniedCalls = await deniedCapture.calls
        XCTAssertTrue(deniedCalls.isEmpty)
    }

    func testSelectionChangeDuringConfirmationRejectsAndLegacyClickStillWorks() async throws {
        let (runtime,id,capture) = try await seeded()
        let result = await runtime.activateDialogFooter(windowID:id,dialogID:"editor",sourceDataSourceRef:"draft",action:try action(confirmation:"Apply selection?")) { _ in
            await runtime.setDataSourceSelection(windowID:id,dataSourceRef:"draft",selected:["id":.number(10)],rowIndex:1)
            return true
        }
        XCTAssertEqual(result?.accepted,false)
        let click = try JSONDecoder().decode(ActionDef.self,from:Data(#"{"id":"legacy","on":[{"event":"onClick","handler":"legacy.execute"}]}"#.utf8))
        _ = await runtime.activateDialogFooter(windowID:id,dialogID:"editor",sourceDataSourceRef:"draft",action:click)
        let calls = await capture.calls
        XCTAssertEqual(calls.map(\.0),["legacy"])
    }

    func testCommittedWriteReportsMissingReceiptAndRefreshFailureSeparately() async throws {
        let (runtime,id,capture) = try await seeded()
        await runtime.registerDataSourceLoader { request in
            await capture.record(request.dataSourceRef,request.input.parameters)
            if request.dataSourceRef == "list" { throw NSError(domain:"Fixture",code:1) }
            return ForgeRuntime.DataSourceFetchResult(rows:[["id":.number(37)]])
        }
        let footer = try action(missingField:true)
        let result = await runtime.activateDialogFooter(windowID:id,dialogID:"editor",sourceDataSourceRef:"draft",action:footer)
        XCTAssertEqual(result?.status,"succeeded",result?.error ?? "")
        XCTAssertEqual(Set(result?.warnings.map(\.stage) ?? []),["refresh","resultState"])
        let state = await runtime.mutationCommandState(windowID:id,command:try XCTUnwrap(footer.footerCommand))
        XCTAssertEqual(state.writerStatus,.succeeded)
        XCTAssertEqual(state.syncStatus,.partialFailure)
        let calls = await capture.calls
        XCTAssertEqual(calls.map(\.0),["writer","list"])
    }
    func testUnknownWriteStaysGuardedUntilResolved() async throws {
        let (runtime,id,capture) = try await seeded()
        await runtime.registerDataSourceLoader { request in
            await capture.record(request.dataSourceRef, request.input.parameters)
            throw URLError(.timedOut)
        }
        let footer = try action()
        let first = await runtime.activateDialogFooter(windowID:id,dialogID:"editor",sourceDataSourceRef:"draft",action:footer)
        let retry = await runtime.activateDialogFooter(windowID:id,dialogID:"editor",sourceDataSourceRef:"draft",action:footer)
        XCTAssertEqual(first?.status, "indeterminate")
        XCTAssertEqual(retry?.accepted, false)
        let calls = await capture.calls
        XCTAssertEqual(calls.map(\.0), ["writer"])
    }

    func testRevocationDuringConfirmationDoesNotWrite() async throws {
        let (runtime,id,capture) = try await seeded()
        let revoked = try metadata("viewer")
        let result = await runtime.activateDialogFooter(windowID:id,dialogID:"editor",sourceDataSourceRef:"draft",action:try action(confirmation:"Confirm")) { _ in
            _ = await runtime.updateWindowInline(id:id,title:"Record",metadata:revoked)
            return true
        }
        XCTAssertEqual(result?.accepted,false)
        let calls = await capture.calls
        XCTAssertTrue(calls.isEmpty)
    }

    func testConflictingWritersShareOneWindowLeaseAcrossConfirmationAndUnknownWrite() async throws {
        let (runtime,id,capture) = try await seeded()
        func footer(_ actionID: String, target: String, prepare: String? = nil, confirm: Bool = false) throws -> ActionDef {
            var command: [String: Any] = ["dataSourceRef":target,"serializationGroup":"record.edit"]
            if let prepare { command["prepare"] = prepare }
            if confirm { command["confirm"] = "Apply?" }
            return try JSONDecoder().decode(ActionDef.self, from: JSONSerialization.data(withJSONObject:["id":actionID,"mutationCommand":command]))
        }
        let first = try footer("first",target:"writer",confirm:true)
        let other = try footer("other",target:"list")
        let cancelled = await runtime.activateDialogFooter(windowID:id,dialogID:"edit",sourceDataSourceRef:"draft",action:first) { _ in
            let blocked = await runtime.activateDialogFooter(windowID:id,dialogID:"edit",sourceDataSourceRef:"draft",action:other)
            XCTAssertEqual(blocked?.status,"group_busy")
            return false
        }
        XCTAssertEqual(cancelled?.status,"cancelled")
        let invalid = try footer("bad",target:"writer",prepare:"Edit.reject")
        let rejected = await runtime.activateDialogFooter(windowID:id,dialogID:"edit",sourceDataSourceRef:"draft",action:invalid)
        XCTAssertEqual(rejected?.status,"invalid_payload")
        await runtime.registerDataSourceLoader { request in
            await capture.record(request.dataSourceRef,request.input.parameters)
            throw URLError(.networkConnectionLost)
        }
        let unknown = await runtime.activateDialogFooter(windowID:id,dialogID:"edit",sourceDataSourceRef:"draft",action:first) { _ in true }
        XCTAssertEqual(unknown?.status,"indeterminate")
        let blocked = await runtime.activateDialogFooter(windowID:id,dialogID:"edit",sourceDataSourceRef:"draft",action:other)
        XCTAssertEqual(blocked?.status,"group_busy")
        let released = await runtime.resolveIndeterminateMutationCommand(windowID:id,command:try XCTUnwrap(first.footerCommand))
        XCTAssertTrue(released)
        await runtime.registerDataSourceLoader { request in
            await capture.record(request.dataSourceRef,request.input.parameters)
            return .init(rows:[])
        }
        let next = await runtime.activateDialogFooter(windowID:id,dialogID:"edit",sourceDataSourceRef:"draft",action:other)
        XCTAssertEqual(next?.status,"succeeded")
        let calls = await capture.calls
        XCTAssertEqual(calls.map(\.0),["writer","list"])
    }

    func testOpenAndCloseRunDeclaredLifecycleOnceAndReopenResetsTypedState() async throws {
        let raw = #"{"view":{"content":{}},"dataSource":{"draft":{}},"dialogs":[{"id":"record","dataSourceRef":"draft","on":[{"event":"onOpen","handler":"dataSource.setWindowFormData","parameters":[{"name":"done","in":"const","location":"false","codec":{"name":"boolean"}},{"name":"receipt","in":"const","location":"null","codec":{"name":"json"}}]},{"event":"onClose","handler":"fixture.closed"}]}]}"#
        let metadata = try JSONDecoder().decode(WindowMetadata.self,from:Data(raw.utf8))
        let runtime = ForgeRuntime(), calls = FooterWrites()
        let window = await runtime.openWindowInline(key:"edit",title:"Edit",metadata:metadata)
        await runtime.registerHandler("fixture.closed"){ _ in await calls.record("close",[:]); return .bool(true) }
        _ = await runtime.presentDialog(windowID:window.id,dialogID:"record")
        await runtime.setWindowFormValue(windowID:window.id,values:["done":.bool(true),"receipt":.number(17)],bumpPrefillRevision:false)
        _ = await runtime.presentDialog(windowID:window.id,dialogID:"record")
        let during = await runtime.windowFormJSONValue(windowID:window.id)
        XCTAssertEqual(during["done"],.bool(true))
        await runtime.closeDialogPublic(windowID:window.id,dialogID:"record")
        await runtime.closeDialogPublic(windowID:window.id,dialogID:"record")
        _ = await runtime.presentDialog(windowID:window.id,dialogID:"record")
        let reopened = await runtime.windowFormJSONValue(windowID:window.id)
        XCTAssertEqual(reopened["done"],.bool(false))
        XCTAssertEqual(reopened["receipt"],.null)
        let events = await calls.calls
        XCTAssertEqual(events.map(\.0),["close"])
    }

    func testDialogFetchPolicyPreservesExplicitAndContentOwnedDrafts() throws {
        for (source, expected) in [
            (#"{}"#, true), (#"{"fetchOnOpen":false}"#, false), (#"{"content":{"id":"draft","fetchData":false}}"#, false),
            (#"{"fetchOnOpen":true,"content":{"id":"draft","fetchData":false}}"#, true)
        ] {
            XCTAssertEqual(try JSONDecoder().decode(DialogDef.self,from:Data(source.utf8)).shouldFetchOnOpen, expected)
        }
    }

}

extension DialogFooterMutationTests {
    func testClosingCommandDismissesOnlyConfirmedOriginalPresentation() async throws {
        for mode in ["success","empty","refresh","failed","unknown","cancel","reopened","selection","keep"] {
            let (runtime,id,capture) = try await seeded()
            let raw: [String: Any] = [
                "id":"save", "close":mode != "keep", "mutationCommand":[
                    "dataSourceRef":"writer", "confirm":"Save?", "resultState":["saved":["0.id"]], "refresh":[["dataSourceRef":"list"]]
                ]
            ]
            let footer = try JSONDecoder().decode(ActionDef.self,from:JSONSerialization.data(withJSONObject:raw))
            await runtime.openDialog(windowID:id,dialogID:"editor",parameters:[:])
            await runtime.registerDataSourceLoader { request in
                await capture.record(request.dataSourceRef, request.input.parameters)
                if request.dataSourceRef == "writer" {
                    if mode == "failed" { throw NSError(domain:"writer",code:422) }
                    if mode == "unknown" { throw URLError(.timedOut) }
                    if mode == "empty" { return .init(rows:[]) }
                    if mode == "reopened" {
                        await runtime.closeDialogPublic(windowID:id,dialogID:"editor")
                        await runtime.openDialog(windowID:id,dialogID:"editor",parameters:[:])
                    }
                    if mode == "selection" {
                        await runtime.setDataSourceSelection(windowID:id,dataSourceRef:"draft",selected:["id":.number(17)])
                    }
                    return .init(rows:[["id":.number(7)]])
                }
                if mode == "refresh" { throw NSError(domain:"reader",code:500) }
                return .init(rows:[])
            }
            let result=await runtime.activateDialogFooter(windowID:id,dialogID:"editor",sourceDataSourceRef:"draft",action:footer,confirm:{_ in mode != "cancel"})
            let open=await runtime.dialogState(windowID:id,dialogID:"editor").open
            XCTAssertEqual(open,!["success","empty","refresh"].contains(mode),mode)
            let calls = await capture.calls
            XCTAssertEqual(calls.filter{$0.0=="writer"}.count,mode == "cancel" ? 0 : 1,mode)
            switch mode {
            case "success","keep": XCTAssertEqual(result?.status,"succeeded",mode)
            case "empty","refresh":
                XCTAssertEqual(result?.status,"succeeded",mode)
                XCTAssertEqual(result?.warnings.map(\.stage),[mode == "empty" ? "resultState" : "refresh"],mode)
            case "unknown": XCTAssertEqual(result?.status,"indeterminate",mode)
            case "failed": XCTAssertEqual(result?.status,"failed",mode)
            case "cancel": XCTAssertEqual(result?.status,"cancelled",mode)
            default: XCTAssertEqual(result?.status,"superseded",mode)
            }
        }
    }
}

extension DialogFooterMutationTests {
    func testReopenedAwaitResultOwnsItsWaiterWhenThePriorCommandCompletes() async throws {
        let document = #"{"view":{"content":{}},"dataSource":{"draft":{},"writer":{}},"dialogs":[{"id":"editor","dataSourceRef":"draft"}]}"#
        let metadata=try JSONDecoder().decode(WindowMetadata.self,from:Data(document.utf8))
        let runtime=ForgeRuntime(), id=await runtime.openWindowInline(key:"record",title:"Record",metadata:metadata).id
        let old=Task { await runtime.openDialogAwaitResult(windowID:id,dialogID:"editor",parameters:["name":.string("first")]) }
        func waitForPresentation(_ name: String) async -> UUID? {
            let updates = await runtime.dialogUpdates(windowID:id,dialogID:"editor")
            for await state in updates where state.open && state.args["name"] == .string(name) { return state.presentationID }
            return nil
        }
        let first = await waitForPresentation("first")
        let initialID = try XCTUnwrap(first)
        let replacement = Task { await runtime.openDialogAwaitResult(windowID:id,dialogID:"editor",parameters:["name":.string("second")]) }
        let second = await waitForPresentation("second")
        let newID = try XCTUnwrap(second)
        XCTAssertNotEqual(initialID,newID)
        // This is the dismissal path used when an admitted command settles.
        await runtime.closeDialog(windowID:id,dialogID:"editor",presentationID:initialID)
        let stillOpen = await runtime.dialogState(windowID:id,dialogID:"editor")
        XCTAssertTrue(stillOpen.open)
        XCTAssertEqual(stillOpen.presentationID,newID)
        await runtime.closeDialog(windowID:id,dialogID:"editor",presentationID:newID,payload:["choice":.number(2)])
        let firstResult = await old.value
        let secondResult = await replacement.value
        XCTAssertNil(firstResult)
        XCTAssertEqual(secondResult,["choice":.number(2)])
    }
}

extension DialogFooterMutationTests {
    func testNonclosingReceiptSettlesWindowStateAfterAnotherPresentationOpens() async throws {
        let data = #"{"view":{"content":{}},"dataSource":{"draft":{"autoFetch":false},"writer":{},"list":{"autoFetch":false}},"dialogs":[{"id":"editor","dataSourceRef":"draft","fetchOnOpen":false}]}"#
        let definition = try JSONDecoder().decode(WindowMetadata.self, from: Data(data.utf8))
        let json = #"{"id":"apply","mutationCommand":{"dataSourceRef":"writer","pendingState":{"busy":true},"successState":{"busy":false},"errorState":{"busy":false},"refresh":[{"dataSourceRef":"list","clearSelection":true}]}}"#
        let action = try JSONDecoder().decode(ActionDef.self, from: Data(json.utf8))
        for rejected in [false, true] {
            let runtime = ForgeRuntime(), calls = FooterWrites()
            let window = await runtime.openWindowInline(key: "document", title: "Document", metadata: definition)
            let started = expectation(description: "Original write started")
            let release = AsyncStream<Void>.makeStream()
            await runtime.registerDataSourceLoader { request in
                await calls.record(request.dataSourceRef, request.input.parameters)
                if request.dataSourceRef == "writer" {
                    started.fulfill()
                    for await _ in release.stream { break }
                    if rejected { throw NSError(domain: "writer", code: 403) }
                }
                return ForgeRuntime.DataSourceFetchResult(rows: [["id": .number(2)]])
            }
            _ = await runtime.presentDialog(windowID: window.id, dialogID: "editor", parameters: ["id": .number(1)])
            let write = Task { await runtime.activateDialogFooter(windowID: window.id, dialogID: "editor", sourceDataSourceRef: "draft", action: action) }
            await fulfillment(of: [started], timeout: 4)
            await runtime.closeDialogPublic(windowID: window.id, dialogID: "editor")
            _ = await runtime.presentDialog(windowID: window.id, dialogID: "editor", parameters: ["id": .number(2)])
            let replacement = await runtime.dialogState(windowID: window.id, dialogID: "editor")
            let busy = await runtime.windowFormJSONValue(windowID: window.id)["busy"]
            XCTAssertEqual(busy, .bool(true))
            release.continuation.yield(())
            release.continuation.finish()
            let result = await write.value
            let state = await runtime.windowFormJSONValue(windowID: window.id)
            let present = await runtime.dialogState(windowID: window.id, dialogID: "editor")
            let refs = await calls.calls.map(\.0)
            XCTAssertEqual(result?.status, rejected ? "failed" : "succeeded")
            XCTAssertEqual(state["busy"], .bool(false))
            XCTAssertEqual(present.presentationID, replacement.presentationID)
            XCTAssertEqual(present.args["id"], .number(2))
            XCTAssertEqual(refs, rejected ? ["writer"] : ["writer", "list"])
        }
    }
}

extension DialogFooterMutationTests {
    private func formPatchWindow(subject: String = "owner") throws -> WindowMetadata {
        let json: [String: Any] = [
            "view": ["content": [:]], "dataSource": ["draft": [:], "writer": [:], "list": [:]],
            "dialogs": [["id": "editor", "dataSourceRef": "draft", "fetchOnOpen": false]],
            "authorizationSnapshot": ["principal": ["subject": subject, "roles": ["editor"]]]
        ]
        return try JSONDecoder().decode(WindowMetadata.self, from: JSONSerialization.data(withJSONObject: json))
    }

    func testSuccessFormStateAppliesOnlyToTheUnchangedFieldsOfItsSubmittingDialog() async throws {
        let action = try JSONDecoder().decode(ActionDef.self, from: Data(#"""
            {"id":"save","mutationCommand":{"dataSourceRef":"writer","successState":{"saved":true},
             "successFormState":{"code":"","count":0,"busy":false,"receipt":null,"detail":{"ids":[1,2]}},
             "refresh":[{"dataSourceRef":"list","bypassCache":true}]}}
            """#.utf8))
        let patch = try XCTUnwrap(action.footerCommand).successFormState
        // receipt is absent and detail is explicitly null in the submitted draft.
        let initial: [String: JSONValue] = ["code": .string("old"), "count": .number(3), "busy": .bool(true),
                                             "detail": .null, "note": .string("original")]
        for mode in ["success", "changed", "absentToNull", "nullToAbsent", "signalChanged", "conflictWithWarning", "reopened", "revoked", "rejected", "unknown"] {
            let runtime = ForgeRuntime(), calls = FooterWrites()
            let id = await runtime.openWindowInline(key: "records", title: "Records", metadata: try formPatchWindow()).id
            let params: [String: JSONValue] = ["id": .number(7)]
            _ = await runtime.presentDialog(windowID: id, dialogID: "editor", parameters: params)
            await runtime.setDataSourceForm(windowID: id, dataSourceRef: "draft", values: initial)
            let started = expectation(description: "Started " + mode)
            let release = AsyncStream<Void>.makeStream()
            await runtime.registerDataSourceLoader { req in
                let form = await runtime.dataSourceForm(windowID: id, dataSourceRef: "draft")
                await calls.record(req.dataSourceRef, form)
                if req.dataSourceRef == "writer" {
                    started.fulfill()
                    for await _ in release.stream { break }
                    if mode == "rejected" { throw NSError(domain: "Forge.DataSource.HTTP", code: 403) }
                    if mode == "unknown" { throw URLError(.timedOut) }
                }
                if req.dataSourceRef == "list", mode == "conflictWithWarning" { throw NSError(domain: "reader", code: 503) }
                return .init(rows: [])
            }
            let submit = Task { await runtime.activateDialogFooter(windowID: id, dialogID: "editor", sourceDataSourceRef: "draft", action: action) }
            await fulfillment(of: [started], timeout: 4)
            var current = initial
            current["note"] = .string("unrelated edit")
            switch mode {
            case "changed", "conflictWithWarning": current["code"] = .string("new edit")
            case "absentToNull": current["receipt"] = .null
            case "nullToAbsent": current.removeValue(forKey: "detail")
            case "reopened":
                let first = await runtime.dialogState(windowID: id, dialogID: "editor")
                await runtime.closeDialogPublic(windowID: id, dialogID: "editor")
                _ = await runtime.presentDialog(windowID: id, dialogID: "editor", parameters: params)
                let second = await runtime.dialogState(windowID: id, dialogID: "editor")
                XCTAssertNotEqual(first.presentationID, second.presentationID)
            case "revoked":
                let signal = await runtime.signals.metadata(windowID: id)
                await signal.set(try formPatchWindow(subject: "replacement"))
            default: break
            }
            await runtime.setDataSourceForm(windowID: id, dataSourceRef: "draft", values: current)
            if mode == "signalChanged" {
                let source = WindowIdentity(windowID: id).dataSourceID(ref: "draft")
                let signal = await runtime.signals.form(dataSourceID: source)
                await signal.set(current.merging(["code": .string("visible edit")]) { _, edit in edit })
            }
            release.continuation.yield(())
            release.continuation.finish()
            let result = await submit.value
            let expected = mode == "success" ? current.merging(patch) { _, terminal in terminal } : current
            let visibleExpected = mode == "signalChanged" ? current.merging(["code": .string("visible edit")]) { _, edit in edit } : expected
            let visible = await runtime.dataSourceForm(windowID: id, dataSourceRef: "draft")
            let stored = await runtime.formJSONValue(windowID: id, dataSourceRef: "draft")
            XCTAssertEqual(visible, visibleExpected, mode)
            XCTAssertEqual(stored, expected, mode)
            let events = await calls.calls
            let global = await runtime.windowFormJSONValue(windowID: id)
            switch mode {
            case "revoked", "rejected", "unknown":
                XCTAssertEqual(result?.status, ["revoked": "superseded", "rejected": "failed", "unknown": "indeterminate"][mode], mode)
                XCTAssertNil(global["saved"], mode)
                XCTAssertEqual(events.map(\.0), ["writer"], mode)
            default:
                XCTAssertEqual(result?.status, "succeeded", mode)
                XCTAssertEqual(global["saved"], .bool(true), mode)
                let state = await runtime.mutationCommandState(windowID: id, command: try XCTUnwrap(action.footerCommand))
                let expectedMessage: String
                switch mode {
                case "conflictWithWarning": expectedMessage = "Saved. Some related data could not be refreshed."
                case "changed", "absentToNull", "nullToAbsent", "signalChanged": expectedMessage = "Saved the submitted version. Your newer changes are still in the form."
                default: expectedMessage = "Completed"
                }
                XCTAssertEqual(state.message, expectedMessage, mode)
                XCTAssertEqual(events.map(\.0), ["writer", "list"], mode)
                XCTAssertEqual(events.last?.1, visibleExpected, "The owner refresh must see the settled form: " + mode)
            }
        }
    }

    func testSuccessFormStateRejectsInvalidMetadataAndRequiresALiveDialog() async throws {
        let runtime = ForgeRuntime(), calls = FooterWrites()
        let id = await runtime.openWindowInline(key: "records", title: "Records", metadata: try formPatchWindow()).id
        await runtime.registerDataSourceLoader { request in
            await calls.record(request.dataSourceRef, request.input.parameters)
            return .init(rows: [])
        }
        func footer(_ spec: [String: Any]) throws -> ActionDef {
            let json: [String: Any] = ["id": "apply", "mutationCommand": ["dataSourceRef": "writer"].merging(spec) { _, next in next }]
            return try JSONDecoder().decode(ActionDef.self, from: JSONSerialization.data(withJSONObject: json))
        }
        let active = try footer(["successFormState": ["note": ""]])
        let closed = await runtime.activateDialogFooter(windowID: id, dialogID: "editor", sourceDataSourceRef: "draft", action: active)
        XCTAssertEqual(closed?.status, "invalid_payload")
        let unscoped = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: try XCTUnwrap(active.footerCommand))
        XCTAssertEqual(unscoped.status, "invalid_payload")

        _ = await runtime.presentDialog(windowID: id, dialogID: "editor")
        for spec: [String: Any] in [
            ["successFormState": ["__proto__": 1]], ["successFormState": ["nested.field": 1]],
            ["clearFormFields": ["file"], "successFormState": ["file": ""]],
            ["before": [["command": ["commandId": "stage", "dataSourceRef": "writer", "successFormState": ["file": ""]]]]],
            ["before": [["command": ["commandId": "stage", "dataSourceRef": "writer"],
                         "cleanup": ["commandId": "undo", "dataSourceRef": "writer", "successFormState": ["file": ""]]]]]
        ] {
            let result = await runtime.activateDialogFooter(windowID: id, dialogID: "editor", sourceDataSourceRef: "draft", action: try footer(spec))
            XCTAssertEqual(result?.status, "invalid_payload", String(describing: spec))
        }
        let missingForm = await runtime.activateDialogFooter(windowID: id, dialogID: "editor", sourceDataSourceRef: "missing", action: active)
        XCTAssertEqual(missingForm?.status, "invalid_payload")
        let avoided = await calls.calls
        XCTAssertTrue(avoided.isEmpty)
        await runtime.setDataSourceForm(windowID: id, dataSourceRef: "draft", values: ["file": .string("temp"), "note": .string("pending")])
        let combined = try footer(["clearFormFields": ["file"], "successFormState": ["note": "done"]])
        let applied = await runtime.activateDialogFooter(windowID: id, dialogID: "editor", sourceDataSourceRef: "draft", action: combined)
        let form = await runtime.dataSourceForm(windowID: id, dataSourceRef: "draft")
        XCTAssertEqual(applied?.status, "succeeded")
        XCTAssertEqual(form, ["file": .null, "note": .string("done")])
        let empty = try footer(["successFormState": [:]])
        let allowed = await runtime.executeMutationCommand(windowID: id, sourceDataSourceRef: "draft", command: try XCTUnwrap(empty.footerCommand))
        XCTAssertEqual(allowed.status, "succeeded")
    }
}
