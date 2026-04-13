import SwiftUI
import ForgeIOSRuntime

public struct TableRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let table: TableDef

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, table: TableDef) {
        self.runtime = runtime
        self.window = window
        self.table = table
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = table.title {
                Text(title).font(.headline)
            }
            ForEach(table.columns, id: \.self) { column in
                Text(column)
                    .font(.footnote)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 4)
            }
        }
        .padding()
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }
}
