import Foundation

public struct RegisteredDataSourceSnapshot: Sendable {
    public let input: InputState
    public let control: ControlState
    public let form: [String: JSONValue]
    public let selection: SelectionState
    /// nil means unresolved; [] is a confirmed empty collection.
    public let collection: [[String: JSONValue]]?
    public let metrics: [String: JSONValue]
}

struct PreparedPrimaryFetch: Sendable {
    let key: String
    let task: Task<Void, Error>
}

public func reportBuilderAutomaticFetchAllowed(windowForm: [String: JSONValue], authoredConfig: JSONValue?, dataSourceAutoFetch: Bool?) -> Bool {
    if case .bool(let value) = windowForm["executeOnOpen"] { return value }
    if case .bool(let value) = authoredConfig?.objectValue?["request"]?.objectValue?["autoFetch"] { return value }
    return dataSourceAutoFetch ?? true
}

extension ForgeRuntime {
    /// Mounted views and reactive observers must use this entry point. Explicit
    /// user/tool refresh actions use refreshDataSourceCollection directly.
    public func automaticallyRefreshDataSourceCollection(windowID: String, dataSourceRef: String) async {
        guard let metadata = await windowMetadata(id: windowID), let source = metadata.dataSources[dataSourceRef] else { return }
        let form = await windowFormJSONValue(windowID: windowID)
        guard reportBuilderAutomaticFetchAllowed(windowForm: form, authoredConfig: nil, dataSourceAutoFetch: source.autoFetch) else { return }
        if await isReportDataSource(windowID: windowID, dataSourceRef: dataSourceRef) {
            guard let packet = try? await preparedReportRequest(windowID: windowID), packet.dataSourceRef == dataSourceRef else { return }
            try? await fetchPreparedPrimary(packet, automatic: true)
            return
        }
        await refreshDataSourceCollection(windowID: windowID, dataSourceRef: dataSourceRef)
    }

    public func registeredDataSourceSnapshot(windowID: String, dataSourceRef: String) async -> RegisteredDataSourceSnapshot? {
        await dataSourceRuntime.registeredSnapshot(dataSourceID: WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef))
    }

    public func registerPreparedReportPrimaryContext(_ packet: PreparedReportRequest) async throws {
        let windowID = packet.identity.windowId
        let current = try await preparedReportRequest(windowID: windowID)
        guard current.identity == packet.identity, current.request == packet.request else { throw ReportPreparationError(reason: "stale-preparation") }
        let id = WindowIdentity(windowID: windowID).dataSourceID(ref: packet.dataSourceRef)
        if await dataSourceRuntime.registerReportInput(dataSourceID: id, parameters: packet.request) {
            await (await signals.input(dataSourceID: id)).set(await dataSourceRuntime.input(dataSourceID: id))
            await (await signals.collection(dataSourceID: id)).set([])
            await (await signals.control(dataSourceID: id)).set(ControlState(inactive: true))
        }
    }

    public func invalidateAutomaticReportPrimaryFetch(windowID: String) {
        preparedPrimaryFetches.removeValue(forKey: windowID)
    }

    func fetchPreparedPrimary(_ packet: PreparedReportRequest, automatic: Bool) async throws {
        let windowID = packet.identity.windowId
        if automatic {
            let source = await windowMetadata(id: windowID)?.dataSources[packet.dataSourceRef]
            let form = await windowFormJSONValue(windowID: windowID)
            guard reportBuilderAutomaticFetchAllowed(windowForm: form, authoredConfig: nil, dataSourceAutoFetch: source?.autoFetch) else { return }
        }
        let key = nativeReportLocalDigest(.object(["builderRef": .string(packet.identity.builderRef), "source": .string(packet.dataSourceRef), "formRevision": packet.identity.formRevision, "stateRevision": packet.identity.stateRevision, "request": .object(packet.request)]))
        if automatic, let existing = preparedPrimaryFetches[windowID], existing.key == key {
            return try await existing.task.value
        }
        let task = Task { try await self.performPreparedPrimaryFetch(packet) }
        preparedPrimaryFetches[windowID] = PreparedPrimaryFetch(key: key, task: task)
        try await task.value
    }

    private func performPreparedPrimaryFetch(_ packet: PreparedReportRequest) async throws {
        let windowID = packet.identity.windowId
        let current = try await preparedReportRequest(windowID: windowID)
        guard current.identity == packet.identity else { throw ReportPreparationError(reason: "stale-preparation") }
        await setDataSourceInputParameters(windowID: windowID, dataSourceRef: packet.dataSourceRef, parameters: packet.request, fetch: true)
        if let issue = packet.validate(current: await reportPreparationIdentity(windowID: windowID, builderRef: packet.identity.builderRef, stateKey: packet.identity.stateKey)) { throw ReportPreparationError(reason: issue) }
        if await dataSourceControl(windowID: windowID, dataSourceRef: packet.dataSourceRef).error != nil { throw ReportPreparationError(reason: "data-fetch-failed") }
    }
}
