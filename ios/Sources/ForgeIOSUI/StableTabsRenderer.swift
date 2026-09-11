import SwiftUI
import ForgeIOSRuntime

struct StableTabsRenderer: View {
    let runtime: ForgeRuntime?
    let window: WindowContext?
    let container: ContainerDef
    let form: [String: JSONValue]
    let collection: [[String: JSONValue]]
    let metrics: [String: JSONValue]
    let windowForm: [String: JSONValue]
    let selection: SelectionState
    @State private var selectedID: String?
    @State private var visited = Set<String>()
    @State private var authorization: [String: JSONValue] = [:]
    @State private var grants: [String: [[String: JSONValue]]] = [:]
    private var stateKey: String { "__forgeStableTab:\(container.id ?? container.containers.first?.id ?? "root")" }
    private func allows(_ condition: DashboardConditionDef?) -> Bool {
        DashboardRuntime.evaluateDashboardCondition(condition, metrics: metrics.mapValues(unwrap), form: form.mapValues(unwrap), windowForm: windowForm.mapValues(unwrap), collection: collection.map { $0.mapValues(unwrap) })
    }
    private var visible: [ContainerDef] {
        container.containers.filter { child in
            guard allows(child.visibleWhen) else { return false }
            guard let permission = child.permissionBoundary else { return true }
            guard allows(permission.visibleWhen) else { return false }
            let rows = permission.mode == "selection" ? (selection.selection.isEmpty ? selection.selected.map { [$0] } ?? [] : selection.selection) : permission.mode == "row" ? collection : []
            return WorkflowPrimitiveRuntime.permissionAllows(spec: permission, authorization: authorization, rows: rows, grants: grants[permission.dataSourceRef ?? ""] ?? [])
        }
    }
    var body: some View {
        let ids = visible.compactMap(\.id)
        let selected = StableTabsState.selected(ids: ids, requested: selectedID ?? windowForm[stateKey]?.stringValue, fallback: container.stableTabs?.defaultSelectedTabId)
        let mounted = StableTabsState.mounted(ids: ids, selected: selected, visited: visited, keepVisited: container.stableTabs?.keepVisitedTabPanelsMounted == true, activeOnly: container.stableTabs?.renderActiveTabPanelOnly != false)
        VStack(alignment: .leading, spacing: 8) {
            if let selected {
                Picker(container.title ?? "Tabs", selection: Binding(get: { selected }, set: select)) {
                    ForEach(visible) { child in Text(child.title ?? child.id ?? "Tab").tag(child.id ?? "") }
                }.accessibilityLabel(container.title ?? "Tabs")
                ForEach(visible.filter { mounted.contains($0.id ?? "") }) { child in
                    ContainerRenderer(runtime: runtime, window: window, container: child, inheritedDataSourceRef: container.dataSourceRef, suppressTitle: true)
                        .frame(height: child.id == selected ? nil : 0)
                        .opacity(child.id == selected ? 1 : 0)
                        .clipped().disabled(child.id != selected).accessibilityHidden(child.id != selected)
                }
            }
        }
        .onAppear { if let selected { visited.insert(selected) } }
        .onChange(of: ids) { if let next = StableTabsState.selected(ids: ids, requested: selectedID ?? windowForm[stateKey]?.stringValue, fallback: container.stableTabs?.defaultSelectedTabId) { select(next) } }
        .onChange(of: windowForm[stateKey]) { selectedID = windowForm[stateKey]?.stringValue; if let selectedID { visited.insert(selectedID) } }
        .task(id: container.containers.compactMap { $0.permissionBoundary?.dataSourceRef }.joined(separator: "|")) {
            guard let runtime, let window else { return }
            authorization = await runtime.windowMetadata(id: window.windowID)?.authorizationSnapshot ?? [:]
            let refs = Set(container.containers.compactMap { $0.permissionBoundary?.dataSourceRef })
            for ref in refs { grants[ref] = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref) }
            await withTaskGroup(of: Void.self) { group in
                group.addTask {
                    for await metadata in await runtime.windowMetadataUpdates(id: window.windowID) { await MainActor.run { authorization = metadata?.authorizationSnapshot ?? [:] } }
                }
                for ref in refs { group.addTask { for await value in await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: ref) { await MainActor.run { grants[ref] = value } } } }
            }
        }
    }
    private func select(_ id: String) {
        let revisit = visited.contains(id)
        selectedID = id; visited.insert(id)
        guard let runtime, let window else { return }
        Task {
            await runtime.setWindowFormValue(windowID: window.windowID, values: [stateKey: .string(id)], bumpPrefillRevision: false)
            if revisit && container.stableTabs?.dataSourceFetchMode != "once", let ref = visible.first(where: { $0.id == id })?.dataSourceRef ?? container.dataSourceRef {
                await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
            }
        }
    }
    private func unwrap(_ value: JSONValue) -> Any {
        switch value { case .string(let v): return v; case .number(let v): return v; case .bool(let v): return v; case .object(let v): return v.mapValues(unwrap); case .array(let v): return v.map(unwrap); case .null: return NSNull() }
    }
}
