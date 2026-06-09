import SwiftUI
import ForgeIOSRuntime

private let hostedWorkspaceDidOpenNotification = Notification.Name("forgeHostedWorkspaceDidOpen")

public struct MenuListRenderer: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.openURL) private var openURL

    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let items: [ItemDef]

    @State private var windowFormValues: [String: JSONValue] = [:]
    @State private var formValuesByDataSource: [String: [String: JSONValue]] = [:]
    @State private var metricsValuesByDataSource: [String: [String: JSONValue]] = [:]
    @State private var collectionValuesByDataSource: [String: [[String: JSONValue]]] = [:]

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef, items: [ItemDef]) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.items = items
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if shouldUseInlineRow {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(visibleItems) { item in
                            renderedItem(item)
                        }
                    }
                }
            } else if shouldUseSummaryGrid {
                if summaryItems.isEmpty {
                    emptyStateCard("No data available for this section yet.")
                } else {
                    LazyVGrid(columns: summaryColumns, spacing: 12) {
                        ForEach(summaryItems) { item in
                            summaryCard(item)
                        }
                    }
                    if summaryItems.count < visibleItems.count {
                        Text("Some values are unavailable for this view.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
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

    private var summaryItems: [ItemDef] {
        visibleItems.filter { item in
            !isPlaceholderSummaryValue(resolvedItemDisplayValue(item) ?? item.value?.displayString)
        }
    }

    private var relevantDataSourceRefs: [String] {
        orderedUnique(
            ([container.dataSourceRef].compactMap { $0 } + items.compactMap(resolveItemDataSourceRef(_:)))
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
            case "link":
                linkItem(item)
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
        let value = normalizedItemDisplayValue(item)
        let isInline = (item.appearance ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "inline"
        if isInline {
            Text(value == "No data" ? title : value)
                .font(.footnote.weight(.medium))
                .foregroundStyle(.secondary)
        } else {
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
            .background(Color.forgeSystemBackground, in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color.black.opacity(0.05), lineWidth: 1)
            )
        }
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
        let value = normalizedItemDisplayValue(item)
        let showsSingleLineValue = shouldUseCompactSummaryStyle(title: title, value: value)
        VStack(alignment: .leading, spacing: 8) {
            if showsSingleLineValue && value != "No data" {
                Text(value)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                if normalizedSummaryTitle(title) != normalizedSummaryTitle(value) {
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
        .background(Color.forgeSystemBackground, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func emptyStateCard(_ message: String) -> some View {
        Text(message)
            .font(.footnote)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
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
                                    .fill(isSelected ? Color.accentColor.opacity(0.14) : Color.forgeSystemBackground)
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
        .background(Color.forgeSystemBackground, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func linkItem(_ item: ItemDef) -> some View {
        let title = resolvedLinkDisplayText(item)
        let isInline = (item.appearance ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "inline"
        if let url = resolvedExternalLinkURL(item) {
            Link(destination: url) {
                Text(title)
                    .font(isInline ? .footnote.weight(.semibold) : .body.weight(.semibold))
                    .foregroundStyle(isInline ? Color.accentColor : .primary)
                    .padding(.horizontal, isInline ? 10 : 14)
                    .padding(.vertical, isInline ? 6 : 10)
                    .frame(maxWidth: isInline ? nil : .infinity, alignment: .leading)
                    .background(
                        isInline
                            ? Color.accentColor.opacity(0.10)
                            : Color.forgeSystemBackground,
                        in: RoundedRectangle(cornerRadius: isInline ? 999 : 14)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: isInline ? 999 : 14)
                            .stroke(Color.accentColor.opacity(isInline ? 0.18 : 0.05), lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
        } else {
            Button(title) {
                Task {
                    await openLinkedWindow(item)
                }
            }
            .buttonStyle(.plain)
            .font(isInline ? .footnote.weight(.semibold) : .body.weight(.semibold))
            .foregroundStyle(isInline ? Color.accentColor : .primary)
            .padding(.horizontal, isInline ? 10 : 14)
            .padding(.vertical, isInline ? 6 : 10)
            .frame(maxWidth: isInline ? nil : .infinity, alignment: .leading)
            .background(
                isInline
                    ? Color.accentColor.opacity(0.10)
                    : Color.forgeSystemBackground,
                in: RoundedRectangle(cornerRadius: isInline ? 999 : 14)
            )
            .overlay(
                RoundedRectangle(cornerRadius: isInline ? 999 : 14)
                    .stroke(Color.accentColor.opacity(isInline ? 0.18 : 0.05), lineWidth: 1)
            )
        }
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

    private func openLinkedWindow(_ item: ItemDef) async {
        guard let runtime, let window else {
            return
        }
        guard let link = item.link else {
            return
        }
        let windowKey = (link.windowKey ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !windowKey.isEmpty else {
            if let url = resolvedExternalLinkURL(item) {
                openURL(url)
            }
            return
        }

        let context = LinkResolutionContext(
            row: [:],
            value: resolvedItemValue(item),
            form: {
                guard let ref = resolveItemDataSourceRef(item) else { return [:] }
                return formValuesByDataSource[ref] ?? [:]
            }(),
            metrics: {
                guard let ref = resolveItemDataSourceRef(item) else { return [:] }
                return metricsValuesByDataSource[ref] ?? [:]
            }(),
            windowForm: windowFormValues
        )
        let state = await openResolvedWindowLink(
            runtime: runtime,
            window: window,
            link: WindowLinkTarget(
                windowKey: windowKey,
                title: resolveLinkWindowTitleFromContext(
                    link: link,
                    context: context,
                    fallbackTitle: resolvedLinkDisplayText(item)
                ),
                parameters: resolveLinkParametersFromContext(link: link, context: context),
                inTab: link.inTab != false,
                modal: link.modal == true,
                newInstance: link.newInstance == true
            )
        )
        await MainActor.run {
            NotificationCenter.default.post(
                name: hostedWorkspaceDidOpenNotification,
                object: nil,
                userInfo: ["state": state]
            )
        }
    }

    private func loadValues() async {
        guard let runtime, let window else {
            await MainActor.run {
                windowFormValues = [:]
                formValuesByDataSource = [:]
                metricsValuesByDataSource = [:]
                collectionValuesByDataSource = [:]
            }
            return
        }

        let currentWindowForm = await runtime.windowFormJSONValue(windowID: window.windowID)
        await MainActor.run {
            windowFormValues = currentWindowForm
        }

        var nextForms: [String: [String: JSONValue]] = [:]
        var nextMetrics: [String: [String: JSONValue]] = [:]
        var nextCollections: [String: [[String: JSONValue]]] = [:]
        for ref in relevantDataSourceRefs {
            var form = await runtime.formJSONValue(windowID: window.windowID, dataSourceRef: ref)
            var metrics = await runtime.dataSourceMetrics(windowID: window.windowID, dataSourceRef: ref)
            var collection = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
            if container.fetchData != false && form.isEmpty && metrics.isEmpty {
                await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
                form = await runtime.formJSONValue(windowID: window.windowID, dataSourceRef: ref)
                metrics = await runtime.dataSourceMetrics(windowID: window.windowID, dataSourceRef: ref)
                collection = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
            }
            nextForms[ref] = form
            nextMetrics[ref] = metrics
            nextCollections[ref] = collection
        }

        await MainActor.run {
            formValuesByDataSource = nextForms
            metricsValuesByDataSource = nextMetrics
            collectionValuesByDataSource = nextCollections
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
                        await refreshDependentDataSources(sourceRef: ref, sourceKind: "form")
                    }
                }
                group.addTask {
                    let stream = await runtime.dataSourceMetricsUpdates(windowID: window.windowID, dataSourceRef: ref)
                    for await next in stream {
                        await MainActor.run {
                            metricsValuesByDataSource[ref] = next
                        }
                        await refreshDependentDataSources(sourceRef: ref, sourceKind: "metrics")
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

    private func refreshDependentDataSources(sourceRef: String, sourceKind: String) async {
        guard let runtime, let window else {
            return
        }
        guard container.fetchData != false else {
            return
        }
        guard let metadata = await runtime.windowMetadata(id: window.windowID) else {
            return
        }
        let refs = relevantDataSourceRefs(for: windowFormValues)
        for ref in refs where ref != sourceRef {
            guard dataSourceDependsOnUpstream(metadata.dataSources[ref], sourceRef: sourceRef, sourceKind: sourceKind) else {
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
            if let resolved = jsonValue(from: SelectorUtil.resolve(metricsValuesByDataSource[ref], selector: key)),
               resolved != .null {
                return resolved
            }
            let firstRow = collectionValuesByDataSource[ref]?.first ?? [:]
            return jsonValue(from: SelectorUtil.resolve(firstRow, selector: key))
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

    private func resolvedLinkDisplayText(_ item: ItemDef) -> String {
        let raw = resolvedItemDisplayValue(item)
            ?? item.link?.text?.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? item.label
            ?? item.title
            ?? item.id
            ?? item.link?.windowTitle
            ?? item.link?.windowKey
            ?? "Open"
        return isPlaceholderSummaryValue(raw) ? "No data" : raw
    }

    private func normalizedItemDisplayValue(_ item: ItemDef) -> String {
        let raw = resolvedItemDisplayValue(item) ?? item.value?.displayString
        return isPlaceholderSummaryValue(raw) ? "No data" : (raw ?? "No data")
    }

    private func resolveLinkParameters(_ item: ItemDef, link: LinkDef) -> [String: JSONValue] {
        var resolved: [String: JSONValue] = [:]
        for (key, spec) in link.parameters {
            guard let value = resolveLinkParameterValue(spec, item: item) else {
                continue
            }
            resolved[key] = value
        }
        return resolved
    }

    private func resolveLinkParameterValue(_ spec: JSONValue, item: ItemDef) -> JSONValue? {
        guard let object = spec.objectValue else {
            return spec
        }
        let source = (object["source"]?.stringValue ?? "value")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let selector = (object["selector"]?.stringValue
            ?? object["field"]?.stringValue
            ?? object["location"]?.stringValue
            ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let wrap = (object["wrap"]?.stringValue ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        let candidate: JSONValue?
        switch source {
        case "metrics":
            if let ref = resolveItemDataSourceRef(item) {
                if selector.isEmpty {
                    if let firstRow = collectionValuesByDataSource[ref]?.first, !firstRow.isEmpty {
                        candidate = .object(firstRow)
                    } else {
                        candidate = .object(metricsValuesByDataSource[ref] ?? [:])
                    }
                } else if let resolved = jsonValue(from: SelectorUtil.resolve(metricsValuesByDataSource[ref], selector: selector)),
                          resolved != .null {
                    candidate = resolved
                } else {
                    let firstRow = collectionValuesByDataSource[ref]?.first ?? [:]
                    candidate = jsonValue(from: SelectorUtil.resolve(firstRow, selector: selector))
                }
            } else {
                candidate = nil
            }
        case "form":
            if let ref = resolveItemDataSourceRef(item) {
                candidate = selector.isEmpty
                    ? .object(formValuesByDataSource[ref] ?? [:])
                    : jsonValue(from: SelectorUtil.resolve(formValuesByDataSource[ref], selector: selector))
            } else {
                candidate = nil
            }
        case "windowform":
            candidate = selector.isEmpty
                ? .object(windowFormValues)
                : jsonValue(from: SelectorUtil.resolve(windowFormValues, selector: selector))
        case "value":
            if selector.isEmpty {
                candidate = resolvedItemValue(item)
            } else if let base = resolvedItemValue(item)?.objectValue {
                candidate = jsonValue(from: SelectorUtil.resolve(base, selector: selector))
            } else {
                candidate = nil
            }
        default:
            candidate = selector.isEmpty ? resolvedItemValue(item) : nil
        }

        guard let candidate else {
            return nil
        }
        if wrap == "array" {
            return .array([candidate])
        }
        return candidate
    }

    private func resolveLinkWindowTitle(_ item: ItemDef, link: LinkDef) -> String {
        let source = (link.windowTitleSource ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        if source == "value" || !source.isEmpty {
            let value = resolvedItemDisplayValue(item)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !value.isEmpty {
                return value
            }
        }
        let explicit = (link.windowTitle ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !explicit.isEmpty {
            return explicit
        }
        return resolvedLinkDisplayText(item)
    }

    private func resolvedExternalLinkURL(_ item: ItemDef) -> URL? {
        let href = item.link?.href?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !href.isEmpty else {
            return nil
        }
        return URL(string: href)
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
                if let resolved = jsonValue(from: SelectorUtil.resolve(metricsValuesByDataSource[ref], selector: field)),
                   resolved != .null {
                    candidate = resolved
                } else {
                    let firstRow = collectionValuesByDataSource[ref]?.first ?? [:]
                    candidate = jsonValue(from: SelectorUtil.resolve(firstRow, selector: field))
                }
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

    private var shouldUseInlineRow: Bool {
        !visibleItems.isEmpty && visibleItems.allSatisfy { item in
            String(item.appearance ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "inline"
        }
    }

    private func isPlaceholderSummaryValue(_ value: String?) -> Bool {
        let normalized = value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        return normalized.isEmpty || ["-", "—", "/", "n/a", "na", "null"].contains(normalized)
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

private func dataSourceDependsOnUpstream(
    _ dataSource: DataSourceDef?,
    sourceRef: String,
    sourceKind: String
) -> Bool {
    guard let dataSource else {
        return false
    }
    let normalizedSourceRef = sourceRef.trimmingCharacters(in: .whitespacesAndNewlines)
    let normalizedKind = sourceKind.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return dataSource.parameters.contains { parameter in
        let input = (parameter.input ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let location = (parameter.location?.stringValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return input == normalizedKind && location.hasPrefix("\(normalizedSourceRef).")
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
