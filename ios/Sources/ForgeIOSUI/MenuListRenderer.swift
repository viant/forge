import SwiftUI
import ForgeIOSRuntime

public struct MenuListRenderer: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let items: [ItemDef]

    @State private var windowFormValues: [String: JSONValue] = [:]
    @State private var formValuesByDataSource: [String: [String: JSONValue]] = [:]
    @State private var metricsValuesByDataSource: [String: [String: JSONValue]] = [:]

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef, items: [ItemDef]) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.items = items
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if shouldUseSummaryGrid {
                LazyVGrid(columns: summaryColumns, spacing: 12) {
                    ForEach(visibleItems) { item in
                        summaryCard(item)
                    }
                }
            } else {
                ForEach(visibleItems) { item in
                    renderedItem(item)
                }
            }
        }
        .task(id: dataTaskKey) {
            await loadValues()
        }
        .task(id: dataSubscriptionKey) {
            await observeDataSources()
        }
        .task(id: window?.windowID ?? "") {
            await observeWindowForm()
        }
    }

    private var dataTaskKey: String {
        [
            window?.windowID ?? "",
            container.id ?? "",
            windowFormSignature,
            relevantDataSourceRefs.joined(separator: "|"),
            items.map { $0.id ?? $0.label ?? "" }.joined(separator: "|")
        ].joined(separator: ":")
    }

    private var dataSubscriptionKey: String {
        [
            window?.windowID ?? "",
            windowFormSignature,
            relevantDataSourceRefs.joined(separator: "|"),
            "data"
        ].joined(separator: ":")
    }

    private var visibleItems: [ItemDef] {
        items.filter(isVisible(_:))
    }

    private var relevantDataSourceRefs: [String] {
        orderedUnique(
            items.compactMap(resolveItemDataSourceRef(_:))
                .filter { !$0.isEmpty }
        )
    }

    private var windowFormSignature: String {
        windowFormValues.signature
    }

    @ViewBuilder
    private func renderedItem(_ item: ItemDef) -> some View {
        if shouldRenderOptionGroup(item) {
            optionGroupItem(item)
        } else {
            switch (item.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
            case "markdown":
                markdownItem(item)
            case "button":
                buttonItem(item)
            default:
                labelItem(item)
            }
        }
    }

    @ViewBuilder
    private func labelItem(_ item: ItemDef) -> some View {
        let title = item.label ?? item.title ?? item.id ?? "Item"
        let value = resolvedItemDisplayValue(item) ?? item.value?.displayString ?? "—"
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.body)
                .foregroundStyle(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func markdownItem(_ item: ItemDef) -> some View {
        let markdown = resolvedItemDisplayValue(item)
            ?? item.value?.displayString
            ?? item.properties["value"]?.displayString
            ?? ""
        if markdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.secondary.opacity(0.08))
                .frame(maxWidth: .infinity, minHeight: 96, alignment: .leading)
        } else {
            MarkdownRenderer(markdown: markdown)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        }
    }

    @ViewBuilder
    private func summaryCard(_ item: ItemDef) -> some View {
        let title = item.label ?? item.title ?? item.id ?? "Item"
        let value = resolvedItemDisplayValue(item) ?? item.value?.displayString ?? "—"
        let showsSingleLineValue = shouldUseCompactSummaryStyle(title: title, value: value)
        VStack(alignment: .leading, spacing: 8) {
            if showsSingleLineValue {
                Text(value == "—" ? title : value)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                if value != "—", normalizedSummaryTitle(title) != normalizedSummaryTitle(value) {
                    Text(title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            } else {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                Text(value)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
            }
        }
        .frame(maxWidth: .infinity, minHeight: showsSingleLineValue ? 56 : 80, alignment: .topLeading)
        .padding(.horizontal, 14)
        .padding(.vertical, showsSingleLineValue ? 12 : 14)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func optionGroupItem(_ item: ItemDef) -> some View {
        let title = item.label ?? item.title ?? item.id ?? "Control"
        let selectedValue = resolvedItemDisplayValue(item)
            ?? item.value?.displayString
            ?? item.options.first(where: { $0.default == true })?.value
            ?? item.options.first?.value
            ?? ""

        VStack(alignment: .leading, spacing: 10) {
            if !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(title)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            LazyVGrid(columns: optionColumns(for: item), alignment: .leading, spacing: 6) {
                ForEach(item.options, id: \.value) { option in
                    let optionValue = option.value ?? ""
                    let optionLabel = option.label ?? optionValue
                    let isSelected = optionValue == selectedValue
                    Button {
                        applyOptionSelection(optionValue, for: item)
                    } label: {
                        Text(optionLabel)
                            .font(.footnote.weight(isSelected ? .semibold : .medium))
                            .foregroundStyle(isSelected ? Color.accentColor : Color.primary)
                            .frame(maxWidth: .infinity)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(
                                Capsule()
                                    .fill(isSelected ? Color.accentColor.opacity(0.14) : Color(.systemBackground))
                            )
                            .overlay(
                                Capsule()
                                    .stroke(isSelected ? Color.accentColor.opacity(0.22) : Color.black.opacity(0.05), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func buttonItem(_ item: ItemDef) -> some View {
        let title = item.properties["text"]?.displayString ?? item.label ?? item.title ?? item.id ?? "Action"
        Button(title) {
            guard let runtime, let window, let execution = item.on.first else { return }
            Task {
                _ = await runtime.execute(
                    execution,
                    context: ExecutionContext(
                        windowID: window.windowID,
                        dataSourceRef: resolveItemDataSourceRef(item) ?? container.dataSourceRef ?? ""
                    )
                )
            }
        }
        .buttonStyle(.borderedProminent)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func observeWindowForm() async {
        guard let runtime, let window else {
            return
        }
        windowFormValues = await runtime.windowFormJSONValue(windowID: window.windowID)
        let stream = await runtime.windowFormUpdates(windowID: window.windowID)
        for await next in stream {
            await MainActor.run {
                windowFormValues = next
            }
            Task(priority: .userInitiated) {
                await refreshWindowFormDrivenDataSources(windowFormValues: next)
            }
        }
    }

    private func loadValues() async {
        guard let runtime, let window else {
            await MainActor.run {
                windowFormValues = [:]
                formValuesByDataSource = [:]
                metricsValuesByDataSource = [:]
            }
            return
        }

        let currentWindowForm = await runtime.windowFormJSONValue(windowID: window.windowID)
        await MainActor.run {
            windowFormValues = currentWindowForm
        }

        var nextForms: [String: [String: JSONValue]] = [:]
        var nextMetrics: [String: [String: JSONValue]] = [:]
        for ref in relevantDataSourceRefs {
            let form = await runtime.formJSONValue(windowID: window.windowID, dataSourceRef: ref)
            let metrics = await runtime.dataSourceMetrics(windowID: window.windowID, dataSourceRef: ref)
            if container.fetchData != false && form.isEmpty && metrics.isEmpty {
                Task {
                    await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
                }
            }
            nextForms[ref] = form
            nextMetrics[ref] = metrics
        }

        await MainActor.run {
            formValuesByDataSource = nextForms
            metricsValuesByDataSource = nextMetrics
        }
    }

    private func observeDataSources() async {
        guard let runtime, let window, !relevantDataSourceRefs.isEmpty else {
            return
        }
        await withTaskGroup(of: Void.self) { group in
            for ref in relevantDataSourceRefs {
                group.addTask {
                    let stream = await runtime.dataSourceFormUpdates(windowID: window.windowID, dataSourceRef: ref)
                    for await next in stream {
                        await MainActor.run {
                            formValuesByDataSource[ref] = next
                        }
                    }
                }
                group.addTask {
                    let stream = await runtime.dataSourceMetricsUpdates(windowID: window.windowID, dataSourceRef: ref)
                    for await next in stream {
                        await MainActor.run {
                            metricsValuesByDataSource[ref] = next
                        }
                    }
                }
            }
            await group.waitForAll()
        }
    }

    private func refreshWindowFormDrivenDataSources(windowFormValues: [String: JSONValue]) async {
        guard let runtime, let window else {
            return
        }
        guard container.fetchData != false else {
            return
        }
        guard let metadata = await runtime.windowMetadata(id: window.windowID) else {
            return
        }
        for ref in relevantDataSourceRefs(for: windowFormValues) {
            guard dataSourceDependsOnWindowForm(metadata.dataSources[ref]) else {
                continue
            }
            Task(priority: .userInitiated) {
                await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
            }
        }
    }

    private func relevantDataSourceRefs(for windowFormValues: [String: JSONValue]) -> [String] {
        orderedUnique(
            items.compactMap { resolveItemDataSourceRef($0, windowFormValues: windowFormValues) }
                .filter { !$0.isEmpty }
        )
    }

    private func resolveItemDataSourceRef(_ item: ItemDef) -> String? {
        resolveItemDataSourceRef(item, windowFormValues: windowFormValues)
    }

    private func resolveItemDataSourceRef(
        _ item: ItemDef,
        windowFormValues: [String: JSONValue]
    ) -> String? {
        let directRef = item.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        if let directRef {
            return directRef
        }
        guard !item.dataSourceRefs.isEmpty else {
            return container.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        }
        let source = item.dataSourceRefSource?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "windowform"
        let selector = item.dataSourceRefSelector?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !selector.isEmpty else {
            return item.dataSourceRefs.values.first?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
                ?? container.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        }
        let key: String?
        switch source {
        case "windowform":
            key = selectorStringValue(from: SelectorUtil.resolve(windowFormValues, selector: selector))
        case "form":
            if let containerRef = container.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty {
                key = selectorStringValue(from: SelectorUtil.resolve(formValuesByDataSource[containerRef], selector: selector))
            } else {
                key = nil
            }
        case "metrics":
            if let containerRef = container.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty {
                key = selectorStringValue(from: SelectorUtil.resolve(metricsValuesByDataSource[containerRef], selector: selector))
            } else {
                key = nil
            }
        default:
            key = nil
        }
        if let key = key?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
           let mapped = item.dataSourceRefs[key]?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty {
            return mapped
        }
        return item.dataSourceRefs.values.first?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            ?? container.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    }

    private func resolvedItemValue(_ item: ItemDef) -> JSONValue? {
        let key = (item.field ?? item.dataField ?? item.bindingPath ?? item.id ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty else {
            return item.value
        }
        switch item.scope?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "metrics":
            guard let ref = resolveItemDataSourceRef(item) else { return nil }
            return jsonValue(from: SelectorUtil.resolve(metricsValuesByDataSource[ref], selector: key))
        case "windowform":
            return jsonValue(from: SelectorUtil.resolve(windowFormValues, selector: key))
        default:
            guard let ref = resolveItemDataSourceRef(item) else { return nil }
            return jsonValue(from: SelectorUtil.resolve(formValuesByDataSource[ref], selector: key))
        }
    }

    private func resolvedItemDisplayValue(_ item: ItemDef) -> String? {
        resolvedItemValue(item)?.displayString
    }

    private func isVisible(_ item: ItemDef) -> Bool {
        guard let visibleWhen = item.visibleWhen else {
            return true
        }
        let source = visibleWhen.source?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        let field = visibleWhen.field?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !field.isEmpty else {
            return true
        }
        let candidate: JSONValue?
        switch source {
        case "windowform":
            candidate = jsonValue(from: SelectorUtil.resolve(windowFormValues, selector: field))
        case "metrics":
            if let ref = resolveItemDataSourceRef(item) {
                candidate = jsonValue(from: SelectorUtil.resolve(metricsValuesByDataSource[ref], selector: field))
            } else {
                candidate = nil
            }
        default:
            if let ref = resolveItemDataSourceRef(item) {
                candidate = jsonValue(from: SelectorUtil.resolve(formValuesByDataSource[ref], selector: field))
            } else {
                candidate = nil
            }
        }
        if let equals = visibleWhen.equals?.displayString {
            return candidate?.displayString == equals
        }
        return candidate != nil && candidate?.displayString != "—"
    }

    private func orderedUnique(_ refs: [String]) -> [String] {
        var seen = Set<String>()
        var ordered: [String] = []
        for ref in refs where seen.insert(ref).inserted {
            ordered.append(ref)
        }
        return ordered
    }

    private var shouldUseSummaryGrid: Bool {
        visibleItems.count >= 2 && visibleItems.allSatisfy { item in
            let type = (item.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return (type.isEmpty || type == "label") && item.options.isEmpty
        }
    }

    private var summaryColumns: [GridItem] {
        let minimumWidth: CGFloat = horizontalSizeClass == .regular ? 132 : 150
        return [GridItem(.adaptive(minimum: minimumWidth), spacing: 12, alignment: .top)]
    }

    private func optionColumns(for item: ItemDef) -> [GridItem] {
        let type = (item.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if type == "buttongroup" || type == "button_group" || type == "button-group" {
            return [GridItem(.adaptive(minimum: horizontalSizeClass == .regular ? 78 : 96), spacing: 6, alignment: .top)]
        }
        return [GridItem(.adaptive(minimum: horizontalSizeClass == .regular ? 86 : 104), spacing: 6, alignment: .top)]
    }

    private func shouldRenderOptionGroup(_ item: ItemDef) -> Bool {
        guard !item.options.isEmpty else {
            return false
        }
        let type = (item.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let scope = (item.scope ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return scope == "windowform" || type == "buttongroup" || type == "button_group" || type == "button-group" || type == "radio"
    }

    private func applyOptionSelection(_ value: String, for item: ItemDef) {
        guard let runtime, let window else {
            return
        }
        let key = (item.bindingPath ?? item.dataField ?? item.field ?? item.id ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty else {
            return
        }
        let scope = (item.scope ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard scope == "windowform" else {
            return
        }
        Task {
            await runtime.setWindowFormValue(
                windowID: window.windowID,
                values: [key: .string(value)]
            )
        }
    }

    private func shouldUseCompactSummaryStyle(title: String, value: String) -> Bool {
        let normalizedTitle = normalizedSummaryTitle(title)
        let normalizedValue = normalizedSummaryTitle(value)
        if normalizedValue == "—" {
            return normalizedTitle.count <= 16
        }
        return normalizedTitle.count <= 18 && normalizedValue.count <= 16
    }

    private func normalizedSummaryTitle(_ text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}

private func dataSourceDependsOnWindowForm(_ dataSource: DataSourceDef?) -> Bool {
    guard let dataSource else {
        return false
    }
    return dataSource.parameters.contains { parameter in
        let source = (parameter.input ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        return source == "windowform"
    }
}

private func selectorStringValue(from value: Any?) -> String? {
    switch value {
    case let string as String:
        return string
    case let json as JSONValue:
        return json.displayString
    default:
        return nil
    }
}

private func jsonValue(from value: Any?) -> JSONValue? {
    guard let value else {
        return .null
    }
    switch value {
    case let value as JSONValue:
        return value
    case let value as String:
        return .string(value)
    case let value as Bool:
        return .bool(value)
    case let value as Int:
        return .number(Double(value))
    case let value as Int64:
        return .number(Double(value))
    case let value as Double:
        return .number(value)
    case let value as Float:
        return .number(Double(value))
    case let value as NSNumber:
        return .number(value.doubleValue)
    case let value as [String: JSONValue]:
        return .object(value)
    case let value as [String: Any]:
        var object: [String: JSONValue] = [:]
        for (key, child) in value {
            guard let json = jsonValue(from: child) else { return nil }
            object[key] = json
        }
        return .object(object)
    case let value as [JSONValue]:
        return .array(value)
    case let value as [Any]:
        let array = value.compactMap(jsonValue(from:))
        guard array.count == value.count else { return nil }
        return .array(array)
    default:
        return nil
    }
}

private extension JSONValue {
    var displayString: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            if value.rounded(.towardZero) == value {
                return String(Int(value))
            }
            return String(value)
        case .bool(let value):
            return value ? "true" : "false"
        case .array(let value):
            return value.map(\.displayString).joined(separator: ", ")
        case .object(let value):
            return value.keys.sorted().map { "\($0): \(value[$0]?.displayString ?? "—")" }.joined(separator: ", ")
        case .null:
            return "—"
        }
    }

    var signature: String {
        switch self {
        case .string(let value):
            return "s:\(value)"
        case .number(let value):
            return "n:\(value)"
        case .bool(let value):
            return "b:\(value)"
        case .array(let values):
            return "a:[\(values.map(\.signature).joined(separator: ","))]"
        case .object(let values):
            return "o:{\(values.keys.sorted().map { "\($0)=\(values[$0]?.signature ?? "null")" }.joined(separator: ","))}"
        case .null:
            return "null"
        }
    }
}

private extension Dictionary where Key == String, Value == JSONValue {
    var signature: String {
        keys.sorted().map { "\($0)=\(self[$0]?.signature ?? "null")" }.joined(separator: "|")
    }
}

private extension JSONPrimitive {
    var displayString: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            if value.rounded(.towardZero) == value {
                return String(Int(value))
            }
            return String(value)
        case .bool(let value):
            return value ? "true" : "false"
        case .null:
            return "—"
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
