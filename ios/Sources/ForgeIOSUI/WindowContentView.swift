import SwiftUI
import ForgeIOSRuntime

public struct WindowContentView: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let metadata: WindowMetadata

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, metadata: WindowMetadata) {
        self.runtime = runtime
        self.window = window
        self.metadata = metadata
    }

    public var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                ForEach(metadata.view?.content?.containers ?? []) { container in
                    ContainerRenderer(runtime: runtime, window: window, container: container)
                }
            }
            .padding()
        }
        .task(id: onInitTaskKey) {
            await runWindowLifecycle(event: "onInit")
        }
        .onDisappear {
            Task {
                await runWindowLifecycle(event: "onDestroy")
            }
        }
    }

    private var onInitTaskKey: String {
        "\(window?.windowID ?? ""):\(metadata.namespace ?? ""):\(metadata.dataSources.keys.sorted().joined(separator: "|"))"
    }

    private func runWindowLifecycle(event: String) async {
        guard let runtime, let window else { return }
        let dataSourceRef = defaultDataSourceRef()
        let executionContext = ExecutionContext(windowID: window.windowID, dataSourceRef: dataSourceRef)
        for execution in metadata.on where execution.event == event {
            guard let resolved = execution.executionDef else { continue }
            _ = await runtime.execute(resolved, context: executionContext, args: ["windowId": .string(window.windowID)])
        }
    }

    private func defaultDataSourceRef() -> String {
        if let containerRef = metadata.view?.content?.containers.first(where: { !($0.dataSourceRef ?? "").isEmpty })?.dataSourceRef {
            return containerRef
        }
        return metadata.dataSources.keys.sorted().first ?? ""
    }
}
