import SwiftUI
import ForgeIOSRuntime

public struct TableRenderer: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let table: TableDef
    @State private var rows: [[String: JSONValue]] = []
    @State private var selectedRowIndex: Int? = nil

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
            if let toolbar = table.toolbar, !toolbar.items.isEmpty {
                tableToolbar(toolbar)
            }
            if rows.isEmpty {
                placeholderTable
            } else {
                contentTable
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
            table.columns.map(\.identityKey).joined(separator: "|")
        ].joined(separator: ":")
    }

    private func loadRows() async {
        guard let runtime, let window, let dataSourceRef = container.dataSourceRef, !dataSourceRef.isEmpty else {
            rows = []
            return
        }
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef)
    }

    private var presentationMode: TablePresentationMode {
        Self.resolvePresentationMode(
            targetContext: nil,
            horizontalSizeClass: horizontalSizeClass
        )
    }

    private var contentTable: some View {
        Group {
            switch presentationMode {
            case .compactCards:
                compactCardTable
            case .regularGrid:
                regularGridTable
            }
        }
    }

    private var placeholderTable: some View {
        Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 12, verticalSpacing: 8) {
            GridRow {
                ForEach(displayColumns, id: \.identityKey) { column in
                    Text(column.displayLabel)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }
            Divider()
            GridRow {
                ForEach(displayColumns, id: \.identityKey) { _ in
                    Text("—")
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    private var compactCardTable: some View {
        LazyVStack(alignment: .leading, spacing: 12) {
            ForEach(rows.indices, id: \.self) { index in
                compactRowCard(row: rows[index], rowIndex: index)
            }
        }
    }

    private func compactRowCard(row: [String: JSONValue], rowIndex: Int) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if let primary = displayColumns.first {
                Text(displayValue(row[columnKey(primary)], fallback: primary.displayLabel))
                    .font(.headline)
                    .foregroundStyle(.primary)
            }
            ForEach(Array(displayColumns.dropFirst()), id: \.identityKey) { column in
                VStack(alignment: .leading, spacing: 2) {
                    Text(column.displayLabel)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(displayValue(row[columnKey(column)]))
                        .font(.body)
                        .foregroundStyle(.primary)
                }
            }
            if !actionColumns.isEmpty {
                HStack(spacing: 8) {
                    actionButtons(row: row, rowIndex: rowIndex, compact: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.background, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(selectedRowIndex == rowIndex ? Color.accentColor.opacity(0.35) : Color.secondary.opacity(0.14), lineWidth: selectedRowIndex == rowIndex ? 1.5 : 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .onTapGesture {
            handleRowSelection(row: row, rowIndex: rowIndex)
        }
    }

    private var regularGridTable: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                headerRow
                Divider()
                ForEach(rows.indices, id: \.self) { index in
                    dataRow(row: rows[index], index: index)
                    if index != rows.indices.last {
                        Divider()
                    }
                }
            }
        }
    }

    private var headerRow: some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(displayColumns, id: \.identityKey) { column in
                Text(column.displayLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .frame(width: Self.columnWidth(for: column), alignment: .leading)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 10)
            }
            if !actionColumns.isEmpty {
                Text("Actions")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .frame(width: 160, alignment: .trailing)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 10)
            }
        }
        .background(Color.secondary.opacity(0.06))
    }

    private func dataRow(row: [String: JSONValue], index: Int) -> some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(displayColumns, id: \.identityKey) { column in
                Text(displayValue(row[columnKey(column)]))
                    .font(.footnote)
                    .foregroundStyle(.primary)
                    .frame(width: Self.columnWidth(for: column), alignment: .leading)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 12)
            }
            if !actionColumns.isEmpty {
                HStack(spacing: 6) {
                    actionButtons(row: row, rowIndex: index, compact: false)
                }
                .frame(width: 160, alignment: .trailing)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
            }
        }
        .background(selectedRowIndex == index ? Color.accentColor.opacity(0.08) : (index.isMultiple(of: 2) ? Color.clear : Color.secondary.opacity(0.035)))
        .contentShape(Rectangle())
        .onTapGesture {
            handleRowSelection(row: row, rowIndex: index)
        }
    }

    @ViewBuilder
    private func tableToolbar(_ toolbar: ToolbarDef) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(toolbar.items) { item in
                    Button(item.label ?? item.id ?? "Action") {
                        guard let runtime, let window else { return }
                        guard let execution = item.on.first else { return }
                        Task {
                            _ = await runtime.execute(
                                execution,
                                context: ExecutionContext(windowID: window.windowID, dataSourceRef: container.dataSourceRef ?? "")
                            )
                        }
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }

    @ViewBuilder
    private func actionButtons(row: [String: JSONValue], rowIndex: Int, compact: Bool) -> some View {
        ForEach(Array(actionColumns.enumerated()), id: \.element.identityKey) { _, column in
            if compact {
                Button {
                    executeRowAction(column: column, row: row, rowIndex: rowIndex)
                } label: {
                    Text(actionLabel(for: column))
                }
                .buttonStyle(BorderedProminentButtonStyle())
                .controlSize(.small)
            } else {
                Button {
                    executeRowAction(column: column, row: row, rowIndex: rowIndex)
                } label: {
                    Text(actionLabel(for: column))
                }
                .buttonStyle(BorderedButtonStyle())
                .controlSize(.small)
            }
        }
    }

    private var displayColumns: [ColumnDef] {
        table.columns.filter { column in
            let type = (column.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return type != "button" && type != "icon"
        }
    }

    private var actionColumns: [ColumnDef] {
        table.columns.filter { column in
            let type = (column.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return (type == "button" || type == "icon") && !column.on.isEmpty
        }
    }

    private func columnKey(_ column: ColumnDef) -> String {
        column.id ?? column.name ?? column.label ?? ""
    }

    private func handleRowSelection(row: [String: JSONValue], rowIndex: Int) {
        selectedRowIndex = selectedRowIndex == rowIndex ? nil : rowIndex
        guard let runtime, let window, let dataSourceRef = container.dataSourceRef, !dataSourceRef.isEmpty else {
            return
        }
        Task {
            _ = await runtime.execute(
                ExecutionDef(action: "dataSource.toggleSelection"),
                context: ExecutionContext(windowID: window.windowID, dataSourceRef: dataSourceRef),
                args: [
                    "row": .object(row),
                    "rowIndex": .number(Double(rowIndex))
                ]
            )
        }
    }

    private func executeRowAction(column: ColumnDef, row: [String: JSONValue], rowIndex: Int) {
        guard let runtime, let window else { return }
        guard let execution = column.on.first else { return }
        Task {
            _ = await runtime.execute(
                execution,
                context: ExecutionContext(windowID: window.windowID, dataSourceRef: container.dataSourceRef ?? ""),
                args: [
                    "row": .object(row),
                    "rowIndex": .number(Double(rowIndex))
                ]
            )
        }
    }

    private func actionLabel(for column: ColumnDef) -> String {
        if let label = column.label, !label.isEmpty { return label }
        if let icon = column.icon, !icon.isEmpty { return icon }
        if let id = column.id, !id.isEmpty { return id }
        if let name = column.name, !name.isEmpty { return name }
        return "Action"
    }

    private func displayValue(_ value: JSONValue?, fallback: String? = nil) -> String {
        if let value {
            return value.displayString
        }
        if let fallback, !fallback.isEmpty {
            return fallback
        }
        return "—"
    }
}

extension TableRenderer {
    static func resolvePresentationMode(
        targetContext: ForgeTargetContext?,
        horizontalSizeClass: UserInterfaceSizeClass?
    ) -> TablePresentationMode {
        if let formFactor = targetContext?.formFactor.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !formFactor.isEmpty {
            if formFactor == "tablet" || formFactor == "desktop" {
                return .regularGrid
            }
            return .compactCards
        }
        if horizontalSizeClass == .regular {
            return .regularGrid
        }
        return .compactCards
    }

    static func columnWidth(for column: ColumnDef) -> CGFloat {
        if let explicit = column.width, explicit > 0 {
            return CGFloat(explicit)
        }
        let base = max(120, min(260, column.displayLabel.count * 11))
        return CGFloat(base)
    }
}

enum TablePresentationMode: Equatable {
    case compactCards
    case regularGrid
}

private extension ColumnDef {
    var identityKey: String {
        id ?? name ?? label ?? UUID().uuidString
    }

    var displayLabel: String {
        label ?? name ?? id ?? "Column"
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
