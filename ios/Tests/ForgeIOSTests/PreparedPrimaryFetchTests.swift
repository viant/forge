import XCTest
@testable import ForgeIOSRuntime

final class PreparedPrimaryFetchTests: XCTestCase {
    func testDeclaredAutomaticPolicyAndExplicitWindowOverride() {
        let disabled: JSONValue = .object(["request": .object(["autoFetch": .bool(false)])])
        XCTAssertFalse(reportBuilderAutomaticFetchAllowed(windowForm: [:], authoredConfig: disabled, dataSourceAutoFetch: true))
        XCTAssertFalse(reportBuilderAutomaticFetchAllowed(windowForm: [:], authoredConfig: nil, dataSourceAutoFetch: false))
        XCTAssertTrue(reportBuilderAutomaticFetchAllowed(windowForm: ["executeOnOpen": .bool(true)], authoredConfig: disabled, dataSourceAutoFetch: false))
        XCTAssertFalse(reportBuilderAutomaticFetchAllowed(windowForm: ["executeOnOpen": .bool(false)], authoredConfig: .object(["request": .object(["autoFetch": .bool(true)])]), dataSourceAutoFetch: true))
        XCTAssertTrue(reportBuilderAutomaticFetchAllowed(windowForm: [:], authoredConfig: nil, dataSourceAutoFetch: nil))
    }

    func testPreparedContextRegistersWithoutIOAndAutomaticRequestsCoalesceAcrossRemount() async throws {
        let runtime = ForgeRuntime()
        let recorder = PrimaryReadRecorder()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","dataSourceRef":"cube"}]}},"dataSource":{"cube":{"autoFetch":true}}}"#.utf8))
        let window = await runtime.openWindowInline(key: "report", title: "Report", metadata: metadata, conversationID: "conversation")
        let identity = await runtime.reportPreparationIdentity(windowID: window.id, builderRef: "builder")
        let query: [String: JSONValue] = ["filters": .object(["orderIds": .array([.number(2659534)]), "From": .string("2026-09-28"), "To": .string("2026-10-05")])]
        let packet = PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: query)
        _ = await runtime.publishPreparedReportRequest(packet)
        await runtime.registerDataSourceLoader { request in
            await recorder.record(request.input.parameters)
            try await Task.sleep(nanoseconds: 10_000_000)
            return ForgeRuntime.DataSourceFetchResult(rows: [["spend": .number(309)]])
        }
        let absent = await runtime.registeredDataSourceSnapshot(windowID: window.id, dataSourceRef: "cube")
        XCTAssertNil(absent)
        try await runtime.registerPreparedReportPrimaryContext(packet)
        let staged = try XCTUnwrap(awaitValue: await runtime.registeredDataSourceSnapshot(windowID: window.id, dataSourceRef: "cube"))
        XCTAssertEqual(staged.input.parameters, query)
        XCTAssertNil(staged.collection)
        XCTAssertTrue(staged.control.inactive)
        let before = await recorder.requests
        XCTAssertTrue(before.isEmpty)
        async let first: Void = runtime.fetchPreparedReportDataSource(windowID: window.id, dataSourceRef: "cube", automatic: true)
        async let second: Void = runtime.fetchPreparedReportDataSource(windowID: window.id, dataSourceRef: "cube", automatic: true)
        _ = try await (first, second)
        // A remount republishes the identical prepared packet and joins its result.
        _ = await runtime.publishPreparedReportRequest(packet)
        try await runtime.registerPreparedReportPrimaryContext(packet)
        try await runtime.fetchPreparedReportDataSource(windowID: window.id, dataSourceRef: "cube", automatic: true)
        let coalesced = await recorder.requests
        XCTAssertEqual(coalesced, [query])
        // Explicit refresh is a new action, even with identical scope.
        try await runtime.fetchPreparedReportDataSource(windowID: window.id, dataSourceRef: "cube")
        let explicit = await recorder.requests
        XCTAssertEqual(explicit, [query, query])
        let loaded = try XCTUnwrap(awaitValue: await runtime.registeredDataSourceSnapshot(windowID: window.id, dataSourceRef: "cube"))
        XCTAssertEqual(loaded.collection, [["spend": .number(309)]])
    }

    func testAutomaticObserverAndPreparedDispatchRespectFalseButExplicitFetchWorks() async throws {
        let runtime = ForgeRuntime()
        let recorder = PrimaryReadRecorder()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","dataSourceRef":"cube"}]}},"dataSource":{"cube":{"autoFetch":false}}}"#.utf8))
        let window = await runtime.openWindowInline(key: "report", title: "Report", metadata: metadata, conversationID: "conversation")
        let identity = await runtime.reportPreparationIdentity(windowID: window.id, builderRef: "builder")
        let query: [String: JSONValue] = ["filters": .object(["orderIds": .array([.number(2659534)])])]
        let packet = PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: query)
        _ = await runtime.publishPreparedReportRequest(packet)
        try await runtime.registerPreparedReportPrimaryContext(packet)
        await runtime.registerDataSourceLoader { request in await recorder.record(request.input.parameters); return ForgeRuntime.DataSourceFetchResult(rows: []) }
        await runtime.automaticallyRefreshDataSourceCollection(windowID: window.id, dataSourceRef: "cube")
        try await runtime.fetchPreparedReportDataSource(windowID: window.id, dataSourceRef: "cube", automatic: true)
        await runtime.automaticallyRefreshDataSourceCollection(windowID: window.id, dataSourceRef: "cube")
        let automatic = await recorder.requests
        XCTAssertTrue(automatic.isEmpty)
        let staged = await runtime.registeredDataSourceSnapshot(windowID: window.id, dataSourceRef: "cube")
        XCTAssertEqual(staged?.input.parameters, query)
        XCTAssertNil(staged?.collection)
        try await runtime.fetchPreparedReportDataSource(windowID: window.id, dataSourceRef: "cube")
        let explicit = await recorder.requests
        XCTAssertEqual(explicit, [query])
    }

    func testChangedStagedInputCannotExposeRowsFromPreviousScope() async {
        let runtime = DataSourceRuntime()
        _ = await runtime.registerReportInput(dataSourceID: "source", parameters: ["scope": .number(1)])
        await runtime.setCollection(dataSourceID: "source", rows: [["value": .number(1)]])
        _ = await runtime.registerReportInput(dataSourceID: "source", parameters: ["scope": .number(2)])
        let snapshot = await runtime.registeredSnapshot(dataSourceID: "source")
        XCTAssertNil(snapshot?.collection)
        XCTAssertEqual(snapshot?.input.parameters, ["scope": .number(2)])
    }
}

private actor PrimaryReadRecorder {
    var requests: [[String: JSONValue]] = []
    func record(_ request: [String: JSONValue]) { requests.append(request) }
}
private func XCTUnwrap<T>(awaitValue: T?, file: StaticString = #filePath, line: UInt = #line) throws -> T {
    try XCTUnwrap(awaitValue, file: file, line: line)
}
