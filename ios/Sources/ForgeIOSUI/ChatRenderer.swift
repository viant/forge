import SwiftUI
import ForgeIOSRuntime

public struct ChatRenderer: View {
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
            Text("Chat renderer scaffold")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }
}
