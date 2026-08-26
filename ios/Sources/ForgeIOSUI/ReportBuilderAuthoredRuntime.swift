import SwiftUI
import ForgeIOSRuntime

func reportBuilderAuthoredDocument(_ windowForm: [String: JSONValue]) -> [String: JSONValue]? {
    let definition = windowForm["reportDefinition"]?.objectValue
    let definitionDocument = definition?["documentPatch"]?.objectValue
        ?? definition?["reportDocument"]?.objectValue
    let stateContainers = windowForm.values.compactMap(\.objectValue)
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
    (document["blocks"]?.arrayValue ?? []).compactMap {
        nonBlankAuthored($0.objectValue?["datasetRef"]?.stringValue)
    }
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
    for key in ["filters", "refinements", "timeoutMs"] where primaryRequest[key] != nil {
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
    config: DashboardReportBuilderDef
) -> [[String: JSONValue]] {
    let computed = Set(fields.compactMap { field -> String? in
        guard field["kind"]?.stringValue == "computedMeasure" else { return nil }
        return nonBlankAuthored(field["key"]?.stringValue)
    })
    guard !computed.isEmpty else { return rows }
    return rows.map { row in
        var result = row
        for measure in config.computedMeasures where computed.contains(measure.identityKey) {
            guard result[measure.identityKey] == nil,
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

private func authoredNumber(_ value: JSONValue?) -> Double? {
    switch value {
    case .number(let number): return number
    case .string(let string): return Double(string)
    default: return nil
    }
}

func materializeReportBuilderAuthoredDocument(_ document: [String: JSONValue]) -> [String: JSONValue] {
    var result = document
    result["blocks"] = .array((document["blocks"]?.arrayValue ?? []).map { value in
        guard var block = value.objectValue,
              block["kind"]?.stringValue == "chartBlock",
              block["chartModel"] == nil,
              let spec = block["chartSpec"]?.objectValue,
              let xField = nonBlankAuthored(spec["xField"]?.stringValue) else {
            return value
        }
        let yFields = (spec["yFields"]?.arrayValue ?? []).compactMap { nonBlankAuthored($0.stringValue) }
        guard !yFields.isEmpty else { return value }
        let authoredType = spec["type"]?.stringValue?.lowercased() ?? ""
        let type: String
        switch authoredType {
        case "horizontal_bar", "horizontalbar", "column": type = "bar"
        case "stackedbar": type = "stacked_bar"
        default: type = authoredType.isEmpty ? "line" : authoredType
        }
        block["chartModel"] = .object([
            "title": spec["title"] ?? block["title"] ?? .null,
            "type": .string(type),
            "xAxis": .object(["dataKey": .string(xField)]),
            "yAxis": .object(["label": spec["yLabel"] ?? .null]),
            "series": .object(["values": .array(yFields.map { field in
                .object(["name": .string(field), "value": .string(field)])
            })])
        ])
        return .object(block)
    })
    return result
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

    @State private var rowsByID: [String: [[String: JSONValue]]] = [:]
    @State private var controlsByID: [String: ControlState] = [:]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let error = visibleError {
                Label(authoredReportLoadErrorMessage(error), systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(.red)
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
        if reportBuilderAuthoredDatasetRefs(document).contains("primary") {
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
        let prepared = materializeReportBuilderAuthoredDocument(document)
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
            )
        ) else { return nil }
        return artifact.metadata.view?.content?.containers.first
    }

    private var requestSignature: String {
        let declarationSignature = declarations.map { "\($0.id):\($0.request.jsonSignature):\($0.scope.jsonSignature)" }.joined(separator: "|")
        return primaryRequest.jsonSignature + "::" + declarationSignature
    }

    private var materializationTaskID: String {
        requestSignature + "::" + (nonBlankAuthored(runRequestID) ?? "auto")
    }

    @MainActor
    private func loadPublishedDatasets() async {
        let requestID = nonBlankAuthored(runRequestID) ?? "native-\(UUID().uuidString)"
        await publishMaterialization(
            requestID: requestID,
            status: "running",
            rowsByID: [:],
            errors: []
        )
        rowsByID = [:]
        controlsByID = [:]
        var loadedRows: [String: [[String: JSONValue]]] = [:]
        var loadErrors: [String] = []
        if reportBuilderAuthoredDatasetRefs(document).contains("primary") {
            loadedRows["primary"] = primaryRows
            if let error = primaryControl.error, !error.isEmpty {
                loadErrors.append(error)
            }
        }
        for declaration in declarations {
            guard !Task.isCancelled else { return }
            controlsByID[declaration.id] = ControlState(loading: true)
            let request = reportBuilderPublishedRequest(primaryRequest: primaryRequest, declaration: declaration)
            let instanceRef = "reportDocument:\(declaration.id)"
            await runtime.fetchDataSourceInstance(
                windowID: window.windowID,
                instanceRef: instanceRef,
                dataSourceRef: declaration.dataSourceRef,
                parameters: request
            )
            guard !Task.isCancelled else { return }
            let rows = await runtime.dataSourceCollection(
                windowID: window.windowID,
                dataSourceRef: instanceRef
            )
            let materializedRows = reportBuilderMaterializeComputedRows(
                rows,
                fields: declaration.fields,
                config: config
            )
            rowsByID[declaration.id] = materializedRows
            loadedRows[declaration.id] = materializedRows
            let control = await runtime.dataSourceControl(
                windowID: window.windowID,
                dataSourceRef: instanceRef
            )
            controlsByID[declaration.id] = control
            if let error = control.error, !error.isEmpty {
                loadErrors.append(error)
            }
        }
        await publishMaterialization(
            requestID: requestID,
            status: loadErrors.isEmpty ? "completed" : "failed",
            rowsByID: loadedRows,
            errors: loadErrors
        )
    }

    @MainActor
    private func publishMaterialization(
        requestID: String,
        status: String,
        rowsByID: [String: [[String: JSONValue]]],
        errors: [String]
    ) async {
        let datasets = rowsByID.keys.sorted().map { id in
            JSONValue.object([
                "id": .string(id),
                "dataSourceRef": .string(id),
                "rows": .array((rowsByID[id] ?? []).map(JSONValue.object))
            ])
        }
        let rowCounts = Dictionary(uniqueKeysWithValues: rowsByID.map { id, rows in
            (id, JSONValue.number(Double(rows.count)))
        })
        var materialization: [String: JSONValue] = [
            "id": .string(requestID),
            "requestId": .string(requestID),
            "status": .string(status),
            "materialized": .bool(status == "completed"),
            "datasetRefs": .array(rowsByID.keys.sorted().map(JSONValue.string)),
            "rowCounts": .object(rowCounts)
        ]
        if !errors.isEmpty {
            materialization["errors"] = .array(errors.map(JSONValue.string))
        }
        var values: [String: JSONValue] = [
            "reportMaterialization": .object(materialization)
        ]
        if status != "running" {
            values["reportStaticDatasets"] = .array(datasets)
        }
        await runtime.setWindowFormValue(
            windowID: window.windowID,
            values: values,
            replace: false
        )
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
