import SwiftUI
import ForgeIOSRuntime

struct TreeEditorRenderer: View {
    let runtime: ForgeRuntime
    let window: WindowContext
    let container: ContainerDef

    @State private var nodes: [[String: JSONValue]] = []
    @State private var selected: Set<String> = []
    @State private var excluded: Set<String> = []
    @State private var expanded: Set<String> = []
    @State private var search = ""

    private var spec: TreeEditorSpec { container.treeEditor! }
    private var dataSourceRef: String { spec.dataSourceRef ?? container.dataSourceRef ?? "" }
    private var rows: [TreeEditorRow] { flattenTree(nodes, spec: spec, expanded: expanded, search: search) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if spec.searchable != false {
                TextField("Search", text: $search).textFieldStyle(.roundedBorder)
            }
            if rows.isEmpty {
                Text(spec.emptyMessage ?? "No items").foregroundStyle(.secondary)
            } else {
                ForEach(rows) { row in
                    HStack(spacing: 6) {
                        Color.clear.frame(width: CGFloat(row.depth * 16), height: 1)
                        if row.hasChildren && spec.collapsible != false {
                            Button { toggleExpanded(row.id) } label: {
                                Image(systemName: expanded.contains(row.id) ? "chevron.down" : "chevron.right")
                            }.buttonStyle(.plain).accessibilityLabel(expanded.contains(row.id) ? "Collapse \(row.label)" : "Expand \(row.label)")
                        } else { Color.clear.frame(width: 12, height: 1) }
                        if spec.selectionMode?.lowercased() == "includeexclude" {
                            Picker(row.label, selection: includeExcludeBinding(row.id)) {
                                Text("None").tag(0); Text("Include").tag(1); Text("Exclude").tag(2)
                            }.pickerStyle(.segmented)
                        } else {
                            Toggle(row.label, isOn: selectedBinding(row.id))
                            #if os(macOS)
                                .toggleStyle(.checkbox)
                            #endif
                        }
                    }
                }
            }
            if let command = spec.mutation {
                MutationCommandButton(
                    runtime: runtime,
                    window: window,
                    sourceDataSourceRef: dataSourceRef,
                    command: command,
                    labelOverride: command.label ?? "Save selection",
                    extras: [
                        "selectedIds": .array(selected.sorted().map(JSONValue.string)),
                        "excludedIds": .array(excluded.sorted().map(JSONValue.string))
                    ]
                )
            }
        }
        .task(id: "\(window.windowID)#\(dataSourceRef)") { await observeNodes() }
        .accessibilityIdentifier("forge-tree-editor")
    }

    private func selectedBinding(_ key: String) -> Binding<Bool> {
        Binding(
            get: { selected.contains(key) },
            set: { selected = WorkflowPrimitiveRuntime.toggleTreeSelection(nodes: nodes, selected: selected, key: key, checked: $0, spec: spec) }
        )
    }

    private func includeExcludeBinding(_ key: String) -> Binding<Int> {
        Binding(
            get: { excluded.contains(key) ? 2 : selected.contains(key) ? 1 : 0 },
            set: { value in
                selected.remove(key); excluded.remove(key)
                if value == 1 { selected.insert(key) }
                if value == 2 { excluded.insert(key) }
            }
        )
    }

    private func toggleExpanded(_ key: String) { if expanded.contains(key) { expanded.remove(key) } else { expanded.insert(key) } }

    @MainActor
    private func observeNodes() async {
        nodes = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef)
        if nodes.isEmpty { await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef) }
        nodes = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef)
        hydrateTreeState()
        let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: dataSourceRef)
        for await next in stream { nodes = next; hydrateTreeState() }
    }

    private func hydrateTreeState() {
        var initialExpanded: Set<String> = []
        var initialSelected: Set<String> = []
        var initialExcluded: Set<String> = []
        walkTree(nodes, spec: spec) { row, depth in
            guard let key = treeIdentity(row, spec: spec) else { return }
            if depth < (spec.defaultExpandedDepth ?? 0) { initialExpanded.insert(key) }
            if let field = spec.selectedField, row[field]?.boolValue == true { initialSelected.insert(key) }
            if let field = spec.excludedField, row[field]?.boolValue == true { initialExcluded.insert(key) }
        }
        if expanded.isEmpty { expanded = initialExpanded }
        if selected.isEmpty { selected = initialSelected }
        if excluded.isEmpty { excluded = initialExcluded }
    }
}

private struct TreeEditorRow: Identifiable {
    let id: String
    let label: String
    let depth: Int
    let hasChildren: Bool
}

private func flattenTree(_ nodes: [[String: JSONValue]], spec: TreeEditorSpec, expanded: Set<String>, search: String) -> [TreeEditorRow] {
    var result: [TreeEditorRow] = []
    func visit(_ rows: [[String: JSONValue]], depth: Int) {
        for row in rows {
            guard let id = treeIdentity(row, spec: spec) else { continue }
            let label = treeLabel(row, spec: spec)
            let children = treeChildren(row, spec: spec)
            if search.isEmpty || label.localizedCaseInsensitiveContains(search) {
                result.append(TreeEditorRow(id: id, label: label, depth: depth, hasChildren: !children.isEmpty))
            }
            if expanded.contains(id) || !search.isEmpty { visit(children, depth: depth + 1) }
        }
    }
    visit(nodes, depth: 0)
    return result
}

private func walkTree(_ nodes: [[String: JSONValue]], spec: TreeEditorSpec, visit: ([String: JSONValue], Int) -> Void, depth: Int = 0) {
    for node in nodes { visit(node, depth); walkTree(treeChildren(node, spec: spec), spec: spec, visit: visit, depth: depth + 1) }
}

private func treeChildren(_ row: [String: JSONValue], spec: TreeEditorSpec) -> [[String: JSONValue]] {
    row[spec.childrenField ?? "children"]?.arrayValue?.compactMap(\.objectValue) ?? []
}

private func treeIdentity(_ row: [String: JSONValue], spec: TreeEditorSpec) -> String? {
    let value = row[spec.identityField ?? "id"]
    switch value { case .string(let value): return value; case .number(let value): return value.rounded() == value ? String(Int(value)) : String(value); default: return nil }
}

private func treeLabel(_ row: [String: JSONValue], spec: TreeEditorSpec) -> String {
    row[spec.labelField ?? "label"]?.stringValue ?? treeIdentity(row, spec: spec) ?? "Item"
}
