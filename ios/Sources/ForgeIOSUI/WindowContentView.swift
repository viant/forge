import SwiftUI
import ForgeIOSRuntime

private struct ForgeEmbeddedNonScrollingKey: EnvironmentKey {
    static let defaultValue = false
}

public enum ForgePresentationDensity {
    case standard
    case compact
}

private struct ForgePresentationDensityKey: EnvironmentKey {
    static let defaultValue = ForgePresentationDensity.standard
}

extension EnvironmentValues {
    var forgeEmbeddedNonScrolling: Bool {
        get { self[ForgeEmbeddedNonScrollingKey.self] }
        set { self[ForgeEmbeddedNonScrollingKey.self] = newValue }
    }

    public var forgePresentationDensity: ForgePresentationDensity {
        get { self[ForgePresentationDensityKey.self] }
        set { self[ForgePresentationDensityKey.self] = newValue }
    }
}

public struct WindowContentView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var availableWidth: CGFloat = 0

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
                        eagerContentStack
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
        .background(
            GeometryReader { proxy in
                Color.clear
                    .preference(key: WindowContentWidthPreferenceKey.self, value: proxy.size.width)
            }
        )
        .onPreferenceChange(WindowContentWidthPreferenceKey.self) { width in
            guard width > 0 else {
                return
            }
            availableWidth = width
        }
        .onDisappear {
            Task {
                await runWindowLifecycle(event: "onDestroy")
            }
        }
    }

    private var lazyContentStack: some View {
        renderedContainers(lazy: true)
        .padding(contentPadding)
        .background(
            GeometryReader { proxy in
                Color.clear
                    .preference(key: WindowContentHeightPreferenceKey.self, value: proxy.size.height)
            }
        )
        .environment(\.forgeEmbeddedNonScrolling, false)
    }

    private var eagerContentStack: some View {
        renderedContainers(lazy: false)
        .padding(contentPadding)
        .background(
            GeometryReader { proxy in
                Color.clear
                    .preference(key: WindowContentHeightPreferenceKey.self, value: proxy.size.height)
            }
        )
        .environment(\.forgeEmbeddedNonScrolling, true)
    }

    @ViewBuilder
    private func renderedContainers(lazy: Bool) -> some View {
        let containers = metadata.view?.content?.containers ?? []
        let layout = metadata.view?.content?.layout
        if layout?.kind?.lowercased() == "split", containers.count >= 2, horizontalSizeClass == .regular {
            let spacing: CGFloat = 16
            let totalWidth = max(availableWidth - contentPadding * 2, 0)
            let fractions = splitFractions(count: containers.count)
            HStack(alignment: .top, spacing: spacing) {
                ForEach(Array(containers.enumerated()), id: \.element.id) { index, container in
                    ContainerRenderer(runtime: runtime, window: window, container: container)
                        .frame(
                            width: max((totalWidth - spacing * CGFloat(max(containers.count - 1, 0))) * fractions[index], 220),
                            alignment: .topLeading
                        )
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
        } else {
            let stackSpacing = resolvedSpacing(from: layout?.gap, fallback: 12)
            if lazy {
                LazyVStack(alignment: .leading, spacing: stackSpacing) {
                    ForEach(containers) { container in
                        ContainerRenderer(runtime: runtime, window: window, container: container)
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: stackSpacing) {
                    ForEach(containers) { container in
                        ContainerRenderer(runtime: runtime, window: window, container: container)
                    }
                }
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
        let executions = metadata.on + (metadata.window?.on ?? [])
        for execution in executions where execution.event == event {
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

    private func resolvedSpacing(from raw: String?, fallback: CGFloat) -> CGFloat {
        guard let raw else {
            return fallback
        }
        let numeric = raw
            .replacingOccurrences(of: "px", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let value = Double(numeric) {
            return CGFloat(value)
        }
        return fallback
    }

    private func splitFractions(count: Int) -> [CGFloat] {
        guard count > 0 else {
            return []
        }
        if count == 2 {
            return [0.62, 0.38]
        }
        let even = 1 / CGFloat(count)
        return Array(repeating: even, count: count)
    }
}

private struct WindowContentWidthPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

public struct WindowContentHeightPreferenceKey: PreferenceKey {
    public static var defaultValue: CGFloat = 0

    public static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}
