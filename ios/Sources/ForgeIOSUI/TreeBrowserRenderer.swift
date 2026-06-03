import SwiftUI
import ForgeIOSRuntime

public struct TreeBrowserRenderer: View {
    @Environment(\.forgeDialogSelectionMode) private var dialogSelectionMode

    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let treeBrowser: TreeBrowserDef

    @State private var rows: [[String: JSONValue]] = []
    @State private var selection: SelectionState = SelectionState()
    @State private var expandedNodeIDs: Set<String> = []

    public init(
        runtime: ForgeRuntime? = nil,
        window: WindowContext? = nil,
        container: ContainerDef,
        treeBrowser: TreeBrowserDef
    ) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.treeBrowser = treeBrowser
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = resolvedTitle {
                Text(title)
                    .font(.subheadline.weight(.semibold))
            }

            if treeNodes.isEmpty {
                Text("No tree data")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 6)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(treeNodes) { node in
                        nodeRow(node, depth: 0)
                    }
                }
            }
        }
        .task(id: dataTaskKey) {
            await loadRows()
        }
        .task(id: subscriptionTaskKey) {
            await observeRows()
        }
        .task(id: selectionTaskKey) {
            await observeSelection()
        }
    }

    private var resolvedTitle: String? {
        let treeTitle = treeBrowser.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        let containerTitle = container.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let treeTitle, !treeTitle.isEmpty else {
            return nil
        }
        if let containerTitle, !containerTitle.isEmpty,
           treeTitle.compare(containerTitle, options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame {
            return nil
        }
        return treeTitle
    }

    private var resolvedDataSourceRef: String {
        treeBrowser.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            ?? container.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            ?? ""
    }

    private var dataTaskKey: String {
        [window?.windowID ?? "", container.id ?? "", resolvedDataSourceRef].joined(separator: ":")
    }

    private var subscriptionTaskKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, "rows"].joined(separator: ":")
    }

    private var selectionTaskKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, "selection"].joined(separator: ":")
    }

    private var isMultiSelect: Bool {
        dialogSelectionMode.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "multi"
    }

    private var treeNodes: [TreeBrowserNode] {
        TreeBrowserNode.build(rows: rows, config: treeBrowser)
    }

    private func loadRows() async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else {
            rows = []
            selection = SelectionState()
            expandedNodeIDs = []
            return
        }
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        selection = await runtime.dataSourceSelectionState(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        await MainActor.run {
            seedExpandedNodeIDsIfNeeded()
        }
    }

    private func observeRows() async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else {
            return
        }
        let stream = await runtime.dataSourceCollectionUpdates(
            windowID: window.windowID,
            dataSourceRef: resolvedDataSourceRef
        )
        for await next in stream {
            await MainActor.run {
                rows = next
                seedExpandedNodeIDsIfNeeded()
            }
        }
    }

    private func observeSelection() async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else {
            return
        }
        let stream = await runtime.dataSourceSelectionUpdates(
            windowID: window.windowID,
            dataSourceRef: resolvedDataSourceRef
        )
        for await next in stream {
            await MainActor.run {
                selection = next
            }
        }
    }

    private func nodeRow(_ node: TreeBrowserNode, depth: Int) -> AnyView {
        AnyView(
            VStack(alignment: .leading, spacing: 4) {
            Button {
                if node.isLeaf {
                    Task {
                        await toggleSelection(for: node)
                    }
                } else {
                    toggleExpansion(for: node)
                }
            } label: {
                HStack(alignment: .center, spacing: 8) {
                    Color.clear
                        .frame(width: CGFloat(depth) * 16, height: 1)

                    Image(systemName: iconName(for: node))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(node.isLeaf ? .secondary : .primary)
                        .frame(width: 14)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(node.label)
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)
                        if !node.secondaryLabel.isEmpty {
                            Text(node.secondaryLabel)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }

                    Spacer(minLength: 0)

                    if isSelected(node) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.tint)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(isSelected(node) ? Color.accentColor.opacity(0.12) : Color.secondary.opacity(0.05))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(isSelected(node) ? Color.accentColor.opacity(0.35) : Color.clear, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel(accessibilityLabel(for: node))
            .accessibilityAddTraits(node.isLeaf ? .isButton : [])

            if !node.isLeaf && expandedNodeIDs.contains(node.id) {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(node.children) { child in
                        nodeRow(child, depth: depth + 1)
                    }
                }
            }
            }
        )
    }

    private func iconName(for node: TreeBrowserNode) -> String {
        if node.isLeaf {
            return "tag"
        }
        return expandedNodeIDs.contains(node.id) ? "chevron.down" : "chevron.right"
    }

    private func accessibilityLabel(for node: TreeBrowserNode) -> String {
        let prefix = node.isLeaf ? "Tree item" : "Tree group"
        if node.secondaryLabel.isEmpty {
            return "\(prefix) \(node.label)"
        }
        return "\(prefix) \(node.label), \(node.secondaryLabel)"
    }

    private func toggleExpansion(for node: TreeBrowserNode) {
        if expandedNodeIDs.contains(node.id) {
            expandedNodeIDs.remove(node.id)
        } else {
            expandedNodeIDs.insert(node.id)
        }
    }

    private func isSelected(_ node: TreeBrowserNode) -> Bool {
        let payload = node.selectionPayload
        if selection.selected == payload {
            return true
        }
        return selection.selection.contains(payload)
    }

    private func toggleSelection(for node: TreeBrowserNode) async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else { return }
        let payload = node.selectionPayload
        let latestSelection = await runtime.dataSourceSelectionState(
            windowID: window.windowID,
            dataSourceRef: resolvedDataSourceRef
        )
        if isMultiSelect {
            var selections = latestSelection.selection
            if let existingIndex = selections.firstIndex(of: payload) {
                selections.remove(at: existingIndex)
            } else {
                selections.append(payload)
            }
            let nextSelection = SelectionState(
                selected: selections.last,
                selection: selections,
                rowIndex: selections.last == nil ? -1 : node.sourceRowIndex
            )
            await runtime.setDataSourceSelectionState(
                windowID: window.windowID,
                dataSourceRef: resolvedDataSourceRef,
                selection: nextSelection
            )
        } else {
            let nextSelection: SelectionState
            if latestSelection.selected == payload {
                nextSelection = SelectionState()
            } else {
                nextSelection = SelectionState(selected: payload, rowIndex: node.sourceRowIndex)
            }
            await runtime.setDataSourceSelectionState(
                windowID: window.windowID,
                dataSourceRef: resolvedDataSourceRef,
                selection: nextSelection
            )
        }
    }

    @MainActor
    private func seedExpandedNodeIDsIfNeeded() {
        guard expandedNodeIDs.isEmpty else { return }
        expandedNodeIDs = Set(treeNodes.filter { !$0.isLeaf }.map(\.id))
    }
}

private struct TreeBrowserNode: Identifiable, Equatable {
    let id: String
    let label: String
    let secondaryLabel: String
    let fullValue: JSONValue?
    let row: [String: JSONValue]
    let isLeaf: Bool
    let children: [TreeBrowserNode]
    let pathParts: [String]
    let sourceRowIndex: Int

    var selectionPayload: [String: JSONValue] {
        var payload = row
        if payload["label"] == nil {
            payload["label"] = .string(label)
        }
        if payload["displayPath"] == nil, !pathParts.isEmpty {
            payload["displayPath"] = .string(pathParts.joined(separator: " / "))
        }
        if payload["value"] == nil, let fullValue {
            payload["value"] = fullValue
        }
        return payload
    }

    static func build(rows: [[String: JSONValue]], config: TreeBrowserDef) -> [TreeBrowserNode] {
        let pathField = config.pathField?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? "path"
        let labelField = config.labelField?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        let valueField = config.valueField?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? "value"
        let subtitleField = config.subtitleField?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        let childrenField = config.childrenField?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? "childNodes"
        let separator = config.separator?.isEmpty == false ? config.separator! : "/"

        if rows.contains(where: { !normalizedChildren(recordValue($0, selector: childrenField)).isEmpty }) {
            return buildNested(
                rows: rows,
                parentParts: [],
                pathField: pathField,
                labelField: labelField,
                valueField: valueField,
                subtitleField: subtitleField,
                childrenField: childrenField,
                separator: separator
            )
        }

        var rootMap: [String: TreeAccumulator] = [:]
        var rootOrder: [String] = []

        for (index, row) in rows.enumerated() {
            let explicitLabel = recordValue(row, selector: labelField)?.stringLike
            let value = recordValue(row, selector: valueField)
            let pathParts = normalizedPath(recordValue(row, selector: pathField), separator: separator)
            let normalizedParts = pathParts.isEmpty
                ? [String(explicitLabel ?? value?.stringLike ?? "Item \(index + 1)").trimmingCharacters(in: .whitespacesAndNewlines)]
                : pathParts

            var currentMap = rootMap
            var currentOrder = rootOrder
            var pathSoFar: [String] = []
            for (partIndex, part) in normalizedParts.enumerated() {
                let trimmedPart = part.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmedPart.isEmpty else { continue }
                pathSoFar.append(trimmedPart)
                let isLeaf = partIndex == normalizedParts.count - 1
                let key = trimmedPart
                var entry = currentMap[key] ?? TreeAccumulator(
                    id: makeNodeID(parts: pathSoFar, fallback: "node-\(index)-\(partIndex)"),
                    label: trimmedPart,
                    childMap: [:],
                    childOrder: [],
                    row: isLeaf ? row : [:],
                    leafLabel: isLeaf ? String(explicitLabel ?? trimmedPart) : "",
                    fullValue: isLeaf ? value : nil,
                    secondaryLabel: isLeaf ? resolveSecondaryLabel(row: row, subtitleField: subtitleField, value: value) : "",
                    pathParts: pathSoFar,
                    sourceRowIndex: index
                )
                if currentMap[key] == nil {
                    currentOrder.append(key)
                }
                if isLeaf {
                    entry.row = row
                    entry.leafLabel = String(explicitLabel ?? trimmedPart)
                    entry.fullValue = value
                    entry.secondaryLabel = resolveSecondaryLabel(row: row, subtitleField: subtitleField, value: value)
                    entry.pathParts = pathSoFar
                    entry.sourceRowIndex = index
                }
                currentMap[key] = entry

                if partIndex == 0 {
                    rootMap = currentMap
                    rootOrder = currentOrder
                } else {
                    updatePath(
                        in: &rootMap,
                        rootOrder: &rootOrder,
                        parts: Array(pathSoFar.dropLast()),
                        childKey: key,
                        childEntry: entry
                    )
                }

                currentMap = entry.childMap
                currentOrder = entry.childOrder
            }
        }

        return mapToNodes(map: rootMap, order: rootOrder)
    }

    private static func buildNested(
        rows: [[String: JSONValue]],
        parentParts: [String],
        pathField: String,
        labelField: String?,
        valueField: String,
        subtitleField: String?,
        childrenField: String,
        separator: String
    ) -> [TreeBrowserNode] {
        rows.enumerated().map { index, row in
            let explicitLabel = recordValue(row, selector: labelField)?.stringLike
            let pathParts = normalizedPath(recordValue(row, selector: pathField), separator: separator)
            let label = String(
                explicitLabel
                    ?? pathParts.last
                    ?? row["label"]?.stringLike
                    ?? row["name"]?.stringLike
                    ?? "Node \(index + 1)"
            ).trimmingCharacters(in: .whitespacesAndNewlines)
            let resolvedPathParts = pathParts.isEmpty ? parentParts + [label] : pathParts
            let childrenRows = normalizedChildren(recordValue(row, selector: childrenField))
            let value = recordValue(row, selector: valueField)
            let children = buildNested(
                rows: childrenRows,
                parentParts: resolvedPathParts,
                pathField: pathField,
                labelField: labelField,
                valueField: valueField,
                subtitleField: subtitleField,
                childrenField: childrenField,
                separator: separator
            )

            return TreeBrowserNode(
                id: makeNodeID(parts: resolvedPathParts, fallback: "node-\(index)"),
                label: label,
                secondaryLabel: children.isEmpty ? resolveSecondaryLabel(row: row, subtitleField: subtitleField, value: value) : "",
                fullValue: children.isEmpty ? value : nil,
                row: row,
                isLeaf: children.isEmpty,
                children: children,
                pathParts: resolvedPathParts,
                sourceRowIndex: index
            )
        }
    }

    private static func mapToNodes(map: [String: TreeAccumulator], order: [String]) -> [TreeBrowserNode] {
        order.compactMap { key in
            guard let entry = map[key] else { return nil }
            let children = mapToNodes(map: entry.childMap, order: entry.childOrder)
            let isLeaf = children.isEmpty
            return TreeBrowserNode(
                id: entry.id,
                label: isLeaf ? (entry.leafLabel.isEmpty ? entry.label : entry.leafLabel) : entry.label,
                secondaryLabel: isLeaf ? entry.secondaryLabel : "",
                fullValue: isLeaf ? entry.fullValue : nil,
                row: entry.row,
                isLeaf: isLeaf,
                children: children,
                pathParts: entry.pathParts,
                sourceRowIndex: entry.sourceRowIndex
            )
        }
    }

    private static func updatePath(
        in rootMap: inout [String: TreeAccumulator],
        rootOrder: inout [String],
        parts: [String],
        childKey: String,
        childEntry: TreeAccumulator
    ) {
        guard let first = parts.first, var entry = rootMap[first] else { return }
        if parts.count == 1 {
            if entry.childMap[childKey] == nil {
                entry.childOrder.append(childKey)
            }
            entry.childMap[childKey] = childEntry
            rootMap[first] = entry
            return
        }
        var childMap = entry.childMap
        var childOrder = entry.childOrder
        updatePath(
            in: &childMap,
            rootOrder: &childOrder,
            parts: Array(parts.dropFirst()),
            childKey: childKey,
            childEntry: childEntry
        )
        entry.childMap = childMap
        entry.childOrder = childOrder
        rootMap[first] = entry
    }

    private static func resolveSecondaryLabel(
        row: [String: JSONValue],
        subtitleField: String?,
        value: JSONValue?
    ) -> String {
        if let subtitleField,
           let subtitle = recordValue(row, selector: subtitleField)?.stringLike,
           !subtitle.isEmpty {
            return subtitle
        }
        return value?.stringLike ?? ""
    }

    private static func normalizedPath(_ value: JSONValue?, separator: String) -> [String] {
        guard let value else { return [] }
        switch value {
        case .array(let values):
            return values.compactMap { $0.stringLike?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        default:
            let text = value.stringLike?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !text.isEmpty else { return [] }
            return text
                .components(separatedBy: separator)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        }
    }

    private static func normalizedChildren(_ value: JSONValue?) -> [[String: JSONValue]] {
        guard case .array(let children)? = value else { return [] }
        return children.compactMap(\.objectValue)
    }

    private static func recordValue(_ row: [String: JSONValue], selector: String?) -> JSONValue? {
        guard let selector, !selector.isEmpty else { return nil }
        guard let resolved = SelectorUtil.resolve(row.mapValues(jsonAnyValue), selector: selector) else {
            return nil
        }
        return jsonValue(from: resolved)
    }

    private static func makeNodeID(parts: [String], fallback: String) -> String {
        let base = parts.filter { !$0.isEmpty }.joined(separator: "::")
        return base.isEmpty ? fallback : base
    }

    private static func jsonAnyValue(_ value: JSONValue) -> Any? {
        switch value {
        case .string(let value):
            return value
        case .number(let value):
            return value
        case .bool(let value):
            return value
        case .array(let value):
            return value.map(jsonAnyValue)
        case .object(let value):
            return value.mapValues(jsonAnyValue)
        case .null:
            return nil
        }
    }

    private static func jsonValue(from value: Any?) -> JSONValue? {
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
            if CFGetTypeID(value) == CFBooleanGetTypeID() {
                return .bool(value.boolValue)
            }
            return .number(value.doubleValue)
        case let value as [String: JSONValue]:
            return .object(value)
        case let value as [String: Any]:
            var object: [String: JSONValue] = [:]
            for (key, child) in value {
                guard let jsonValue = jsonValue(from: child) else { return nil }
                object[key] = jsonValue
            }
            return .object(object)
        case let value as [Any]:
            let values = value.compactMap(jsonValue)
            guard values.count == value.count else { return nil }
            return .array(values)
        default:
            return nil
        }
    }
}

private struct TreeAccumulator {
    let id: String
    var label: String
    var childMap: [String: TreeAccumulator]
    var childOrder: [String]
    var row: [String: JSONValue]
    var leafLabel: String
    var fullValue: JSONValue?
    var secondaryLabel: String
    var pathParts: [String]
    var sourceRowIndex: Int
}

private extension JSONValue {
    var stringLike: String? {
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
        default:
            return nil
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
