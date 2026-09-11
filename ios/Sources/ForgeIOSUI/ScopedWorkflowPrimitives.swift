import SwiftUI
import ForgeIOSRuntime

struct ScopedWorkflowPrimitives: View {
    let runtime: ForgeRuntime?
    let window: WindowContext?
    let container: ContainerDef
    var body: some View {
        ForEach(PrimitivePairing.scopedContainers(container)) { part in
            ScopedWorkflowPrimitive(runtime: runtime, window: window, container: part)
        }
    }
}

private struct ScopedWorkflowPrimitive: View {
    let runtime: ForgeRuntime?
    let window: WindowContext?
    let container: ContainerDef
    @State private var form: [String: JSONValue] = [:]
    @State private var collection: [[String: JSONValue]] = []
    @State private var metrics: [String: JSONValue] = [:]
    @State private var windowForm: [String: JSONValue] = [:]
    @State private var selection = SelectionState()
    @State private var loaded = false

    var body: some View {
        Group {
            if loaded {
                WorkflowPresentationPrimitives(runtime: runtime, window: window, container: container, form: form, collection: collection, metrics: metrics, windowForm: windowForm, selection: selection)
            }
        }.task(id: "\(window?.windowID ?? ""):\(container.dataSourceRef ?? "")") { await observe() }
    }

    @MainActor private func observe() async {
        guard let runtime, let window else { loaded = true; return }
        let ref = container.dataSourceRef ?? ""
        loaded = false
        form = await runtime.formJSONValue(windowID: window.windowID, dataSourceRef: ref)
        collection = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
        metrics = await runtime.dataSourceMetrics(windowID: window.windowID, dataSourceRef: ref)
        selection = await runtime.dataSourceSelectionState(windowID: window.windowID, dataSourceRef: ref)
        windowForm = await runtime.windowFormJSONValue(windowID: window.windowID)
        if !ref.isEmpty, form.isEmpty, collection.isEmpty, metrics.isEmpty, container.fetchData != false,
           let source = await runtime.windowMetadata(id: window.windowID)?.dataSources[ref], source.autoFetch != false {
            await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
            form = await runtime.formJSONValue(windowID: window.windowID, dataSourceRef: ref)
            collection = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
            metrics = await runtime.dataSourceMetrics(windowID: window.windowID, dataSourceRef: ref)
        }
        loaded = true
        await withTaskGroup(of: Void.self) { group in
            group.addTask { for await value in await runtime.dataSourceFormUpdates(windowID: window.windowID, dataSourceRef: ref) { await MainActor.run { form = value } } }
            group.addTask { for await value in await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: ref) { await MainActor.run { collection = value } } }
            group.addTask { for await value in await runtime.dataSourceMetricsUpdates(windowID: window.windowID, dataSourceRef: ref) { await MainActor.run { metrics = value } } }
            group.addTask { for await value in await runtime.dataSourceSelectionUpdates(windowID: window.windowID, dataSourceRef: ref) { await MainActor.run { selection = value } } }
            group.addTask { for await value in await runtime.windowFormUpdates(windowID: window.windowID) { await MainActor.run { windowForm = value } } }
        }
    }
}
