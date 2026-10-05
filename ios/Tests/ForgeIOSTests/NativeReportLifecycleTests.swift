import XCTest
@testable import ForgeIOSRuntime

final class NativeReportLifecycleTests: XCTestCase {
    func testSavedArtifactsRemainCompletedWhenActivationIsSupersededOrUnconfirmed() async throws {
        for contextStatus in ["superseded", "unconfirmed"] {
            let runtime = ForgeRuntime()
            let recorder = RuntimeLifecycleRecorder(contextStatus: contextStatus)
            let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","dataSourceRef":"cube"}]}},"dataSource":{"cube":{"autoFetch":false}}}"#.utf8))
            let window = await runtime.openWindowInline(key: "report", title: "Report", metadata: metadata, conversationID: "conversation")
            let identity = await runtime.reportPreparationIdentity(windowID: window.id, builderRef: "builder")
            let request: [String: JSONValue] = ["filters": .object([:])]
            let packet = PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: request)
            _ = await runtime.publishPreparedReportRequest(packet)
            await runtime.registerNativeReportLifecycleHandler(recorder)
            await runtime.registerDataSourceLoader { _ in await recorder.record("load"); return ForgeRuntime.DataSourceFetchResult(rows: []) }
            try await runtime.publishNativeReportAdmission(NativeReportAdmission(preparation: packet, conversationID: "conversation", stateKey: "state", document: ["blocks": .array([])], datasets: [.init(id: "primary", dataSourceRef: "cube", request: request)]))
            _ = try await runtime.beginNativeReportRun(windowID: window.id, requestID: "request", origin: "ui.report.run")
            _ = try await runtime.materializeNativeReportRun(requestID: "request", transform: { _, rows in rows })
            let form = await runtime.windowFormJSONValue(windowID: window.id)
            XCTAssertEqual(form["reportMaterialization"]?.objectValue?["status"], .string("completed"))
            XCTAssertEqual(form["reportMaterialization"]?.objectValue?["contextStatus"], .string(contextStatus))
            XCTAssertEqual(form["reportMaterialization"]?.objectValue?["active"], contextStatus == "superseded" ? .bool(false) : .null)
            XCTAssertEqual(form["reportStaticDatasets"]?.arrayValue?.count, 1)
            let events = await recorder.events
            XCTAssertEqual(events, ["begin", "load", "complete"])
        }
    }

    func testRuntimeRequiresAdmissionAndRemountsJoinOnePhysicalRead() async throws {
        let runtime = ForgeRuntime()
        let recorder = RuntimeLifecycleRecorder()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","dataSourceRef":"cube"}]}},"dataSource":{"cube":{"autoFetch":false}}}"#.utf8))
        let window = await runtime.openWindowInline(key: "report", title: "Report", metadata: metadata, conversationID: "conversation")
        let identity = await runtime.reportPreparationIdentity(windowID: window.id, builderRef: "builder")
        let request: [String: JSONValue] = ["filters": .object(["orderIds": .array([.number(2659534)])])]
        let packet = PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: request)
        _ = await runtime.publishPreparedReportRequest(packet)
        await runtime.registerNativeReportLifecycleHandler(recorder)
        await runtime.registerDataSourceLoader { request in
            await recorder.record("load")
            XCTAssertEqual(request.resolvedInputs, packet.request)
            try await Task.sleep(nanoseconds: 10_000_000)
            return ForgeRuntime.DataSourceFetchResult(rows: [])
        }
        try await runtime.publishNativeReportAdmission(NativeReportAdmission(preparation: packet, conversationID: "conversation", stateKey: "reportBuilder:builder", document: ["blocks": .array([])], datasets: [NativeReportDatasetAdmission(id: "primary", dataSourceRef: "cube", request: request)]))
        await runtime.fetchDataSourceInstance(windowID: window.id, instanceRef: "reportDocument:primary", dataSourceRef: "cube", parameters: request)
        let before = await recorder.events
        XCTAssertTrue(before.isEmpty)
        _ = try await runtime.beginNativeReportRun(windowID: window.id, requestID: "request", origin: "ui.report.run")
        async let first = runtime.materializeNativeReportRun(requestID: "request", transform: { _, rows in rows })
        async let second = runtime.materializeNativeReportRun(requestID: "request", transform: { _, rows in rows })
        let results = try await (first, second)
        XCTAssertEqual(results.0.completed.reportRunID, "durable")
        XCTAssertEqual(results.1.rows["primary"], [])
        let events = await recorder.events
        XCTAssertEqual(events, ["begin", "load", "complete"])
        let form = await runtime.windowFormJSONValue(windowID: window.id)
        XCTAssertEqual(form["reportMaterialization"]?.objectValue?["id"], .string("durable"))
        XCTAssertEqual(form["reportMaterialization"]?.objectValue?["status"], .string("completed"))
        let trusted = await runtime.completedNativeReportDatasets(windowID: window.id)
        XCTAssertEqual(trusted?.rows["primary"], [])
        await runtime.setWindowFormValue(windowID: window.id, values: ["reportStaticDatasets": .array([.object(["id": .string("primary"), "dataSourceRef": .string("cube"), "request": .object(request), "rows": .array([.object(["spend": .number(999999)])])])])], bumpPrefillRevision: false)
        let tampered = await runtime.completedNativeReportDatasets(windowID: window.id)
        XCTAssertNil(tampered, "A preserved completion signature cannot authorize edited rows")
        await runtime.setWindowFormValue(windowID: window.id, values: ["reportStaticDatasets": form["reportStaticDatasets"]!], bumpPrefillRevision: false)
        let restored = await runtime.completedNativeReportDatasets(windowID: window.id)
        XCTAssertEqual(restored?.rows["primary"], [])
        let finalEvents = await recorder.events
        XCTAssertEqual(finalEvents, ["begin", "load", "complete"])
    }

    func testAccountResetDuringCurrentCheckCannotReinsertPriorAdmission() async throws {
        let lifecycle = NativeReportLifecycle()
        let recorder = LifecycleRecorder()
        await lifecycle.register(recorder)
        await lifecycle.publish(admission())
        do {
            _ = try await lifecycle.begin(windowID: "window", requestID: "old-account-request", origin: "ui.report.run", current: { _ in
                await lifecycle.reset()
                return true
            })
            XCTFail("Account reset must fence the suspended prior admission")
        } catch let error as ReportPreparationError { XCTAssertEqual(error.reason, "stale-report-account") }
        let beginnings = await recorder.beginnings
        XCTAssertEqual(beginnings, 0)
        let handle = await lifecycle.handle(requestID: "old-account-request")
        XCTAssertNil(handle)
    }

    private func admission(title: String = "Report") -> NativeReportAdmission {
        let identity = PreparedReportIdentity(windowId: "window", builderRef: "builder", formRevision: .string("form"), stateRevision: .string("state"))
        let request: [String: JSONValue] = ["filters": .object(["orderIds": .array([.number(2659534)])])]
        return NativeReportAdmission(preparation: PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: request), conversationID: "conversation", stateKey: "reportBuilder:builder", document: ["title": .string(title)], datasets: [NativeReportDatasetAdmission(id: "summary", dataSourceRef: "cube", request: request)])
    }
    func testConcurrentAdmissionJoinsOneDurableRunAndChangedDocumentRejectsReuse() async throws {
        let lifecycle = NativeReportLifecycle()
        let handler = LifecycleRecorder()
        await lifecycle.register(handler)
        await lifecycle.publish(admission())
        async let first = lifecycle.begin(windowID: "window", requestID: "request", origin: "ui.report.run", current: { _ in true })
        async let second = lifecycle.begin(windowID: "window", requestID: "request", origin: "ui.report.run", current: { _ in true })
        let pair = try await (first, second)
        XCTAssertEqual(pair.0.reportRunID, pair.1.reportRunID)
        let count = await handler.beginnings
        XCTAssertEqual(count, 1)
        await lifecycle.publish(admission(title: "Changed"))
        do {
            _ = try await lifecycle.begin(windowID: "window", requestID: "request", origin: "ui.report.run", current: { _ in true })
            XCTFail("Changed authored input must not reuse an admitted request ID")
        } catch let error as ReportPreparationError { XCTAssertEqual(error.reason, "report-request-identity-conflict") }
    }
    func testEmptyDatasetCompletesOnceAndChangedRowsCannotReuseCompletion() async throws {
        let lifecycle = NativeReportLifecycle()
        let handler = LifecycleRecorder()
        await lifecycle.register(handler)
        await lifecycle.publish(admission())
        let handle = try await lifecycle.begin(windowID: "window", requestID: "request", origin: "ui.report.run", current: { _ in true })
        _ = try await lifecycle.complete(handle: handle, rows: ["summary": []], current: { true })
        _ = try await lifecycle.complete(handle: handle, rows: ["summary": []], current: { true })
        let count = await handler.completions
        XCTAssertEqual(count, 1)
        do {
            _ = try await lifecycle.complete(handle: handle, rows: ["summary": [["spend": .number(309)]]], current: { true })
            XCTFail("Changed materialized rows must not reuse an existing completion")
        } catch let error as ReportPreparationError { XCTAssertEqual(error.reason, "report-result-identity-conflict") }
    }
    func testStaleAdmissionAndMissingDatasetDoNotReachHost() async throws {
        let lifecycle = NativeReportLifecycle()
        let handler = LifecycleRecorder()
        await lifecycle.register(handler)
        await lifecycle.publish(admission())
        do { _ = try await lifecycle.begin(windowID: "window", requestID: "stale", origin: "ui.report.run", current: { _ in false }); XCTFail("Stale admission") }
        catch let error as ReportPreparationError { XCTAssertEqual(error.reason, "stale-preparation") }
        let handle = try await lifecycle.begin(windowID: "window", requestID: "request", origin: "ui.report.run", current: { _ in true })
        do { _ = try await lifecycle.complete(handle: handle, rows: [:], current: { true }); XCTFail("Missing dataset is not an empty result") }
        catch let error as ReportPreparationError { XCTAssertEqual(error.reason, "stale-preparation") }
        let begins = await handler.beginnings
        let completes = await handler.completions
        XCTAssertEqual(begins, 1)
        XCTAssertEqual(completes, 0)
    }
}
private actor LifecycleRecorder: NativeReportLifecycleHandler {
    var beginnings = 0
    var completions = 0
    func begin(admission: NativeReportAdmission, uiRunRequestID: String, origin: String) async throws -> NativeReportRunHandle {
        beginnings += 1
        try await Task.sleep(nanoseconds: 10_000_000)
        return NativeReportRunHandle(reportRunID: "durable", revision: 1, uiRunRequestID: uiRunRequestID, admission: admission)
    }
    func complete(handle: NativeReportRunHandle, rows: [String: [[String: JSONValue]]], current: @escaping @Sendable () async -> Bool) async throws -> NativeReportCompletedRun {
        completions += 1
        return NativeReportCompletedRun(reportRunID: handle.reportRunID, revision: 2)
    }
    func fail(handle: NativeReportRunHandle, code: String, text: String) async throws {}
}

private actor RuntimeLifecycleRecorder: NativeReportLifecycleHandler {
    let contextStatus: String
    init(contextStatus: String = "active") { self.contextStatus = contextStatus }
    var events: [String] = []
    func record(_ event: String) { events.append(event) }
    func begin(admission: NativeReportAdmission, uiRunRequestID: String, origin: String) async throws -> NativeReportRunHandle {
        events.append("begin")
        return NativeReportRunHandle(reportRunID: "durable", revision: 1, uiRunRequestID: uiRunRequestID, admission: admission)
    }
    func complete(handle: NativeReportRunHandle, rows: [String: [[String: JSONValue]]], current: @escaping @Sendable () async -> Bool) async throws -> NativeReportCompletedRun {
        events.append("complete")
        XCTAssertEqual(rows["primary"], [])
        return NativeReportCompletedRun(reportRunID: handle.reportRunID, revision: 2, contextStatus: contextStatus, active: contextStatus == "unconfirmed" ? nil : contextStatus == "active", activationError: contextStatus == "active" ? nil : "Report saved; selection changed.")
    }
    func fail(handle: NativeReportRunHandle, code: String, text: String) async throws { events.append("fail") }
}
