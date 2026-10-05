import Foundation

public struct NativeReportCompletedDatasets: Sendable {
    public let reportRunID: String
    public let requestID: String
    public let datasets: [JSONValue]
    public let rows: [String: [[String: JSONValue]]]
    public let activationWarning: String?
}

enum NativeReportCompletedCacheScope: Sendable {
    case materialized(String)
    case frozen(UUID)
    case legacy(JSONValue)
}
struct NativeReportCompletedCache: Sendable {
    let token = UUID()
    let generation: Int
    let conversationID: String
    let ownerID: String
    let formDatasets: JSONValue
    let scope: NativeReportCompletedCacheScope
    let value: NativeReportCompletedDatasets
}

extension ForgeRuntime {
    /// Host-only boundary: call after owner/context/run and exact fill verification.
    /// A matching namespace or digest in mutable window form alone never installs trust.
    public func installVerifiedLegacyReportCache(windowID: String, conversationID: String, reportRunID: String, ownerID: String, form: [String: JSONValue], generation: Int) throws {
        guard generation == nativeReportAccountGeneration, !ownerID.isEmpty, !conversationID.isEmpty,
              let proof = form["reportValidatedRestore"], proof.objectValue?["runId"] == .string(reportRunID),
              case .array(let bindings) = proof.objectValue?["datasets"] else { throw ReportPreparationError(reason: "invalid-verified-report-cache") }
        try storeCompletedReportCache(windowID: windowID, conversationID: conversationID, reportRunID: reportRunID, ownerID: ownerID, form: form, bindings: bindings, scope: .legacy(proof))
    }

    func installFrozenReportCache(_ entry: NativeReportFrozenAdmission, form: [String: JSONValue]) throws {
        let bindings = entry.admission.datasets.map { JSONValue.object(["id": .string($0.id), "dataSourceRef": .string($0.dataSourceRef), "request": .object($0.request)]) }
        try storeCompletedReportCache(windowID: entry.admission.preparation.identity.windowId, conversationID: entry.admission.conversationID, reportRunID: entry.reportRunID, ownerID: entry.ownerID, form: form, bindings: bindings, scope: .frozen(entry.token))
    }

    func cacheMaterializedReport(handle: NativeReportRunHandle, completed: NativeReportCompletedRun, datasets: [JSONValue]) throws {
        guard nativeReportActiveRequestGenerations[handle.admission.preparation.identity.windowId] == nativeReportAccountGeneration else { throw ReportPreparationError(reason: "stale-report-account") }
        let form: [String: JSONValue] = ["reportStaticDatasets": .array(datasets), "reportMaterialization": .object(["id": .string(completed.reportRunID), "requestId": .string(handle.uiRunRequestID), "status": .string("completed"), "activationError": completed.activationError.map(JSONValue.string) ?? .null])]
        let bindings = handle.admission.datasets.map { JSONValue.object(["id": .string($0.id), "dataSourceRef": .string($0.dataSourceRef), "request": .object($0.request)]) }
        try storeCompletedReportCache(windowID: handle.admission.preparation.identity.windowId, conversationID: handle.admission.conversationID, reportRunID: completed.reportRunID, ownerID: handle.ownerID, form: form, bindings: bindings, scope: .materialized(handle.admission.signature))
    }

    private func storeCompletedReportCache(windowID: String, conversationID: String, reportRunID: String, ownerID: String, form: [String: JSONValue], bindings: [JSONValue], scope: NativeReportCompletedCacheScope) throws {
        guard !reportRunID.isEmpty, let materialization = form["reportMaterialization"]?.objectValue,
              (materialization["id"] ?? materialization["reportRunId"]) == .string(reportRunID), materialization["status"] == .string("completed"),
              case .array(let stored) = form["reportStaticDatasets"], !bindings.isEmpty, bindings.count == stored.count else { throw ReportPreparationError(reason: "invalid-completed-report-cache") }
        var remaining: [String: [String: JSONValue]] = [:]
        for raw in bindings {
            guard let binding = raw.objectValue, let id = binding["id"]?.stringValue, !id.isEmpty, remaining[id] == nil,
                  binding["dataSourceRef"]?.stringValue?.isEmpty == false, binding["request"]?.objectValue != nil else { throw ReportPreparationError(reason: "invalid-completed-report-binding") }
            remaining[id] = binding
        }
        var canonical: [JSONValue] = []
        var rows: [String: [[String: JSONValue]]] = [:]
        for raw in stored {
            guard let dataset = raw.objectValue, let id = dataset["id"]?.stringValue, let binding = remaining.removeValue(forKey: id),
                  dataset["dataSourceRef"] == binding["dataSourceRef"], case .array(let values) = dataset["rows"], values.allSatisfy({ $0.objectValue != nil }),
                  dataset["request"] == nil || dataset["request"] == binding["request"] else { throw ReportPreparationError(reason: "invalid-completed-report-rows") }
            rows[id] = values.compactMap(\.objectValue)
            var value = binding; value["rows"] = .array(values); canonical.append(.object(value))
        }
        guard remaining.isEmpty else { throw ReportPreparationError(reason: "missing-completed-report-dataset") }
        let value = NativeReportCompletedDatasets(reportRunID: reportRunID, requestID: materialization["requestId"]?.stringValue ?? reportRunID, datasets: canonical, rows: rows, activationWarning: materialization["activationError"]?.stringValue)
        completedNativeReportCaches[windowID] = NativeReportCompletedCache(generation: nativeReportAccountGeneration, conversationID: conversationID, ownerID: ownerID, formDatasets: .array(stored), scope: scope, value: value)
    }

    /// Returns only runtime-owned rows, after checking the current scope and account.
    public func completedNativeReportDatasets(windowID: String) async -> NativeReportCompletedDatasets? {
        guard let cache = completedNativeReportCaches[windowID], cache.generation == nativeReportAccountGeneration,
              windows.first(where: { $0.id == windowID })?.conversationID == cache.conversationID else { return nil }
        let form = await windowFormJSONValue(windowID: windowID)
        guard let materialization = form["reportMaterialization"]?.objectValue,
              (materialization["id"] ?? materialization["reportRunId"]) == .string(cache.value.reportRunID),
              materialization["status"] == .string("completed"), form["reportStaticDatasets"] == cache.formDatasets else { return nil }
        let admission = await nativeReportLifecycle.admission(windowID: windowID)
        switch cache.scope {
        case .materialized(let signature):
            guard let admission, admission.signature == signature, await nativeReportAdmissionIsCurrent(admission) else { return nil }
        case .frozen(let token):
            guard frozenNativeReportAdmissions[windowID]?.token == token, let admission,
                  frozenNativeReportPublishedSignatures[windowID] == admission.signature, await nativeReportAdmissionIsCurrent(admission) else { return nil }
        case .legacy(let proof):
            if let admission {
                guard await nativeReportAdmissionIsCurrent(admission), nativeReportRestoreProofMatches(proof, admission: admission) else { return nil }
            } else {
                guard proof.objectValue?["authorInputs"] == .string(nativeReportLocalDigest(.object(reportPreparationAuthorInputs(form)))) else { return nil }
            }
        }
        guard cache.generation == nativeReportAccountGeneration, completedNativeReportCaches[windowID]?.token == cache.token else { return nil }
        return cache.value
    }
}
