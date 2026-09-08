import Foundation

public enum DataStateBoundaryKind: String, Sendable, Equatable {
    case loading
    case empty
    case partial
    case error
    case ready
}

public struct HistoryDiffEntry: Sendable, Equatable, Identifiable {
    public let path: String
    public let label: String
    public let before: String
    public let after: String
    public let redacted: Bool
    public var id: String { path }
}

public struct ScheduleValidationError: Sendable, Equatable {
    public let index: Int
    public let code: String
}

public struct ScheduleValidationResult: Sendable, Equatable {
    public let valid: Bool
    public let errors: [ScheduleValidationError]
}

public struct UploadFileValue: Sendable, Equatable, Identifiable {
    public let name: String
    public let mimeType: String
    public let data: Data
    public var id: String { "\(name):\(data.count)" }

    public init(name: String, mimeType: String = "application/octet-stream", data: Data) {
        self.name = name
        self.mimeType = mimeType
        self.data = data
    }
}

public struct UploadValidationResult: Sendable, Equatable {
    public let valid: Bool
    public let errors: [String]
}

public enum WorkflowPrimitiveRuntime {
    public static func dataStateBoundaryKind(
        controls: [ControlState],
        collections: [[[String: JSONValue]]],
        allowPartial: Bool = false
    ) -> DataStateBoundaryKind {
        let errors = controls.filter { ($0.error ?? "").isEmpty == false }
        let loading = controls.contains { $0.loading }
        let populated = collections.filter { !$0.isEmpty }.count
        let sourceCount = max(controls.count, collections.count)

        if loading && populated == 0 { return .loading }
        if !errors.isEmpty {
            if allowPartial && populated > 0 { return .partial }
            return .error
        }
        if sourceCount > 1 && populated > 0 && populated < sourceCount {
            return allowPartial ? .partial : .empty
        }
        return populated == 0 ? .empty : .ready
    }

    public static func presentationRecord(
        form: [String: JSONValue],
        collection: [[String: JSONValue]],
        metrics: [String: JSONValue]
    ) -> [String: JSONValue] {
        if !form.isEmpty { return form }
        if let first = collection.first { return first }
        return metrics
    }

    public static func relationLabel(count: Int, spec: RelationDrillSpec) -> String {
        if count == 0, let empty = spec.emptyText, !empty.isEmpty { return empty }
        let noun = count == 1
            ? (spec.singularLabel ?? "item")
            : (spec.pluralLabel ?? "items")
        return "\(count) \(noun)"
    }

    public static func permissionAllows(
        spec: PermissionBoundarySpec,
        authorization: [String: JSONValue],
        rows: [[String: JSONValue]] = [],
        grants: [[String: JSONValue]] = []
    ) -> Bool {
        guard let capability = spec.capability?.trimmingCharacters(in: .whitespacesAndNewlines), !capability.isEmpty else { return true }
        let mode = spec.mode?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "resource"
        if mode == "resource" {
            return authorization["resource"]?.objectValue?["capabilities"]?.objectValue?[capability]?.boolValue == true
        }
        guard !rows.isEmpty else { return true }
        let identity = spec.identityField?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? spec.identityField! : "id"
        let grantsByID = Dictionary(uniqueKeysWithValues: grants.compactMap { grant -> (String, [String: JSONValue])? in
            guard let value = grant["resourceId"] ?? grant[identity], let key = primitiveIdentityString(value) else { return nil }
            return (key, grant)
        })
        return rows.allSatisfy { row in
            guard let value = row[identity], let key = primitiveIdentityString(value), let grant = grantsByID[key] else { return false }
            return grant["capabilities"]?.objectValue?[capability]?.boolValue == true
        }
    }

    public static func responsiveDataGridState(spec: ResponsiveDataGridSpec, target: String) -> ResponsiveDataGridStateSpec? {
        let states = spec.breakpoints ?? [:]
        return states[target] ?? states[target == "phone" ? "narrow" : "wide"] ?? states["desktop"] ?? states.values.first
    }

    public static func validateSchedule(rows: [[String: JSONValue]], spec: ScheduleEditorSpec) -> ScheduleValidationResult {
        let startField = spec.startField ?? "start"
        let endField = spec.endField ?? "end"
        let minimum = parseDurationMilliseconds(spec.minDuration)
        var normalized: [(index: Int, start: Date?, end: Date?)] = []
        var errors: [ScheduleValidationError] = []
        for (index, row) in rows.enumerated() {
            if row["_scheduleErrors"]?.objectValue?.values.contains(where: { $0.boolValue == true || $0.stringValue?.isEmpty == false }) == true {
                errors.append(ScheduleValidationError(index: index, code: "timezone"))
            }
            let start = scheduleDate(resolveSchedule(row, selector: startField))
            let end = scheduleDate(resolveSchedule(row, selector: endField))
            normalized.append((index, start, end))
            guard let start, let end else {
                errors.append(ScheduleValidationError(index: index, code: "invalid_date"))
                continue
            }
            if end <= start { errors.append(ScheduleValidationError(index: index, code: "invalid_range")) }
            if let minimum, end.timeIntervalSince(start) * 1_000 < minimum {
                errors.append(ScheduleValidationError(index: index, code: "min_duration"))
            }
        }
        if spec.allowOverlap == false {
            let sorted = normalized.compactMap { item -> (Int, Date, Date)? in
                guard let start = item.start, let end = item.end else { return nil }
                return (item.index, start, end)
            }.sorted { $0.1 < $1.1 }
            for index in 1..<sorted.count where sorted[index].1 < sorted[index - 1].2 {
                errors.append(ScheduleValidationError(index: sorted[index].0, code: "overlap"))
            }
        }
        return ScheduleValidationResult(valid: errors.isEmpty, errors: errors)
    }

    public static func toggleTreeSelection(
        nodes: [[String: JSONValue]],
        selected: Set<String>,
        key: String,
        checked: Bool,
        spec: TreeEditorSpec
    ) -> Set<String> {
        var result = selected
        var keys: Set<String> = [key]
        if spec.cascade?.lowercased() == "descendants" {
            for node in nodes { collectTreeSelectionKeys(node: node, target: key, collecting: false, spec: spec, result: &keys) }
        }
        for value in keys { if checked { result.insert(value) } else { result.remove(value) } }
        return result
    }

    public static func validateUpload(files: [UploadFileValue], spec: UploadCollectionSpec) -> UploadValidationResult {
        var errors: [String] = []
        if spec.multiple == false && files.count > 1 { errors.append("Only one file is allowed.") }
        if let maxFiles = spec.maxFiles, maxFiles > 0, files.count > maxFiles { errors.append("No more than \(maxFiles) files are allowed.") }
        for file in files {
            if !uploadTypeAccepted(file, rules: spec.accept ?? []) { errors.append("\(file.name) has an unsupported type.") }
            if let maxBytes = spec.maxBytes, maxBytes > 0, Int64(file.data.count) > maxBytes { errors.append("\(file.name) exceeds the size limit.") }
        }
        return UploadValidationResult(valid: errors.isEmpty, errors: errors)
    }

    public static func encodeUpload(files: [UploadFileValue], spec: UploadCollectionSpec) throws -> [String: JSONValue] {
        let transport = spec.transport ?? "mcpBlob"
        guard transport == "mcpBlob" else { throw UploadRuntimeError.message("Unsupported upload transport: \(transport)") }
        let blobs = files.map { file in JSONValue.object([
            "name": .string(file.name), "size": .number(Double(file.data.count)), "type": .string(file.mimeType),
            "data": .string(file.data.base64EncodedString()), "filename": .string(file.name), "mimeType": .string(file.mimeType)
        ]) }
        return [
            "transport": .string("mcpBlob"),
            spec.blobField ?? "files": spec.multiple == false ? (blobs.first ?? .null) : .array(blobs)
        ]
    }

    public static func masterDetailIdentity(row: [String: JSONValue]?, fields: [String]) -> String? {
        guard let row else { return nil }
        let keys = fields.isEmpty ? ["id"] : fields
        let values = keys.compactMap { row[$0].flatMap(primitiveIdentityString) }
        return values.count == keys.count ? values.joined(separator: "\u{001f}") : nil
    }

    public static func resolveMasterDetailSelection(
        rows: [[String: JSONValue]],
        selected: [String: JSONValue]?,
        persisted: [String: JSONValue]?,
        identityFields: [String]
    ) -> [String: JSONValue]? {
        let selectedID = masterDetailIdentity(row: selected, fields: identityFields)
        if let selectedID, let match = rows.first(where: { masterDetailIdentity(row: $0, fields: identityFields) == selectedID }) { return match }
        let persistedID = masterDetailIdentity(row: persisted, fields: identityFields)
        if let persistedID { return rows.first(where: { masterDetailIdentity(row: $0, fields: identityFields) == persistedID }) }
        return nil
    }

    public static func masterDetailParameters(spec: MasterDetailRegionSpec, row: [String: JSONValue]) -> [String: JSONValue] {
        spec.parameters.compactMapValues { parameter in
            guard let object = parameter.objectValue else { return parameter }
            let source = object["source"]?.stringValue?.lowercased() ?? "row"
            guard source == "row" else { return object["value"] ?? parameter }
            let selector = object["selector"]?.stringValue ?? object["field"]?.stringValue ?? ""
            let value = resolveSchedule(row, selector: selector) ?? .null
            return object["wrap"]?.stringValue?.lowercased() == "array" ? .array([value]) : value
        }
    }

    private static func collectTreeSelectionKeys(node: [String: JSONValue], target: String, collecting: Bool, spec: TreeEditorSpec, result: inout Set<String>) {
        let identityField = spec.identityField ?? "id"
        let nodeKey = node[identityField].flatMap(primitiveIdentityString) ?? ""
        let shouldCollect = collecting || nodeKey == target
        if shouldCollect && !nodeKey.isEmpty { result.insert(nodeKey) }
        let children = node[spec.childrenField ?? "children"]?.arrayValue?.compactMap(\.objectValue) ?? []
        for child in children { collectTreeSelectionKeys(node: child, target: target, collecting: shouldCollect, spec: spec, result: &result) }
    }

    public static func historyDiffEntries(before: JSONValue?, after: JSONValue?, spec: HistoryDiffSpec) -> [HistoryDiffEntry] {
        var result: [HistoryDiffEntry] = []
        collectHistoryDiff(before: before ?? .null, after: after ?? .null, path: "", spec: spec, result: &result)
        return result
    }

    private static func collectHistoryDiff(before: JSONValue, after: JSONValue, path: String, spec: HistoryDiffSpec, result: inout [HistoryDiffEntry]) {
        let leaf = path.split(separator: ".").last.map(String.init) ?? path
        let ignored = Set(spec.ignoreFields ?? [])
        if ignored.contains(path) || ignored.contains(leaf) { return }
        if case .object(let left) = before, case .object(let right) = after {
            for key in Set(left.keys).union(right.keys).sorted() {
                collectHistoryDiff(
                    before: left[key] ?? .null,
                    after: right[key] ?? .null,
                    path: path.isEmpty ? key : "\(path).\(key)",
                    spec: spec,
                    result: &result
                )
            }
            return
        }
        let normalizedBefore = normalizedHistoryValue(before, arrayStrategy: spec.arrayStrategy)
        let normalizedAfter = normalizedHistoryValue(after, arrayStrategy: spec.arrayStrategy)
        guard normalizedBefore != normalizedAfter else { return }
        let redactedFields = Set(spec.redactFields ?? [])
        let redacted = redactedFields.contains(path) || redactedFields.contains(leaf)
        result.append(HistoryDiffEntry(
            path: path.isEmpty ? "value" : path,
            label: spec.fieldLabels?[path] ?? spec.fieldLabels?[leaf] ?? historyLabel(leaf),
            before: redacted ? "••••" : historyDisplay(before),
            after: redacted ? "••••" : historyDisplay(after),
            redacted: redacted
        ))
    }

    private static func normalizedHistoryValue(_ value: JSONValue, arrayStrategy: String?) -> JSONValue {
        guard arrayStrategy?.lowercased() == "set", case .array(let values) = value else { return value }
        return .array(values.sorted { historyDisplay($0) < historyDisplay($1) })
    }

    private static func historyDisplay(_ value: JSONValue) -> String {
        switch value {
        case .string(let value): return value
        case .number(let value): return value.rounded() == value ? String(Int(value)) : String(value)
        case .bool(let value): return value ? "true" : "false"
        case .null: return "—"
        case .array(let values): return values.map(historyDisplay).joined(separator: ", ")
        case .object(let values): return values.keys.sorted().map { "\($0): \(historyDisplay(values[$0] ?? .null))" }.joined(separator: ", ")
        }
    }

    private static func historyLabel(_ value: String) -> String {
        value.replacingOccurrences(of: "_", with: " ").split(separator: " ").map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: " ")
    }
}

private enum UploadRuntimeError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let value) = self { return value }; return nil }
}

private func uploadTypeAccepted(_ file: UploadFileValue, rules: [String]) -> Bool {
    if rules.isEmpty { return true }
    let name = file.name.lowercased(); let type = file.mimeType.lowercased()
    return rules.contains { raw in
        let rule = raw.lowercased()
        if rule.hasPrefix(".") { return name.hasSuffix(rule) }
        if rule.hasSuffix("/*") { return type.hasPrefix(String(rule.dropLast())) }
        return type == rule
    }
}

private func resolveSchedule(_ row: [String: JSONValue], selector: String) -> JSONValue? {
    JSONValue(any: SelectorUtil.resolve(row.compactMapValues(\.anyValue), selector: selector))
}

private func scheduleDate(_ value: JSONValue?) -> Date? {
    guard case .string(let text) = value else { return nil }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: text) ?? ISO8601DateFormatter().date(from: text)
}

private func parseDurationMilliseconds(_ raw: String?) -> Double? {
    let text = raw?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
    guard let match = text.range(of: #"^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$"#, options: .regularExpression) else { return nil }
    let matched = String(text[match])
    let unit = matched.hasSuffix("ms") ? "ms" : String(matched.suffix(1))
    let numberText = unit == "ms" ? String(matched.dropLast(2)) : String(matched.dropLast())
    guard let value = Double(numberText.trimmingCharacters(in: .whitespaces)) else { return nil }
    let multiplier: Double = ["ms": 1, "s": 1_000, "m": 60_000, "h": 3_600_000, "d": 86_400_000][unit] ?? 1
    return value * multiplier
}

private func primitiveIdentityString(_ value: JSONValue) -> String? {
    switch value {
    case .string(let value): return value.isEmpty ? nil : value
    case .number(let value): return value.rounded() == value ? String(Int(value)) : String(value)
    case .bool(let value): return value ? "true" : "false"
    default: return nil
    }
}
