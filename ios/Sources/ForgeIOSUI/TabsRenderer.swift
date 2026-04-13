import SwiftUI
import ForgeIOSRuntime

public struct TabsRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef) {
        self.runtime = runtime
        self.window = window
        self.container = container
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = container.title {
                Text(title).font(.headline)
            }
            TabView {
                ForEach(container.containers) { child in
                    ContainerRenderer(runtime: runtime, window: window, container: child)
                        .tabItem {
                            Text(child.title ?? child.id ?? "Tab")
                        }
                }
            }
            .frame(minHeight: 220)
        }
    }
}
