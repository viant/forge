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
            "reportFill": reportFill,
            "reportPrint": .object([
                "kind": .string("reportPrint"),
                "title": .string(title)
            ]),
            "reportId": .string(report.id),
            "fences": .array(try exportFences(report))
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

    public static func exportFences(_ report: TranscriptCanonicalReport) throws -> [JSONValue] {
        guard let source = report.source.objectValue else {
            throw InlineReportRuntimeCompilerError.invalidSource
        }
        let exportScope = nonEmpty(source["scope"]?.stringValue) ?? report.scope
        var sequence = 1
        var start = pdfSource(source)
        start["version"] = .number(1)
        start["scope"] = .string(exportScope)
        start["id"] = .string(report.id)
        start["sequence"] = .number(Double(sequence))
        start["mode"] = .string("start")
        start["grammar"] = .string(report.grammar)
        sequence += 1
        var fences: [JSONValue] = [exportFence(kind: "forge-report", index: 0, payload: start)]
        var emittedDatasetIDs = Set<String>()
        for (key, source) in report.dataSources.sorted(by: { $0.key < $1.key }) {
            guard let payload = source.payload else { continue }
            let datasetID = nonEmpty(key) ?? nonEmpty(source.id) ?? key
            let materializedPayload = TranscriptEnvelope.materializeCanonicalPayload(
                format: source.format,
                payload: payload
            )
            let exportPayload = pdfDatasetPayload(materializedPayload ?? payload)
            let data: [String: JSONValue] = [
                "version": .number(Double(source.version ?? 2)),
                "scope": .string(source.scope.flatMap(nonEmpty) ?? exportScope),
                "reportRef": .string(source.reportRef.flatMap(nonEmpty) ?? report.id),
                "sequence": .number(Double(sequence)),
                "id": .string(datasetID),
                "format": .string(materializedPayload == nil ? (nonEmpty(source.format) ?? "json") : "json"),
                "mode": .string("replace"),
                "data": exportPayload
            ]
            fences.append(exportFence(kind: "forge-data", index: fences.count, payload: data))
            emittedDatasetIDs.insert(datasetID)
            sequence += 1
        }
        let referencedDatasetIDs = Set((start["blocks"]?.arrayValue ?? []).compactMap {
            nonEmpty($0.objectValue?["datasetRef"]?.stringValue)
        })
        for datasetID in referencedDatasetIDs.subtracting(emittedDatasetIDs).sorted() {
            fences.append(exportFence(kind: "forge-data", index: fences.count, payload: [
                "version": .number(2),
                "scope": .string(exportScope),
                "reportRef": .string(report.id),
                "sequence": .number(Double(sequence)),
                "id": .string(datasetID),
                "format": .string("json"),
                "mode": .string("replace"),
                "data": .array([])
            ]))
            sequence += 1
        }
        fences.append(exportFence(kind: "forge-report", index: fences.count, payload: [
            "version": .number(1),
            "scope": .string(exportScope),
            "id": .string(report.id),
            "sequence": .number(Double(sequence)),
            "mode": .string("commit")
        ]))
        return fences
    }

    private static func pdfDatasetPayload(_ value: JSONValue) -> JSONValue {
        switch value {
        case .string(let text):
            // Blank table cells are valid live data, but the canonical Go
            // ReportPrint model rejects empty text elements. Preserve the
            // missing-value meaning with the standard display marker.
            return text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .string("—") : value
        case .array(let values):
            return .array(values.map(pdfDatasetPayload))
        case .object(let object):
            return .object(object.mapValues(pdfDatasetPayload))
        case .number, .bool, .null:
            return value
        }
    }

    private static func exportFence(kind: String, index: Int, payload: [String: JSONValue]) -> JSONValue {
        .object([
            "kind": .string(kind),
            "index": .number(Double(index)),
            "payload": .object(payload)
        ])
    }

    private static func pdfSource(_ source: [String: JSONValue]) -> [String: JSONValue] {
        guard let blocks = source["blocks"]?.arrayValue else { return source }
        var result = source
        result["blocks"] = .array(blocks.enumerated().compactMap { index, value in
            guard var block = value.objectValue else { return value }
            switch block["kind"]?.stringValue {
            case "filterBarBlock", "refinementBarBlock":
                // Interactive controls belong to the live report. The PDF is a
                // read-only snapshot and the Go report schema rejects empty
                // control declarations, so omit them from export fences.
                return nil
            case "tableBlock":
                block.removeValue(forKey: "description")
            case "kpiBlock":
                if block["description"] == nil, let subtitle = block["subtitle"] {
                    block["description"] = subtitle
                }
                block.removeValue(forKey: "subtitle")
                block.removeValue(forKey: "size")
                block.removeValue(forKey: "suffix")
                block.removeValue(forKey: "tone")
            case "timelineBlock":
                let timeField = nonEmpty(block.removeValue(forKey: "timeField")?.stringValue)
                let titleField = nonEmpty(block.removeValue(forKey: "titleField")?.stringValue)
                let descriptionField = nonEmpty(block.removeValue(forKey: "descriptionField")?.stringValue)
                var columns: [JSONValue] = []
                for (key, label) in [(timeField, "Time"), (titleField, "Event"), (descriptionField, "Detail")] {
                    if let key {
                        columns.append(.object(["key": .string(key), "label": .string(label)]))
                    }
                }
                columns.append(contentsOf: block["columns"]?.arrayValue ?? [])
                var seen = Set<String>()
                block["kind"] = .string("tableBlock")
                block["columns"] = .array(columns.filter { column in
                    guard let key = nonEmpty(column.objectValue?["key"]?.stringValue) else { return false }
                    return seen.insert(key).inserted
                })
            case "badgesBlock":
                if let items = block["items"]?.arrayValue {
                    block["items"] = .array(items.enumerated().map { itemIndex, item in
                        guard var badge = item.objectValue, badge["id"] == nil else { return item }
                        badge["id"] = .string("badge_\(itemIndex + 1)")
                        return .object(badge)
                    })
                }
            case "infoPanelBlock", "calloutBlock":
                let id = block["id"] ?? .string("block_\(index + 1)")
                let title = block["title"]
                let markdown = block["body"] ?? block["description"] ?? .string("")
                block = ["id": id, "kind": .string("markdownBlock"), "markdown": markdown]
                if let title { block["title"] = title }
            default:
                break
            }
            return .object(block)
        })
        return result
    }

    private static func normalizedDatasetRows(
        _ dataSources: [String: TranscriptCanonicalData]
    ) -> [String: [JSONValue]] {
        Dictionary(uniqueKeysWithValues: dataSources.map { key, source in
            let id = nonEmpty(key) ?? nonEmpty(source.id) ?? key
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
        if kind == "timelineBlock" {
            let datasetRef = object["datasetRef"]?.stringValue ?? ""
            let rows = datasets[datasetRef]?.compactMap(\.objectValue) ?? []
            let timeField = nonEmpty(object["timeField"]?.stringValue) ?? "timestamp"
            let titleField = nonEmpty(object["titleField"]?.stringValue) ?? "title"
            let descriptionField = nonEmpty(object["descriptionField"]?.stringValue) ?? "description"
            let columns = object["columns"]?.arrayValue?.compactMap(\.objectValue) ?? []
            content["events"] = .array(rows.map { row in
                var details: [String] = []
                if let description = nonEmpty(row[descriptionField]?.stringValue) {
                    details.append(description)
                }
                for column in columns {
                    guard let key = nonEmpty(column["key"]?.stringValue),
                          let value = DashboardRuntime.dashboardReportRuntimeValueText(row[key]),
                          !value.isEmpty else { continue }
                    let label = nonEmpty(column["label"]?.stringValue) ?? key
                    details.append("\(label): \(value)")
                }
                return .object([
                    "date": row[timeField] ?? .string(""),
                    "title": row[titleField] ?? .string("Event"),
                    "body": .string(details.joined(separator: "\n\n"))
                ])
            })
            content["rowCount"] = .number(Double(rows.count))
        }
        let datasetRef = nonEmpty(object["datasetRef"]?.stringValue)
            ?? nonEmpty(content["datasetRef"]?.stringValue)
            ?? ""
        object["content"] = materializeReportTemplates(
            .object(content),
            datasetRef: datasetRef,
            datasets: datasets
        )
        return .object(object)
    }

    private static func materializeReportTemplates(
        _ value: JSONValue,
        datasetRef: String,
        datasets: [String: [JSONValue]]
    ) -> JSONValue {
        switch value {
        case .object(let object):
            return .object(object.mapValues { materializeReportTemplates($0, datasetRef: datasetRef, datasets: datasets) })
        case .array(let values):
            return .array(values.map { materializeReportTemplates($0, datasetRef: datasetRef, datasets: datasets) })
        case .string(let text):
            return .string(resolveReportTemplate(text, datasetRef: datasetRef, datasets: datasets))
        default:
            return value
        }
    }

    private static func resolveReportTemplate(
        _ template: String,
        datasetRef: String,
        datasets: [String: [JSONValue]]
    ) -> String {
        guard template.contains("${") || template.contains("{{") else { return template }
        let canonical = replaceTemplateMatches(in: template, regex: dollarTemplate) { token in
            resolveReportTemplateToken(token, datasetRef: datasetRef, datasets: datasets)
        }
        return replaceTemplateMatches(in: canonical, regex: handlebarsTemplate) { token in
            resolveReportTemplateToken(token, datasetRef: datasetRef, datasets: datasets)
        }
    }

    private static func replaceTemplateMatches(
        in source: String,
        regex: NSRegularExpression,
        resolve: (String) -> String
    ) -> String {
        var output = source
        let sourceRange = NSRange(source.startIndex..<source.endIndex, in: source)
        for match in regex.matches(in: source, range: sourceRange).reversed() {
            guard let tokenRange = Range(match.range(at: 1), in: source),
                  let wholeRange = Range(match.range(at: 0), in: output) else { continue }
            output.replaceSubrange(wholeRange, with: resolve(String(source[tokenRange])))
        }
        return output
    }

    private static func resolveReportTemplateToken(
        _ rawToken: String,
        datasetRef: String,
        datasets: [String: [JSONValue]]
    ) -> String {
        let token = rawToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty else { return "—" }
        let function = firstMatch(formatFunction, in: token)
        let spaced = firstMatch(formatSpace, in: token)
        let helper = function?.0 ?? spaced?.0
        let valueToken = function?.1 ?? spaced?.1 ?? token
        guard let value = resolveReportTemplateValue(valueToken, datasetRef: datasetRef, datasets: datasets) else {
            return "—"
        }
        if let helper {
            let format: String
            switch helper.lowercased() {
            case "compact": format = "compactNumber"
            case "percentfraction": format = "percentFraction"
            default: format = helper
            }
            return DashboardRuntime.formatDashboardValue(reportTemplateAnyValue(value), format: format)
        }
        switch value {
        case .string(let text): return text
        case .number(let number): return number.rounded() == number ? String(Int(number)) : String(number)
        case .bool(let flag): return flag ? "true" : "false"
        case .null: return "—"
        default: return String(describing: reportTemplateAnyValue(value) ?? "—")
        }
    }

    private static func firstMatch(_ regex: NSRegularExpression, in value: String) -> (String, String)? {
        let range = NSRange(value.startIndex..<value.endIndex, in: value)
        guard let match = regex.firstMatch(in: value, range: range),
              match.range == range,
              let helperRange = Range(match.range(at: 1), in: value),
              let valueRange = Range(match.range(at: 2), in: value) else { return nil }
        return (String(value[helperRange]), String(value[valueRange]))
    }

    private static func resolveReportTemplateValue(
        _ rawPath: String,
        datasetRef: String,
        datasets: [String: [JSONValue]]
    ) -> JSONValue? {
        var path = rawPath.trimmingCharacters(in: .whitespacesAndNewlines)
        if path.hasPrefix("row.") { path.removeFirst(4) }
        let absolute = path.split(separator: ".", maxSplits: 1).map(String.init)
        if absolute.count == 2, datasets[absolute[0]] != nil {
            let nestedPath = absolute[1].hasPrefix("row.") ? String(absolute[1].dropFirst(4)) : absolute[1]
            return resolveReportTemplatePath(datasets[absolute[0]]?.first, path: nestedPath)
        }
        if let value = resolveReportTemplatePath(datasets[datasetRef]?.first, path: path) { return value }
        for (id, rows) in datasets where id != datasetRef {
            if let value = resolveReportTemplatePath(rows.first, path: path) { return value }
        }
        return nil
    }

    private static func resolveReportTemplatePath(_ root: JSONValue?, path: String) -> JSONValue? {
        guard var current = root else { return nil }
        for segment in path.split(separator: ".").map(String.init).filter({ !$0.isEmpty }) {
            guard let next = current.objectValue?[segment] else { return nil }
            current = next
        }
        if case .null = current { return nil }
        return current
    }

    private static func reportTemplateAnyValue(_ value: JSONValue) -> Any? {
        switch value {
        case .string(let text): return text
        case .number(let number): return number
        case .bool(let flag): return flag
        case .null: return nil
        case .array(let values): return values.map(reportTemplateAnyValue)
        case .object(let object): return object.mapValues(reportTemplateAnyValue)
        }
    }

    private static let dollarTemplate = try! NSRegularExpression(pattern: #"\$\{\s*([^}]+?)\s*\}"#)
    private static let handlebarsTemplate = try! NSRegularExpression(pattern: #"\{\{\s*(.+?)\s*\}\}"#)
    private static let formatFunction = try! NSRegularExpression(
        pattern: #"(?i)^fmt\.(compact|compactNumber|currency|currency2|percent|percentFraction|number|number2|number5)\((.+)\)$"#
    )
    private static let formatSpace = try! NSRegularExpression(
        pattern: #"(?i)^fmt\.(compact|compactNumber|currency|currency2|percent|percentFraction|number|number2|number5)\s+(.+)$"#
    )

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
