import SwiftUI
import ForgeIOSRuntime

func reportBuilderAuthoredDocument(_ windowForm: [String: JSONValue], stateKey: String? = nil) -> [String: JSONValue]? {
    let definition = windowForm["reportDefinition"]?.objectValue
    let definitionDocument = definition?["documentPatch"]?.objectValue
        ?? definition?["reportDocument"]?.objectValue
    let stateContainers = stateKey.flatMap { reportPreparationValue(windowForm, path: $0)?.objectValue }.map { [$0] } ?? []
    let stateBlocks = stateContainers.compactMap {
        $0["reportDocumentBlocks"]?.arrayValue
    }.first { !$0.isEmpty }
    let nestedDocument = stateContainers.compactMap {
        $0["reportDocument"]?.objectValue ?? $0["documentPatch"]?.objectValue
    }.first
    var stateDocument = nestedDocument ?? definitionDocument
    if let stateBlocks {
        var next = stateDocument ?? [:]
        next["blocks"] = .array(stateBlocks)
        stateDocument = next
    }
    let candidates = [
        stateDocument,
        definition?["documentPatch"]?.objectValue,
        definition?["reportDocument"]?.objectValue,
        windowForm["documentPatch"]?.objectValue,
        windowForm["reportDocument"]?.objectValue
    ]
    return candidates.compactMap { $0 }.first { !($0["blocks"]?.arrayValue ?? []).isEmpty }
}

func reportBuilderAuthoredDatasetRefs(_ document: [String: JSONValue]) -> [String] {
    var seen = Set<String>()
    var result: [String] = []
    func collect(_ value: JSONValue) {
        if let object = value.objectValue {
            if let ref = nonBlankAuthored(object["datasetRef"]?.stringValue), seen.insert(ref).inserted {
                result.append(ref)
            }
            for key in object.keys.sorted() where key != "datasetRef" { collect(object[key]!) }
        } else {
            for child in value.arrayValue ?? [] { collect(child) }
        }
    }
    collect(.array(document["blocks"]?.arrayValue ?? []))
    return result
}

func reportBuilderPublishedSources(
    config: DashboardReportBuilderDef,
    document: [String: JSONValue]
) -> [ReportBuilderPublishedDataSourceDef] {
    let ordered = reportBuilderAuthoredDatasetRefs(document).filter { $0 != "primary" }
    let order = ordered.enumerated().reduce(into: [String: Int]()) { result, entry in
        if result[entry.element] == nil {
            result[entry.element] = entry.offset
        }
    }
    var seen = Set<String>()
    return config.dataSources
        .filter { order[$0.id] != nil }
        .filter { seen.insert($0.id).inserted }
        .sorted {
            let left = reportBuilderPublishedFetchPriority($0)
            let right = reportBuilderPublishedFetchPriority($1)
            return left == right ? (order[$0.id] ?? .max) < (order[$1.id] ?? .max) : left < right
        }
}

func reportBuilderPublishedFetchPriority(_ source: ReportBuilderPublishedDataSourceDef) -> Int {
    let dimensions = source.request["dimensions"]?.objectValue
        ?? Dictionary(uniqueKeysWithValues: source.fields.compactMap { field in
            guard field["kind"]?.stringValue == "dimension",
                  let key = nonBlankAuthored(field["key"]?.stringValue) else { return nil }
            return (key, .bool(true))
        })
    let limit: Int?
    switch source.request["limit"] {
    case .number(let value): limit = Int(value)
    case .string(let value): limit = Int(value)
    default: limit = nil
    }
    guard dimensions.isEmpty else { return 1 }
    if let limit {
        return limit <= 1 ? 0 : 1
    }
    // Hosted report payloads may publish the field catalog while deliberately
    // omitting the writable request. A field-only dataset with no dimensions
    // is still an aggregate/KPI request and should populate before charts and
    // detail tables.
    return source.fields.isEmpty ? 1 : 0
}

func reportBuilderPublishedRequest(
    primaryRequest: [String: JSONValue],
    declaration: ReportBuilderPublishedDataSourceDef,
    now: Date = Date(),
    calendar: Calendar = .current
) -> [String: JSONValue] {
    var inherited: [String: JSONValue] = [:]
    for key in ["filters", "refinements", "timeoutMs", "options"] where primaryRequest[key] != nil {
        inherited[key] = primaryRequest[key]
    }
    let generated = reportBuilderPublishedFieldRequest(
        fields: declaration.fields,
        primaryRequest: primaryRequest
    )
    var result = mergeAuthoredObjects(inherited, mergeAuthoredObjects(generated, declaration.request))
    guard let relative = declaration.scope["relativeDateRange"]?.objectValue,
          let range = reportBuilderRelativeDateRange(
            preset: relative["preset"]?.stringValue,
            now: now,
            calendar: calendar
          ) else {
        return result
    }
    if let path = nonBlankAuthored(relative["startParamPath"]?.stringValue) {
        setAuthoredNestedValue(&result, path: path, value: .string(range.start))
    }
    if let path = nonBlankAuthored(relative["endParamPath"]?.stringValue) {
        setAuthoredNestedValue(&result, path: path, value: .string(range.end))
    }
    return result
}

private func reportBuilderPublishedFieldRequest(
    fields: [[String: JSONValue]],
    primaryRequest: [String: JSONValue]
) -> [String: JSONValue] {
    guard !fields.isEmpty else { return [:] }
    let dimensions: [String: JSONValue] = Dictionary(uniqueKeysWithValues: fields.compactMap { field -> (String, JSONValue)? in
        guard field["kind"]?.stringValue == "dimension",
              let key = nonBlankAuthored(field["key"]?.stringValue) else { return nil }
        return (key, .bool(true))
    })
    let measures: [String: JSONValue] = Dictionary(uniqueKeysWithValues: fields.compactMap { field -> (String, JSONValue)? in
        guard field["kind"]?.stringValue == "measure",
              let key = nonBlankAuthored(field["key"]?.stringValue) else { return nil }
        return (key, .bool(true))
    })
    var result: [String: JSONValue] = [
        "dimensions": .object(dimensions),
        "measures": .object(measures),
        "offset": .number(0),
        "limit": dimensions.isEmpty ? .number(1) : (primaryRequest["limit"] ?? .number(100))
    ]
    if let firstDimension = dimensions.keys.first {
        let orderField = measures["totalSpend"] != nil ? "totalSpend desc" : "\(firstDimension) asc"
        result["orderBy"] = .array([.string(orderField)])
    }
    return result
}

func reportBuilderMaterializeComputedRows(
    _ rows: [[String: JSONValue]],
    fields: [[String: JSONValue]],
    config: DashboardReportBuilderDef,
    requiredFields: Set<String> = []
) -> [[String: JSONValue]] {
    let computed = Set(fields.compactMap { field -> String? in
        guard field["kind"]?.stringValue == "computedMeasure" else { return nil }
        return nonBlankAuthored(field["key"]?.stringValue)
    }).union(requiredFields)
    guard !computed.isEmpty else { return rows }
    return rows.map { row in
        var result = row
        for measure in config.computedMeasures where computed.contains(measure.identityKey) {
            let existing = result[measure.identityKey]
            guard existing == nil || existing == .null,
                  let compute = measure.compute,
                  (compute.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "ratio",
                  let numerator = compute.numerator,
                  let denominator = compute.denominator,
                  let denominatorValue = authoredNumber(result[denominator]),
                  denominatorValue != 0 else { continue }
            var value = (authoredNumber(result[numerator]) ?? 0) / denominatorValue * (compute.scale ?? 1)
            if let decimals = compute.decimals {
                let factor = pow(10.0, Double(max(0, decimals)))
                value = (value * factor).rounded() / factor
            }
            result[measure.identityKey] = .number(value)
        }
        return result
    }
}

private func reportBuilderAuthoredComputedFields(
    document: [String: JSONValue],
    datasetID: String,
    config: DashboardReportBuilderDef
) -> Set<String> {
    let computed = Set(config.computedMeasures.map(\.identityKey))
    var referenced = Set<String>()
    func collect(_ value: JSONValue) {
        switch value {
        case .string(let string):
            if computed.contains(string) { referenced.insert(string) }
        case .array(let values): values.forEach(collect)
        case .object(let object): object.values.forEach(collect)
        default: break
        }
    }
    for block in document["blocks"]?.arrayValue ?? [] {
        guard let object = block.objectValue,
              object["datasetRef"]?.stringValue == datasetID else { continue }
        collect(.object(object))
    }
    return referenced
}

private func authoredNumber(_ value: JSONValue?) -> Double? {
    switch value {
    case .number(let number): return number
    case .string(let string): return Double(string)
    default: return nil
    }
}

func materializeReportBuilderAuthoredDocument(_ document: [String: JSONValue], fieldsByDataset: [String: [[String: JSONValue]]] = [:]) -> [String: JSONValue] {
    ReportChartMaterializer.materialize(document, fieldsByDataset: fieldsByDataset)
}

func authoredReportLoadErrorMessage(_ error: String) -> String {
    let detail = error.lowercased()
    if detail.contains("504") || detail.contains("gateway time-out") {
        return "Report data took too long to load. Try refreshing."
    }
    if detail.contains("timeout") || detail.contains("timed out") {
        return "Some report data did not respond. Try refreshing."
    }
    return "Some report data could not be loaded. Try refreshing."
}

struct ReportBuilderAuthoredResult: View {
    let runtime: ForgeRuntime
    let window: WindowContext
    let dashboardRoot: ContainerDef
    let config: DashboardReportBuilderDef
    let document: [String: JSONValue]
    let primaryRows: [[String: JSONValue]]
    let primaryControl: ControlState
    let primaryRequest: [String: JSONValue]
    let runRequestID: String?
    let preparedRequest: PreparedReportRequest?

    @State private var rowsByID: [String: [[String: JSONValue]]] = [:]
    @State private var controlsByID: [String: ControlState] = [:]
    @State private var activationWarning: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let error = visibleError {
                Label(authoredReportLoadErrorMessage(error), systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
            if let activationWarning {
                Label(activationWarning, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(.orange)
                    .accessibilityIdentifier("forge-report-activation-warning")
            }
            if isLoading {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("Loading report data…").font(.subheadline).foregroundStyle(.secondary)
                }
                .accessibilityIdentifier("forge-authored-report-loading")
            }
            if let container = runtimeContainer,
               hasMaterializedRows || !isLoading || visibleError != nil {
                DashboardRenderer(runtime: runtime, window: window, container: container)
            }
        }
        .task(id: materializationTaskID) {
            await loadPublishedDatasets()
        }
    }

    private var declarations: [ReportBuilderPublishedDataSourceDef] {
        reportBuilderPublishedSources(config: config, document: document)
    }

    private var allRows: [String: [[String: JSONValue]]] {
        var result = rowsByID
        if reportBuilderAuthoredDatasetRefs(document).contains("primary"), result["primary"] == nil {
            result["primary"] = primaryRows
        }
        return result
    }

    private var allControls: [ControlState] {
        var result = Array(controlsByID.values)
        if reportBuilderAuthoredDatasetRefs(document).contains("primary") {
            result.append(primaryControl)
        }
        return result
    }

    private var isLoading: Bool { allControls.contains { $0.loading } }
    private var hasMaterializedRows: Bool { allRows.values.contains { !$0.isEmpty } }
    private var visibleError: String? { allControls.compactMap(\.error).first { !$0.isEmpty } }

    private var runtimeContainer: ContainerDef? {
        let prepared = materializeReportBuilderAuthoredDocument(document, fieldsByDataset: Dictionary(config.dataSources.map { ($0.id, $0.fields) }, uniquingKeysWith: { first, _ in first }))
        let sources = allRows.mapValues { rows in
            rows.map(JSONValue.object)
        }
        guard let artifact = try? InlineReportRuntimeCompiler.compile(
            TranscriptCanonicalReport(
                scope: "report-builder",
                id: "\(window.windowID)-authored-report",
                grammar: "report-document-v1",
                status: "ready",
                source: .object(prepared),
                dataSources: Dictionary(uniqueKeysWithValues: sources.map { id, rows in
                    (id, TranscriptCanonicalData(id: id, format: "json", payload: .array(rows)))
                })
            ),
            reportOptions: config.reportOptions, optionValues: primaryRequest["options"]?.objectValue ?? [:]
        ) else { return nil }
        return artifact.metadata.view?.content?.containers.first
    }

    private var requestSignature: String {
        let declarationSignature = declarations.map { "\($0.id):\($0.request.jsonSignature):\($0.scope.jsonSignature)" }.joined(separator: "|")
        return primaryRequest.jsonSignature + "::" + declarationSignature
    }

    private var materializationTaskID: String {
        requestSignature + "::" + (nonBlankAuthored(runRequestID) ?? "auto") + "::" + (preparedRequest.map { reportPreparationFingerprint($0.identity.stateRevision) } ?? "pending")
    }

    @MainActor
    private func loadPublishedDatasets() async {
        let explicitRequest = nonBlankAuthored(runRequestID)
        if let cached = await runtime.completedNativeReportDatasets(windowID: window.windowID),
           !Task.isCancelled, explicitRequest == nil || explicitRequest == cached.requestID,
           Set(cached.rows.keys).isSuperset(of: reportBuilderAuthoredDatasetRefs(document)) {
            activationWarning = cached.activationWarning
            rowsByID = cached.rows
            controlsByID = Dictionary(uniqueKeysWithValues: cached.rows.keys.map { ($0, ControlState(loading: false)) })
            return
        }
        activationWarning = nil
        guard let requestID = explicitRequest, let packet = preparedRequest else { rowsByID = [:]; controlsByID = [:]; return }
        rowsByID = [:]
        controlsByID = ["materialization": ControlState(loading: true)]
        let capturedConfig = config
        let capturedDocument = document
        do {
            let result = try await runtime.materializeNativeReportRun(requestID: requestID) { id, rows in
                let fields = capturedConfig.dataSources.first { $0.id == id }?.fields ?? []
                return reportBuilderMaterializeComputedRows(rows, fields: fields, config: capturedConfig, requiredFields: reportBuilderAuthoredComputedFields(document: capturedDocument, datasetID: id, config: capturedConfig))
            }
            guard !Task.isCancelled, packet.validate(current: await runtime.reportPreparationIdentity(windowID: window.windowID, builderRef: packet.identity.builderRef, stateKey: packet.identity.stateKey)) == nil else { return }
            activationWarning = result.completed.activationError
            rowsByID = result.rows
            controlsByID = Dictionary(uniqueKeysWithValues: result.rows.keys.map { ($0, ControlState(loading: false)) })
        } catch {
            if !Task.isCancelled { controlsByID = ["materialization": ControlState(loading: false, error: error.localizedDescription)] }
        }
    }


}

private func reportBuilderRelativeDateRange(
    preset: String?,
    now: Date,
    calendar: Calendar
) -> (start: String, end: String)? {
    let key = (preset ?? "").lowercased().replacingOccurrences(of: "_", with: "")
    let today = calendar.startOfDay(for: now)
    let offsets: (Int, Int)?
    switch key {
    case "today": offsets = (0, 0)
    case "yesterday": offsets = (-1, -1)
    case "last3days", "3d": offsets = (-2, 0)
    case "last7days", "7d": offsets = (-6, 0)
    case "last30days", "30d": offsets = (-29, 0)
    default: offsets = nil
    }
    guard let offsets,
          let start = calendar.date(byAdding: .day, value: offsets.0, to: today),
          let end = calendar.date(byAdding: .day, value: offsets.1, to: today) else { return nil }
    let formatter = DateFormatter()
    formatter.calendar = calendar
    formatter.timeZone = calendar.timeZone
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return (formatter.string(from: start), formatter.string(from: end))
}

private func mergeAuthoredObjects(
    _ inherited: [String: JSONValue],
    _ declared: [String: JSONValue]
) -> [String: JSONValue] {
    var result = inherited
    for (key, value) in declared {
        if let left = result[key]?.objectValue, let right = value.objectValue {
            result[key] = .object(mergeAuthoredObjects(left, right))
        } else {
            result[key] = value
        }
    }
    return result
}

private func setAuthoredNestedValue(_ object: inout [String: JSONValue], path: String, value: JSONValue) {
    let parts = path.split(separator: ".").map(String.init).filter { !$0.isEmpty }
    guard let head = parts.first else { return }
    if parts.count == 1 { object[head] = value; return }
    var child = object[head]?.objectValue ?? [:]
    setAuthoredNestedValue(&child, path: parts.dropFirst().joined(separator: "."), value: value)
    object[head] = .object(child)
}

private func nonBlankAuthored(_ value: String?) -> String? {
    let result = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return result.isEmpty ? nil : result
}

private extension Dictionary where Key == String, Value == JSONValue {
    var jsonSignature: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(self) else { return "" }
        return String(decoding: data, as: UTF8.self)
    }
}
