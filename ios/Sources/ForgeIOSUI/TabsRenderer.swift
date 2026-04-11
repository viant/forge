import SwiftUI
import ForgeIOSRuntime

public struct TabsRenderer: View {
    private let container: ContainerDef

    public init(container: ContainerDef) {
        self.container = container
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = container.title {
                Text(title).font(.headline)
            }
            TabView {
                ForEach(container.containers) { child in
                    ContainerRenderer(container: child)
                        .tabItem {
                            Text(child.title ?? child.id ?? "Tab")
                        }
                }
            }
            .frame(minHeight: 220)
        }
    }
}
