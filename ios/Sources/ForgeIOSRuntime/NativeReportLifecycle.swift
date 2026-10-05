import Foundation
import CryptoKit

public struct NativeReportDatasetAdmission: Sendable, Equatable {
    public let id: String
    public let dataSourceRef: String
    public let request: [String: JSONValue]
    public init(id: String, dataSourceRef: String, request: [String: JSONValue]) {
        self.id = id; self.dataSourceRef = dataSourceRef; self.request = request
    }
}

/// The captured authored document and every physical request, before report IO.
public struct NativeReportAdmission: Sendable {
    public let preparation: PreparedReportRequest
    public let conversationID: String
    public let stateKey: String
    public let document: [String: JSONValue]
    public let datasets: [NativeReportDatasetAdmission]
    public let authoredConfiguration: [String: JSONValue]
    public let authorState: [String: JSONValue]
    public let prefillIdentity: [String: JSONValue]
    public init(preparation: PreparedReportRequest, conversationID: String, stateKey: String, document: [String: JSONValue], datasets: [NativeReportDatasetAdmission], authoredConfiguration: [String: JSONValue] = [:], authorState: [String: JSONValue] = [:], prefillIdentity: [String: JSONValue] = ["prefill": .null, "prefillRevision": .number(0)]) {
        self.preparation = preparation; self.conversationID = conversationID
        self.stateKey = stateKey; self.document = document; self.datasets = datasets
        self.authoredConfiguration = authoredConfiguration; self.authorState = authorState; self.prefillIdentity = prefillIdentity
    }
    public var parameters: [String: JSONValue] {
        var values: [String: JSONValue] = ["viewMode": .string(preparation.config.result?.defaultMode ?? "table"), "groupBy": .string(""), "pageSize": .number(50), "orderField": .string(""), "orderDir": .string("desc")]
        for key in values.keys { if let value = preparation.state[key] { values[key] = value } }
        return values
    }
    public var signature: String {
        nativeReportLocalDigest(.object([
            "conversationId": .string(conversationID), "stateKey": .string(stateKey),
            "windowId": .string(preparation.identity.windowId), "builderRef": .string(preparation.identity.builderRef),
            "formRevision": preparation.identity.formRevision, "stateRevision": preparation.identity.stateRevision,
            "request": .object(preparation.request), "state": .object(preparation.state), "document": .object(document),
            "authorState": .object(authorState), "prefill": .object(prefillIdentity), "configuration": .object(authoredConfiguration),
            "datasets": .array(datasets.map { .object(["id": .string($0.id), "dataSourceRef": .string($0.dataSourceRef), "request": .object($0.request)]) })
        ]))
    }
}
public struct NativeReportRunHandle: Sendable {
    public let reportRunID: String
    public let revision: Int64
    public let uiRunRequestID: String
    public let admission: NativeReportAdmission
    public let ownerID: String
    public let expectedContextRevision: Int64
    public init(reportRunID: String, revision: Int64, uiRunRequestID: String, admission: NativeReportAdmission, ownerID: String = "", expectedContextRevision: Int64 = 0) {
        self.reportRunID = reportRunID; self.revision = revision; self.uiRunRequestID = uiRunRequestID; self.admission = admission
        self.ownerID = ownerID; self.expectedContextRevision = expectedContextRevision
    }
}
public struct NativeReportCompletedRun: Sendable {
    public let reportRunID: String
    public let revision: Int64
    public let contextStatus: String
    public let active: Bool?
    public let activationError: String?
    public init(reportRunID: String, revision: Int64, contextStatus: String = "active", active: Bool? = true, activationError: String? = nil) {
        self.reportRunID = reportRunID; self.revision = revision
        self.contextStatus = contextStatus; self.active = active; self.activationError = activationError
    }
}
public struct NativeReportMaterializedRun: Sendable {
    public let completed: NativeReportCompletedRun
    public let rows: [String: [[String: JSONValue]]]
}
public struct NativeReportCompletionUncertainError: Error, LocalizedError, Sendable {
    public init() {}
    public var errorDescription: String? { "Report completion could not be confirmed. Reopen the report to check its saved status." }
}
public protocol NativeReportLifecycleHandler: Sendable {
    func begin(admission: NativeReportAdmission, uiRunRequestID: String, origin: String) async throws -> NativeReportRunHandle
    func complete(handle: NativeReportRunHandle, rows: [String: [[String: JSONValue]]], current: @escaping @Sendable () async -> Bool) async throws -> NativeReportCompletedRun
    func fail(handle: NativeReportRunHandle, code: String, text: String) async throws
}

extension ForgeRuntime {
    public func registerNativeReportLifecycleHandler(_ handler: any NativeReportLifecycleHandler) async {
        await nativeReportLifecycle.register(handler)
    }
    public func publishNativeReportAdmission(_ admission: NativeReportAdmission) async throws {
        let generation = nativeReportAccountGeneration
        guard await nativeReportAdmissionIsCurrent(admission), generation == nativeReportAccountGeneration, Set(admission.datasets.map(\.id)).count == admission.datasets.count,
              !admission.datasets.isEmpty, admission.datasets.allSatisfy({ !$0.id.isEmpty && !$0.dataSourceRef.isEmpty }) else { throw ReportPreparationError(reason: "invalid-report-admission") }
        await nativeReportLifecycle.publish(admission)
    }
    public func nativeReportAdmissionIsCurrent(_ admission: NativeReportAdmission) async -> Bool {
        guard let window = windows.first(where: { $0.id == admission.preparation.identity.windowId }), window.conversationID == admission.conversationID else { return false }
        let packet: PreparedReportRequest
        do { packet = try await preparedReportRequest(windowID: window.id) }
        catch {
            return false
        }
        guard packet.identity == admission.preparation.identity, packet.request == admission.preparation.request else { return false }
        return await frozenPublishedAdmissionIsCurrent(admission)
    }
    public func beginNativeReportRun(windowID: String, requestID: String, origin: String) async throws -> NativeReportRunHandle {
        let generation = nativeReportAccountGeneration
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline {
            if let admission = await nativeReportLifecycle.admission(windowID: windowID), await nativeReportAdmissionIsCurrent(admission) { break }
            try await Task.sleep(nanoseconds: 20_000_000)
        }
        guard generation == nativeReportAccountGeneration else { throw ReportPreparationError(reason: "stale-report-account") }
        frozenNativeReportPublishedSignatures.removeValue(forKey: windowID)
        frozenNativeReportAdmissions.removeValue(forKey: windowID)
        nativeReportActiveRequestGenerations[windowID] = generation
        nativeReportActiveRequestIDs[windowID] = requestID
        let handle = try await nativeReportLifecycle.begin(windowID: windowID, requestID: requestID, origin: origin) { admission in
            await self.nativeReportRequestIsCurrent(admission, requestID: requestID)
        }
        guard await nativeReportRequestIsCurrent(handle.admission, requestID: requestID), generation == nativeReportAccountGeneration else { throw ReportPreparationError(reason: "stale-report-account") }
        await setWindowFormValue(windowID: windowID, values: ["reportMaterialization": .object(["id": .string(handle.reportRunID), "requestId": .string(requestID), "status": .string("running"), "materialized": .bool(false), "admissionSignature": .string(handle.admission.signature)])], replace: false)
        return handle
    }
    func nativeReportRequestIsCurrent(_ admission: NativeReportAdmission, requestID: String) async -> Bool {
        guard nativeReportActiveRequestGenerations[admission.preparation.identity.windowId] == nativeReportAccountGeneration, nativeReportActiveRequestIDs[admission.preparation.identity.windowId] == requestID else { return false }
        let generation = nativeReportAccountGeneration
        guard await nativeReportAdmissionIsCurrent(admission) else { return false }
        return generation == nativeReportAccountGeneration && nativeReportActiveRequestGenerations[admission.preparation.identity.windowId] == generation && nativeReportActiveRequestIDs[admission.preparation.identity.windowId] == requestID
    }
    public func materializeNativeReportRun(requestID: String, transform: @escaping @Sendable (String, [[String: JSONValue]]) -> [[String: JSONValue]]) async throws -> NativeReportMaterializedRun {
        guard let handle = await nativeReportLifecycle.handle(requestID: requestID), await nativeReportRequestIsCurrent(handle.admission, requestID: requestID) else { throw ReportPreparationError(reason: "report-not-admitted") }
        if let task = nativeReportMaterializations[requestID] { return try await task.value }
        let task = Task { try await self.executeNativeReportRun(handle: handle, transform: transform) }
        nativeReportMaterializations[requestID] = task
        return try await task.value
    }
    private func executeNativeReportRun(handle: NativeReportRunHandle, transform: @escaping @Sendable (String, [[String: JSONValue]]) -> [[String: JSONValue]]) async throws -> NativeReportMaterializedRun {
        let admission = handle.admission
        let windowID = admission.preparation.identity.windowId
        var rows: [String: [[String: JSONValue]]] = [:]
        var completionCommitted = false
        do {
            for dataset in admission.datasets {
                guard await nativeReportRequestIsCurrent(admission, requestID: handle.uiRunRequestID) else { throw ReportPreparationError(reason: "stale-preparation") }
                guard await windowMetadata(id: windowID)?.dataSources[dataset.dataSourceRef] != nil else { throw ReportPreparationError(reason: "missing-dataset-transport") }
                let completionID = UUID().uuidString
                nativeReportDispatches[completionID] = NativeReportDatasetDispatch(requestID: handle.uiRunRequestID, admissionSignature: admission.signature, dataset: dataset)
                let ref = "reportDocument:\(dataset.id)"
                await fetchDataSourceInstance(windowID: windowID, instanceRef: ref, dataSourceRef: dataset.dataSourceRef, parameters: dataset.request, nativeCompletionID: completionID)
                nativeReportDispatches.removeValue(forKey: completionID)
                guard await nativeReportRequestIsCurrent(admission, requestID: handle.uiRunRequestID) else { nativeReportDatasetResults.removeValue(forKey: completionID); throw ReportPreparationError(reason: "stale-preparation") }
                let control = await dataSourceControl(windowID: windowID, dataSourceRef: ref)
                if let error = control.error { nativeReportDatasetResults.removeValue(forKey: completionID); throw NSError(domain: "NativeReportDataset", code: 1, userInfo: [NSLocalizedDescriptionKey: error]) }
                guard let result = nativeReportDatasetResults.removeValue(forKey: completionID) else { throw ReportPreparationError(reason: "dataset-response-not-confirmed") }
                rows[dataset.id] = transform(dataset.id, result.rows)
            }
            let completed = try await nativeReportLifecycle.complete(handle: handle, rows: rows) { await self.nativeReportRequestIsCurrent(admission, requestID: handle.uiRunRequestID) }
            completionCommitted = true
            guard await nativeReportRequestIsCurrent(admission, requestID: handle.uiRunRequestID) else { throw ReportPreparationError(reason: "stale-preparation") }
            let datasets = admission.datasets.map { dataset in JSONValue.object([
                "id": .string(dataset.id), "dataSourceRef": .string(dataset.dataSourceRef), "request": .object(dataset.request), "rows": .array((rows[dataset.id] ?? []).map(JSONValue.object))
            ]) }
            try cacheMaterializedReport(handle: handle, completed: completed, datasets: datasets)
            await setWindowFormValue(windowID: windowID, values: [
                "reportMaterialization": .object(["id": .string(completed.reportRunID), "requestId": .string(handle.uiRunRequestID), "status": .string("completed"), "materialized": .bool(true), "revision": .number(Double(completed.revision)), "contextStatus": .string(completed.contextStatus), "active": completed.active.map(JSONValue.bool) ?? .null, "activationError": completed.activationError.map(JSONValue.string) ?? .null, "admissionSignature": .string(admission.signature), "datasetRefs": .array(admission.datasets.map { .string($0.id) })]),
                "reportStaticDatasets": .array(datasets)
            ], replace: false)
            return NativeReportMaterializedRun(completed: completed, rows: rows)
        } catch {
            if !completionCommitted && !(error is NativeReportCompletionUncertainError) {
                try await nativeReportLifecycle.fail(handle: handle, code: "report_materialization_failed", text: error.localizedDescription)
                if await nativeReportRequestIsCurrent(admission, requestID: handle.uiRunRequestID) {
                    await setWindowFormValue(windowID: windowID, values: ["reportMaterialization": .object(["id": .string(handle.reportRunID), "requestId": .string(handle.uiRunRequestID), "status": .string("failed"), "materialized": .bool(false), "errors": .array([.string(error.localizedDescription)])])], replace: false)
                }
            }
            throw error
        }
    }
}

/// Owned by the runtime rather than a view, so remounting never repeats admission.
public actor NativeReportLifecycle {
    private var epoch = 0
    private var handler: (any NativeReportLifecycleHandler)?
    private var admissions: [String: NativeReportAdmission] = [:]
    private var beginnings: [String: Task<NativeReportRunHandle, Error>] = [:]
    private var requestSignatures: [String: String] = [:]
    private var handles: [String: NativeReportRunHandle] = [:]
    private var completionSignatures: [String: String] = [:]
    private var completions: [String: Task<NativeReportCompletedRun, Error>] = [:]
    public init() {}
    public func register(_ handler: any NativeReportLifecycleHandler) { self.handler = handler }
    public func reset() {
        epoch += 1
        beginnings.values.forEach { $0.cancel() }
        completions.values.forEach { $0.cancel() }
        admissions.removeAll(); beginnings.removeAll(); requestSignatures.removeAll()
        handles.removeAll(); completionSignatures.removeAll(); completions.removeAll()
    }
    public func publish(_ admission: NativeReportAdmission) { admissions[admission.preparation.identity.windowId] = admission }
    public func admission(windowID: String) -> NativeReportAdmission? { admissions[windowID] }
    public func handle(requestID: String) -> NativeReportRunHandle? { handles[requestID] }
    public func begin(windowID: String, requestID: String, origin: String, current: @escaping @Sendable (NativeReportAdmission) async -> Bool) async throws -> NativeReportRunHandle {
        let initialEpoch = epoch
        guard let handler else { throw ReportPreparationError(reason: "durable-report-persistence-unavailable") }
        guard let admission = admissions[windowID] else { throw ReportPreparationError(reason: "authored-report-admission-pending") }
        guard !requestID.isEmpty, admission.preparation.validate(current: admission.preparation.identity) == nil, await current(admission) else { throw ReportPreparationError(reason: "stale-preparation") }
        guard initialEpoch == epoch else { throw ReportPreparationError(reason: "stale-report-account") }
        if let signature = requestSignatures[requestID], signature != admission.signature { throw ReportPreparationError(reason: "report-request-identity-conflict") }
        let task: Task<NativeReportRunHandle, Error>
        if let existing = beginnings[requestID] { task = existing }
        else {
            requestSignatures[requestID] = admission.signature
            task = Task { try await handler.begin(admission: admission, uiRunRequestID: requestID, origin: origin) }
            beginnings[requestID] = task
        }
        let handle = try await task.value
        guard initialEpoch == epoch else { throw ReportPreparationError(reason: "stale-report-account") }
        guard handle.admission.signature == admission.signature, await current(admission) else {
            try await handler.fail(handle: handle, code: "stale_preparation", text: "Report preparation changed before data loading.")
            throw ReportPreparationError(reason: "stale-preparation")
        }
        handles[requestID] = handle
        return handle
    }
    public func complete(handle: NativeReportRunHandle, rows: [String: [[String: JSONValue]]], current: @escaping @Sendable () async -> Bool) async throws -> NativeReportCompletedRun {
        guard let handler, handles[handle.uiRunRequestID]?.admission.signature == handle.admission.signature, handles[handle.uiRunRequestID]?.reportRunID == handle.reportRunID, Set(rows.keys) == Set(handle.admission.datasets.map(\.id)), await current() else { throw ReportPreparationError(reason: "stale-preparation") }
        let signature = nativeReportLocalDigest(.object(rows.mapValues { .array($0.map(JSONValue.object)) }))
        if let previous = completionSignatures[handle.uiRunRequestID], previous != signature { throw ReportPreparationError(reason: "report-result-identity-conflict") }
        if let task = completions[handle.uiRunRequestID] { return try await task.value }
        completionSignatures[handle.uiRunRequestID] = signature
        let task = Task { try await handler.complete(handle: handle, rows: rows, current: current) }
        completions[handle.uiRunRequestID] = task
        return try await task.value
    }
    public func fail(handle: NativeReportRunHandle, code: String, text: String) async throws {
        guard let handler else { throw ReportPreparationError(reason: "durable-report-persistence-unavailable") }
        try await handler.fail(handle: handle, code: code, text: text)
    }
}

struct NativeReportDatasetDispatch: Sendable {
    let requestID: String
    let admissionSignature: String
    let dataset: NativeReportDatasetAdmission
}

public func nativeReportRestoreProofMatches(_ proof: JSONValue?, admission: NativeReportAdmission) -> Bool {
    guard let proof = proof?.objectValue, proof["builderRef"] == .string(admission.preparation.identity.builderRef),
          proof["documentFingerprint"] == .string(nativeReportLocalDigest(.object(admission.document))),
          case .array(let bindings) = proof["datasets"], bindings.count == admission.datasets.count else { return false }
    if admission.datasets.contains(where: { $0.id == "primary" }), proof["primaryRequest"] != .object(admission.preparation.request) { return false }
    let defaults = proof["inheritedEmptyDefaults"]?.objectValue ?? [:]
    var expected = Dictionary(uniqueKeysWithValues: admission.datasets.map { ($0.id, $0) })
    for binding in bindings {
        guard let item = binding.objectValue, let id = item["id"]?.stringValue, let dataset = expected.removeValue(forKey: id),
              item["dataSourceRef"] == .string(dataset.dataSourceRef), let savedRequest = item["request"]?.objectValue else { return false }
        if savedRequest != dataset.request {
            guard id != "primary", let declaration = admission.preparation.config.dataSources.first(where: { $0.id == id && $0.dataSourceRef == dataset.dataSourceRef }),
                  declaration.scope["mode"] == .string("inherit") else { return false }
            let authoredFilters = declaration.request["filters"]?.objectValue ?? [:]
            let localFilters = declaration.scope["local"]?.objectValue?["filters"]?.objectValue ?? [:]
            let allowed = defaults.filter { key, value in
                authoredFilters[key] == nil && localFilters[key] == nil && (value == .null || value == .string("") || value == .array([]))
            }
            func omittingInheritedDefaults(_ request: [String: JSONValue]) -> [String: JSONValue] {
                var result = request
                if var filters = result["filters"]?.objectValue {
                    for (key, value) in allowed where filters[key] == value { filters.removeValue(forKey: key) }
                    result["filters"] = .object(filters)
                }
                return result
            }
            guard omittingInheritedDefaults(savedRequest) == omittingInheritedDefaults(dataset.request) else { return false }
        }
    }
    return expected.isEmpty
}

/// A bounded local cache digest. Cross-platform admission hashes use their shared canonical contract.
public func nativeReportLocalDigest(_ value: JSONValue) -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    guard let bytes = try? encoder.encode(value) else { return "invalid" }
    return SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
}
