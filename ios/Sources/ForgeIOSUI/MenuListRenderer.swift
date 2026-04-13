import SwiftUI
import ForgeIOSRuntime

public struct MenuListRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let items: [ItemDef]

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, items: [ItemDef]) {
        self.runtime = runtime
        self.window = window
        self.items = items
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title ?? item.id ?? "Item")
                    if let subtitle = item.subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }
}
