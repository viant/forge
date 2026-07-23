import Foundation

public struct TranscriptForgeDataBlock: Codable, Equatable, Sendable {
    public let version: Int?
    public let id: String?
    public let format: String?
    public let mode: String?
    public let data: JSONValue?

    public init(version: Int? = nil, id: String? = nil, format: String? = nil, mode: String? = nil, data: JSONValue? = nil) {
        self.version = version
        self.id = id
        self.format = format
        self.mode = mode
        self.data = data
    }
}

public struct TranscriptForgeUIPayload: Codable, Equatable, Sendable {
    public let version: Int?
    public let title: String?
    public let subtitle: String?
    public let blocks: [JSONValue]

    public init(version: Int? = nil, title: String? = nil, subtitle: String? = nil, blocks: [JSONValue] = []) {
        self.version = version
        self.title = title
        self.subtitle = subtitle
        self.blocks = blocks
    }
}

public struct TranscriptForgeDataStore: Equatable, Sendable {
    public let id: String
    public let rows: JSONValue

    public init(id: String, rows: JSONValue) {
        self.id = id
        self.rows = rows
    }
}

/// Platform-neutral transcript parts emitted by a conversation SDK. Forge owns
/// their data/UI pairing so native hosts do not re-parse completed messages.
public struct TranscriptCanonicalData: Equatable, Sendable {
    public let version: Int?
    public let scope: String?
    public let reportRef: String?
    public let sequence: Int?
    public let id: String
    public let format: String?
    public let mode: String?
    public let payload: JSONValue?

    public init(version: Int? = nil, scope: String? = nil, reportRef: String? = nil, sequence: Int? = nil, id: String, format: String? = nil, mode: String? = nil, payload: JSONValue? = nil) {
        self.version = version
        self.scope = scope
        self.reportRef = reportRef
        self.sequence = sequence
        self.id = id
        self.format = format
        self.mode = mode
        self.payload = payload
    }
}

public struct TranscriptCanonicalPart: Equatable, Sendable {
    public let kind: String
    public let text: String?
    public let source: String?
    public let payload: JSONValue?
    public let data: TranscriptCanonicalData?

    public init(kind: String, text: String? = nil, source: String? = nil, payload: JSONValue? = nil, data: TranscriptCanonicalData? = nil) {
        self.kind = kind
        self.text = text
        self.source = source
        self.payload = payload
        self.data = data
    }
}

public struct TranscriptCanonicalReport: Equatable, Sendable {
    public let scope: String
    public let id: String
    public let grammar: String
    public let status: String
    public let sequence: Int?
    public let resetVersion: Int
    public let source: JSONValue
    public let dataSources: [String: TranscriptCanonicalData]

    public init(
        scope: String,
        id: String,
        grammar: String,
        status: String,
        sequence: Int? = nil,
        resetVersion: Int = 0,
        source: JSONValue,
        dataSources: [String: TranscriptCanonicalData] = [:]
    ) {
        self.scope = scope
        self.id = id
        self.grammar = grammar
        self.status = status
        self.sequence = sequence
        self.resetVersion = resetVersion
        self.source = source
        self.dataSources = dataSources
    }
}

public enum TranscriptEnvelopePart: Equatable, Sendable {
    case markdown(String)
    case forgeUI(TranscriptForgeUIPayload, [String: TranscriptForgeDataStore])
}

/// Generic Forge transcript envelope decoding. Hosts decide where to place the
/// result; Forge owns fence interpretation and data-mode materialization.
public enum TranscriptEnvelope {
    /// Removes progressive report transport fences from text that accompanies
    /// an already-assembled canonical report. Ordinary markdown and legacy
    /// Forge UI payloads remain visible.
    public static func suppressProgressiveTransport(in markdown: String) -> String {
        MarkdownFenceParser.parse(markdown).map { part in
            switch part {
            case .text(let value):
                return value
            case .fence(let raw, let language, _, let body, let closed):
                guard closed else { return raw }
                if language == "forge-report" {
                    return ""
                }
                if language == "forge-data", isProgressiveDataBody(body) {
                    return ""
                }
                return raw
            }
        }.joined()
    }

    public static func parse(_ markdown: String) -> [TranscriptEnvelopePart] {
        guard !markdown.isEmpty else { return [] }
        var parts: [TranscriptEnvelopePart] = []
        var dataBlocks: [TranscriptForgeDataBlock] = []
        var dataRaw: [String] = []
        var renderedUI = false
        for part in MarkdownFenceParser.parse(markdown) {
            switch part {
            case .text(let value):
                if !dataBlocks.isEmpty, value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    dataRaw.append(value)
                } else {
                    flushPendingData(&parts, dataBlocks: &dataBlocks, raw: &dataRaw)
                    appendMarkdown(&parts, value)
                }
            case .fence(let raw, let language, let header, let body, let closed):
                guard closed else { flushPendingData(&parts, dataBlocks: &dataBlocks, raw: &dataRaw); appendMarkdown(&parts, raw); continue }
                switch language {
                case "forge-data":
                    guard let data = decodeData(header: header, body: body), let id = data.id?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty else { flushPendingData(&parts, dataBlocks: &dataBlocks, raw: &dataRaw); appendMarkdown(&parts, raw); continue }
                    dataBlocks.append(data)
                    dataRaw.append(raw)
                case "forge-ui":
                    guard let payload = try? JSONDecoder().decode(TranscriptForgeUIPayload.self, from: Data(body.utf8)) else { flushPendingData(&parts, dataBlocks: &dataBlocks, raw: &dataRaw); appendMarkdown(&parts, raw); continue }
                    parts.append(.forgeUI(payload, materialize(dataBlocks)))
                    // Data fences are a snapshot for the next UI fence. A later
                    // UI block must supply its own data rather than inherit rows.
                    dataBlocks.removeAll(keepingCapacity: true)
                    dataRaw.removeAll(keepingCapacity: true)
                    renderedUI = true
                default: flushPendingData(&parts, dataBlocks: &dataBlocks, raw: &dataRaw); appendMarkdown(&parts, raw)
                }
            }
        }
        flushPendingData(&parts, dataBlocks: &dataBlocks, raw: &dataRaw)
        return renderedUI ? parts : [.markdown(markdown)]
    }

    /// Builds the same envelope from the canonical SDK representation. Raw
    /// parsing is reserved for streaming or legacy messages without that field.
    public static func fromCanonical(_ canonicalParts: [TranscriptCanonicalPart]) -> [TranscriptEnvelopePart] {
        guard !canonicalParts.isEmpty else { return [] }
        var parts: [TranscriptEnvelopePart] = []
        var dataBlocks: [TranscriptForgeDataBlock] = []
        var dataRaw: [String] = []
        var renderedUI = false
        var renderedReport = false
        for part in canonicalParts {
            switch part.kind.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
            case "markdown":
                let text = part.text ?? ""
                if !dataBlocks.isEmpty, text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    dataRaw.append(text)
                } else {
                    flushPendingData(&parts, dataBlocks: &dataBlocks, raw: &dataRaw)
                    appendMarkdown(&parts, text)
                }
            case "forgedata":
                if isProgressiveData(part) {
                    renderedReport = true
                    continue
                } else if let data = canonicalData(part) {
                    dataBlocks.append(data)
                    dataRaw.append(part.source ?? "")
                } else {
                    flushPendingData(&parts, dataBlocks: &dataBlocks, raw: &dataRaw)
                    appendMarkdown(&parts, part.source ?? "")
                }
            case "forgeui":
                if let payload = canonicalUI(part) {
                    parts.append(.forgeUI(payload, materialize(dataBlocks)))
                    dataBlocks.removeAll(keepingCapacity: true)
                    dataRaw.removeAll(keepingCapacity: true)
                    renderedUI = true
                } else {
                    flushPendingData(&parts, dataBlocks: &dataBlocks, raw: &dataRaw)
                    appendMarkdown(&parts, part.source ?? "")
                }
            case "forgereport":
                renderedReport = true
                continue
            default:
                flushPendingData(&parts, dataBlocks: &dataBlocks, raw: &dataRaw)
                appendMarkdown(&parts, part.source ?? "")
            }
        }
        flushPendingData(&parts, dataBlocks: &dataBlocks, raw: &dataRaw)
        return renderedUI || renderedReport ? parts : [.markdown(canonicalParts.map { $0.text ?? $0.source ?? "" }.joined())]
    }

    public static func rows(from value: JSONValue) -> [[String: JSONValue]] {
        switch value { case .array(let entries): return entries.compactMap(\.objectValue); case .object(let row): return [row]; default: return [] }
    }

    private static func decodeData(header: String, body: String) -> TranscriptForgeDataBlock? {
        let attributes = MarkdownFenceHeader.attributes(header)
        if let id = attributes["id"]?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty {
            let format = attributes["format"]?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let data: JSONValue
            if format == "csv" {
                data = .string(body)
            } else if let decoded = try? JSONDecoder().decode(JSONValue.self, from: Data(body.utf8)) {
                data = decoded
            } else {
                return nil
            }
            return TranscriptForgeDataBlock(version: 1, id: id, format: format, mode: attributes["mode"], data: data)
        }
        guard let block = try? JSONDecoder().decode(TranscriptForgeDataBlock.self, from: Data(body.utf8)),
              let id = block.id?.trimmingCharacters(in: .whitespacesAndNewlines),
              !id.isEmpty else { return nil }
        return TranscriptForgeDataBlock(version: block.version, id: id, format: block.format, mode: block.mode, data: block.data)
    }

    private static func canonicalData(_ part: TranscriptCanonicalPart) -> TranscriptForgeDataBlock? {
        guard let data = part.data else { return nil }
        let id = data.id.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty, let payload = data.payload else { return nil }
        return TranscriptForgeDataBlock(
            version: data.version ?? 1,
            id: id,
            format: data.format?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            mode: data.mode,
            data: payload
        )
    }

    private static func isProgressiveData(_ part: TranscriptCanonicalPart) -> Bool {
        guard let data = part.data else { return false }
        return data.version == 2 || !(data.reportRef?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
    }

    private static func isProgressiveDataBody(_ body: String) -> Bool {
        guard let object = try? JSONSerialization.jsonObject(with: Data(body.utf8)) as? [String: Any] else {
            return false
        }
        if let version = object["version"] as? NSNumber, version.intValue == 2 {
            return true
        }
        guard let reportRef = object["reportRef"] as? String else {
            return false
        }
        return !reportRef.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private static func canonicalUI(_ part: TranscriptCanonicalPart) -> TranscriptForgeUIPayload? {
        guard let payload = part.payload,
              let data = try? JSONEncoder().encode(payload) else { return nil }
        return try? JSONDecoder().decode(TranscriptForgeUIPayload.self, from: data)
    }

    private static func materialize(_ blocks: [TranscriptForgeDataBlock]) -> [String: TranscriptForgeDataStore] {
        var store: [String: TranscriptForgeDataStore] = [:]
        for block in blocks {
            guard let id = block.id?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty else { continue }
            let next = materialize(block)
            let mode = block.mode?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "replace"
            let rows: JSONValue
            switch (mode, store[id]?.rows) {
            case ("append", .some(.array(let existing))):
                if case .array(let incoming) = next { rows = .array(existing + incoming) } else { rows = next }
            case ("patch", .some(.object(let existing))):
                if case .object(let incoming) = next { rows = .object(existing.merging(incoming) { _, replacement in replacement }) } else { rows = next }
            default: rows = next
            }
            store[id] = TranscriptForgeDataStore(id: id, rows: rows)
        }
        return store
    }

    private static func materialize(_ block: TranscriptForgeDataBlock) -> JSONValue {
        let format = block.format?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let inferredFormat = format?.isEmpty == false ? format! : (block.data?.stringValue == nil ? "json" : "csv")
        guard inferredFormat == "csv", let text = block.data?.stringValue else {
            return block.data ?? .null
        }
        guard let rows = parseCSVRows(text) else { return .string(text) }
        return .array(rows.map(JSONValue.object))
    }

    static func materializeCanonicalPayload(format: String?, payload: JSONValue?) -> JSONValue? {
        guard let payload else { return nil }
        let normalizedFormat = format?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard normalizedFormat == "csv", let text = payload.stringValue else { return payload }
        guard let rows = parseCSVRows(text) else { return payload }
        return .array(rows.map(JSONValue.object))
    }

    private static func parseCSVRows(_ text: String) -> [[String: JSONValue]]? {
        var records: [[String]] = []
        var row: [String] = []
        var current = ""
        var quoted = false
        var cursor = text.startIndex
        while cursor < text.endIndex {
            let character = text[cursor]
            let next = text.index(after: cursor)
            if character == "\"", quoted, next < text.endIndex, text[next] == "\"" {
                current.append("\"")
                cursor = text.index(after: next)
            } else if character == "\"" {
                quoted.toggle()
                cursor = next
            } else if character == ",", !quoted {
                row.append(current.trimmingCharacters(in: .whitespaces))
                current = ""
                cursor = next
            } else if (character == "\n" || character == "\r"), !quoted {
                row.append(current.trimmingCharacters(in: .whitespaces))
                if row.contains(where: { !$0.isEmpty }) { records.append(row) }
                row = []
                current = ""
                cursor = character == "\r" && next < text.endIndex && text[next] == "\n" ? text.index(after: next) : next
            } else {
                current.append(character)
                cursor = next
            }
        }
        guard !quoted else { return nil }
        row.append(current.trimmingCharacters(in: .whitespaces))
        if row.contains(where: { !$0.isEmpty }) { records.append(row) }
        guard let headers = records.first, !headers.isEmpty else { return [] }
        guard Set(headers).count == headers.count else { return nil }
        return records.dropFirst().map { cells in
            Dictionary(uniqueKeysWithValues: headers.enumerated().map { index, header in
                (header, csvValue(cells.indices.contains(index) ? cells[index] : ""))
            })
        }
    }

    private static func csvValue(_ raw: String) -> JSONValue {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.caseInsensitiveCompare("true") == .orderedSame { return .bool(true) }
        if text.caseInsensitiveCompare("false") == .orderedSame { return .bool(false) }
        if let value = Double(text) { return .number(value) }
        return .string(text)
    }

    private static func appendMarkdown(_ parts: inout [TranscriptEnvelopePart], _ text: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        if case .markdown(let existing)? = parts.last { parts[parts.count - 1] = .markdown(existing + text) } else { parts.append(.markdown(text)) }
    }

    private static func flushPendingData(
        _ parts: inout [TranscriptEnvelopePart],
        dataBlocks: inout [TranscriptForgeDataBlock],
        raw: inout [String]
    ) {
        raw.forEach { appendMarkdown(&parts, $0) }
        dataBlocks.removeAll(keepingCapacity: true)
        raw.removeAll(keepingCapacity: true)
    }
}
