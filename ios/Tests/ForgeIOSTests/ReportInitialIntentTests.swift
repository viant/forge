import XCTest
@testable import ForgeIOSRuntime

final class ReportInitialIntentTests: XCTestCase {
    func testOnlyCurrentReadyPublicationAcknowledgesAndNewIntentKeysReset() async throws {
        let runtime = ForgeRuntime()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","dataSourceRef":"cube"}]}},"dataSource":{"cube":{"autoFetch":false}}}"#.utf8))
        let window = await runtime.openWindowInline(key: "report", title: "Report", metadata: metadata, conversationID: "conversation")
        let identity = await runtime.reportPreparationIdentity(windowID: window.id, builderRef: "builder")
        let request: [String: JSONValue] = ["filters": .object(["orderIds": .array([.number(7)])])]
        let binding: [[String: JSONValue]] = [["path": .string("filters.orderIds"), "value": .array([.number(7)])]]
        let packet = PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: request, requiredBindings: binding)
        let key = reportInitialIntentKey(builderRef: "builder", stateKey: "state", prefillSignature: "revision1")
        let unpublished = await runtime.acknowledgeReportInitialIntent(packet, key: key)
        XCTAssertFalse(unpublished)
        _ = await runtime.publishPreparedReportRequest(packet)
        let acknowledged = await runtime.acknowledgeReportInitialIntent(packet, key: key)
        XCTAssertTrue(acknowledged)
        let current = await runtime.reportInitialIntentAcknowledged(windowID: window.id, key: key)
        XCTAssertTrue(current)
        for changedKey in [reportInitialIntentKey(builderRef: "other", stateKey: "state", prefillSignature: "revision1"), reportInitialIntentKey(builderRef: "builder", stateKey: "state", prefillSignature: "revision2")] {
            let matches = await runtime.reportInitialIntentAcknowledged(windowID: window.id, key: changedKey)
            XCTAssertFalse(matches)
        }
        await runtime.closeWindow(id: window.id)
        let closed = await runtime.reportInitialIntentAcknowledged(windowID: window.id, key: key)
        XCTAssertFalse(closed)
    }
}
