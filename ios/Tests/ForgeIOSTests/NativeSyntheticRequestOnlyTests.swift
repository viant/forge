import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

final class NativeSyntheticRequestOnlyTests: XCTestCase {
    // Authored from scratch: IDs, dates, configuration and module are synthetic.
    func testDeclaredPortableHooksBindScopedRequestWithoutFetch() throws {
        let config = try JSONDecoder().decode(JSONValue.self, from: Data(#"""
{"title":"Synthetic records","dataSourceRef":"sampleRows","hooks":{"initializeState":"initialize","buildRequest":"build"},"measures":[{"id":"amount","key":"amount","paramPath":"measures.amount","default":true},{"id":"count","key":"count","paramPath":"measures.count","default":true}],"dimensions":[{"id":"day","key":"day","paramPath":"dimensions.day","default":true},{"id":"category","key":"category","paramPath":"dimensions.category","default":true}],"predicates":[{"id":"entityIds","bucket":"scope","multiple":true,"emitArray":true,"manualEntry":true,"manualValueType":"int","paramPath":"filters.entityIds","prefill":{"selector":"prefill.entityIds"}},{"id":"range","kind":"dateRange","startParamPath":"filters.from","endParamPath":"filters.to","prefill":{"startSelector":"prefill.from","endSelector":"prefill.to"}}],"result":{"defaultMode":"table","pageSize":50,"chartLimit":1000,"chartDataMode":"fullQuery","chartRowLimit":1000},"dataSources":[{"id":"summary","dataSourceRef":"sampleRows","request":{"measures":{"amount":true}},"scope":{"mode":"inherit"},"capabilities":{"backendRefetch":true}}]}
"""#.utf8))
        let windowForm = try JSONDecoder().decode(JSONValue.self, from: Data(#"""
{"prefill":{"entityIds":[7],"from":"2026-01-01","to":"2026-01-02"},"reportBuilderRef":"sampleBuilder"}
"""#.utf8))
        let module = #"""
({initialize: ({state,windowForm}) => ({...state,scopeParams:{entityIds:(windowForm.prefill.entityIds||[]).map(Number),from:windowForm.prefill.from,to:windowForm.prefill.to},binding:{source:"sampleRows"},groupBy:"category",pageSize:50,orderField:"day",orderDir:"asc",viewMode:"table"}),build: ({state}) => ({filters:state.scopeParams,measures:{amount:true,count:true},dimensions:{day:true,category:true},limit:50,offset:0})})
"""#
        let initial = try XCTUnwrap(ActionHookRuntime.invoke(code: module, functionName: "initialize", props: .object(["config":config,"windowForm":windowForm,"state":.object([:])])))
        let typed = lowerReportBuilderPredicates(try JSONDecoder().decode(DashboardReportBuilderDef.self, from: JSONEncoder().encode(config)))
        let fallback = StoredReportBuilderState(selectedMeasures:["amount","count"],selectedDimensions:["day","category"],chartSpec:nil,viewMode:"table",staticFilters:[:],dynamicGroups:[:],dynamicFilterDrafts:[:])
        let state = ReportBuilderRenderer.reportBuilderState(fromHookResult:initial,fallback:fallback)
        let base = ReportBuilderRenderer.buildBaseRequestForState(config:typed,state:state)
        let prepared = try ReportBuilderRenderer.prepareReportRequest(base:base,config:typed,authoredConfig:config,state:initial,windowForm:windowForm.objectValue ?? [:],moduleCode:module)
        XCTAssertEqual(prepared.request["filters"]?.objectValue?["entityIds"],.array([.number(7)]))
        XCTAssertEqual(prepared.request["filters"]?.objectValue?["from"],.string("2026-01-01"))
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
