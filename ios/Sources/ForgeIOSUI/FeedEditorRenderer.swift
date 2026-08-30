import SwiftUI
import ForgeIOSRuntime

struct FeedEditableTableView: View {
    let runtime: ForgeRuntime?
    let window: WindowContext?
    let container: ContainerDef

    @State private var rows: [[String: JSONValue]] = []
    @State private var query = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if container.quickFilter == true {
                TextField("Filter selected rows", text: $query)
                    .textFieldStyle(.roundedBorder)
            }
            if filteredRows.isEmpty {
                Text("No rows available.").font(.footnote).foregroundStyle(.secondary)
            } else {
                GeometryReader { proxy in
                    editableTable(availableWidth: proxy.size.width)
                }
                .frame(height: tableHeight)
            }
            if container.allowAdd != false,
               case .object(let addRow) = container.addRow,
               case .object(let defaults) = addRow["defaults"] {
                Button {
                    dispatch(FeedPatchOperation(
                        dataSourceRef: dataSourceRef,
                        op: "add",
                        path: "/collection/-",
                        value: .object(defaults)
                    ))
                } label: {
                    Image(systemName: "plus")
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.bordered)
                .accessibilityLabel(addRow["label"]?.stringValue ?? "Add row")
            }
        }
        .task(id: subscriptionKey) { await observeRows() }
    }

    private var frozenColumn: ColumnDef? {
        container.columns.first(where: { $0.frozen == true }) ?? container.columns.first
    }

    private var scrollingColumns: [ColumnDef] {
        guard let frozenKey = frozenColumn.flatMap(feedColumnKey) else { return container.columns }
        return container.columns.filter { feedColumnKey($0) != frozenKey }
    }

    private var headerHeight: CGFloat { 36 }
    private var tableHeight: CGFloat {
        headerHeight + filteredRows.reduce(CGFloat(2)) { total, indexed in
            total + feedRowHeight(indexed.element, columns: container.columns)
        }
    }

    @ViewBuilder
    private func editableTable(availableWidth: CGFloat) -> some View {
        let frozen = frozenColumn
        let frozenWidth = min(max(feedColumnWidth(frozen, availableWidth: availableWidth), 92), availableWidth * 0.40)
        ZStack(alignment: .topLeading) {
            ScrollView(.horizontal, showsIndicators: true) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 0) {
                        ForEach(scrollingColumns) { column in
                            feedHeader(column).frame(width: feedColumnWidth(column, availableWidth: availableWidth), height: headerHeight)
                        }
                        Text("").frame(width: 46, height: headerHeight)
                    }
                    ForEach(filteredRows, id: \.offset) { indexed in
                        let rowHeight = feedRowHeight(indexed.element, columns: container.columns)
                        HStack(spacing: 0) {
                            ForEach(scrollingColumns) { column in
                                editableCell(column, row: indexed)
                                    .frame(width: feedColumnWidth(column, availableWidth: availableWidth), height: rowHeight)
                            }
                            Button(role: .destructive) {
                                dispatch(FeedPatchOperation(dataSourceRef: dataSourceRef, op: "remove", path: "/collection/\(indexed.offset)"))
                            } label: {
                                Image(systemName: "trash").frame(width: 32, height: 32)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(container.removeRowLabel?.nonEmptyFeedText ?? "Remove row")
                            .frame(width: 46, height: rowHeight)
                        }
                    }
                }
                .padding(.leading, frozenWidth)
            }

            if let frozen {
                VStack(alignment: .leading, spacing: 0) {
                    feedHeader(frozen).frame(width: frozenWidth, height: headerHeight)
                    ForEach(filteredRows, id: \.offset) { indexed in
                        let rowHeight = feedRowHeight(indexed.element, columns: container.columns)
                        editableCell(frozen, row: indexed)
                            .frame(width: frozenWidth, height: rowHeight)
                    }
                }
                .background(Color.forgeSystemBackground)
                .overlay(alignment: .trailing) { Divider() }
                .shadow(color: Color.black.opacity(0.045), radius: 2, x: 1)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.secondary.opacity(0.18), lineWidth: 1))
    }

    private func feedHeader(_ column: ColumnDef) -> some View {
        Text(column.label ?? feedColumnKey(column) ?? "Value")
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(.horizontal, 8)
            .background(feedTablePastelColor(key: container.id, rowIndex: 0, header: true))
    }

    private func editableCell(_ column: ColumnDef, row: (offset: Int, element: [String: JSONValue])) -> some View {
        let field = feedColumnKey(column) ?? ""
        return FeedEditableCell(
            column: column,
            value: row.element[field],
            onChange: { value in
                dispatch(FeedPatchOperation(
                    dataSourceRef: dataSourceRef,
                    op: "replace",
                    path: "/collection/\(row.offset)/\(escapeFeedPointer(field))",
                    value: value
                ))
            }
        )
        .padding(6)
        .background(feedTablePastelColor(key: container.id, rowIndex: row.offset, header: false))
        .overlay(alignment: .bottom) { Divider() }
        .overlay(alignment: .trailing) { Divider().opacity(0.55) }
    }

    private var dataSourceRef: String { container.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "" }
    private var subscriptionKey: String { "\(window?.windowID ?? "")#\(dataSourceRef)" }
    private var filteredRows: [(offset: Int, element: [String: JSONValue])] {
        rows.enumerated().filter { _, row in
            query.isEmpty || row.values.contains { $0.feedDisplayText.localizedCaseInsensitiveContains(query) }
        }
    }

    private func observeRows() async {
        guard let runtime, let window, !dataSourceRef.isEmpty else { return }
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef)
        let updates = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: dataSourceRef)
        for await next in updates { rows = next }
    }

    private func dispatch(_ operation: FeedPatchOperation) {
        guard let runtime, let window else { return }
        Task {
            do {
                if try await runtime.dispatchFeedPatch(windowID: window.windowID, operation: operation) { return }
                _ = try await runtime.applyFeedPatchOperations(windowID: window.windowID, operations: [operation])
            } catch {
                return
            }
        }
    }
}

private struct FeedEditableCell: View {
    let column: ColumnDef
    let value: JSONValue?
    let onChange: (JSONValue) -> Void

    var body: some View {
        if column.editor == .bool(false) {
            Text(value?.feedDisplayText.nonEmptyFeedText ?? "-")
                .font(.subheadline)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        } else if case .object(let editor) = column.editor,
                  editor["type"]?.stringValue?.lowercased() == "boolean" {
            Toggle("", isOn: Binding(
                get: { value?.boolValue ?? false },
                set: { onChange(.bool($0)) }
            ))
            .labelsHidden()
        } else if case .object(let editor) = column.editor,
                  editor["type"]?.stringValue?.lowercased() == "select",
                  case .array(let options) = editor["options"] {
            Picker("", selection: Binding(
                get: { value?.feedDisplayText ?? "" },
                set: { selected in
                    if let option = options.first(where: { $0.feedDisplayText == selected }) {
                        onChange(option)
                    }
                }
            )) {
                ForEach(Array(options.enumerated()), id: \.offset) { _, option in
                    Text(option.feedDisplayText).tag(option.feedDisplayText)
                }
            }
            .pickerStyle(.menu)
            .labelsHidden()
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 7)
            .padding(.vertical, 5)
            .background(Color.secondary.opacity(0.035), in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.16), lineWidth: 1))
        } else if isFeedNarrativeColumn(column) {
            TextEditor(text: Binding(
                get: { value?.feedDisplayText ?? "" },
                set: { onChange(.string($0)) }
            ))
            .font(.subheadline)
            .scrollContentBackground(.hidden)
            .padding(3)
            .background(Color.secondary.opacity(0.035), in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.16), lineWidth: 1))
        } else {
            TextField(
                column.label ?? feedColumnKey(column) ?? "Value",
                text: Binding(
                    get: { value?.feedDisplayText ?? "" },
                    set: { text in
                        if case .object(let editor) = column.editor,
                           editor["type"]?.stringValue?.lowercased() == "number",
                           let number = Double(text) {
                            onChange(.number(number))
                        } else {
                            onChange(.string(text))
                        }
                    }
                )
            )
            .font(.subheadline)
            .padding(.horizontal, 8)
            .padding(.vertical, 7)
            .background(Color.secondary.opacity(0.035), in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.16), lineWidth: 1))
        }
    }
}

struct FeedLookupChipsView: View {
    let runtime: ForgeRuntime?
    let window: WindowContext?
    let container: ContainerDef

    @State private var query = ""
    @State private var provider = ""
    @State private var lookupRows: [[String: JSONValue]] = []
    @State private var selectedRows: [[String: JSONValue]] = []
    @State private var lookupExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let lookup {
                Button {
                    withAnimation(.easeInOut(duration: 0.18)) { lookupExpanded.toggle() }
                } label: {
                    Image(systemName: lookupExpanded ? "xmark" : "plus")
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.bordered)
                .accessibilityLabel(lookupExpanded ? "Close lookup" : (lookup["placeholder"]?.stringValue ?? "Add item"))

                if lookupExpanded {
                    TextField(lookup["placeholder"]?.stringValue ?? "Search", text: $query)
                        .textFieldStyle(.plain)
                        .font(.subheadline)
                        .padding(.horizontal, 10)
                        .frame(height: 36)
                        .background(Color(red: 0.933, green: 0.973, blue: 0.945), in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(red: 0.75, green: 0.86, blue: 0.78), lineWidth: 1))
                    if case .array(let providers) = lookup["providers"] {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(Array(providers.enumerated()), id: \.offset) { _, raw in
                                    if case .object(let item) = raw {
                                        let id = item["id"]?.stringValue ?? ""
                                        Button(item["label"]?.stringValue ?? id) { provider = id }
                                            .buttonStyle(.bordered)
                                            .controlSize(.small)
                                            .tint(provider == id ? Color.accentColor : Color.secondary)
                                    }
                                }
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(filteredLookupRows.prefix(20).enumerated()), id: \.offset) { _, candidate in
                            Button {
                                addLookupCandidate(candidate, lookup: lookup)
                                query = ""
                                lookupExpanded = false
                            } label: {
                                HStack(spacing: 8) {
                                    Text(lookupLabel(candidate, lookup: lookup))
                                        .font(.subheadline)
                                        .lineLimit(2)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    Image(systemName: "plus.circle.fill")
                                }
                            }
                            .buttonStyle(.bordered)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
            FeedEditableTableView(runtime: runtime, window: window, container: container)
        }
        .task(id: lookupTaskKey) { await loadLookupRows() }
        .task(id: "selected#\(lookupTaskKey)") { await observeSelectedRows() }
        .onChange(of: query) { _, _ in Task { await loadLookupRows() } }
        .onChange(of: provider) { _, _ in Task { await loadLookupRows() } }
        .onAppear {
            if provider.isEmpty { provider = lookup?["defaultProvider"]?.stringValue ?? "" }
        }
    }

    private var lookup: [String: JSONValue]? { container.lookup?.objectValue }
    private var lookupRef: String { lookup?["dataSourceRef"]?.stringValue ?? "" }
    private var lookupTaskKey: String { "\(window?.windowID ?? "")#\(lookupRef)" }
    private var filteredLookupRows: [[String: JSONValue]] {
        guard let lookup else { return [] }
        let valueField = lookup["valueField"]?.stringValue ?? "value"
        let selectionValueField = lookup["selectionValueField"]?.stringValue ?? valueField
        let selectedValues = Set(selectedRows.map { $0[selectionValueField]?.feedDisplayText ?? "" })
        return lookupRows.filter { row in
            (query.isEmpty || row.values.contains { $0.feedDisplayText.localizedCaseInsensitiveContains(query) }) &&
                !selectedValues.contains(row[valueField]?.feedDisplayText ?? "")
        }
    }

    private func loadLookupRows() async {
        guard let lookup else { return }
        if lookupRef.isEmpty {
            lookupRows = lookup["options"]?.arrayValue?.compactMap(\.objectValue) ?? []
            return
        }
        guard let runtime, let window else { return }
        let minimumLength = lookup["minQueryLength"]?.intValue ?? 0
        if query.count < minimumLength {
            lookupRows = []
            return
        }
        var flatInputs = lookup["inputs"]?.objectValue ?? [:]
        if case .array(let providers) = lookup["providers"],
           let selectedProvider = providers.compactMap(\.objectValue).first(where: { $0["id"]?.stringValue == provider }) {
            flatInputs.merge(selectedProvider["inputs"]?.objectValue ?? [:]) { _, providerValue in providerValue }
        }
        if let queryInput = lookup["queryInput"]?.stringValue, !queryInput.isEmpty {
            flatInputs[queryInput] = .string(query)
        }
        if let providerField = lookup["providerField"]?.stringValue, !providerField.isEmpty, !provider.isEmpty {
            flatInputs[providerField] = .string(provider)
        }
        if case .object(let bindings) = lookup["inputBindings"] {
            for (inputPath, rawBinding) in bindings {
                guard case .object(let binding) = rawBinding,
                      let sourceRef = binding["dataSourceRef"]?.stringValue,
                      !sourceRef.isEmpty else { continue }
                let sourceRows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: sourceRef)
                if let source = sourceRows.first,
                   let value = feedValue(at: binding["path"]?.stringValue ?? "", in: source) {
                    flatInputs[inputPath] = value
                }
            }
        }
        let filter = nestedFeedInputs(flatInputs)
        await runtime.setDataSourceFilter(windowID: window.windowID, dataSourceRef: lookupRef, filter: filter)
        lookupRows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: lookupRef)
    }

    private func observeSelectedRows() async {
        guard let runtime, let window, let ref = container.dataSourceRef, !ref.isEmpty else { return }
        selectedRows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
        let updates = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: ref)
        for await next in updates { selectedRows = next }
    }

    private func lookupLabel(_ row: [String: JSONValue], lookup: [String: JSONValue]) -> String {
        let labelField = lookup["labelField"]?.stringValue ?? "label"
        let valueField = lookup["valueField"]?.stringValue ?? "value"
        return normalizedFeedLookupText(row[labelField])
            ?? normalizedFeedLookupText(row["displayPath"])
            ?? normalizedFeedLookupText(row["path"])
            ?? normalizedFeedLookupText(row[valueField])
            ?? "Add"
    }

    private func addLookupCandidate(_ candidate: [String: JSONValue], lookup: [String: JSONValue]) {
        guard let runtime, let window, let targetRef = container.dataSourceRef else { return }
        let result = mapFeedLookupResult(candidate, lookup: lookup, provider: provider)
        let operation = FeedPatchOperation(dataSourceRef: targetRef, op: "add", path: "/collection/-", value: .object(result))
        Task {
            do {
                if try await runtime.dispatchFeedPatch(windowID: window.windowID, operation: operation) { return }
                _ = try await runtime.applyFeedPatchOperations(windowID: window.windowID, operations: [operation])
            } catch { return }
        }
    }
}

private func mapFeedLookupResult(
    _ candidate: [String: JSONValue],
    lookup: [String: JSONValue],
    provider: String
) -> [String: JSONValue] {
    var result: [String: JSONValue] = [:]
    if case .object(let mapping) = lookup["resultMapping"] {
        for (field, raw) in mapping {
            if case .string(let path) = raw {
                result[field] = normalizedFeedLookupValue(feedValue(at: path, in: candidate)) ?? .null
            } else if case .object(let config) = raw {
                if let constant = config["value"] { result[field] = constant }
                else if case .array(let choices) = config["firstOf"] {
                    result[field] = choices.compactMap { choice in
                        choice.stringValue.flatMap { normalizedFeedLookupValue(feedValue(at: $0, in: candidate)) }
                    }.first { !$0.feedDisplayText.isEmpty } ?? .null
                }
            }
        }
    }
    if result.isEmpty {
        let source = lookup["valueField"]?.stringValue ?? "value"
        let target = lookup["selectionValueField"]?.stringValue ?? source
        result[target] = candidate[source] ?? .null
    }
    if let providerField = lookup["providerField"]?.stringValue, !providerField.isEmpty, !provider.isEmpty {
        result[providerField] = .string(provider)
    }
    return result
}

private func feedColumnKey(_ column: ColumnDef) -> String? {
    let value = column.key ?? column.name ?? column.id
    let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return trimmed.isEmpty ? nil : trimmed
}

private func escapeFeedPointer(_ value: String) -> String {
    value.replacingOccurrences(of: "~", with: "~0").replacingOccurrences(of: "/", with: "~1")
}

private func isFeedNarrativeColumn(_ column: ColumnDef) -> Bool {
    let key = ((feedColumnKey(column) ?? "") + " " + (column.label ?? "")).lowercased()
    if ["reason", "rationale", "description", "strategy", "notes", "message"].contains(where: key.contains) {
        return true
    }
    return column.editor?.objectValue?["type"]?.stringValue?.lowercased() == "textarea"
}

private func feedColumnWidth(_ column: ColumnDef?, availableWidth: CGFloat) -> CGFloat {
    guard let column else { return min(140, availableWidth * 0.4) }
    if let width = column.width, width > 0 { return CGFloat(width) }
    let key = ((feedColumnKey(column) ?? "") + " " + (column.label ?? "")).lowercased()
    if isFeedNarrativeColumn(column) { return 320 }
    if key.contains("name") || key.contains("publisher") || key.contains("audience") || key.contains("deal") { return 220 }
    if key.contains("id") || key.contains("code") || key.contains("cpm") || key.contains("cost") || key.contains("budget") || key.contains("impression") || key.contains("reach") { return 128 }
    return 168
}

private func feedRowHeight(_ row: [String: JSONValue], columns: [ColumnDef]) -> CGFloat {
    let narrativeLength = columns
        .filter(isFeedNarrativeColumn)
        .compactMap { column in feedColumnKey(column).flatMap { row[$0]?.feedDisplayText.count } }
        .max() ?? 0
    guard narrativeLength > 0 else { return 52 }
    let estimatedLines = max(1, Int(ceil(Double(narrativeLength) / 42.0)))
    return min(82, max(58, CGFloat(estimatedLines * 17 + 30)))
}

private func feedTablePastelColor(key: String?, rowIndex: Int, header: Bool) -> Color {
    let seed = (key ?? "table").unicodeScalars.reduce(0) { ($0 + Int($1.value)) % 4 }
    let palette: [(red: Double, green: Double, blue: Double)] = [
        (0.84, 0.91, 0.99),
        (0.84, 0.96, 0.91),
        (0.99, 0.91, 0.82),
        (0.92, 0.88, 0.98)
    ]
    let color = palette[seed]
    let opacity = header ? 0.72 : (rowIndex.isMultiple(of: 2) ? 0.20 : 0.10)
    return Color(red: color.red, green: color.green, blue: color.blue).opacity(opacity)
}

private func feedValue(at path: String, in row: [String: JSONValue]) -> JSONValue? {
    let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return .object(row) }
    if let direct = row[trimmed] { return direct }
    var current: JSONValue = .object(row)
    for component in trimmed.split(separator: ".").map(String.init) {
        guard case .object(let object) = current, let next = object[component] else { return nil }
        current = next
    }
    return current
}

private func nestedFeedInputs(_ flat: [String: JSONValue]) -> [String: JSONValue] {
    var result: [String: JSONValue] = [:]
    for (path, value) in flat {
        insertFeedInput(value, components: path.split(separator: ".").map(String.init), into: &result)
    }
    return result
}

private func insertFeedInput(_ value: JSONValue, components: [String], into object: inout [String: JSONValue]) {
    guard let first = components.first else { return }
    if components.count == 1 {
        object[first] = value
        return
    }
    var child = object[first]?.objectValue ?? [:]
    insertFeedInput(value, components: Array(components.dropFirst()), into: &child)
    object[first] = .object(child)
}

private func normalizedFeedLookupText(_ value: JSONValue?) -> String? {
    guard let value else { return nil }
    let text: String
    switch value {
    case .array(let entries): text = entries.compactMap(normalizedFeedLookupText).joined(separator: " / ")
    case .object: text = ""
    default: text = value.feedDisplayText
    }
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty || trimmed.lowercased() == "null" ? nil : trimmed
}

private func normalizedFeedLookupValue(_ value: JSONValue?) -> JSONValue? {
    guard let value else { return nil }
    if case .array = value { return normalizedFeedLookupText(value).map(JSONValue.string) }
    return value
}

private extension String {
    var nonEmptyFeedText: String? { isEmpty ? nil : self }
}

private extension JSONValue {
    var feedDisplayText: String {
        switch self {
        case .string(let value): return value
        case .number(let value): return value.rounded() == value ? String(Int(value)) : String(value)
        case .bool(let value): return value ? "true" : "false"
        case .null: return ""
        case .array(let values): return values.map(\.feedDisplayText).joined(separator: ", ")
        case .object: return ""
        }
    }
}
