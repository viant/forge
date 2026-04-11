import SwiftUI
import ForgeIOSRuntime

public struct WindowContentView: View {
    private let metadata: WindowMetadata

    public init(metadata: WindowMetadata) {
        self.metadata = metadata
    }

    public var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                ForEach(metadata.view?.content?.containers ?? []) { container in
                    ContainerRenderer(container: container)
                }
            }
            .padding()
        }
    }
}
