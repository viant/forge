import Foundation

public struct InlineReportWorkspaceDatasetRequest: Equatable, Sendable {
    public let id: String
    public let dataSourceRef: String
    public let inputs: [String: JSONValue]

    public init(id: String, dataSourceRef: String, inputs: [String: JSONValue] = [:]) {
        self.id = id
        self.dataSourceRef = dataSourceRef
        self.inputs = inputs
    }
}

public struct InlineReportRuntimeArtifact: Sendable {
    public let reportSpec: JSONValue
    public let reportFill: JSONValue
    public let metadata: WindowMetadata

    public init(reportSpec: JSONValue, reportFill: JSONValue, metadata: WindowMetadata) {
        self.reportSpec = reportSpec
        self.reportFill = reportFill
        self.metadata = metadata
    }
}

public enum InlineReportRuntimeCompilerError: LocalizedError, Sendable {
    case invalidSource
    case unsupportedGrammar(String)
    case unavailableStatus(String)

    public var errorDescription: String? {
        switch self {
        case .invalidSource:
            return "Inline report source must be a JSON object."
        case .unsupportedGrammar(let grammar):
            return "Unsupported inline report grammar '\(grammar)'."
        case .unavailableStatus(let status):
            return "Inline report is \(status) and cannot be rendered."
        }
    }
}

/// Compiles the portable inline-report envelope into Forge's existing native
/// report runtime. Hosts own placement and datasource transport only.
public enum InlineReportRuntimeCompiler {
    public static func workspaceDatasetRequests(
        _ report: TranscriptCanonicalReport
    ) -> [InlineReportWorkspaceDatasetRequest] {
        guard let source = report.source.objectValue else { return [] }
        let materialized = Set(report.dataSources.keys)
        return sourceDeclarations(source).compactMap { declaration in
            guard declaration["kind"]?.stringValue?.lowercased() == "workspaceref",
                  let id = nonEmpty(declaration["id"]?.stringValue),
                  !materialized.contains(id) else { return nil }
            let dataSourceRef = nonEmpty(declaration["dataSourceRef"]?.stringValue)
                ?? nonEmpty(declaration["sourceRef"]?.stringValue)
                ?? id
            let inputs = declaration["request"]?.objectValue
                ?? declaration["inputs"]?.objectValue
                ?? [:]
            return InlineReportWorkspaceDatasetRequest(id: id, dataSourceRef: dataSourceRef, inputs: inputs)
        }
    }

    public static func compile(_ report: TranscriptCanonicalReport) throws -> InlineReportRuntimeArtifact {
        let status = report.status.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !status.isEmpty && status != "committed" && status != "ready" {
            throw InlineReportRuntimeCompilerError.unavailableStatus(status)
        }
        guard let source = report.source.objectValue else {
            throw InlineReportRuntimeCompilerError.invalidSource
        }
        let grammar = report.grammar.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard grammar == "report-document-v1" || grammar == "dashboard-v1" else {
            throw InlineReportRuntimeCompilerError.unsupportedGrammar(grammar)
        }

        let blocks = grammar == "dashboard-v1"
            ? adaptDashboardBlocks(source["blocks"]?.arrayValue ?? [])
            : (source["blocks"]?.arrayValue ?? [])
        let title = nonEmpty(source["title"]?.stringValue) ?? humanize(report.id)
        let subtitle = nonEmpty(source["subtitle"]?.stringValue)
        let datasetDeclarations = sourceDeclarations(source).map(JSONValue.object)
        let blockOrder = layoutBlockOrder(source: source, blocks: blocks)

        var reportSpecObject = source
        reportSpecObject["kind"] = .string("reportSpec")
        reportSpecObject["id"] = .string(report.id)
        reportSpecObject["title"] = .string(title)
        reportSpecObject["blocks"] = .array(blocks)
        reportSpecObject["datasets"] = .array(datasetDeclarations)
        reportSpecObject["layoutIntent"] = .object(["blockOrder": .array(blockOrder.map(JSONValue.string))])

        let datasetRows = normalizedDatasetRows(report.dataSources)
        let fillDatasets = datasetRows.keys.sorted().map { id -> JSONValue in
            let rows = datasetRows[id] ?? []
            return .object([
                "id": .string(id),
                "rows": .array(rows),
                "provenance": .object(["rowCount": .number(Double(rows.count))])
            ])
        }
        let fillBlocks = blocks.map { materializeBlock($0, datasets: datasetRows) }
        let reportFill: JSONValue = .object([
            "kind": .string("reportFill"),
            "reportId": .string(report.id),
            "datasets": .array(fillDatasets),
            "blocks": .array(fillBlocks),
            "diagnostics": .array([])
        ])
        let reportSpec = JSONValue.object(reportSpecObject)
        var runtime: [String: JSONValue] = [
            "title": .string(title),
            "reportSpec": reportSpec,
            "reportFill": reportFill
        ]
        if let subtitle { runtime["subtitle"] = .string(subtitle) }
        let metadata = WindowMetadata(
            namespace: "forge.inline-report",
            view: ViewDef(content: ContentDef(containers: [
                ContainerDef(
                    id: "inline-report-runtime",
                    title: title,
                    subtitle: subtitle,
                    kind: "dashboard.reportRuntime",
                    reportRuntime: .object(runtime)
                )
            ]))
        )
        return InlineReportRuntimeArtifact(reportSpec: reportSpec, reportFill: reportFill, metadata: metadata)
    }

    private static func normalizedDatasetRows(
        _ dataSources: [String: TranscriptCanonicalData]
    ) -> [String: [JSONValue]] {
        Dictionary(uniqueKeysWithValues: dataSources.map { key, source in
            let id = nonEmpty(source.id) ?? key
            let payload = TranscriptEnvelope.materializeCanonicalPayload(format: source.format, payload: source.payload)
            let rows: [JSONValue]
            if let array = payload?.arrayValue {
                rows = array
            } else if let object = payload?.objectValue {
                rows = [.object(object)]
            } else {
                rows = []
            }
            return (id, rows)
        })
    }

    private static func materializeBlock(
        _ block: JSONValue,
        datasets: [String: [JSONValue]]
    ) -> JSONValue {
        guard var object = block.objectValue else { return block }
        var content = object["content"]?.objectValue ?? object
        let kind = object["kind"]?.stringValue ?? ""
        if kind == "markdownBlock", content["markdown"] == nil {
            content["markdown"] = object["markdown"] ?? .string("")
        }
        if kind == "kpiBlock" {
            let datasetRef = object["datasetRef"]?.stringValue ?? ""
            let row = datasets[datasetRef]?.first?.objectValue
            let valueField = object["valueField"]?.stringValue
            let secondaryField = object["secondaryField"]?.stringValue
            content["value"] = valueField.flatMap { row?[$0] } ?? .null
            content["secondaryValue"] = secondaryField.flatMap { row?[$0] } ?? .null
            content["rowCount"] = .number(Double(datasets[datasetRef]?.count ?? 0))
        }
        object["content"] = .object(content)
        return .object(object)
    }

    private static func adaptDashboardBlocks(_ blocks: [JSONValue]) -> [JSONValue] {
        blocks.flatMap { block -> [JSONValue] in
            guard var object = block.objectValue else { return [] }
            let kind = object["kind"]?.stringValue ?? ""
            switch kind {
            case "dashboard.table", "dashboard.kpiTable":
                object["kind"] = .string("tableBlock")
            case "dashboard.timeline", "dashboard.dimensions", "dashboard.composition":
                object["kind"] = .string("chartBlock")
                object["xField"] = object["xField"] ?? object["dateField"] ?? object["categoryKey"] ?? object["timeKey"]
                object["measures"] = object["measures"] ?? object["series"] ?? object["valueKey"].map { .array([$0]) }
            case "dashboard.filters":
                object["kind"] = .string("filterBarBlock")
            case "dashboard.summary":
                let metrics = object["metrics"]?.arrayValue ?? []
                return metrics.enumerated().compactMap { index, metric in
                    guard let value = metric.objectValue else { return nil }
                    let selector = value["selector"]?.stringValue?.replacingOccurrences(of: "0.", with: "")
                    let summaryID = object["id"]?.stringValue ?? "summary"
                    let metricID = value["id"] ?? .string("\(summaryID)-\(index + 1)")
                    let metricTitle = value["label"] ?? object["title"] ?? .string("KPI")
                    let datasetRef = object["dataSourceRef"] ?? .null
                    let valueField = selector.map(JSONValue.string) ?? .null
                    let valueLabel = value["label"] ?? .string("Value")
                    let valueFormat = value["format"] ?? .null
                    return .object([
                        "id": metricID,
                        "kind": .string("kpiBlock"),
                        "title": metricTitle,
                        "datasetRef": datasetRef,
                        "valueField": valueField,
                        "valueLabel": valueLabel,
                        "valueFormat": valueFormat
                    ])
                }
            case "dashboard.report":
                object["kind"] = .string("sectionBlock")
            case "dashboard.messages":
                object["kind"] = .string("collectionBlock")
            default:
                break
            }
            return [.object(object)]
        }
    }

    private static func sourceDeclarations(_ source: [String: JSONValue]) -> [[String: JSONValue]] {
        var result: [[String: JSONValue]] = []
        for key in ["datasets", "dataSources"] {
            if let values = source[key]?.arrayValue {
                result.append(contentsOf: values.compactMap(\.objectValue))
            } else if let values = source[key]?.objectValue {
                result.append(contentsOf: values.map { id, value in
                    var declaration = value.objectValue ?? [:]
                    declaration["id"] = declaration["id"] ?? .string(id)
                    return declaration
                })
            }
        }
        var seen = Set<String>()
        return result.filter { declaration in
            guard let id = nonEmpty(declaration["id"]?.stringValue), seen.insert(id).inserted else { return false }
            return true
        }
    }

    private static func layoutBlockOrder(source: [String: JSONValue], blocks: [JSONValue]) -> [String] {
        let ordered = source["layout"]?.objectValue?["items"]?.arrayValue?.compactMap {
            $0.objectValue?["blockId"]?.stringValue
        } ?? []
        return ordered.isEmpty ? blocks.compactMap { $0.objectValue?["id"]?.stringValue } : ordered
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func humanize(_ value: String) -> String {
        value.replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }
}
