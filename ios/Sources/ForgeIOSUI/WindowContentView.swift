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
    }
}
