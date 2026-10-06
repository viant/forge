import XCTest
@testable import ForgeIOSRuntime

final class NativeReportFrozenAdmissionTests: XCTestCase {
    private func fixture() -> (NativeReportAdmission, [String: JSONValue]) {
        let state: [String: JSONValue] = ["opaque": .string("retained")]
        let document: [String: JSONValue] = ["blocks": .array([.object(["datasetRef": .string("primary")])])]
        let configuration: [String: JSONValue] = ["request": .object(["autoFetch": .bool(false)])]
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        let request: [String: JSONValue] = ["filters": .object(["orderIds": .array([.number(7)])])]
        let identity = PreparedReportIdentity(windowId: "window", builderRef: "builder", formRevision: .string("restored"), stateRevision: .string("restored"), stateKey: "state")
        let packet = PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: request, state: ["policy": .string("original")], preparedAt: Date(timeIntervalSince1970: 1000), preparedCalendar: calendar)
        let admission = NativeReportAdmission(preparation: packet, conversationID: "conversation", stateKey: "state", document: document,
            datasets: [.init(id: "primary", dataSourceRef: "cube", request: request)], authoredConfiguration: configuration, authorState: state)
        let form: [String: JSONValue] = ["reportBuilderRef": .string("builder"), "state": .object(state), "executeOnOpen": .bool(false),
            "reportDefinition": .object(["documentPatch": .object(document)]),
            "reportStaticDatasets": .array([.object(["id": .string("primary"), "dataSourceRef": .string("cube"), "request": .object(request), "rows": .array([])])]),
            "reportMaterialization": .object(["status": .string("completed"), "reportRunId": .string("saved")])]
        return (admission, form)
    }
    func testVerifiedFrozenPublicationRebasesIdentityAndKeepsAcknowledgmentAfterEdit() async throws {
        let runtime = ForgeRuntime()
        let (admission, form) = fixture()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"dataSource":{"cube":{"autoFetch":false}}}"#.utf8))
        _ = await runtime.openWindow(key: "report", title: "Report", id: "window", conversationID: "conversation")
        _ = await runtime.updateWindowInline(id: "window", title: "Report", metadata: metadata, resolveMetadata: false)
        await runtime.bindNativeReportAccount(generation: 1)
        await runtime.setWindowFormValue(windowID: "window", values: form, replace: true, bumpPrefillRevision: false)
        try await runtime.installNativeReportFrozenAdmission(admission, reportRunID: "saved", ownerID: "owner", form: form, generation: 1)
        let metadataRevision = await runtime.windowMetadata(id: "window")?.runtimeAuthoring.map(reportPreparationFingerprint) ?? ""
        let frozen = await runtime.publishFrozenNativeReportPreparation(windowID: "window", builderRef: "builder", stateKey: "state", configuration: admission.authoredConfiguration, document: admission.document, initialIntentKey: "intent", expectedMetadataRevision: metadataRevision)
        XCTAssertNotNil(frozen)
        XCTAssertNotEqual(frozen?.identity, admission.preparation.identity)
        XCTAssertEqual(frozen?.preparedAt, admission.preparation.preparedAt)
        XCTAssertEqual(frozen?.state, admission.preparation.state)
        await runtime.registerDataSourceLoader { _ in
            XCTFail("Mounting a verified completed empty result must not refetch")
            return ForgeRuntime.DataSourceFetchResult(rows: [])
        }
        await runtime.automaticallyRefreshDataSourceCollection(windowID: "window", dataSourceRef: "cube")
        await runtime.automaticallyRefreshDataSourceCollection(windowID: "window", dataSourceRef: "cube")
        let completedRows = await runtime.completedNativeReportDatasets(windowID: "window")
        XCTAssertEqual(completedRows?.rows["primary"], [])
        let acknowledged = await runtime.reportInitialIntentAcknowledged(windowID: "window", key: "intent")
        XCTAssertTrue(acknowledged)
        await runtime.setWindowFormValue(windowID: "window", values: ["state": .object(["opaque": .string("edited")])], bumpPrefillRevision: false)
        let stale = await runtime.frozenNativeReportPreparation(windowID: "window", builderRef: "builder", stateKey: "state", configuration: admission.authoredConfiguration, document: admission.document, expectedMetadataRevision: "")
        XCTAssertNil(stale)
        let stillAcknowledged = await runtime.reportInitialIntentAcknowledged(windowID: "window", key: "intent")
        XCTAssertTrue(stillAcknowledged)
    }
    func testEditAfterFrozenCaptureCannotPublishEarlierQueryUnderNewIdentity() async throws {
        let runtime = ForgeRuntime()
        let (admission, form) = fixture()
        _ = await runtime.openWindow(key: "report", title: "Report", id: "window", conversationID: "conversation")
        await runtime.setWindowFormValue(windowID: "window", values: form, replace: true, bumpPrefillRevision: false)
        try await runtime.installNativeReportFrozenAdmission(admission, reportRunID: "saved", ownerID: "owner", form: form, generation: 0)
        let captured = await runtime.frozenNativeReportPreparation(windowID: "window", builderRef: "builder", stateKey: "state", configuration: admission.authoredConfiguration, document: admission.document, expectedMetadataRevision: "")
        XCTAssertNotNil(captured)
        await runtime.setWindowFormValue(windowID: "window", values: ["state": .object(["opaque": .string("changed-between-capture-and-publish")])], bumpPrefillRevision: false)
        let published = await runtime.publishPreparedReportRequest(captured!)
        XCTAssertFalse(published)
    }
    func testChangedSavedRowsRejectsFrozenCompletedCache() async throws {
        let runtime = ForgeRuntime()
        let (admission, form) = fixture()
        _ = await runtime.openWindow(key: "report", title: "Report", id: "window", conversationID: "conversation")
        await runtime.setWindowFormValue(windowID: "window", values: form, replace: true, bumpPrefillRevision: false)
        try await runtime.installNativeReportFrozenAdmission(admission, reportRunID: "saved", ownerID: "owner", form: form, generation: 0)
        await runtime.setWindowFormValue(windowID: "window", values: ["reportStaticDatasets": .array([.object(["id": .string("primary"), "rows": .array([.object(["spend": .number(999999)])])])])], bumpPrefillRevision: false)
        let frozen = await runtime.frozenNativeReportPreparation(windowID: "window", builderRef: "builder", stateKey: "state", configuration: admission.authoredConfiguration, document: admission.document, expectedMetadataRevision: "")
        XCTAssertNil(frozen)
    }
    func testAccountGenerationRejectsLateInstallationAndCannotRollBack() async throws {
        let runtime = ForgeRuntime()
        let (admission, form) = fixture()
        await runtime.bindNativeReportAccount(generation: 2)
        await runtime.bindNativeReportAccount(generation: 1)
        do {
            try await runtime.installNativeReportFrozenAdmission(admission, reportRunID: "saved", ownerID: "owner", form: form, generation: 1)
            XCTFail("Earlier account generation must not reinstall a saved run")
        } catch {}
    }
}
