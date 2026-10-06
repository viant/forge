import Foundation

struct NativeReportFrozenAdmission: Sendable {
    let token = UUID()
    let admission: NativeReportAdmission
    let reportRunID: String
    let ownerID: String
    let generation: Int
    let prefill: JSONValue
    let prefillRevision: JSONValue
    let staticDatasets: JSONValue
}

extension ForgeRuntime {
    /// Monotonic generations fence late tasks from an earlier authenticated client.
    public func bindNativeReportAccount(generation: Int) async {
        guard generation > nativeReportAccountGeneration else { return }
        for fetch in preparedPrimaryFetches.values { fetch.task.cancel() }
        preparedPrimaryFetches.removeAll()
        nativeReportAccountGeneration = generation
        frozenNativeReportAdmissions.removeAll()
        completedNativeReportCaches.removeAll()
        frozenNativeReportPublishedSignatures.removeAll()
        preparedReportRequests.removeAll()
        acknowledgedReportInitialIntents.removeAll()
        nativeReportAuthoredPreparations.removeAll()
        for task in nativeReportMaterializations.values { task.cancel() }
        nativeReportMaterializations.removeAll()
        nativeReportActiveRequestIDs.removeAll()
        nativeReportActiveRequestGenerations.removeAll()
        nativeReportDispatches.removeAll()
        nativeReportDatasetResults.removeAll()
        await nativeReportLifecycle.reset()
    }
    public func installNativeReportFrozenAdmission(_ admission: NativeReportAdmission, reportRunID: String, ownerID: String, form: [String: JSONValue], generation: Int) throws {
        guard generation == nativeReportAccountGeneration, !reportRunID.isEmpty, !ownerID.isEmpty,
              !admission.conversationID.isEmpty else { throw ReportPreparationError(reason: "stale-report-account") }
        guard admission.prefillIdentity == nativeReportPrefillIdentity(form) else { throw ReportPreparationError(reason: "admission-prefill-mismatch") }
        _ = try nativeReportAdmissionContext(admission)
        let entry = NativeReportFrozenAdmission(admission: admission, reportRunID: reportRunID, ownerID: ownerID, generation: generation,
            prefill: form["prefill"] ?? .null, prefillRevision: form["__forge"]?.objectValue?["prefillRevision"] ?? .number(0), staticDatasets: form["reportStaticDatasets"] ?? .null)
        guard frozenReportMatches(entry, form: form, configuration: admission.authoredConfiguration, document: admission.document) else { throw ReportPreparationError(reason: "stale-report-author-inputs") }
        try installFrozenReportCache(entry, form: form)
        frozenNativeReportAdmissions[admission.preparation.identity.windowId] = entry
    }
    public func frozenNativeReportPreparation(windowID: String, builderRef: String, stateKey: String, configuration: [String: JSONValue], document: [String: JSONValue], expectedMetadataRevision: String) async -> PreparedReportRequest? {
        guard let entry = frozenNativeReportAdmissions[windowID] else { return nil }
        let metadata = await windowMetadata(id: windowID)
        let form = await windowFormJSONValue(windowID: windowID)
        guard (metadata?.runtimeAuthoring.map(reportPreparationFingerprint) ?? "") == expectedMetadataRevision, windows.first(where: { $0.id == windowID })?.conversationID == entry.admission.conversationID,
              entry.admission.preparation.identity.builderRef == builderRef, entry.admission.stateKey == stateKey,
              frozenReportMatches(entry, form: form, configuration: configuration, document: document) else {
            if frozenEntryIsCurrent(entry, windowID: windowID) {
                frozenNativeReportAdmissions.removeValue(forKey: windowID)
            }
            return nil
        }
        // Identity belongs to the exact form that passed the frozen-input check.
        // A later edit must fail publication, never acquire the old query/clock.
        let identity = reportPreparationSnapshotIdentity(windowID: windowID, builderRef: builderRef, stateKey: stateKey, form: form, metadata: metadata)
        let original = entry.admission.preparation
        return PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: original.dataSourceRef,
            request: original.request, state: original.state, config: original.config, requiredBindings: original.requiredBindings,
            preparedAt: original.preparedAt, preparedCalendar: original.preparedCalendar)
    }
    public func invalidateNativeReportFrozenAdmission(windowID: String) { frozenNativeReportAdmissions.removeValue(forKey: windowID) }
    private func frozenEntryIsCurrent(_ entry: NativeReportFrozenAdmission, windowID: String) -> Bool {
        entry.generation == nativeReportAccountGeneration && frozenNativeReportAdmissions[windowID]?.token == entry.token
    }
    func frozenPublishedAdmissionIsCurrent(_ admission: NativeReportAdmission) async -> Bool {
        let windowID = admission.preparation.identity.windowId
        guard frozenNativeReportPublishedSignatures[windowID] == admission.signature else { return true }
        guard let entry = frozenNativeReportAdmissions[windowID] else { return false }
        let form = await windowFormJSONValue(windowID: windowID)
        return frozenEntryIsCurrent(entry, windowID: windowID) && frozenReportMatches(entry, form: form, configuration: admission.authoredConfiguration, document: admission.document)
    }
    private func frozenReportMatches(_ entry: NativeReportFrozenAdmission, form: [String: JSONValue], configuration: [String: JSONValue], document: [String: JSONValue]) -> Bool {
        let admission = entry.admission
        guard entry.generation == nativeReportAccountGeneration,
              form["reportBuilderRef"] == .string(admission.preparation.identity.builderRef),
              form["executeOnOpen"] == .bool(false),
              form["reportStaticDatasets"] == entry.staticDatasets,
              form["reportMaterialization"]?.objectValue?["reportRunId"] == .string(entry.reportRunID),
              form["reportMaterialization"]?.objectValue?["status"] == .string("completed"),
              (form["prefill"] ?? .null) == entry.prefill,
              (form["__forge"]?.objectValue?["prefillRevision"] ?? .number(0)) == entry.prefillRevision,
              reportPreparationValue(form, path: admission.stateKey)?.objectValue == admission.authorState,
              configuration == admission.authoredConfiguration, document == admission.document else { return false }
        return true
    }
}

extension ForgeRuntime {
    public func publishFrozenNativeReportPreparation(windowID: String, builderRef: String, stateKey: String, configuration: [String: JSONValue], document: [String: JSONValue], initialIntentKey: String, expectedMetadataRevision: String) async -> PreparedReportRequest? {
        guard let entry = frozenNativeReportAdmissions[windowID],
              let packet = await frozenNativeReportPreparation(windowID: windowID, builderRef: builderRef, stateKey: stateKey, configuration: configuration, document: document, expectedMetadataRevision: expectedMetadataRevision),
              frozenEntryIsCurrent(entry, windowID: windowID), await publishPreparedReportRequest(packet), frozenEntryIsCurrent(entry, windowID: windowID) else { return nil }
        let original = entry.admission
        let admission = NativeReportAdmission(preparation: packet, conversationID: original.conversationID, stateKey: stateKey,
            document: original.document, datasets: original.datasets, authoredConfiguration: original.authoredConfiguration, authorState: original.authorState, prefillIdentity: original.prefillIdentity)
        do { try await publishNativeReportAdmission(admission) } catch { return nil }
        guard frozenEntryIsCurrent(entry, windowID: windowID),
              await acknowledgeReportInitialIntent(packet, key: initialIntentKey),
              frozenEntryIsCurrent(entry, windowID: windowID) else { return nil }
        frozenNativeReportPublishedSignatures[windowID] = admission.signature
        nativeReportAuthoredPreparations[windowID] = packet.identity
        let form = await windowFormJSONValue(windowID: windowID)
        guard frozenReportMatches(entry, form: form, configuration: configuration, document: document),
              packet.identity == reportPreparationSnapshotIdentity(windowID: windowID, builderRef: builderRef, stateKey: stateKey, form: form, metadata: await windowMetadata(id: windowID)) else { return nil }
        var materialization = form["reportMaterialization"]?.objectValue ?? [:]
        materialization["admissionSignature"] = .string(admission.signature)
        var updated = form
        updated["reportMaterialization"] = .object(materialization)
        guard frozenEntryIsCurrent(entry, windowID: windowID),
              await dataSourceRuntime.commitReportFormSnapshot(dataSourceID: WindowIdentity(windowID: windowID).windowFormID(), expected: form, updated: updated) != nil,
              frozenEntryIsCurrent(entry, windowID: windowID) else { return nil }
        return packet
    }
}
