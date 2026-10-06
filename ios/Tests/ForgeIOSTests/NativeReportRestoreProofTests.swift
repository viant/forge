import XCTest
@testable import ForgeIOSRuntime

final class NativeReportRestoreProofTests: XCTestCase {
    private func fixture(authored: Bool = false, local: Bool = false, emptyKey: String = "status", value: JSONValue = .string(""), primary: Bool = false) throws -> (JSONValue, NativeReportAdmission) {
        let id = primary ? "primary" : "summary"
        let saved: [String: JSONValue] = ["filters": .object(["orderIds": .array([.number(42)])]), "limit": .number(50), "offset": .number(0)]
        var current = saved
        current["filters"] = .object(["orderIds": .array([.number(42)]), emptyKey: value])
        let configValue: JSONValue = .object(["dataSources": .array([.object([
            "id": .string(id), "dataSourceRef": .string("cube"),
            "request": .object(authored ? ["filters": .object(["status": .string("")])] : [:]),
            "scope": .object(local ? ["mode": .string("inherit"), "local": .object(["filters": .object(["status": .string("")])])] : ["mode": .string("inherit")])
        ])])])
        let config = try JSONDecoder().decode(DashboardReportBuilderDef.self, from: JSONEncoder().encode(configValue))
        let identity = PreparedReportIdentity(windowId: "window", builderRef: "builder", formRevision: .number(1), stateRevision: .number(1))
        let packet = PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: ["limit": .number(1000)], config: config)
        let document: [String: JSONValue] = ["blocks": .array([.object(["id": .string("kpi"), "datasetRef": .string(id)])])]
        let admission = NativeReportAdmission(preparation: packet, conversationID: "conversation", stateKey: "state", document: document, datasets: [.init(id: id, dataSourceRef: "cube", request: current)])
        let proof: JSONValue = .object(["builderRef": .string("builder"), "primaryRequest": .object(saved), "documentFingerprint": .string(nativeReportLocalDigest(.object(document))), "inheritedEmptyDefaults": .object(["status": .string("")]), "datasets": .array([.object(["id": .string(id), "dataSourceRef": .string("cube"), "request": .object(saved)])])])
        return (proof, admission)
    }
    func testKnownInheritedEmptyDefaultDoesNotInvalidateUnreferencedPrimary() throws {
        let (proof, admission) = try fixture()
        XCTAssertTrue(nativeReportRestoreProofMatches(proof, admission: admission))
    }
    func testUnknownEmptyAndNonemptyPredicatesRemainStrict() throws {
        for input in [try fixture(emptyKey: "unknown"), try fixture(value: .string("behind")), try fixture(value: .null)] {
            XCTAssertFalse(nativeReportRestoreProofMatches(input.0, admission: input.1))
        }
    }
    func testAuthoredAndLocalEmptyPredicatesAreNotPruned() throws {
        for input in [try fixture(authored: true), try fixture(local: true)] {
            XCTAssertFalse(nativeReportRestoreProofMatches(input.0, admission: input.1))
        }
    }
    func testReferencedPrimaryRemainsExact() throws {
        let (proof, admission) = try fixture(primary: true)
        XCTAssertFalse(nativeReportRestoreProofMatches(proof, admission: admission))
    }
}
