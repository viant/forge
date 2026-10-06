import Foundation

public let nativeReportAdmissionKey = "_agentlyReportAdmission"

public func nativeReportPrefillIdentity(_ form: [String: JSONValue]) -> [String: JSONValue] {
    ["prefill": form["prefill"] ?? .null, "prefillRevision": form["__forge"]?.objectValue?["prefillRevision"] ?? .number(0)]
}

/// Persisted preparation metadata is separate from the physical query parameters.
/// Only a verified host run may use this record for a cold restoration.
public func nativeReportAdmissionContext(_ admission: NativeReportAdmission) throws -> JSONValue {
    let packet = admission.preparation
    guard packet.preparedCalendar.identifier == .gregorian,
          TimeZone.knownTimeZoneIdentifiers.contains(packet.preparedCalendar.timeZone.identifier) || packet.preparedCalendar.timeZone.identifier == "GMT" || packet.preparedCalendar.timeZone.identifier == "UTC",
          !admission.authoredConfiguration.isEmpty,
          packet.validate(current: packet.identity) == nil,
          !admission.datasets.isEmpty,
          Set(admission.datasets.map(\.id)).count == admission.datasets.count,
          admission.datasets.allSatisfy({ !$0.id.isEmpty && !$0.dataSourceRef.isEmpty }) else {
        throw ReportPreparationError(reason: "invalid-report-admission-context")
    }
    let formatter = ISO8601DateFormatter()
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    // Millisecond precision is the shared Swift/Kotlin wire clock contract.
    let clock = Date(timeIntervalSince1970: floor(packet.preparedAt.timeIntervalSince1970 * 1000) / 1000)
    let zone = packet.preparedCalendar.timeZone.identifier == "GMT" ? "UTC" : packet.preparedCalendar.timeZone.identifier
    return .object([
        "version": .number(1), "preparedAt": .string(formatter.string(from: clock)),
        "timeZone": .string(zone), "calendar": .string("gregorian"),
        "builderRef": .string(packet.identity.builderRef), "stateKey": .string(admission.stateKey),
        "primaryDataSourceRef": .string(packet.dataSourceRef), "state": .object(packet.state),
        "digests": .object([
            "profile": .string(nativeReportDigestProfile),
            "prefill": .string(try nativeReportAdmissionDigest(.object(admission.prefillIdentity))),
            "authorState": .string(try nativeReportAdmissionDigest(.object(admission.authorState))),
            "policyState": .string(try nativeReportAdmissionDigest(.object(packet.state))),
            "document": .string(try nativeReportAdmissionDigest(.object(admission.document))),
            "configuration": .string(try nativeReportAdmissionDigest(.object(admission.authoredConfiguration)))
        ]),
        "datasets": .array(admission.datasets.map { .object([
            "id": .string($0.id), "dataSourceRef": .string($0.dataSourceRef), "request": .object($0.request)
        ]) })
    ])
}

public func nativeReportRequestedParams(_ admission: NativeReportAdmission) throws -> [String: JSONValue] {
    guard admission.preparation.request[nativeReportAdmissionKey] == nil else {
        throw ReportPreparationError(reason: "reserved-admission-query-key")
    }
    var requested = admission.preparation.request
    requested[nativeReportAdmissionKey] = try nativeReportAdmissionContext(admission)
    return requested
}

/// Pure verification against the current authored inputs. This neither dispatches
/// data reads nor installs a runtime acknowledgment.
public func restoredNativeReportAdmission(namespace: JSONValue, primaryRequest: [String: JSONValue], authorState: [String: JSONValue], document: [String: JSONValue], configuration: [String: JSONValue], conversationID: String, windowID: String, builderRef: String, stateKey: String, primaryDataSourceRef: String, prefillIdentity: [String: JSONValue] = ["prefill": .null, "prefillRevision": .number(0)]) throws -> NativeReportAdmission {
    func reject(_ reason: String) -> ReportPreparationError { ReportPreparationError(reason: reason) }
    guard let value = namespace.objectValue, value["version"] == .number(1), value["calendar"] == .string("gregorian"),
          value["builderRef"] == .string(builderRef), value["stateKey"] == .string(stateKey), value["primaryDataSourceRef"] == .string(primaryDataSourceRef),
          let state = value["state"]?.objectValue, let digests = value["digests"]?.objectValue,
          digests["profile"] == .string(nativeReportDigestProfile) else { throw reject("admission-source-mismatch") }
    for (key, input) in [("prefill", prefillIdentity), ("authorState", authorState), ("policyState", state), ("document", document), ("configuration", configuration)] {
        guard digests[key] == .string(try nativeReportAdmissionDigest(.object(input))) else { throw reject("admission-\(key)-mismatch") }
    }
    guard let timestamp = value["preparedAt"]?.stringValue, let zone = value["timeZone"]?.stringValue,
          TimeZone.knownTimeZoneIdentifiers.contains(zone) || zone == "UTC", let timeZone = TimeZone(identifier: zone) else { throw reject("unsupported-admission-clock") }
    let formatter = ISO8601DateFormatter()
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let date = formatter.date(from: timestamp), formatter.string(from: date) == timestamp else { throw reject("unsupported-admission-clock") }
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    let config = try JSONDecoder().decode(DashboardReportBuilderDef.self, from: JSONEncoder().encode(JSONValue.object(configuration)))
    let identity = PreparedReportIdentity(windowId: windowID, builderRef: builderRef, formRevision: .string("restored-admission"), stateRevision: .string("restored-admission"), stateKey: stateKey)
    let packet = PreparedReportRequest(identity: identity, status: "ready", hookStatus: "completed", dataSourceRef: primaryDataSourceRef, request: primaryRequest, state: state, config: config, preparedAt: date, preparedCalendar: calendar)
    guard case .array(let bindings) = value["datasets"], !bindings.isEmpty else { throw reject("missing-admission-datasets") }
    var ids = Set<String>()
    let datasets = try bindings.map { raw -> NativeReportDatasetAdmission in
        guard let item = raw.objectValue, Set(item.keys) == Set(["id", "dataSourceRef", "request"]),
              let id = item["id"]?.stringValue, !id.isEmpty, ids.insert(id).inserted,
              let ref = item["dataSourceRef"]?.stringValue, !ref.isEmpty, let request = item["request"]?.objectValue else { throw reject("invalid-admission-dataset") }
        if id == "primary" {
            guard ref == primaryDataSourceRef, request == primaryRequest else { throw reject("admission-primary-mismatch") }
        } else {
            let sources = config.dataSources.filter { $0.id == id && $0.dataSourceRef == ref }
            guard sources.count == 1, try packet.publishedRequest(sources[0], current: identity) == request else { throw reject("admission-published-request-mismatch") }
        }
        return NativeReportDatasetAdmission(id: id, dataSourceRef: ref, request: request)
    }
    var documentRefs = Set<String>()
    func collect(_ value: JSONValue) {
        if let object = value.objectValue {
            if let ref = object["datasetRef"]?.stringValue, !ref.isEmpty { documentRefs.insert(ref) }
            for child in object.values { collect(child) }
        } else if case .array(let children) = value { children.forEach(collect) }
    }
    collect(document["blocks"] ?? .array([]))
    guard documentRefs == ids else { throw reject("admission-document-datasets-mismatch") }
    return NativeReportAdmission(preparation: packet, conversationID: conversationID, stateKey: stateKey, document: document, datasets: datasets, authoredConfiguration: configuration, authorState: authorState, prefillIdentity: prefillIdentity)
}

/// Select only the declared builder state, preserving original authored fields.
public func nativeReportSelectedDocument(_ form: [String: JSONValue], stateKey: String) -> [String: JSONValue]? {
    let definition = form["reportDefinition"]?.objectValue
    let state = reportPreparationValue(form, path: stateKey)?.objectValue
    var document = state?["reportDocument"]?.objectValue ?? state?["documentPatch"]?.objectValue
        ?? definition?["documentPatch"]?.objectValue ?? definition?["reportDocument"]?.objectValue
        ?? form["documentPatch"]?.objectValue ?? form["reportDocument"]?.objectValue
    if case .array(let blocks) = state?["reportDocumentBlocks"], !blocks.isEmpty {
        if document == nil { document = [:] }
        document?["blocks"] = .array(blocks)
    }
    guard let result = document, case .array(let blocks) = result["blocks"], !blocks.isEmpty else { return nil }
    return result
}
