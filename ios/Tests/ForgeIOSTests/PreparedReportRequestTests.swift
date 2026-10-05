import XCTest
@testable import ForgeIOSRuntime

final class PreparedReportRequestTests: XCTestCase {
    func testCommittedSnapshotPreservesLatestResultStateAndRejectsAuthorChange() async throws {
        let runtime = DataSourceRuntime()
        let expected: [String: JSONValue] = ["custom": .object(["orderIds": .array([.number(7)])])]
        var current = expected
        current["reportMaterialization"] = .object(["status": .string("running")])
        await runtime.setForm(dataSourceID: "form", values: current)
        var updated = expected
        updated["custom"] = .object(["orderIds": .array([.number(7)]), "initialized": .bool(true)])
        let committedValue = await runtime.commitReportFormSnapshot(dataSourceID: "form", expected: expected, updated: updated)
        let committed = try XCTUnwrap(committedValue)
        XCTAssertEqual(committed["reportMaterialization"], current["reportMaterialization"])
        XCTAssertEqual(committed["custom"], updated["custom"])
        var changed = committed
        changed["custom"] = .object(["orderIds": .array([.number(99)])])
        await runtime.setForm(dataSourceID: "form", values: changed)
        let rejected = await runtime.commitReportFormSnapshot(dataSourceID: "form", expected: committed, updated: committed)
        XCTAssertNil(rejected)
    }

    func testIdenticalProducerCommitDoesNotEmitAnotherFormUpdate() async throws {
        actor Counter { var count = 0; func hit() { count += 1 } }
        let runtime = DataSourceRuntime(), counter = Counter()
        let form: [String: JSONValue] = ["custom": .object(["initialized": .bool(true)])]
        await runtime.setForm(dataSourceID: "form", values: form)
        let updates = await runtime.formUpdates(dataSourceID: "form")
        let observer = Task { for await _ in updates { await counter.hit() } }
        defer { observer.cancel() }
        for _ in 0..<20 { if await counter.count == 1 { break }; try await Task.sleep(nanoseconds: 1_000_000) }
        _ = await runtime.commitReportFormSnapshot(dataSourceID: "form", expected: form, updated: form)
        try await Task.sleep(nanoseconds: 10_000_000)
        let count = await counter.count
        XCTAssertEqual(count, 1)
    }

    func testCommittedIdentityCannotPublishAfterAuthorOrMetadataChanges() async throws {
        let runtime = ForgeRuntime()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","dataSourceRef":"cube"}]}},"dataSource":{"cube":{"autoFetch":false}}}"#.utf8))
        let window = await runtime.openWindowInline(key: "report", title: "Report", metadata: metadata)
        let form = await runtime.windowFormJSONValue(windowID: window.id)
        var updated = form; updated["custom"] = .object(["initialized": .bool(true)])
        let revision = metadata.runtimeAuthoring.map(reportPreparationFingerprint) ?? ""
        let committedValue = await runtime.commitReportProducerState(windowID: window.id, builderRef: "builder", stateKey: "custom", expectedForm: form, updatedForm: updated, expectedMetadataRevision: revision)
        let committed = try XCTUnwrap(committedValue)
        let packet = PreparedReportRequest(identity: committed, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: [:])
        await runtime.setWindowFormValue(windowID: window.id, values: ["custom": .object(["orderIds": .array([.number(99)])])])
        let authorAccepted = await runtime.publishPreparedReportRequest(packet)
        XCTAssertFalse(authorAccepted)
        await runtime.setWindowFormValue(windowID: window.id, values: updated, replace: true)
        let changedMetadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"title":"Changed","view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","dataSourceRef":"cube"}]}},"dataSource":{"cube":{"autoFetch":false}}}"#.utf8))
        _ = await runtime.updateWindowInline(id: window.id, title: "Changed", metadata: changedMetadata, resolveMetadata: false)
        let metadataAccepted = await runtime.publishPreparedReportRequest(packet)
        XCTAssertFalse(metadataAccepted)
    }

    func testProducerCASPreservesNewCustomState() async throws {
        let runtime = DataSourceRuntime()
        let a: [String: JSONValue] = ["custom": .object(["builder": .string("a")])]
        let b: [String: JSONValue] = ["custom": .object(["builder": .string("b")])]
        await runtime.setForm(dataSourceID: "form", values: a)
        await runtime.setForm(dataSourceID: "form", values: b)
        let committed = await runtime.compareAndSetReportForm(dataSourceID: "form", expected: a, updated: a)
        XCTAssertFalse(committed)
        let current = await runtime.form(dataSourceID: "form")
        XCTAssertEqual(current, b)
    }

    func testQueuedFetchACannotAdoptReadyPacketB() async throws {
        actor Capture { var count = 0; func hit() { count += 1 }; func total() -> Int { count } }
        let capture = Capture(), runtime = ForgeRuntime()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","dataSourceRef":"cube"}]}},"dataSource":{"cube":{"autoFetch":false}}}"#.utf8))
        let window = await runtime.openWindowInline(key: "report", title: "Report", metadata: metadata)
        await runtime.registerDataSourceLoader { _ in await capture.hit(); return ForgeRuntime.DataSourceFetchResult() }
        let first = await runtime.reportPreparationIdentity(windowID: window.id, builderRef: "builder")
        _ = await runtime.publishPreparedReportRequest(PreparedReportRequest(identity: first, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: [:]))
        await runtime.setWindowFormValue(windowID: window.id, values: ["reportStarterId": .string("b")])
        let second = await runtime.reportPreparationIdentity(windowID: window.id, builderRef: "builder")
        _ = await runtime.publishPreparedReportRequest(PreparedReportRequest(identity: second, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: [:]))
        do { try await runtime.fetchPreparedReportDataSource(windowID: window.id, dataSourceRef: "cube", expectedIdentity: first); XCTFail("Queued A adopted B") } catch {}
        let count = await capture.total(); XCTAssertEqual(count, 0)
    }

    func testPhysicalReportRefreshAndInstanceCannotBypassCurrentPreparation() async throws {
        actor Capture { var count = 0; func hit() { count += 1 }; func total() -> Int { count } }
        let capture = Capture(), runtime = ForgeRuntime()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","dataSourceRef":"cube","dashboard":{"reportBuilder":{"dataSources":[{"id":"summary","dataSourceRef":"cube","request":{"filters":{},"limit":1}}]}}}]}},"dataSource":{"cube":{"autoFetch":false}}}"#.utf8))
        let window = await runtime.openWindowInline(key: "report", title: "Report", metadata: metadata)
        await runtime.registerDataSourceLoader { _ in await capture.hit(); return ForgeRuntime.DataSourceFetchResult(rows: [["value": .number(1)]]) }
        await runtime.setDataSourceInputParameters(windowID: window.id, dataSourceRef: "cube", parameters: ["filters": .object([:])], fetch: true)
        await runtime.fetchDataSourceInstance(windowID: window.id, instanceRef: "reportDocument:summary", dataSourceRef: "cube", parameters: ["filters": .object([:]), "limit": .number(1)])
        var count = await capture.total(); XCTAssertEqual(count, 0)
        let identity = await runtime.reportPreparationIdentity(windowID: window.id, builderRef: "builder")
        let config = try JSONDecoder().decode(DashboardReportBuilderDef.self, from: Data(#"{"dataSources":[{"id":"summary","dataSourceRef":"cube","request":{"filters":{},"limit":1}}]}"#.utf8))
        _ = await runtime.publishPreparedReportRequest(PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: ["filters": .object([:])], config: config))
        try await runtime.fetchPreparedReportDataSource(windowID: window.id, dataSourceRef: "cube")
        count = await capture.total(); XCTAssertEqual(count, 1)
        await runtime.setWindowFormValue(windowID: window.id, values: ["prefill": .object(["entityIds": .array([.number(2)])])])
        await runtime.refreshDataSourceCollection(windowID: window.id, dataSourceRef: "cube")
        await runtime.fetchDataSourceInstance(windowID: window.id, instanceRef: "reportDocument:summary", dataSourceRef: "cube", parameters: ["filters": .object([:]), "limit": .number(1)])
        count = await capture.total(); XCTAssertEqual(count, 1)
    }

    func testLateInstanceResultCannotCommitAfterDefinitionChangesWithoutNewFetch() async throws {
        actor Producer {
            var started = false
            var continuation: CheckedContinuation<ForgeRuntime.DataSourceFetchResult?, Never>?
            func load() async -> ForgeRuntime.DataSourceFetchResult? { started = true; return await withCheckedContinuation { continuation = $0 } }
            func begun() -> Bool { started }
            func finish() { continuation?.resume(returning: ForgeRuntime.DataSourceFetchResult(rows: [["stale": .bool(true)]])); continuation = nil }
        }
        for instance in [true, false] {
        let runtime = ForgeRuntime(), producer = Producer()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","stateKey":"custom","dataSourceRef":"cube","dashboard":{"reportBuilder":{"dataSources":[{"id":"summary","dataSourceRef":"cube","request":{"filters":{},"limit":1}}]}}}]}},"dataSource":{"cube":{"autoFetch":false}}}"#.utf8))
        let window = await runtime.openWindowInline(key: "report", title: "Report", metadata: metadata)
        await runtime.setWindowFormValue(windowID: window.id, values: ["custom:builder": .object(["scope": .string("old")]), "reportDefinition": .object(["documentPatch": .object(["title": .string("old")])])])
        let identity = await runtime.reportPreparationIdentity(windowID: window.id, builderRef: "builder", stateKey: "custom:builder")
        let config = try JSONDecoder().decode(DashboardReportBuilderDef.self, from: Data(#"{"dataSources":[{"id":"summary","dataSourceRef":"cube","request":{"filters":{},"limit":1}}]}"#.utf8))
        _ = await runtime.publishPreparedReportRequest(PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: ["filters": .object([:])], config: config))
        await runtime.registerDataSourceLoader { _ in await producer.load() }
        let fetch = Task {
            if instance { await runtime.fetchDataSourceInstance(windowID: window.id, instanceRef: "reportDocument:summary", dataSourceRef: "cube", parameters: ["filters": .object([:]), "limit": .number(1)]) }
            else { await runtime.setDataSourceInputParameters(windowID: window.id, dataSourceRef: "cube", parameters: ["filters": .object([:])], fetch: true) }
        }
        for _ in 0..<100 { if await producer.begun() { break }; try await Task.sleep(nanoseconds: 1_000_000) }
        let started = await producer.begun(); XCTAssertTrue(started)
        await runtime.setWindowFormValue(windowID: window.id, values: ["reportDefinition": .object(["documentPatch": .object(["title": .string("new")])])])
        await producer.finish(); await fetch.value
        let rows = await runtime.dataSourceCollection(windowID: window.id, dataSourceRef: instance ? "reportDocument:summary" : "cube")
        XCTAssertTrue(rows.isEmpty)
        let changed = await runtime.reportPreparationIdentity(windowID: window.id, builderRef: "builder", stateKey: "custom:builder")
        XCTAssertNotEqual(changed, identity)
        await runtime.setWindowFormValue(windowID: window.id, values: ["custom:builder": .object(["scope": .string("new")])])
        let changedState = await runtime.reportPreparationIdentity(windowID: window.id, builderRef: "builder", stateKey: "custom:builder")
        XCTAssertNotEqual(changedState.stateRevision, changed.stateRevision)
        }
    }

    func testNoRefExcludesLiteralHiddenAndRejectsUnresolvedTabs() async throws {
        let runtime = ForgeRuntime()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"visible","dataSourceRef":"shown"},{"id":"hidden","className":"forge-container-hidden","dataSourceRef":"secret"}]}},"dataSource":{"shown":{},"secret":{},"unused":{}}}"#.utf8))
        let window = await runtime.openWindowInline(key: "active", title: "Active", metadata: metadata)
        let refs = try await runtime.activeViewDataSourceRefs(windowID: window.id)
        XCTAssertEqual(refs, ["shown"])
        let ambiguous = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"tabs","kind":"tabs","tabs":{},"containers":[{"id":"one","dataSourceRef":"one"},{"id":"two","dataSourceRef":"two"}]}]}},"dataSource":{"one":{},"two":{}}}"#.utf8))
        let tabWindow = await runtime.openWindowInline(key: "tabs", title: "Tabs", metadata: ambiguous)
        do { _ = try await runtime.activeViewDataSourceRefs(windowID: tabWindow.id); XCTFail("Ambiguous tabs fetched") } catch let error as ReportPreparationError { XCTAssertEqual(error.reason, "ambiguous-active-view") }
    }

    func testValidatedFenceKeepsPacketAWhenPacketBIsPublishedBeforeDispatch() async throws {
        let runtime = ForgeRuntime()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","dataSourceRef":"cube"}]}},"dataSource":{"cube":{"autoFetch":false}}}"#.utf8))
        let window = await runtime.openWindowInline(key: "report", title: "Report", metadata: metadata)
        let a: [String: JSONValue] = ["filters": .object(["entityIds": .array([.number(1)])])]
        let b: [String: JSONValue] = ["filters": .object(["entityIds": .array([.number(2)])])]
        await runtime.setWindowFormValue(windowID: window.id, values: ["reportStarterId": .string("a")])
        let first = await runtime.reportPreparationIdentity(windowID: window.id, builderRef: "builder")
        _ = await runtime.publishPreparedReportRequest(PreparedReportRequest(identity: first, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: a))
        let fence = try await runtime.validatedReportFetchFence(windowID: window.id, dataSourceRef: "cube", parameters: a)
        await runtime.setWindowFormValue(windowID: window.id, values: ["reportStarterId": .string("b")])
        let second = await runtime.reportPreparationIdentity(windowID: window.id, builderRef: "builder")
        _ = await runtime.publishPreparedReportRequest(PreparedReportRequest(identity: second, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: b))
        let current = await runtime.reportFetchFenceIsCurrent(fence, windowID: window.id)
        XCTAssertFalse(current); XCTAssertEqual(fence.identity, first); XCTAssertNotEqual(first, second)
        do { _ = try await runtime.validatedReportFetchFence(windowID: window.id, dataSourceRef: "cube", parameters: a); XCTFail("Old parameters accepted by new packet") } catch {}
    }

    func testDelayedInitializationCannotPublishOldInputsAsNewIdentity() async throws {
        actor Initializer { var begun = false; var continuation: CheckedContinuation<Void, Never>?; func wait() async { begun = true; await withCheckedContinuation { continuation = $0 } }; func started() -> Bool { begun }; func finish() { continuation?.resume(); continuation = nil } }
        actor Capture { var calls = 0; func hit() { calls += 1 }; func count() -> Int { calls } }
        let runtime = ForgeRuntime(), initializer = Initializer(), capture = Capture()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","stateKey":"custom","dataSourceRef":"cube"}]}},"dataSource":{"cube":{"autoFetch":false}}}"#.utf8))
        let window = await runtime.openWindowInline(key: "report", title: "Report", metadata: metadata)
        await runtime.registerDataSourceLoader { _ in await capture.hit(); return ForgeRuntime.DataSourceFetchResult() }
        await runtime.setWindowFormValue(windowID: window.id, values: ["prefill": .object(["entityIds": .array([.number(1)])])])
        let formA = await runtime.windowFormJSONValue(windowID: window.id)
        let revision = metadata.runtimeAuthoring.map(reportPreparationFingerprint) ?? ""
        let old = Task {
            await initializer.wait()
            return await runtime.validatedReportProducerIdentity(windowID: window.id, builderRef: "builder", stateKey: "custom:builder", expectedForm: formA, expectedMetadataRevision: revision)
        }
        for _ in 0..<100 { if await initializer.started() { break }; try await Task.sleep(nanoseconds: 1_000_000) }
        await runtime.setWindowFormValue(windowID: window.id, values: ["prefill": .object(["entityIds": .array([.number(2)])])])
        await initializer.finish()
        let identityA = await old.value; XCTAssertNil(identityA)
        await runtime.refreshDataSourceCollection(windowID: window.id, dataSourceRef: "cube")
        var count = await capture.count(); XCTAssertEqual(count, 0)
        let formB = await runtime.windowFormJSONValue(windowID: window.id)
        let actual = await runtime.windowMetadata(id: window.id)
        let identityB = await runtime.validatedReportProducerIdentity(windowID: window.id, builderRef: "builder", stateKey: "custom:builder", expectedForm: formB, expectedMetadataRevision: actual?.runtimeAuthoring.map(reportPreparationFingerprint) ?? "")
        let ready = try XCTUnwrap(identityB)
        _ = await runtime.publishPreparedReportRequest(PreparedReportRequest(identity: ready, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: ["filters": .object(["entityIds": .array([.number(2)])])]))
        try await runtime.fetchPreparedReportDataSource(windowID: window.id, dataSourceRef: "cube")
        count = await capture.count(); XCTAssertEqual(count, 1)
    }

    func testSharedWholeBridgeFetchPlanFixtures() throws {
        var root = URL(fileURLWithPath: #filePath); for _ in 0..<4 { root.deleteLastPathComponent() }
        let data = try Data(contentsOf: root.appendingPathComponent("testdata/native-report-preparation/fetch-plans.json"))
        let fixture = try JSONDecoder().decode(JSONValue.self, from: data)
        guard case .array(let cases) = fixture.objectValue?["cases"] else { return XCTFail("Missing cases") }
        for value in cases {
            let entry = try XCTUnwrap(value.objectValue)
            func strings(_ key: String) -> [String] { guard case .array(let values) = entry[key] else { return [] }; return values.compactMap { guard case .string(let string) = $0 else { return nil }; return string } }
            let requested: String?; if case .string(let string) = entry["requestedRef"] { requested = string } else { requested = nil }
            let plan = ReportDataFetchPlan.resolve(requestedRef: requested, activeRefs: strings("activeRefs"), registryRefs: strings("registryRefs"), reportRefs: strings("reportRefs"), preparedRefs: strings("preparedRefs"))
            let expected = try XCTUnwrap(entry["expected"]?.objectValue)
            XCTAssertEqual(.string(plan.status), expected["status"])
            XCTAssertEqual(.array(plan.targets.map(JSONValue.string)), expected["targets"])
        }
    }

    func testSharedWebDerivedPublishedRequestFixtures() throws {
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let data = try Data(contentsOf: root.appendingPathComponent("testdata/native-report-preparation/published-requests.json"))
        let fixture = try JSONDecoder().decode(JSONValue.self, from: data)
        guard case .array(let cases) = fixture.objectValue?["cases"] else { return XCTFail("Missing cases") }
        let now = ISO8601DateFormatter().date(from: "2026-10-04T12:00:00Z")!
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        for value in cases {
            let entry = try XCTUnwrap(value.objectValue)
            func decode<T: Decodable>(_ key: String, as type: T.Type) throws -> T { try JSONDecoder().decode(type, from: JSONEncoder().encode(try XCTUnwrap(entry[key]))) }
            let name = try decode("name", as: String.self)
            let identity = try decode("identity", as: PreparedReportIdentity.self)
            let prepared = PreparedReportRequest(identity: try decode("preparedIdentity", as: PreparedReportIdentity.self), status: try decode("status", as: String.self), hookStatus: try decode("hookStatus", as: String.self), dataSourceRef: try decode("primaryDataSourceRef", as: String.self), request: entry["primaryRequest"]?.objectValue ?? [:], state: entry["state"]?.objectValue ?? [:], requiredBindings: entry["requiredBindings"].flatMap { value in guard case .array(let values) = value else { return nil }; return values.compactMap(\.objectValue) } ?? [])
            let expected = try XCTUnwrap(entry["expected"]?.objectValue)
            do {
                let request = try prepared.publishedRequest(decode("source", as: ReportBuilderPublishedDataSourceDef.self), current: identity, datasetScopeParams: entry["datasetScopeParams"]?.objectValue ?? [:], now: now, calendar: calendar)
                XCTAssertEqual(expected["status"], .string("ready"), name)
                XCTAssertEqual(.object(request), expected["request"], name)
            } catch let error as ReportPreparationError {
                let status = ["pending", "stale-preparation"].contains(error.reason) ? "pending" : "error"
                XCTAssertEqual(expected["status"], .string(status), name)
                if let reason = expected["reason"] { XCTAssertEqual(reason, .string(error.reason), name) }
            }
        }
    }
}
