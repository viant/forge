import XCTest
@testable import ForgeIOSRuntime

final class NativeReportAdmissionContextTests: XCTestCase {
    private func admission(request: [String: JSONValue] = ["filters": .object(["orderIds": .array([.number(2659534)])])]) -> NativeReportAdmission {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        let identity = PreparedReportIdentity(windowId: "window", builderRef: "builder", formRevision: .string("form"), stateRevision: .string("state"))
        let packet = PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: request, state: ["scopeParams": .object(["date": .string("last7days")])], preparedAt: Date(timeIntervalSince1970: 1_759_701_234.567), preparedCalendar: calendar)
        return NativeReportAdmission(preparation: packet, conversationID: "conversation", stateKey: "reportBuilder:builder", document: ["blocks": .array([.object(["datasetRef": .string("primary")])])], datasets: [NativeReportDatasetAdmission(id: "primary", dataSourceRef: "cube", request: request)], authoredConfiguration: ["request": .object(["autoFetch": .bool(false)])], authorState: ["dynamicFilterDrafts": .object(["opaque": .string("retained")])])
    }
    func testNamespaceSeparatesRawAuthorStateAndPolicyStateWithoutChangingQuery() throws {
        let original = admission()
        let requested = try nativeReportRequestedParams(original)
        var query = requested
        let namespace = query.removeValue(forKey: nativeReportAdmissionKey)!.objectValue!
        XCTAssertEqual(query, original.preparation.request)
        XCTAssertEqual(namespace["state"], .object(original.preparation.state))
        XCTAssertEqual(namespace["timeZone"], .string("America/Los_Angeles"))
        XCTAssertEqual(namespace["calendar"], .string("gregorian"))
        XCTAssertEqual(namespace["preparedAt"], .string("2025-10-05T21:53:54.567Z"))
        let digests = namespace["digests"]!.objectValue!
        XCTAssertEqual(digests["authorState"], .string(try nativeReportAdmissionDigest(.object(original.authorState))))
        XCTAssertEqual(digests["policyState"], .string(try nativeReportAdmissionDigest(.object(original.preparation.state))))
        XCTAssertNotEqual(digests["authorState"], digests["policyState"])
    }
    func testPureRestoreUsesRecordedClockAndRejectsTamperedAuthorState() throws {
        let original = admission()
        let namespace = try nativeReportAdmissionContext(original)
        let restored = try restoredNativeReportAdmission(namespace: namespace, primaryRequest: original.preparation.request, authorState: original.authorState, document: original.document, configuration: original.authoredConfiguration, conversationID: "conversation", windowID: "cold-window", builderRef: "builder", stateKey: original.stateKey, primaryDataSourceRef: "cube")
        XCTAssertEqual(restored.datasets, original.datasets)
        XCTAssertEqual(restored.preparation.preparedCalendar.timeZone.identifier, "America/Los_Angeles")
        XCTAssertEqual(restored.preparation.state, original.preparation.state)
        XCTAssertThrowsError(try restoredNativeReportAdmission(namespace: namespace, primaryRequest: original.preparation.request, authorState: [:], document: original.document, configuration: original.authoredConfiguration, conversationID: "conversation", windowID: "cold-window", builderRef: "builder", stateKey: original.stateKey, primaryDataSourceRef: "cube"))
    }
    func testPureRestoreRejectsChangedPhysicalRequest() throws {
        let original = admission()
        let namespace = try nativeReportAdmissionContext(original)
        XCTAssertThrowsError(try restoredNativeReportAdmission(namespace: namespace, primaryRequest: ["filters": .object(["orderIds": .array([.number(9)])])], authorState: original.authorState, document: original.document, configuration: original.authoredConfiguration, conversationID: "conversation", windowID: "cold-window", builderRef: "builder", stateKey: original.stateKey, primaryDataSourceRef: "cube"))
    }
    func testAcknowledgedClearedScopeKeepsOriginalPrefillIdentity() throws {
        let cleared = admission(request: ["filters": .object([:])])
        let prefill = nativeReportPrefillIdentity(["prefill": .object(["orderId": .number(2659534)]), "__forge": .object(["prefillRevision": .number(3)])])
        let saved = NativeReportAdmission(preparation: cleared.preparation, conversationID: cleared.conversationID, stateKey: cleared.stateKey, document: cleared.document, datasets: cleared.datasets, authoredConfiguration: cleared.authoredConfiguration, authorState: cleared.authorState, prefillIdentity: prefill)
        let restored = try restoredNativeReportAdmission(namespace: nativeReportAdmissionContext(saved), primaryRequest: saved.preparation.request, authorState: saved.authorState, document: saved.document, configuration: saved.authoredConfiguration, conversationID: saved.conversationID, windowID: "cold-window", builderRef: "builder", stateKey: saved.stateKey, primaryDataSourceRef: "cube", prefillIdentity: prefill)
        XCTAssertEqual(restored.preparation.request["filters"], .object([:]))
        XCTAssertEqual(restored.prefillIdentity, prefill)
    }
    func testPrefillIdentityIsExactAndRequiredOnRestore() throws {
        let original = admission()
        let namespace = try nativeReportAdmissionContext(original)
        func restore(_ value: JSONValue, _ prefill: [String: JSONValue]) throws -> NativeReportAdmission {
            try restoredNativeReportAdmission(namespace: value, primaryRequest: original.preparation.request, authorState: original.authorState, document: original.document, configuration: original.authoredConfiguration, conversationID: "conversation", windowID: "cold-window", builderRef: "builder", stateKey: original.stateKey, primaryDataSourceRef: "cube", prefillIdentity: prefill)
        }
        XCTAssertNoThrow(try restore(namespace, nativeReportPrefillIdentity([:])))
        XCTAssertThrowsError(try restore(namespace, nativeReportPrefillIdentity(["prefill": .object(["orderId": .number(9)])])))
        XCTAssertThrowsError(try restore(namespace, nativeReportPrefillIdentity(["__forge": .object(["prefillRevision": .number(1)])])))
        XCTAssertThrowsError(try restore(namespace, nativeReportPrefillIdentity(["__forge": .object(["prefillRevision": .string("0")])])))
        var missing = namespace.objectValue!
        var digests = missing["digests"]!.objectValue!
        digests.removeValue(forKey: "prefill"); missing["digests"] = .object(digests)
        XCTAssertThrowsError(try restore(.object(missing), original.prefillIdentity))
    }
    func testReservedQueryKeyCannotBeOverwritten() {
        XCTAssertThrowsError(try nativeReportRequestedParams(admission(request: [nativeReportAdmissionKey: .string("authored")])))
    }
}
