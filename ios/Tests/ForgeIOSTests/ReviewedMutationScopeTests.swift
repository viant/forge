import Foundation
import XCTest
@testable import ForgeIOSRuntime

private final class UnexpectedReviewTransport: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        XCTFail("The HTTP writer ran after the review changed.")
        client?.urlProtocol(self, didFailWithError: URLError(.cancelled))
    }
    override func stopLoading() {}
}

private final class OriginalReviewWriterTransport: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        var body = request.httpBody ?? Data()
        if body.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var bytes = [UInt8](repeating:0,count:256)
            while true {
                let count = stream.read(&bytes,maxLength:bytes.count)
                if count <= 0 { break }
                body.append(contentsOf:bytes.prefix(count))
            }
        }
        let envelope = try? JSONDecoder().decode(JSONValue.self,from:body)
        XCTAssertEqual(envelope?.objectValue?["inputs"]?.objectValue?["value"],.number(7))
        let response = HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:"HTTP/1.1",headerFields:nil)!
        client?.urlProtocol(self,didReceive:response,cacheStoragePolicy:.notAllowed)
        client?.urlProtocol(self,didLoad:Data(#"{"rows":[{"id":7}]}"#.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

private actor ReviewCalls {
    var refs: [String] = []
    func append(_ ref: String) { refs.append(ref) }
}

final class ReviewedMutationScopeTests: XCTestCase {
    private let owner = ["parameter":"record.owner","source":"windowForm","field":"parent.ids.0"]
    private let current: [String:JSONValue] = ["parent": .object(["ids": .array([.number(7)])])]
    private let switched: [String:JSONValue] = ["parent": .object(["ids": .array([.number(8)])])]
    private let args: [String:JSONValue] = ["record": .object(["owner": .number(7)])]

    private func metadata(_ command: [String:Any], principal: [String:Any] = ["subject":"one","issuer":"service","tenantId":"team"], httpWriter: Bool = false) throws -> WindowMetadata {
        let writer: [String:Any] = httpWriter ? ["service":["uri":"/v1/api/datasources/save/fetch","method":"POST"],
            "parameters":[["name":"value","in":"input","location":"save.parameters.value"]]] : [:]
        let json: [String:Any] = ["namespace":"Editor","authorizationSnapshot":["principal":principal],
            "actions":["code":"({prepare:()=>({value:7})})"], "dataSource":["draft":[:],"parent":[:],"save":writer,"stage":[:],"undo":[:],"other":[:],"read":[:]],
            "dialogs":[["id":"edit","dataSourceRef":"draft","fetchOnOpen":false,"actions":[["id":"apply","close":false,"mutationCommand":command]]]]]
        return try JSONDecoder().decode(WindowMetadata.self, from: JSONSerialization.data(withJSONObject: json))
    }

    private func setup(_ overrides: [String:Any] = [:]) async throws -> (ForgeRuntime, String, ActionDef, ReviewCalls) {
        let command: [String:Any] = ["dataSourceRef":"save","reviewedScope":[owner],"successState":["saved":true]]
        let m = try metadata(command.merging(overrides) { _, rhs in rhs })
        let r = ForgeRuntime(), id = await r.openWindowInline(key:"records",title:"Records",metadata:m).id
        await r.setWindowFormValue(windowID:id,values:current)
        let calls = ReviewCalls()
        await r.registerDataSourceLoader { q in
            await calls.append(q.dataSourceRef)
            return .init(rows:[["id":.number(7)]])
        }
        return (r,id,m.dialogs[0].actions[0],calls)
    }

    private func send(_ r: ForgeRuntime, _ id: String, _ action: ActionDef) async -> MutationCommandResult? {
        await r.activateDialogFooter(windowID:id,dialogID:"edit",sourceDataSourceRef:"draft",action:action)
    }

    func testOriginalArgumentsAreTypedAndCannotBeReboundFromDraftInput() async throws {
        let rules = [owner, ["parameter":"record.owner","source":"collection","dataSourceRef":"parent","field":"0.id"],
            ["parameter":"accepted","source":"metrics","dataSourceRef":"parent","field":"totals.accepted"],
            ["parameter":"rows","source":"selection","dataSourceRef":"parent","field":"selection"]]
        let (r,id,a,j) = try await setup(["reviewedScope":rules])
        let rows: [[String:JSONValue]] = [["id":.number(7),"flags":.array([.bool(false),.null])]]
        await r.setDataSourceCollection(windowID:id,dataSourceRef:"parent",rows:rows)
        await r.setDataSourceMetrics(windowID:id,dataSourceRef:"parent",values:["totals":.object(["accepted":.bool(false)])])
        await r.setDataSourceSelectionState(windowID:id,dataSourceRef:"parent",selection:.init(selected:rows[0],selection:rows,rowIndex:0))
        let launch = args.merging(["accepted":.bool(false),"rows":.array(rows.map(JSONValue.object))]) { _, new in new }
        for invalid in [JSONValue.string("7"), .null, .string(" \t"), .number(8)] {
            var wrong = launch
            wrong["record"] = .object(["owner":invalid])
            _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:wrong)
            await r.setDataSourceInputParameters(windowID:id,dataSourceRef:"draft",parameters:launch)
            let result = await send(r,id,a)
            XCTAssertEqual(result?.status,"invalid_payload")
        }
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:launch)
        let result = await send(r,id,a), refs = await j.refs
        XCTAssertEqual(result?.status,"succeeded"); XCTAssertEqual(refs,["save"])
    }

    func testMissingPresentationAndActorReplacementFailUntilReopened() async throws {
        let (r,id,a,j) = try await setup()
        let signal = await r.signals.dialog(dialogID:id+"Dialogedit")
        await signal.set(.init(open:true,props:args,args:args))
        let missing = await send(r,id,a)
        XCTAssertEqual(missing?.status,"invalid_payload")
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        let swapped = try metadata(["dataSourceRef":"save","reviewedScope":[owner]],principal:["subject":"one","issuer":"service","tenantId":2])
        await (await r.signals.metadata(windowID:id)).set(swapped)
        let rejected = await send(r,id,a)
        XCTAssertEqual(rejected?.status,"invalid_payload")
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        let success = await send(r,id,a), refs = await j.refs
        XCTAssertEqual(success?.status,"succeeded"); XCTAssertEqual(refs,["save"])
    }

    func testSwitchDuringConfirmationAndPendingStateAfterPrepareNeverWrite() async throws {
        let (r,id,a,j) = try await setup(["confirm":"Apply?","prepare":"Editor.prepare"])
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        let replacement = switched
        _ = await r.activateDialogFooter(windowID:id,dialogID:"edit",sourceDataSourceRef:"draft",action:a) { _ in
            await r.setWindowFormValue(windowID:id,values:replacement); return true
        }
        let refs = await j.refs
        XCTAssertEqual(refs,[])
        let (other,otherID,footer,log) = try await setup(["prepare":"Editor.prepare","pendingState":["parent":["ids":[8]]]])
        _ = await other.presentDialog(windowID:otherID,dialogID:"edit",parameters:args)
        let result = await send(other,otherID,footer), late = await log.refs
        XCTAssertEqual(result?.status,"invalid_payload"); XCTAssertEqual(late,[])
    }

    func testAcknowledgedWriteNeverReplaysInsideSupersededPresentation() async throws {
        let (r,id,a,j) = try await setup()
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        let replacement = switched
        await r.registerDataSourceLoader { q in
            await j.append(q.dataSourceRef)
            await r.setWindowFormValue(windowID:id,values:replacement)
            return .init(rows:[["id":.number(7)]])
        }
        let first = await send(r,id,a)
        let state = await r.mutationCommandState(windowID:id,command:a.footerCommand!)
        XCTAssertEqual(first?.status,"superseded"); XCTAssertEqual(state.writerStatus,.succeeded); XCTAssertTrue(state.guarded)
        let form = await r.windowFormJSONValue(windowID:id)
        XCTAssertNil(form["saved"])
        await r.setWindowFormValue(windowID:id,values:current)
        let replay = await send(r,id,a)
        XCTAssertEqual(replay?.status,"suppressed")
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        _ = await send(r,id,a)
        let refs = await j.refs; XCTAssertEqual(refs,["save","save"])
    }

    func testConfirmedPreparationCannotDispatchFinalWriterOrCleanupForNewScope() async throws {
        let step: [String:Any] = ["command":["commandId":"first","dataSourceRef":"stage"],"cleanup":["commandId":"undo","dataSourceRef":"undo"]]
        let (r,id,a,j) = try await setup(["before":[step]])
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        let replacement = switched
        await r.registerDataSourceLoader { q in
            await j.append(q.dataSourceRef)
            await r.setWindowFormValue(windowID:id,values:replacement)
            return .init(rows:[["id":.number(7)]])
        }
        _ = await send(r,id,a)
        await r.setWindowFormValue(windowID:id,values:current)
        _ = await send(r,id,a)
        let refs = await j.refs; XCTAssertEqual(refs,["stage"])
    }

    func testGroupMembersInheritReviewedScopeAndKeepIndependentAcknowledgements() async throws {
        let members = ["stage","other"].map { ["command":["commandId":$0,"dataSourceRef":$0]] }
        let (r,id,a,j) = try await setup(["dataSourceRef":"","group":members])
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        let valid = await send(r,id,a)
        XCTAssertEqual(valid?.status,"succeeded"); XCTAssertEqual(valid?.members?.count,2)
        await r.setWindowFormValue(windowID:id,values:switched)
        let stale = await send(r,id,a), refs = await j.refs
        XCTAssertEqual(stale?.status,"invalid_payload"); XCTAssertEqual(Set(refs),Set(["stage","other"]))
    }
    func testReviewRejectsSwitchedBackPresentationAndDoesNotTrustLaterPrincipal() async throws {
        let (r,id,a,j) = try await setup()
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        await r.setWindowFormValue(windowID:id,values:switched)
        _ = await send(r,id,a)
        await r.setWindowFormValue(windowID:id,values:current)
        let back = await send(r,id,a)
        XCTAssertEqual(back?.status,"invalid_payload")

        let command: [String:Any] = ["dataSourceRef":"save","reviewedScope":[owner]]
        let sig = await r.signals.metadata(windowID:id)
        await sig.set(try metadata(command,principal:[:]))
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        await sig.set(try metadata(command))
        let untrusted = await send(r,id,a), refs = await j.refs
        XCTAssertEqual(untrusted?.status,"invalid_payload"); XCTAssertEqual(refs,[])
    }

    func testVerifiedReadbackRetainsReceiptWithoutRedeliveryWhenReviewChanges() async throws {
        let binding: [String:Any] = ["name":"owner","in":"windowForm","location":"parent.ids.0","to":"read","codec":["name":"int"]]
        let verify: [String:Any] = ["idsParameter":"ids","scope":[["field":"parent","parameter":binding]]]

        let (r,id,a,j) = try await setup(["receiptIdentity":["field":"id","generated":true],
            "reconcile":["mode":"refetch","dataSourceRef":"read","identityField":"id","verify":verify]])
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        let replacement = switched
        await r.registerDataSourceLoader { q in
            await j.append(q.dataSourceRef)
            if q.dataSourceRef == "save" { await r.setWindowFormValue(windowID:id,values:replacement) }
            return .init(rows:[["id":.number(7),"parent":.number(7)]])
        }
        let first = await send(r,id,a)
        XCTAssertEqual(first?.status,"verification_failed",first?.error ?? "")
        await r.setWindowFormValue(windowID:id,values:current)
        let replay = await r.activateDialogFooter(windowID:id,dialogID:"edit",sourceDataSourceRef:"draft",action:a,
                                                   retryVerificationInvocationId:first?.invocationId)
        let refs = await j.refs, state = await r.mutationCommandState(windowID:id,command:a.footerCommand!)
        XCTAssertEqual(replay?.status,"verification_failed"); XCTAssertEqual(refs,["save"]); XCTAssertEqual(state.writerStatus,.succeeded)
    }

    func testInvalidRuleAndNestedReviewNeverReachWriter() async throws {
        for invalid in [["parameter":"record.owner","source":"metrics","field":"value"],
                        ["parameter":"record..owner","source":"windowForm","field":"parent.ids.0"],
                        ["parameter":"record.owner","source":"windowForm","field":"parent.ids.0","dataSourceRef":"parent"]] {
            let (r,id,a,j) = try await setup(["reviewedScope":[invalid]])
            _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
            let outcome = await send(r,id,a), refs = await j.refs
            XCTAssertEqual(outcome?.status,"invalid_payload"); XCTAssertEqual(refs,[])
        }
        let child: [String:Any] = ["commandId":"stage","dataSourceRef":"stage","reviewedScope":[owner]]
        let (r,id,a,j) = try await setup(["before":[["command":child]]])
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        _ = await send(r,id,a)
        let refs = await j.refs; XCTAssertEqual(refs,[])
    }

    func testHTTPFallbackRechecksAfterLoaderYields() async throws {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [UnexpectedReviewTransport.self]
        let session = URLSession(configuration:config)
        defer { session.invalidateAndCancel() }
        let r = ForgeRuntime(windowMetadataBaseURL:URL(string:"https://unit.test"),session:session)
        let m = try metadata(["dataSourceRef":"save","reviewedScope":[owner]],httpWriter:true)
        let id = await r.openWindowInline(key:"records",title:"Records",metadata:m).id
        await r.setWindowFormValue(windowID:id,values:current)
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        let replacement = switched, received = ReviewCalls()
        await r.registerDataSourceLoader { q in
            await received.append(q.dataSourceRef)
            await r.setWindowFormValue(windowID:id,values:replacement)
            return nil
        }
        let action = m.dialogs[0].actions[0], result = await send(r,id,action)
        let state = await r.mutationCommandState(windowID:id,command:action.footerCommand!), refs = await received.refs
        XCTAssertEqual(result?.status,"invalid_payload"); XCTAssertEqual(state.writerStatus,.notInvoked); XCTAssertEqual(refs,["save"])
    }

    func testGroupPendingChangeBlocksAllPhysicalWriters() async throws {
        let members = ["stage","other"].map { ["command":["commandId":$0,"dataSourceRef":$0]] }
        let (r,id,a,j) = try await setup(["dataSourceRef":"","group":members,"pendingState":["parent":["ids":[8]]]])
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        let result = await send(r,id,a), refs = await j.refs
        XCTAssertEqual(result?.status,"superseded"); XCTAssertEqual(refs,[])
    }

    func testRejectedGroupRestoresItsPendingFieldsAndAllowsClosingTheDialog() async throws {
        let members = ["stage","other"].map { ["command":["commandId":$0,"dataSourceRef":$0]] }
        let (r,id,a,j) = try await setup(["dataSourceRef":"","group":members,
            "pendingState":["parent":["ids":[8]],"busy":true,"status":"Working"]])
        await r.setWindowFormValue(windowID:id,values:["status":.string("Ready"),"untouched":.string("keep")])
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        let result = await send(r,id,a), refs = await j.refs
        let form = await r.windowFormJSONValue(windowID:id)
        let signal = await r.signals.form(dataSourceID:WindowIdentity(windowID:id).windowFormID()).peek()
        XCTAssertEqual(result?.status,"superseded"); XCTAssertEqual(refs,[])
        XCTAssertEqual(form["parent"],current["parent"]); XCTAssertEqual(form["status"],.string("Ready"))
        XCTAssertNil(form["busy"]); XCTAssertEqual(form["untouched"],.string("keep")); XCTAssertEqual(signal,form)
    }

    func testPendingReleaseHonorsLaterEditsActorAndReplacementPresentation() async throws {
        let command: [String:Any] = ["dataSourceRef":"save","reviewedScope":[owner]]
        let replacementMetadata = try metadata(command,principal:["subject":"other","issuer":"service","tenantId":"team"])
        for change in ["parent","actor","presentation"] {
            let step = ["command":["commandId":"first","dataSourceRef":"stage"]]
            let (r,id,a,j) = try await setup(["before":[step],"pendingState":[
                "busy":true,"status":"Working","edited":"Writing","added":"Transient"]])
            await r.setWindowFormValue(windowID:id,values:["busy":.bool(false),"status":.string("Previous owner's status"),"edited":.string("Before")])
            _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
            let nextParent = switched, launch = args
            await r.registerDataSourceLoader { request in
                await j.append(request.dataSourceRef)
                await r.setWindowFormValue(windowID:id,values:["edited":.string("Later")])
                switch change {
                case "actor": await (await r.signals.metadata(windowID:id)).set(replacementMetadata)
                case "presentation": _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:launch)
                default: await r.setWindowFormValue(windowID:id,values:nextParent)
                }
                return .init(rows:[["id":.number(7)]])
            }
            _ = await send(r,id,a)
            let refs = await j.refs, form = await r.windowFormJSONValue(windowID:id)
            let visible = await r.signals.form(dataSourceID:WindowIdentity(windowID:id).windowFormID()).peek()
            XCTAssertEqual(refs,["stage"],change); XCTAssertEqual(form["edited"],.string("Later"),change)
            XCTAssertEqual(form["busy"],change == "actor" ? nil : .bool(false),change)
            XCTAssertEqual(form["status"],change == "actor" ? nil : .string("Previous owner's status"),change)
            XCTAssertNil(form["added"],change)
            XCTAssertEqual(visible,form,change)
        }
    }

    func testRetirementFinishesBeforeReopenAndLateAcknowledgementDoesNotTouchReplacement() async throws {
        for directReplacement in [false,true] {
            let (r,id,a,log) = try await setup(["pendingState":["busy":true,"status":"Working"]])
            _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
            let started = AsyncStream<Void>.makeStream(), release = AsyncStream<Void>.makeStream()
            await r.registerDataSourceLoader { q in
                await log.append(q.dataSourceRef)
                started.continuation.yield(()); started.continuation.finish()
                for await _ in release.stream { break }
                return .init(rows:[["id":.number(7)]])
            }
            let send = Task { await r.activateDialogFooter(windowID:id,dialogID:"edit",sourceDataSourceRef:"draft",action:a) }
            for await _ in started.stream { break }
            let pending = await r.windowFormJSONValue(windowID:id); XCTAssertEqual(pending["busy"],.bool(true))
            await r.setWindowFormValue(windowID:id,values:["status":.string("Later edit")])
            if !directReplacement {
                await r.closeDialogPublic(windowID:id,dialogID:"edit")
                let closed = await r.windowFormJSONValue(windowID:id)
                XCTAssertNil(closed["busy"]); XCTAssertEqual(closed["status"],.string("Later edit"))
            }
            _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
            let replacement = await r.windowFormJSONValue(windowID:id)
            XCTAssertNil(replacement["busy"]); XCTAssertEqual(replacement["status"],.string("Later edit"))
            await r.setWindowFormValue(windowID:id,values:["busy":.bool(true),"status":.string("New presentation")])
            release.continuation.yield(()); release.continuation.finish()
            let result = await send.value, state = await r.mutationCommandState(windowID:id,command:a.footerCommand!)
            let settled = await r.windowFormJSONValue(windowID:id), calls = await log.refs
            XCTAssertEqual(result?.status,"superseded"); XCTAssertEqual(state.writerStatus,.succeeded); XCTAssertEqual(calls,["save"])
            XCTAssertEqual(settled["busy"],.bool(true)); XCTAssertEqual(settled["status"],.string("New presentation")); XCTAssertNil(settled["saved"])
        }
    }

    func testReviewedWriterAndHTTPFallbackUseStagedInputsAfterAnotherInputIsInstalled() async throws {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [OriginalReviewWriterTransport.self]
        let session = URLSession(configuration:config)
        defer { session.invalidateAndCancel() }
        let r = ForgeRuntime(windowMetadataBaseURL:URL(string:"https://unit.test"),session:session)
        let m = try metadata(["dataSourceRef":"save","prepare":"Editor.prepare","reviewedScope":[owner]],httpWriter:true)
        let id = await r.openWindowInline(key:"records",title:"Records",metadata:m).id
        await r.setWindowFormValue(windowID:id,values:current)
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        let log = ReviewCalls()
        await r.registerDataSourceLoader { q in
            XCTAssertEqual(q.input.parameters,["value":.number(7)])
            await log.append(q.dataSourceRef)
            await r.setDataSourceInputParameters(windowID:id,dataSourceRef:"save",parameters:["value":.number(8)])
            return nil
        }
        let result = await send(r,id,m.dialogs[0].actions[0]), calls = await log.refs
        XCTAssertEqual(result?.status,"succeeded"); XCTAssertEqual(calls,["save"])
        let latest = await r.dataSourceRuntime.input(dataSourceID:WindowIdentity(windowID:id).dataSourceID(ref:"save"))
        XCTAssertEqual(latest.parameters,["value":.number(8)])
    }

    func testQueuedRegistrationResolvesBindingsFromTheCapturedWriterInput() async throws {
        let r = ForgeRuntime(), m = try metadata(["dataSourceRef":"save","reviewedScope":[owner]],httpWriter:true)
        let id = await r.openWindowInline(key:"records",title:"Records",metadata:m).id
        let ref = WindowIdentity(windowID:id).dataSourceID(ref:"save"), calls = ReviewCalls()
        await r.registerDataSourceLoader { q in
            await calls.append(q.dataSourceRef)
            XCTAssertEqual(q.input.parameters["value"],.number(7)); XCTAssertEqual(q.resolvedInputs["value"],.number(7))
            return .init(rows:[["id":.number(7)]])
        }
        let staged = await r.dataSourceRuntime.installInputParameters(dataSourceID:ref,parameters:["value":.number(7)],fetch:false,preservePendingFetch:false)
        let release = AsyncStream<Void>.makeStream()
        let queued = Task {
            for await _ in release.stream { break }
            _ = await r.refreshDataSourceRows(windowID:id,dataSourceRef:"save",admitTransport:{true},submittedInput:staged)
        }
        await r.setDataSourceInputParameters(windowID:id,dataSourceRef:"save",parameters:["value":.number(8)])
        release.continuation.yield(()); release.continuation.finish()
        await queued.value
        let refs = await calls.refs
        XCTAssertEqual(refs,["save"])
    }

    func testTwoInFlightFootersRetireAnOverlappingFieldInPublicationOrder() async throws {
        let r = ForgeRuntime()
        func footer(_ id: String) -> [String:Any] {
            ["id":id,"close":false,"mutationCommand":["dataSourceRef":id,"reviewedScope":[owner],"pendingState":["status":id]]]
        }
        let json: [String:Any] = ["authorizationSnapshot":["principal":["subject":"owner"]],
            "dataSource":["draft":[:],"save":[:],"other":[:]],"dialogs":[["id":"edit","dataSourceRef":"draft",
            "fetchOnOpen":false,"actions":[footer("save"),footer("other")]]]]
        let m = try JSONDecoder().decode(WindowMetadata.self,from:JSONSerialization.data(withJSONObject:json))
        let id = await r.openWindowInline(key:"records",title:"Records",metadata:m).id
        await r.setWindowFormValue(windowID:id,values:current.merging(["status":.string("Ready")]) { _, new in new })
        _ = await r.presentDialog(windowID:id,dialogID:"edit",parameters:args)
        let started = AsyncStream<String>.makeStream(), saveRelease = AsyncStream<Void>.makeStream(), otherRelease = AsyncStream<Void>.makeStream()
        await r.registerDataSourceLoader { q in
            started.continuation.yield(q.dataSourceRef)
            let stream = q.dataSourceRef == "save" ? saveRelease.stream : otherRelease.stream
            for await _ in stream { break }
            return .init(rows:[["id":.number(7)]])
        }
        var writes = started.stream.makeAsyncIterator()
        let a = Task { await r.activateDialogFooter(windowID:id,dialogID:"edit",sourceDataSourceRef:"draft",action:m.dialogs[0].actions[0]) }
        let first = await writes.next(); XCTAssertEqual(first,"save")
        let b = Task { await r.activateDialogFooter(windowID:id,dialogID:"edit",sourceDataSourceRef:"draft",action:m.dialogs[0].actions[1]) }
        let second = await writes.next(); XCTAssertEqual(second,"other")
        await r.closeDialogPublic(windowID:id,dialogID:"edit")
        let retired = await r.windowFormJSONValue(windowID:id)
        XCTAssertEqual(retired["status"],.string("Ready"))
        saveRelease.continuation.finish(); otherRelease.continuation.finish(); started.continuation.finish()
        _ = await a.value; _ = await b.value
    }

}
