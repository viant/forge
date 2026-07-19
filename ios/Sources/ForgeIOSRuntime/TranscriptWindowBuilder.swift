import Foundation

public struct TranscriptWindowPresentation: Sendable {
    public let metadata: WindowMetadata
    public let dataStore: [String: TranscriptForgeDataStore]

    public init(metadata: WindowMetadata, dataStore: [String: TranscriptForgeDataStore]) {
        self.metadata = metadata
        self.dataStore = dataStore
    }
}

/// Adapts the portable Forge transcript payload into regular Forge window metadata.
/// Host applications own only placement and runtime lifecycle.
public enum TranscriptWindowBuilder {
    public static func presentation(
        payload: TranscriptForgeUIPayload,
        dataStore: [String: TranscriptForgeDataStore]
    ) throws -> TranscriptWindowPresentation {
        let normalizedStore = normalizeDataStore(payload: payload, dataStore: dataStore)
        let containers = try payload.blocks.enumerated().compactMap { index, block in
            try adapt(block, index: index)
        }
        guard !containers.isEmpty else {
            throw TranscriptWindowBuilderError.noRenderableBlocks
        }
        let dataSources = Dictionary(uniqueKeysWithValues: normalizedStore.keys.map { ($0, DataSourceDef()) })
        let metadata = WindowMetadata(
            namespace: "forge.transcript",
            view: ViewDef(content: ContentDef(containers: [
                ContainerDef(
                    id: "transcript-root",
                    title: payload.title,
                    subtitle: payload.subtitle,
                    containers: containers
                )
            ])),
            dataSources: dataSources
        )
        return TranscriptWindowPresentation(metadata: metadata, dataStore: normalizedStore)
    }

    public static func normalizeDataStore(
        payload: TranscriptForgeUIPayload,
        dataStore: [String: TranscriptForgeDataStore]
    ) -> [String: TranscriptForgeDataStore] {
        var result = dataStore
        for block in payload.blocks {
            // A referenced transcript datasource without a matching fence is an
            // explicit empty update, not permission to retain a previous stream's rows.
            if let object = block.objectValue,
               let dataSourceRef = dataSourceRef(for: object),
               result[dataSourceRef] == nil {
                result[dataSourceRef] = TranscriptForgeDataStore(id: dataSourceRef, rows: .array([]))
            }
            guard let object = block.objectValue, let synthetic = synthesizeDataStore(from: object) else { continue }
            result[synthetic.id] = synthetic
        }
        return result
    }

    private static func adapt(_ block: JSONValue, index: Int) throws -> ContainerDef? {
        guard let object = block.objectValue else { return nil }
        switch object["kind"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "" {
        case "planner.table", "dashboard.table", "dashboard.kpiTable":
            let idPrefix = object["kind"]?.stringValue?.replacingOccurrences(of: ".", with: "-") ?? "table"
            let title = object["title"]?.stringValue
            return ContainerDef(
                id: object["id"]?.stringValue ?? "\(idPrefix)-\(index)",
                title: title,
                kind: "table",
                dataSourceRef: dataSourceRef(for: object),
                table: TableDef(title: title, columns: columns(from: object))
            )
        case "dashboard.summary":
            return ContainerDef(
                id: object["id"]?.stringValue ?? "dashboard-summary-\(index)",
                title: object["title"]?.stringValue,
                subtitle: object["subtitle"]?.stringValue,
                kind: "dashboard.summary",
                dataSourceRef: dataSourceRef(for: object),
                metrics: summaryMetrics(from: object)
            )
        case "dashboard.report":
            let sectionPayload = (object["sections"]?.arrayValue ?? []).compactMap { section -> JSONValue? in
                guard let value = section.objectValue else { return nil }
                let body = (value["body"]?.arrayValue ?? []).compactMap(\.stringValue)
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                return .object([
                    "id": value["id"] ?? .null,
                    "title": value["title"] ?? .null,
                    "body": .array(body.map(JSONValue.string)),
                    "tone": value["tone"] ?? .null
                ])
            }
            let sections = try decode([DashboardReportSectionDef].self, from: sectionPayload)
            return ContainerDef(
                id: object["id"]?.stringValue ?? "dashboard-report-\(index)",
                title: object["title"]?.stringValue,
                subtitle: object["subtitle"]?.stringValue,
                kind: "dashboard.report",
                sections: sections
            )
        case "dashboard.filters":
            let items = (object["items"]?.arrayValue ?? []).compactMap { item -> DashboardFilterItemDef? in
                guard let value = item.objectValue else { return nil }
                let options = (value["options"]?.arrayValue ?? []).compactMap { option -> DashboardFilterOptionDef? in
                    guard let optionValue = option.objectValue else { return nil }
                    return DashboardFilterOptionDef(
                        label: optionValue["label"]?.stringValue,
                        value: optionValue["value"]?.stringValue,
                        defaultValue: optionValue["default"]?.boolValue
                    )
                }
                return DashboardFilterItemDef(
                    id: value["id"]?.stringValue,
                    label: value["label"]?.stringValue,
                    field: value["field"]?.stringValue,
                    multiple: value["multiple"]?.boolValue,
                    options: options
                )
            }
            return ContainerDef(
                id: object["id"]?.stringValue ?? "dashboard-filters-\(index)",
                title: object["title"]?.stringValue,
                subtitle: object["subtitle"]?.stringValue,
                kind: "dashboard.filters",
                dashboard: DashboardDef(filters: DashboardFiltersDef(items: items))
            )
        case "dashboard.dimensions":
            let fields = try decode([DashboardFieldDef].self, from: [object["dimension"] ?? .null, object["metric"] ?? .null])
            return ContainerDef(
                id: object["id"]?.stringValue ?? "dashboard-dimensions-\(index)",
                title: object["title"]?.stringValue,
                subtitle: object["subtitle"]?.stringValue,
                kind: "dashboard.dimensions",
                dataSourceRef: dataSourceRef(for: object),
                dimension: fields.first,
                metric: fields.dropFirst().first,
                viewModes: object["viewModes"]?.arrayValue?.compactMap(\.stringValue) ?? [],
                limit: object["limit"]?.intValue,
                orderBy: object["orderBy"]?.stringValue
            )
        case "dashboard.messages":
            let items = (object["items"]?.arrayValue ?? []).compactMap { entry -> ItemDef? in
                guard let value = entry.objectValue else { return nil }
                return ItemDef(
                    id: value["id"]?.stringValue,
                    label: value["label"]?.stringValue,
                    title: value["title"]?.stringValue,
                    body: value["body"]?.stringValue,
                    severity: value["severity"]?.stringValue
                )
            }
            return ContainerDef(
                id: object["id"]?.stringValue ?? "dashboard-messages-\(index)",
                title: object["title"]?.stringValue,
                subtitle: object["subtitle"]?.stringValue,
                kind: "dashboard.messages",
                items: items
            )
        case "dashboard.timeline":
            let xKey = object["dateField"]?.stringValue
                ?? object["timeColumn"]?.stringValue
                ?? object["groupBy"]?.stringValue
                ?? object["seriesColumn"]?.stringValue
                ?? "label"
            let valueKeys = object["series"]?.arrayValue?.compactMap { series -> String? in
                nonEmpty(series.stringValue)
                    ?? series.objectValue.flatMap { value in
                        nonEmpty(value["key"]?.stringValue)
                            ?? nonEmpty(value["id"]?.stringValue)
                            ?? nonEmpty(value["value"]?.stringValue)
                    }
            } ?? [object["valueColumn"]?.stringValue].compactMap { $0 }
            return ContainerDef(
                id: object["id"]?.stringValue ?? "dashboard-timeline-\(index)",
                title: object["title"]?.stringValue,
                subtitle: object["subtitle"]?.stringValue,
                kind: "chart",
                dataSourceRef: dataSourceRef(for: object),
                chart: ChartDef(
                    kind: "chart",
                    title: object["title"]?.stringValue,
                    type: object["chartType"]?.stringValue ?? "bar",
                    xKey: xKey,
                    valueKey: valueKeys.first,
                    nameKey: xKey,
                    series: valueKeys
                )
            )
        default:
            return nil
        }
    }

    private static func synthesizeDataStore(from object: [String: JSONValue]) -> TranscriptForgeDataStore? {
        guard object["kind"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) == "dashboard.summary" else { return nil }
        var row: [String: JSONValue] = [:]
        for item in object["items"]?.arrayValue ?? [] {
            guard let value = item.objectValue else { continue }
            let key = fieldKey(value["key"]?.stringValue ?? value["label"]?.stringValue ?? value["id"]?.stringValue ?? "value")
            row[key] = value["value"] ?? .null
        }
        guard !row.isEmpty else { return nil }
        return TranscriptForgeDataStore(id: syntheticDataSourceRef(for: object), rows: .array([.object(row)]))
    }

    private static func summaryMetrics(from object: [String: JSONValue]) -> [DashboardMetricDef] {
        let declared = object["metrics"]?.arrayValue ?? []
        if !declared.isEmpty {
            return declared.compactMap { metric in
                if let name = metric.stringValue { return DashboardMetricDef(id: name, label: titleize(name), selector: name) }
                guard let value = metric.objectValue else { return nil }
                let selector = value["selector"]?.stringValue ?? value["key"]?.stringValue
                return DashboardMetricDef(
                    id: value["id"]?.stringValue ?? selector,
                    label: value["label"]?.stringValue ?? titleize(selector ?? ""),
                    selector: selector,
                    format: value["format"]?.stringValue
                )
            }
        }
        return (object["items"]?.arrayValue ?? []).compactMap { item in
            guard let value = item.objectValue else { return nil }
            let key = fieldKey(value["key"]?.stringValue ?? value["label"]?.stringValue ?? value["id"]?.stringValue ?? "value")
            return DashboardMetricDef(id: key, label: value["label"]?.stringValue ?? titleize(key), selector: key, format: value["format"]?.stringValue)
        }
    }

    private static func dataSourceRef(for object: [String: JSONValue]) -> String? {
        nonEmpty(object["dataSourceRef"]?.stringValue)
            ?? nonEmpty(object["dataSource"]?.stringValue)
            ?? (object["kind"]?.stringValue == "dashboard.summary" ? syntheticDataSourceRef(for: object) : nil)
    }

    private static func columns(from object: [String: JSONValue]) -> [ColumnDef] {
        (object["columns"]?.arrayValue ?? []).compactMap { column in
            guard let value = column.objectValue,
                  let key = nonEmpty(value["key"]?.stringValue) ?? nonEmpty(value["id"]?.stringValue) else { return nil }
            return ColumnDef(
                id: key,
                name: key,
                label: nonEmpty(value["label"]?.stringValue) ?? titleize(key),
                type: nonEmpty(value["type"]?.stringValue),
                format: nonEmpty(value["format"]?.stringValue),
                link: value["link"]?.objectValue.map { LinkDef(href: nonEmpty($0["href"]?.stringValue)) }
            )
        }
    }

    private static func syntheticDataSourceRef(for object: [String: JSONValue]) -> String {
        "inline_\(fieldKey(nonEmpty(object["id"]?.stringValue) ?? nonEmpty(object["title"]?.stringValue) ?? "transcript-block"))"
    }

    private static func decode<T: Decodable>(_ type: T.Type, from value: [JSONValue]) throws -> T {
        try JSONDecoder().decode(T.self, from: JSONEncoder().encode(value))
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func fieldKey(_ value: String) -> String {
        var words: [String] = []
        var current = ""
        var previous: Character?
        func flush() {
            if !current.isEmpty {
                words.append(current.lowercased())
                current = ""
            }
        }
        for character in value.trimmingCharacters(in: .whitespacesAndNewlines) {
            if character.isLetter || character.isNumber {
                if character.isUppercase && previous?.isLowercase == true {
                    flush()
                }
                current.append(character)
            } else {
                flush()
            }
            previous = character
        }
        flush()
        guard let first = words.first else { return "value" }
        return first + words.dropFirst().map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined()
    }

    private static func titleize(_ value: String) -> String {
        value.replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst().lowercased() }
            .joined(separator: " ")
    }
}

public enum TranscriptWindowBuilderError: Error, Sendable {
    case noRenderableBlocks
}
