import SwiftUI
import ForgeIOSRuntime

public struct ChatRenderer: View {
    private let container: ContainerDef

    public init(container: ContainerDef) {
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
