import SwiftUI
import ForgeIOSRuntime

struct DerivedDataSourceRenderer: View {
    let runtime: ForgeRuntime
    let window: WindowContext
    let container: ContainerDef

    @State private var sources: [String: [[String: JSONValue]]] = [:]
    @State private var controls: [String: ControlState] = [:]

    private var spec: DerivedDataSourceSpec { container.derivedDataSource! }
    private var targetRef: String { container.dataSourceRef ?? "" }

    var body: some View {
        Color.clear
            .frame(width: 0, height: 0)
            .task(id: "\(window.windowID)#\(targetRef)#\(spec.sources.joined(separator: ","))") {
                await observeSources()
            }
            .onChange(of: sourceSignature) { _, _ in Task { await recompute() } }
            .accessibilityHidden(true)
    }

    private var sourceSignature: String {
        let rows = spec.sources.map { "\($0):\(sources[$0]?.description ?? "")" }.joined(separator: "|")
        let state = spec.sources.map { "\($0):\(controls[$0]?.loading == true):\(controls[$0]?.error ?? "")" }.joined(separator: "|")
        return rows + "#" + state
    }

    @MainActor
    private func observeSources() async {
        guard !targetRef.isEmpty else { return }
        await runtime.setDataSourceControl(windowID: window.windowID, dataSourceRef: targetRef, control: ControlState(loading: true))
        for ref in spec.sources {
            sources[ref] = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
            controls[ref] = await runtime.dataSourceControl(windowID: window.windowID, dataSourceRef: ref)
            if sources[ref]?.isEmpty != false && controls[ref]?.loading != true {
                await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
                sources[ref] = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
                controls[ref] = await runtime.dataSourceControl(windowID: window.windowID, dataSourceRef: ref)
            }
        }
        await recompute()
        await withTaskGroup(of: Void.self) { group in
            for ref in spec.sources {
                group.addTask {
                    let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: ref)
                    for await rows in stream { await MainActor.run { sources[ref] = rows } }
                }
                group.addTask {
                    let stream = await runtime.dataSourceControlUpdates(windowID: window.windowID, dataSourceRef: ref)
                    for await state in stream { await MainActor.run { controls[ref] = state } }
                }
            }
        }
    }

    @MainActor
    private func recompute() async {
        guard !targetRef.isEmpty else { return }
        let optional = Set(spec.optionalSources ?? [])
        if let requiredError = spec.sources.first(where: { !optional.contains($0) && controls[$0]?.error?.isEmpty == false }),
           let message = controls[requiredError]?.error {
            await runtime.setDataSourceControl(windowID: window.windowID, dataSourceRef: targetRef, control: ControlState(error: message))
            return
        }
        if spec.sources.contains(where: { controls[$0]?.loading == true }) {
            await runtime.setDataSourceControl(windowID: window.windowID, dataSourceRef: targetRef, control: ControlState(loading: true))
            return
        }
        let warnings = spec.sources.compactMap { ref -> String? in
            guard optional.contains(ref), let error = controls[ref]?.error, !error.isEmpty else { return nil }
            return "\(ref): \(error)"
        }
        var effective = sources
        for ref in optional where controls[ref]?.error?.isEmpty == false { effective[ref] = [] }
        do {
            let rows = try DerivedDataSourceRuntime.run(sources: effective, spec: spec)
            let current = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: targetRef)
            if current != rows { await runtime.setDataSourceCollection(windowID: window.windowID, dataSourceRef: targetRef, rows: rows) }
            await runtime.setDataSourceControl(windowID: window.windowID, dataSourceRef: targetRef, control: ControlState(warnings: warnings))
        } catch {
            await runtime.setDataSourceControl(windowID: window.windowID, dataSourceRef: targetRef, control: ControlState(error: error.localizedDescription, warnings: warnings))
        }
    }
}
