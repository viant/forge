import SwiftUI
import ForgeIOSRuntime

public struct TableRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let table: TableDef
    @State private var rows: [[String: JSONValue]] = []

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef, table: TableDef) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.table = table
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = table.title {
                Text(title).font(.headline)
            }
            if rows.isEmpty {
                placeholderTable
            } else {
                compactTable
            }
        }
        .padding()
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .task(id: tableTaskKey) {
            await loadRows()
        }
    }

    private var tableTaskKey: String {
        [
            window?.windowID ?? "",
            container.id ?? "",
            container.dataSourceRef ?? "",
            table.title ?? "",
            table.columns.joined(separator: "|")
        ].joined(separator: ":")
    }

    private func loadRows() async {
        guard let runtime, let window, let dataSourceRef = container.dataSourceRef, !dataSourceRef.isEmpty else {
            rows = []
            return
        }
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef)
    }

    private var placeholderTable: some View {
        Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 12, verticalSpacing: 8) {
            GridRow {
                ForEach(table.columns, id: \.self) { column in
                    Text(column)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }
            Divider()
            GridRow {
                ForEach(table.columns, id: \.self) { _ in
                    Text("—")
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    private var compactTable: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 14, verticalSpacing: 8) {
                GridRow {
                    ForEach(table.columns, id: \.self) { column in
                        Text(column)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .frame(minWidth: 96, alignment: .leading)
                    }
                }
                Divider()
                ForEach(rows.indices, id: \.self) { index in
                    let row = rows[index]
                    GridRow {
                        ForEach(table.columns, id: \.self) { column in
                            Text(row[column]?.displayString ?? "—")
                                .font(.footnote)
                                .frame(minWidth: 96, alignment: .leading)
                        }
                    }
                    if index != rows.indices.last {
                        Divider()
                    }
                }
            }
        }
    }
}

private extension JSONValue {
    var displayString: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            if value.rounded(.towardZero) == value {
                return String(Int(value))
            }
            return String(value)
        case .bool(let value):
            return value ? "true" : "false"
        case .array(let value):
            return value.map(\.displayString).joined(separator: ", ")
        case .object(let value):
            return value.map { "\($0.key): \($0.value.displayString)" }.joined(separator: ", ")
        case .null:
            return "—"
        }
    }
}
