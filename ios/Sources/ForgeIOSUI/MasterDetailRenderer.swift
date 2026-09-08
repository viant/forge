import SwiftUI
import ForgeIOSRuntime

struct MasterDetailRenderer: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    let runtime: ForgeRuntime
    let window: WindowContext
    let container: ContainerDef

    @State private var rows: [[String: JSONValue]] = []
    @State private var selection = SelectionState()
    @State private var windowForm: [String: JSONValue] = [:]
    @State private var compactDetailVisible = false

    private var spec: MasterDetailSpec { container.masterDetail! }
    private var masterContainer: ContainerDef? { container.containers.first { $0.id == spec.master.containerId } }
    private var detailContainer: ContainerDef? { container.containers.first { $0.id == spec.detail.containerId } }
    private var masterRef: String { masterContainer?.dataSourceRef ?? container.dataSourceRef ?? "" }
    private var detailRef: String { detailContainer?.dataSourceRef ?? "" }
    private var persisted: [String: JSONValue]? { spec.stateKey.flatMap { windowForm[$0]?.objectValue } }
    private var selected: [String: JSONValue]? {
        WorkflowPrimitiveRuntime.resolveMasterDetailSelection(
            rows: rows,
            selected: selection.selected ?? selection.selection.last,
            persisted: persisted,
            identityFields: spec.identityFields
        )
    }
    private var selectedID: String { WorkflowPrimitiveRuntime.masterDetailIdentity(row: selected, fields: spec.identityFields) ?? "" }
    private var detailAllowed: Bool {
        guard let selected else { return false }
        return DashboardRuntime.evaluateDashboardCondition(spec.detail.allowedWhen, form: selected.mapValues(masterAnyValue))
    }

    var body: some View {
        Group {
            if masterRef == detailRef && !masterRef.isEmpty {
                Label("Master and detail must use distinct datasource contexts.", systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red)
            } else if horizontalSizeClass == .compact {
                compactBody
            } else {
                HStack(alignment: .top, spacing: 12) { masterBody.frame(maxWidth: .infinity); detailBody.frame(maxWidth: .infinity) }
            }
        }
        .task(id: "\(window.windowID)#\(masterRef)") { await observeMaster() }
        .task(id: selectedID) { await synchronizeDetail() }
        .accessibilityIdentifier("forge-master-detail")
    }

    @ViewBuilder
    private var compactBody: some View {
        if compactDetailVisible && selected != nil {
            VStack(alignment: .leading, spacing: 8) {
                Button("Back", systemImage: "chevron.left") { compactDetailVisible = false }
                detailBody
            }
        } else {
            masterBody.onChange(of: selectedID) { _, value in if !value.isEmpty { compactDetailVisible = true } }
        }
    }

    @ViewBuilder
    private var masterBody: some View {
        if let masterContainer {
            ContainerRenderer(runtime: runtime, window: window, container: masterContainer, inheritedDataSourceRef: container.dataSourceRef)
        }
    }

    @ViewBuilder
    private var detailBody: some View {
        if selected == nil {
            ContentUnavailableView(spec.emptyDetail?.message ?? "Select an item", systemImage: "sidebar.right")
        } else if !detailAllowed {
            ContentUnavailableView("Selection is not permitted", systemImage: "lock")
        } else if let detailContainer {
            ContainerRenderer(runtime: runtime, window: window, container: detailContainer, inheritedDataSourceRef: container.dataSourceRef)
        }
    }

    @MainActor
    private func observeMaster() async {
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: masterRef)
        selection = await runtime.dataSourceSelectionState(windowID: window.windowID, dataSourceRef: masterRef)
        windowForm = await runtime.windowFormJSONValue(windowID: window.windowID)
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: masterRef)
                for await value in stream { await MainActor.run { rows = value } }
            }
            group.addTask {
                let stream = await runtime.dataSourceSelectionUpdates(windowID: window.windowID, dataSourceRef: masterRef)
                for await value in stream { await MainActor.run { selection = value } }
            }
            group.addTask {
                let stream = await runtime.windowFormUpdates(windowID: window.windowID)
                for await value in stream { await MainActor.run { windowForm = value } }
            }
        }
    }

    @MainActor
    private func synchronizeDetail() async {
        guard let selected, detailAllowed, !detailRef.isEmpty else {
            if !detailRef.isEmpty {
                await runtime.setDataSourceSelection(windowID: window.windowID, dataSourceRef: detailRef, selected: nil)
                await runtime.setDataSourceForm(windowID: window.windowID, dataSourceRef: detailRef, values: [:])
            }
            if persisted != nil, spec.selectionInvalidation?.lowercased() == "clear", let stateKey = spec.stateKey {
                await runtime.setWindowFormValue(windowID: window.windowID, values: [stateKey: .object(["$replace": .bool(true), "value": .null])], bumpPrefillRevision: false)
            }
            return
        }
        if let stateKey = spec.stateKey {
            let identity = Dictionary(uniqueKeysWithValues: (spec.identityFields.isEmpty ? ["id"] : spec.identityFields).compactMap { field in selected[field].map { (field, $0) } })
            await runtime.setWindowFormValue(windowID: window.windowID, values: [stateKey: .object(identity)], bumpPrefillRevision: false)
        }
        await runtime.setDataSourceInputParameters(
            windowID: window.windowID,
            dataSourceRef: detailRef,
            parameters: WorkflowPrimitiveRuntime.masterDetailParameters(spec: spec.detail, row: selected),
            fetch: true
        )
    }
}

private func masterAnyValue(_ value: JSONValue) -> Any {
    switch value { case .string(let value): return value; case .number(let value): return value; case .bool(let value): return value; case .array(let values): return values.map(masterAnyValue); case .object(let values): return values.mapValues(masterAnyValue); case .null: return NSNull() }
}
