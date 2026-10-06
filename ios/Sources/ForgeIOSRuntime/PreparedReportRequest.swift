import Foundation

public struct PreparedReportIdentity: Codable, Sendable, Equatable {
    public let windowId: String
    public let builderRef: String
    public let formRevision: JSONValue
    public let stateRevision: JSONValue
    public let stateKey: String?
    public init(windowId: String, builderRef: String, formRevision: JSONValue, stateRevision: JSONValue, stateKey: String? = nil) {
        self.windowId = windowId; self.builderRef = builderRef; self.formRevision = formRevision; self.stateRevision = stateRevision; self.stateKey = stateKey
    }
}
public struct PreparedReportRequest: Sendable {
    public let identity: PreparedReportIdentity
    public let status: String
    public let hookStatus: String
    public let dataSourceRef: String
    public let request: [String: JSONValue]
    public let state: [String: JSONValue]
    public let config: DashboardReportBuilderDef
    public let requiredBindings: [[String: JSONValue]]
    public let error: String?
    public let preparedAt: Date
    public let preparedCalendar: Calendar
    public init(identity: PreparedReportIdentity, status: String, hookStatus: String, dataSourceRef: String, request: [String: JSONValue], state: [String: JSONValue] = [:], config: DashboardReportBuilderDef = DashboardReportBuilderDef(), requiredBindings: [[String: JSONValue]] = [], error: String? = nil, preparedAt: Date = Date(), preparedCalendar: Calendar = .current) {
        self.identity = identity; self.status = status; self.hookStatus = hookStatus; self.dataSourceRef = dataSourceRef; self.request = request; self.state = state; self.config = config; self.requiredBindings = requiredBindings; self.error = error; self.preparedAt = preparedAt; self.preparedCalendar = preparedCalendar
    }
    public func validate(current: PreparedReportIdentity) -> String? {
        guard current == identity else { return "stale-preparation" }
        guard status == "ready" else { return status == "error" ? (error ?? "preparation-error") : "pending" }
        guard hookStatus == "completed" else { return "unsupported-hook" }
        for binding in requiredBindings {
            guard let path = binding["path"]?.preparationString, reportPreparationValue(request, path: path) == binding["value"] else { return "unbound-intent" }
        }
        return nil
    }
    public func publishedRequest(_ source: ReportBuilderPublishedDataSourceDef, current: PreparedReportIdentity, datasetScopeParams: [String: JSONValue] = [:], now: Date? = nil, calendar: Calendar? = nil) throws -> [String: JSONValue] {
        if let issue = validate(current: current) { throw ReportPreparationError(reason: issue) }
        let now = now ?? preparedAt
        let calendar = calendar ?? preparedCalendar
        guard source.hasDeclaredRequest else { throw ReportPreparationError(reason: "missing-request") }
        let policy = try ReportDatasetScopePolicy(source.scope)
        var context: [String: JSONValue] = [:]
        if let options = request["options"]?.objectValue { context["options"] = .object(options) }
        if source.dataSourceRef == dataSourceRef {
            if let filters = request["filters"]?.objectValue { context["filters"] = .object(filters) }
            if let refinements = request["refinements"] { context["refinements"] = refinements }
        }
        let scopedValues = datasetScopeParams[source.id]?.objectValue ?? datasetScopeParams
        for option in source.scopeParamOptions {
            guard let id = option["id"]?.preparationString ?? option["value"]?.preparationString else { continue }
            let path = option["paramPath"]?.preparationString ?? ""
            if policy.exclude.contains(id) {
                for key in ["paramPath", "startParamPath", "endParamPath"] { if let excludedPath = option[key]?.preparationString { reportPreparationDelete(&context, path: excludedPath) } }
                continue
            }
            var raw = scopedValues[id] ?? (state["scopeParams"]?.objectValue ?? state["staticFilters"]?.objectValue ?? [:])[id]
            if option["kind"]?.preparationString?.lowercased() == "daterange" {
                for (key, property) in [("startParamPath", "start"), ("endParamPath", "end")] {
                    guard let datePath = option[key]?.preparationString else { continue }
                    let value = raw?.objectValue?[property] ?? reportPreparationValue(request, path: datePath)
                    if let value, !reportPreparationEmpty(value) { reportPreparationSet(&context, path: datePath, value: value) }
                }
            } else if !path.isEmpty {
                if raw == nil || reportPreparationEmpty(raw!) { raw = reportPreparationValue(request, path: path) }
                if let raw, !reportPreparationEmpty(raw) { reportPreparationSet(&context, path: path, value: raw) }
            }
        }
        var local = policy.local
        if let relative = policy.relative {
            guard let startPath = relative["startParamPath"]?.preparationString, let endPath = relative["endParamPath"]?.preparationString,
                  let preset = relative["preset"]?.preparationString?.lowercased().replacingOccurrences(of: "_", with: "") else { throw ReportPreparationError(reason: "unsupported-relative-date") }
            let offsets: [String: (Int, Int)] = ["today": (0,0), "yesterday": (-1,-1), "last3days": (-2,0), "3d": (-2,0), "last7days": (-6,0), "7d": (-6,0), "last30days": (-29,0), "30d": (-29,0)]
            guard let range = offsets[preset] else { throw ReportPreparationError(reason: "unsupported-relative-date") }
            let today = calendar.startOfDay(for: now)
            let formatter = DateFormatter(); formatter.calendar = calendar; formatter.timeZone = calendar.timeZone; formatter.dateFormat = "yyyy-MM-dd"
            for (path, offset) in [(startPath, range.0), (endPath, range.1)] {
                guard let date = calendar.date(byAdding: .day, value: offset, to: today) else { throw ReportPreparationError(reason: "unsupported-relative-date") }
                reportPreparationSet(&local, path: path, value: .string(formatter.string(from: date)))
            }
        }
        switch policy.mode {
        case "append": return reportPreparationMerge(reportPreparationMerge(source.request, local), context)
        case "override", "exclude": return reportPreparationMerge(reportPreparationMerge(source.request, context), local)
        default: return reportPreparationMerge(source.request, context)
        }
    }
}
public struct ReportPreparationError: Error, LocalizedError { public let reason: String; public var errorDescription: String? { "Report request is unavailable: \(reason). No data request was sent." }; public init(reason: String) { self.reason = reason } }
private struct ReportDatasetScopePolicy {
    let mode: String; let local: [String: JSONValue]; let exclude: Set<String>; let relative: [String: JSONValue]?
    init(_ scope: [String: JSONValue]) throws {
        let raw = scope["mode"]?.preparationString ?? ""
        let excluded = Set(scope["exclude"]?.preparationArray?.compactMap(\.preparationString) ?? [])
        let explicitLocal = scope["local"]?.objectValue ?? [:]
        let legacy = scope.filter { !["mode", "local", "exclude", "relativeDateRange", "inheritContext"].contains($0.key) }
        if !raw.isEmpty && !["inherit", "append", "override", "exclude"].contains(raw) { throw ReportPreparationError(reason: "invalid-scope-policy") }
        if raw == "exclude" && excluded.isEmpty { throw ReportPreparationError(reason: "invalid-scope-policy") }
        if raw.isEmpty && scope["inheritContext"] == .bool(false) && !excluded.isEmpty { throw ReportPreparationError(reason: "invalid-scope-policy") }
        mode = !raw.isEmpty ? raw : !excluded.isEmpty ? "exclude" : scope["inheritContext"] == .bool(false) ? "override" : (!legacy.isEmpty || !explicitLocal.isEmpty) ? "append" : "inherit"
        local = raw.isEmpty ? reportPreparationMerge(legacy, explicitLocal) : explicitLocal
        exclude = excluded; relative = scope["relativeDateRange"]?.objectValue
    }
}
public func reportPreparationFingerprint(_ value: JSONValue) -> String { let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]; return (try? String(decoding: encoder.encode(value), as: UTF8.self)) ?? "invalid" }
public func reportPreparationValue(_ object: [String: JSONValue], path: String) -> JSONValue? { path.split(separator: ".").reduce(JSONValue.object(object) as JSONValue?) { $0?.objectValue?[String($1)] } }
private func reportPreparationEmpty(_ value: JSONValue) -> Bool { value == .null || value == .string("") || value == .array([]) }
private func reportPreparationMerge(_ base: [String: JSONValue], _ patch: [String: JSONValue]) -> [String: JSONValue] { var result = base; for (key, value) in patch { if let left = result[key]?.objectValue, let right = value.objectValue { result[key] = .object(reportPreparationMerge(left, right)) } else { result[key] = value } }; return result }
private func reportPreparationSet(_ object: inout [String: JSONValue], path: String, value: JSONValue) { let parts = path.split(separator: "."); guard let first = parts.first else { return }; if parts.count == 1 { object[String(first)] = value } else { var child = object[String(first)]?.objectValue ?? [:]; reportPreparationSet(&child, path: parts.dropFirst().joined(separator: "."), value: value); object[String(first)] = .object(child) } }
private func reportPreparationDelete(_ object: inout [String: JSONValue], path: String) { let parts = path.split(separator: "."); guard let first = parts.first else { return }; if parts.count == 1 { object.removeValue(forKey: String(first)) } else if var child = object[String(first)]?.objectValue { reportPreparationDelete(&child, path: parts.dropFirst().joined(separator: ".")); object[String(first)] = .object(child) } }
private extension JSONValue { var preparationString: String? { guard case .string(let s) = self else { return nil }; return s.isEmpty ? nil : s }; var preparationArray: [JSONValue]? { guard case .array(let a) = self else { return nil }; return a } }

extension ForgeRuntime {
    public func reportPreparationIdentity(windowID: String, builderRef: String, stateKey: String? = nil) async -> PreparedReportIdentity {
        let form = await windowFormJSONValue(windowID: windowID)
        let metadata = await windowMetadata(id: windowID)
        return reportPreparationSnapshotIdentity(windowID: windowID, builderRef: builderRef, stateKey: stateKey, form: form, metadata: metadata)
    }

    public func publishPreparedReportRequest(_ prepared: PreparedReportRequest) async -> Bool {
        guard windows.contains(where: { $0.id == prepared.identity.windowId }) else { return false }
        let generation = nativeReportAccountGeneration
        let current = await reportPreparationIdentity(windowID: prepared.identity.windowId, builderRef: prepared.identity.builderRef, stateKey: prepared.identity.stateKey)
        guard nativeReportAccountGeneration == generation, current == prepared.identity else { return false }
        preparedReportRequests[current.windowId] = prepared
        return true
    }
    public func preparedReportRequest(windowID: String) async throws -> PreparedReportRequest {
        let generation = nativeReportAccountGeneration
        guard windows.contains(where: { $0.id == windowID }) else { throw ReportPreparationError(reason: "window-closed") }
        guard let prepared = preparedReportRequests[windowID] else { throw ReportPreparationError(reason: "pending") }
        let current = await reportPreparationIdentity(windowID: windowID, builderRef: prepared.identity.builderRef, stateKey: prepared.identity.stateKey)
        guard generation == nativeReportAccountGeneration, let installed = preparedReportRequests[windowID],
              installed.identity == prepared.identity, installed.request == prepared.request,
              installed.state == prepared.state, installed.preparedAt == prepared.preparedAt else { throw ReportPreparationError(reason: "stale-preparation") }
        if let issue = prepared.validate(current: current) {
            throw ReportPreparationError(reason: issue)
        }
        return prepared
    }
    public func waitPreparedReportRequest(windowID: String, timeout: TimeInterval = 5) async throws -> PreparedReportRequest {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            do { return try await preparedReportRequest(windowID: windowID) }
            catch let error as ReportPreparationError where ["pending", "stale-preparation"].contains(error.reason) { try await Task.sleep(nanoseconds: 20_000_000) }
        }
        throw ReportPreparationError(reason: "pending")
    }
    public func isReportDataSource(windowID: String, dataSourceRef: String) async -> Bool {
        guard let metadata = await windowMetadata(id: windowID), let data = try? JSONEncoder().encode(metadata), let raw = try? JSONDecoder().decode(JSONValue.self, from: data) else { return false }
        var refs = Set<String>()
        func walk(_ value: JSONValue) {
            if let object = value.objectValue {
                if object["reportBuilder"]?.objectValue != nil || object["reportBuilders"]?.objectValue?.isEmpty == false || object["kind"] == .string("dashboard.reportBuilder") {
                    if let ref = object["dataSourceRef"]?.preparationString { refs.insert(ref) }
                    if let variants = object["reportBuilders"]?.objectValue { for variant in variants.values { if let ref = variant.objectValue?["dataSourceRef"]?.preparationString { refs.insert(ref) } } }
                }
                if let sources = object["dataSources"]?.preparationArray { for source in sources { if let ref = source.objectValue?["dataSourceRef"]?.preparationString { refs.insert(ref) }; if let id = source.objectValue?["id"]?.preparationString { refs.insert(id) } } }
                object.values.forEach(walk)
            } else { (value.preparationArray ?? []).forEach(walk) }
        }
        walk(raw); return refs.contains(dataSourceRef)
    }
    public func fetchPreparedReportDataSource(windowID: String, dataSourceRef: String, expectedIdentity: PreparedReportIdentity? = nil, automatic: Bool = false) async throws {
        let prepared: PreparedReportRequest
        if let expectedIdentity {
            prepared = try await preparedReportRequest(windowID: windowID)
            guard prepared.identity == expectedIdentity else { throw ReportPreparationError(reason: "stale-preparation") }
        } else { prepared = try await waitPreparedReportRequest(windowID: windowID) }
        let current = await reportPreparationIdentity(windowID: windowID, builderRef: prepared.identity.builderRef, stateKey: prepared.identity.stateKey)
        if dataSourceRef == prepared.dataSourceRef {
            if let error = prepared.validate(current: current) { throw ReportPreparationError(reason: error) }
            try await fetchPreparedPrimary(prepared, automatic: automatic)
        } else if let source = prepared.config.dataSources.first(where: { $0.id == dataSourceRef }) {
            let request = try prepared.publishedRequest(source, current: current)
            await fetchDataSourceInstance(windowID: windowID, instanceRef: "reportDocument:\(source.id)", dataSourceRef: source.dataSourceRef, parameters: request)
        } else { throw ReportPreparationError(reason: "inactive-report-source") }
    }
}

extension ForgeRuntime {
    public func activeViewDataSourceRefs(windowID: String) async throws -> [String] {
        guard let metadata = await windowMetadata(id: windowID), let view = metadata.view?.content,
              let data = try? JSONEncoder().encode(view), let encodedRoot = try? JSONDecoder().decode(JSONValue.self, from: data) else { return [] }
        let root = metadata.runtimeAuthoring?.objectValue?["view"]?.objectValue?["content"] ?? encodedRoot
        let form = await windowFormJSONValue(windowID: windowID)
        var refs = Set<String>()
        func walk(_ value: JSONValue) throws {
            if let object = value.objectValue {
                if object["className"]?.preparationString?.split(whereSeparator: { $0.isWhitespace }).contains("forge-container-hidden") == true { return }
                if let condition = object["visibleWhen"], condition != .bool(true) { if condition == .bool(false) { return }; throw ReportPreparationError(reason: "ambiguous-active-view") }
                if object["visible"] == .bool(false) || object["hidden"] == .bool(true) || object["visibility"] == .bool(false) { return }
                if let visibility = object["visibility"], visibility != .bool(true) { throw ReportPreparationError(reason: "ambiguous-active-view") }
                if case .array(let tabs) = object["tabs"], tabs.count > 1 { throw ReportPreparationError(reason: "ambiguous-active-view") }
                if object["kind"] == .string("tabs") || object["kind"] == .string("dashboard.tabGroup") { throw ReportPreparationError(reason: "ambiguous-active-view") }
                let dashboard = object["dashboard"]?.objectValue ?? [:]
                let variants = object["reportBuilders"]?.objectValue ?? dashboard["reportBuilders"]?.objectValue ?? [:]
                if !variants.isEmpty {
                    let selected = form["reportBuilderRef"]?.preparationString ?? object["reportBuilderRef"]?.preparationString ?? dashboard["reportBuilderRef"]?.preparationString ?? ""
                    if let variant = variants[selected]?.objectValue, let ref = variant["dataSourceRef"]?.preparationString ?? object["dataSourceRef"]?.preparationString { refs.insert(ref) }
                    return
                }
                if let ref = object["dataSourceRef"]?.preparationString { refs.insert(ref) }
                for key in ["containers", "items", "tabs", "content"] { if let child = object[key] { try walk(child) } }
            } else { try (value.preparationArray ?? []).forEach(walk) }
        }
        try walk(root); return refs.sorted()
    }
}

extension ForgeRuntime {
    public func authoredReportConfig(windowID: String, containerID: String, builderRef: String) async -> JSONValue? {
        guard let metadata = await windowMetadata(id: windowID), let authoring = metadata.runtimeAuthoring else { return nil }
        func find(_ value: JSONValue) -> JSONValue? {
            if let object = value.objectValue {
                if object["id"] == .string(containerID) {
                    let dashboard = object["dashboard"]?.objectValue ?? [:]
                    let variants = object["reportBuilders"]?.objectValue ?? dashboard["reportBuilders"]?.objectValue ?? [:]
                    return variants[builderRef]?.objectValue?["reportBuilder"] ?? dashboard["reportBuilder"] ?? object["reportBuilder"]
                }
                for (key, child) in object where ["view", "content", "containers", "tabs", "items"].contains(key) { if let result = find(child) { return result } }
            } else { for child in value.preparationArray ?? [] { if let result = find(child) { return result } } }
            return nil
        }
        return find(authoring)
    }

}

public struct ReportDataFetchPlan: Sendable, Equatable {
    public let status: String
    public let targets: [String]
    public static func resolve(requestedRef: String?, activeRefs: [String], registryRefs: [String], reportRefs: [String], preparedRefs: [String]) -> ReportDataFetchPlan {
        let targets = requestedRef.map { [$0] } ?? Array(Set(activeRefs)).sorted()
        guard targets.allSatisfy({ registryRefs.contains($0) }) else { return ReportDataFetchPlan(status: "error", targets: []) }
        guard targets.allSatisfy({ !reportRefs.contains($0) || preparedRefs.contains($0) }) else { return ReportDataFetchPlan(status: "pending", targets: []) }
        return ReportDataFetchPlan(status: "ready", targets: targets)
    }
}

struct PreparedReportFetchFence: Sendable {
    let required: Bool
    let identity: PreparedReportIdentity?
    let reportRequestID: String?
    let nativeCompletionID: String?
    init(required: Bool, identity: PreparedReportIdentity?, reportRequestID: String? = nil, nativeCompletionID: String? = nil) { self.required = required; self.identity = identity; self.reportRequestID = reportRequestID; self.nativeCompletionID = nativeCompletionID }
}
extension ForgeRuntime {
    func reportFetchFenceIsCurrent(_ fence: PreparedReportFetchFence, windowID: String) async -> Bool {
        guard !Task.isCancelled else { return false }
        guard fence.required else { return true }
        guard let identity = fence.identity, let packet = try? await preparedReportRequest(windowID: windowID) else { return false }
        guard identity == packet.identity else { return false }
        if let requestID = fence.reportRequestID, let completionID = fence.nativeCompletionID, let dispatch = nativeReportDispatches[completionID], let admission = await nativeReportLifecycle.admission(windowID: windowID) {
            guard dispatch.requestID == requestID, dispatch.admissionSignature == admission.signature else { return false }
            return await nativeReportRequestIsCurrent(admission, requestID: requestID)
        }
        if fence.reportRequestID != nil { return false }
        return true
    }
}

public func reportPreparationAuthorInputs(_ form: [String: JSONValue]) -> [String: JSONValue] {
    let results: Set<String> = ["reportRunRequest", "reportMaterialization", "reportStaticDatasets", "reportSpec", "reportFill", "reportPrint", "reportExportRequest", "reportExportError", "reportValidatedRestore"]
    return form.filter { !results.contains($0.key) }
}
extension ForgeRuntime {
    public func commitReportProducerState(windowID: String, builderRef: String, stateKey: String, expectedForm: [String: JSONValue], updatedForm: [String: JSONValue], expectedMetadataRevision: String) async -> PreparedReportIdentity? {
        guard let metadata = await windowMetadata(id: windowID), metadata.runtimeAuthoring.map(reportPreparationFingerprint) == expectedMetadataRevision else { return nil }
        guard let committed = await dataSourceRuntime.commitReportFormSnapshot(dataSourceID: WindowIdentity(windowID: windowID).windowFormID(), expected: expectedForm, updated: updatedForm) else { return nil }
        guard await windowMetadata(id: windowID)?.runtimeAuthoring.map(reportPreparationFingerprint) == expectedMetadataRevision else { return nil }
        return reportPreparationSnapshotIdentity(windowID: windowID, builderRef: builderRef, stateKey: stateKey, form: committed, metadata: metadata)
    }
    public func validatedReportProducerIdentity(windowID: String, builderRef: String, stateKey: String, expectedForm: [String: JSONValue], expectedMetadataRevision: String) async -> PreparedReportIdentity? {
        let before = await reportPreparationIdentity(windowID: windowID, builderRef: builderRef, stateKey: stateKey)
        let form = await windowFormJSONValue(windowID: windowID)
        let metadata = await windowMetadata(id: windowID)
        let after = await reportPreparationIdentity(windowID: windowID, builderRef: builderRef, stateKey: stateKey)
        guard before == after,
              reportPreparationAuthorInputs(form) == reportPreparationAuthorInputs(expectedForm),
              metadata?.runtimeAuthoring.map(reportPreparationFingerprint) == expectedMetadataRevision else { return nil }
        return before
    }
    func validatedReportFetchFence(windowID: String, dataSourceRef: String, instanceRef: String? = nil, parameters: [String: JSONValue], nativeCompletionID: String? = nil) async throws -> PreparedReportFetchFence {
        let owned = await isReportDataSource(windowID: windowID, dataSourceRef: dataSourceRef)
        let required = owned || instanceRef?.hasPrefix("reportDocument:") == true
        guard required else { return PreparedReportFetchFence(required: false, identity: nil) }
        let packet = try await preparedReportRequest(windowID: windowID)
        let expected: [String: JSONValue]
        if let instanceRef, instanceRef.hasPrefix("reportDocument:") {
            let id = String(instanceRef.dropFirst("reportDocument:".count))
            if id == "primary", dataSourceRef == packet.dataSourceRef { expected = packet.request }
            else {
                guard let source = packet.config.dataSources.first(where: { $0.id == id && $0.dataSourceRef == dataSourceRef }) else { throw ReportPreparationError(reason: "inactive-report-source") }
                expected = try packet.publishedRequest(source, current: packet.identity)
            }
        } else {
            guard dataSourceRef == packet.dataSourceRef else { throw ReportPreparationError(reason: "inactive-report-source") }
            expected = packet.request
        }
        guard parameters == expected else { throw ReportPreparationError(reason: "request-does-not-match-preparation") }
        let authoredAdmission = await nativeReportLifecycle.admission(windowID: windowID)
        if nativeReportAuthoredPreparations[windowID] != nil || authoredAdmission != nil {
            guard let admission = await nativeReportLifecycle.admission(windowID: windowID), let completionID = nativeCompletionID, let dispatch = nativeReportDispatches[completionID],
                  let handle = await nativeReportLifecycle.handle(requestID: dispatch.requestID), handle.admission.signature == admission.signature,
                  dispatch.admissionSignature == admission.signature, dispatch.dataset.dataSourceRef == dataSourceRef, dispatch.dataset.request == parameters,
                  instanceRef == "reportDocument:\(dispatch.dataset.id)", admission.datasets.contains(dispatch.dataset),
                  await nativeReportRequestIsCurrent(admission, requestID: dispatch.requestID) else { throw ReportPreparationError(reason: "report-not-admitted") }
            return PreparedReportFetchFence(required: true, identity: packet.identity, reportRequestID: dispatch.requestID, nativeCompletionID: completionID)
        }
        return PreparedReportFetchFence(required: true, identity: packet.identity)
    }
}

public func reportPreparationInitializationInputs(_ form: [String: JSONValue], stateKey: String?) -> [String: JSONValue] {
    var result = reportPreparationAuthorInputs(form)
    func remove(_ object: inout [String: JSONValue], parts: [Substring]) {
        guard let first = parts.first else { return }
        if parts.count == 1 { object.removeValue(forKey: String(first)); return }
        guard var child = object[String(first)]?.objectValue else { return }
        remove(&child, parts: Array(parts.dropFirst()))
        if child.isEmpty { object.removeValue(forKey: String(first)) } else { object[String(first)] = .object(child) }
    }
    if let stateKey { remove(&result, parts: stateKey.split(separator: ".")) }
    return result
}

func reportPreparationSnapshotIdentity(windowID: String, builderRef: String, stateKey: String?, form: [String: JSONValue], metadata: WindowMetadata?) -> PreparedReportIdentity {
    let chosen = form["reportBuilderRef"]?.preparationString ?? builderRef
    let metadataValue = metadata?.runtimeAuthoring ?? (try? metadata.map { try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode($0)) }) ?? nil
    let actualStateKey = stateKey ?? "reportBuilder:\(chosen)"
    let scope: [String: JSONValue] = ["authorInputs": .object(reportPreparationAuthorInputs(form)), "builderRef": .string(chosen), "metadata": metadataValue ?? .null, "stateKey": .string(actualStateKey)]
    return PreparedReportIdentity(windowId: windowID, builderRef: chosen, formRevision: .string(reportPreparationFingerprint(.object(scope))), stateRevision: .string(reportPreparationFingerprint(reportPreparationValue(form, path: actualStateKey) ?? .object([:]))), stateKey: actualStateKey)
}

public func reportInitialIntentKey(builderRef: String, stateKey: String, prefillSignature: String) -> String {
    nativeReportLocalDigest(.object(["builderRef": .string(builderRef), "stateKey": .string(stateKey), "prefill": .string(prefillSignature)]))
}
extension ForgeRuntime {
    public func reportInitialIntentAcknowledged(windowID: String, key: String) -> Bool {
        acknowledgedReportInitialIntents[windowID] == key
    }
    public func acknowledgeReportInitialIntent(_ prepared: PreparedReportRequest, key: String) async -> Bool {
        guard let current = try? await preparedReportRequest(windowID: prepared.identity.windowId),
              current.identity == prepared.identity, current.request == prepared.request,
              prepared.validate(current: current.identity) == nil else { return false }
        acknowledgedReportInitialIntents[prepared.identity.windowId] = key
        return true
    }
}
