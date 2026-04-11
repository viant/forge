import SwiftUI
import ForgeIOSRuntime

public struct MenuListRenderer: View {
    private let items: [ItemDef]

    public init(items: [ItemDef]) {
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
