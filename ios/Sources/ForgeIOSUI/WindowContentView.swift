import SwiftUI
import ForgeIOSRuntime

private struct ForgeEmbeddedNonScrollingKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var forgeEmbeddedNonScrolling: Bool {
        get { self[ForgeEmbeddedNonScrollingKey.self] }
        set { self[ForgeEmbeddedNonScrollingKey.self] = newValue }
    }
}

public struct WindowContentView: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let metadata: WindowMetadata
    private let scrollEnabled: Bool
    private let contentPadding: CGFloat

    public init(
        runtime: ForgeRuntime? = nil,
        window: WindowContext? = nil,
        metadata: WindowMetadata,
        scrollEnabled: Bool = true,
        contentPadding: CGFloat = 16
    ) {
        self.runtime = runtime
        self.window = window
        self.metadata = metadata
        self.scrollEnabled = scrollEnabled
        self.contentPadding = contentPadding
    }

    public var body: some View {
        ZStack {
            Group {
                if scrollEnabled {
                    ScrollView {
                        lazyContentStack
                    }
                } else {
                    eagerContentStack
                }
            }

            if let runtime, let window, !metadata.dialogs.isEmpty {
                WindowDialogLayer(
                    runtime: runtime,
                    window: window,
                    dialogs: metadata.dialogs,
                    defaultDataSourceRef: defaultDataSourceRef()
                )
            }
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

    private var lazyContentStack: some View {
        LazyVStack(alignment: .leading, spacing: 12) {
            ForEach(metadata.view?.content?.containers ?? []) { container in
                ContainerRenderer(runtime: runtime, window: window, container: container)
            }
        }
        .padding(contentPadding)
        .environment(\.forgeEmbeddedNonScrolling, false)
    }

    private var eagerContentStack: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(metadata.view?.content?.containers ?? []) { container in
                ContainerRenderer(runtime: runtime, window: window, container: container)
            }
        }
        .padding(contentPadding)
        .environment(\.forgeEmbeddedNonScrolling, true)
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
