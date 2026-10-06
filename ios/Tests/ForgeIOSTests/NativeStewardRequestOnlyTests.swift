import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

final class NativeStewardRequestOnlyTests: XCTestCase {
    func testActualDeclaredPortableHooksBindScopedRequestWithoutFetch() throws {
        let proofURL = URL(fileURLWithPath: "/tmp/native-selected-builder-request-only-proof.json")
        guard FileManager.default.fileExists(atPath: proofURL.path) else { throw XCTSkip("Optional captured authorized Steward request-only proof") }
        var root = URL(fileURLWithPath: #filePath); for _ in 0..<4 { root.deleteLastPathComponent() }
        let metadataURL = root.deletingLastPathComponent().appendingPathComponent("agently-ag-ui/output/playwright/steward-workflows/fullform-report-current-window.json")
        let proof = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: proofURL)).objectValue!
        let captured = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: metadataURL)).objectValue!
        let code = try XCTUnwrap(captured["metadata"]?.objectValue?["actions"]?.objectValue?["code"])
        guard case .string(let module) = code else { return XCTFail("Missing authored module") }
        let config = try XCTUnwrap(proof["config"])
        let windowForm = try XCTUnwrap(proof["windowForm"])
        let hooks = try XCTUnwrap(config.objectValue?["hooks"]?.objectValue)
        guard case .string(let initialize) = hooks["initializeState"], case .string = hooks["buildRequest"] else { return XCTFail("Missing declared hooks") }
        let initial = try XCTUnwrap(ActionHookRuntime.invoke(code: module, functionName: initialize, props: .object(["config": config, "windowForm": windowForm, "state": .object([:])])))
        let typedConfig = lowerReportBuilderPredicates(try JSONDecoder().decode(DashboardReportBuilderDef.self, from: JSONEncoder().encode(config)))
        let fallback = StoredReportBuilderState(selectedMeasures: ["totalSpend", "impressions"], selectedDimensions: ["eventDate", "channelId"], chartSpec: nil, viewMode: "table", staticFilters: [:], dynamicGroups: [:], dynamicFilterDrafts: [:])
        let nativeState = ReportBuilderRenderer.reportBuilderState(fromHookResult: initial, fallback: fallback)
        let base = ReportBuilderRenderer.buildBaseRequestForState(config: typedConfig, state: nativeState)
        let prepared = try ReportBuilderRenderer.prepareReportRequest(base: base, config: typedConfig, authoredConfig: config, state: initial, windowForm: windowForm.objectValue ?? [:], moduleCode: module)
        let request = JSONValue.object(prepared.request)
        let proofData = try JSONEncoder().encode(JSONValue.object(["state": initial, "request": request]))
        try proofData.write(to: URL(fileURLWithPath: "/tmp/ios-native-hooks-request-only.json"))
        let actualFilters = request.objectValue?["filters"]?.objectValue ?? [:]
        let expectedFilters = proof["request"]?.objectValue?["filters"]?.objectValue ?? [:]
        for (path, value) in expectedFilters where value != .string("") { XCTAssertEqual(actualFilters[path], value, path) }
        XCTAssertEqual(request.objectValue?["filters"]?.objectValue?["orderIds"], JSONValue.array([.number(2659534)]))
    }
    func testSuccessfulDeclaredGlobalHookIsNotRenarrowedByPrefill() throws {
        let config = try JSONDecoder().decode(DashboardReportBuilderDef.self, from: Data(#"{"hooks":{"buildRequest":"build"},"predicates":[{"id":"entityIds","kind":"dynamic","bucket":"scope","paramPath":"filters.entityIds","multiple":true,"emitArray":true,"manualValueType":"int"}]}"#.utf8))
        let lowered = lowerReportBuilderPredicates(config)
        let parts = try ReportBuilderRenderer.prepareReportRequest(base: ["measures": .object(["spend": .bool(true)])], config: lowered, state: .object([:]), windowForm: ["prefill": .object(["entityIds": .array([.number(7)])])], moduleCode: "({build: ({request}) => ({...request, filters:{}})})", requireInitialIntent: false)
        XCTAssertEqual(parts.request["filters"], .object([:]))
        let identity = PreparedReportIdentity(windowId: "window", builderRef: "builder", formRevision: .number(1), stateRevision: .number(1))
        let packet = PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: parts.request, requiredBindings: parts.bindings)
        XCTAssertNil(packet.validate(current: identity))
        XCTAssertThrowsError(try ReportBuilderRenderer.prepareReportRequest(base: [:], config: lowered, state: .object([:]), windowForm: ["prefill": .object(["entityIds": .array([.number(7)])])], moduleCode: "({})"))
    }

    func testNoHookPrefillPersistsAsAuthorStateAcrossRemountAndCanBeCleared() throws {
        let config = lowerReportBuilderPredicates(try JSONDecoder().decode(DashboardReportBuilderDef.self, from: Data(#"{"staticFilters":[{"id":"dateRange","type":"dateRange","startParamPath":"filters.From","endParamPath":"filters.To"}],"predicates":[{"id":"entityIds","kind":"dynamic","bucket":"scope","paramPath":"filters.entityIds","multiple":true,"emitArray":true,"manualValueType":"int"}]}"#.utf8)))
        let empty = StoredReportBuilderState(selectedMeasures: [], selectedDimensions: [], chartSpec: nil, viewMode: "table", staticFilters: [:], dynamicGroups: [:], dynamicFilterDrafts: [:])
        let form: [String: JSONValue] = ["prefill": .object(["entityIds": .array([.string("7")]), "from": .string("2026-10-01"), "to": .string("2026-10-04")])]
        let seeded = ReportBuilderRenderer.initialStateApplyingDeclaredPrefill(config: config, state: empty, windowForm: form)
        let remounted = try JSONDecoder().decode(StoredReportBuilderState.self, from: JSONEncoder().encode(seeded))
        let base = ReportBuilderRenderer.buildBaseRequestForState(config: config, state: remounted)
        let initial = try ReportBuilderRenderer.prepareReportRequest(base: base, config: config, state: .object([:]), windowForm: form, moduleCode: nil)
        XCTAssertEqual(initial.request["filters"]?.objectValue?["entityIds"], .array([.number(7)]))
        XCTAssertEqual(initial.request["filters"]?.objectValue?["From"], .string("2026-10-01"))
        let cleared = ReportBuilderRenderer.reportBuilderState(fromHookResult: .object(["dynamicGroups": .object([:]), "scopeParams": .object([:])]), fallback: remounted)
        let after = try ReportBuilderRenderer.prepareReportRequest(base: ReportBuilderRenderer.buildBaseRequestForState(config: config, state: cleared), config: config, state: .object([:]), windowForm: form, moduleCode: nil, requireInitialIntent: false)
        XCTAssertNil(after.request["filters"])
    }

    func testAcknowledgedNoHookBuilderCanClearItsInitialPrefill() throws {
        let config = try JSONDecoder().decode(DashboardReportBuilderDef.self, from: Data(#"{"staticFilters":[{"id":"order","paramPath":"filters.orderId"}]}"#.utf8))
        let form: [String: JSONValue] = ["prefill": .object(["order": .number(7)])]
        let initial = try ReportBuilderRenderer.prepareReportRequest(base: [:], config: config, state: .object([:]), windowForm: form, moduleCode: nil)
        XCTAssertEqual(initial.request["filters"]?.objectValue?["orderId"], .number(7))
        let cleared = try ReportBuilderRenderer.prepareReportRequest(base: [:], config: config, state: .object([:]), windowForm: form, moduleCode: nil, requireInitialIntent: false)
        XCTAssertNil(cleared.request["filters"])
        XCTAssertTrue(cleared.bindings.isEmpty)
    }

    func testInitialExplicitIntentCannotBeErasedBySuccessfulHookButGlobalInputCan() throws {
        let config = try JSONDecoder().decode(DashboardReportBuilderDef.self, from: Data(#"{"hooks":{"buildRequest":"build"},"staticFilters":[{"id":"dateRange","type":"dateRange","startParamPath":"filters.From","endParamPath":"filters.To"}],"predicates":[{"id":"entityIds","kind":"dynamic","bucket":"scope","paramPath":"filters.entityIds","multiple":true,"emitArray":true,"manualValueType":"int"}]}"#.utf8))
        let lowered = lowerReportBuilderPredicates(config)
        let form: [String: JSONValue] = ["prefill": .object(["entityIds": .array([.string("7")]), "from": .string("2026-10-01"), "to": .string("2026-10-04")])]
        let identity = PreparedReportIdentity(windowId: "window", builderRef: "builder", formRevision: .number(1), stateRevision: .number(1))
        func validate(_ parts: (request: [String: JSONValue], bindings: [[String: JSONValue]])) -> String? {
            PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: "cube", request: parts.request, requiredBindings: parts.bindings).validate(current: identity)
        }
        let dropped = try ReportBuilderRenderer.prepareReportRequest(base: [:], config: lowered, state: .object([:]), windowForm: form, moduleCode: "({build: () => ({})})")
        XCTAssertEqual(validate(dropped), "unbound-intent")
        XCTAssertEqual(dropped.bindings.first(where: { $0["path"] == .string("filters.entityIds") })?["value"], .array([.number(7)]))
        let preserved = try ReportBuilderRenderer.prepareReportRequest(base: [:], config: lowered, state: .object([:]), windowForm: form, moduleCode: "({build: ({request}) => request})")
        XCTAssertNil(validate(preserved))
        XCTAssertEqual(preserved.request["filters"]?.objectValue?["From"], .string("2026-10-01"))
        let global = try ReportBuilderRenderer.prepareReportRequest(base: [:], config: lowered, state: .object([:]), windowForm: [:], moduleCode: "({build: () => ({})})")
        XCTAssertTrue(global.bindings.isEmpty)
        XCTAssertNil(validate(global))
    }

    func testAuthoredSidecarSurvivesResolutionAndNeverAddsWireField() throws {
        let raw = Data(#"{"view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","dataSourceRef":"cube","dashboard":{"reportBuilder":{"extensions":{"neededByHook":true},"source":{"plugin":"authored"}}}}]}},"actions":{"code":"({})"}}"#.utf8)
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: raw)
        let resolved = MetadataResolver.resolve(metadata, for: ForgeTargetContext())
        XCTAssertNotNil(resolved.runtimeAuthoring?.objectValue?["view"])
        let encoded = String(decoding: try JSONEncoder().encode(resolved), as: UTF8.self)
        XCTAssertFalse(encoded.contains("runtimeAuthoring"))
        XCTAssertFalse(encoded.contains("__nativeAuthoredConfig"))
        XCTAssertTrue(reportPreparationFingerprint(resolved.runtimeAuthoring ?? .null).contains("neededByHook"))
    }
}
