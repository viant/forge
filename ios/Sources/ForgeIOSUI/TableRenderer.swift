import SwiftUI
import ForgeIOSRuntime

private let hostedWorkspaceDidOpenNotification = Notification.Name("forgeHostedWorkspaceDidOpen")

public struct TableRenderer: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.forgeEmbeddedNonScrolling) private var forgeEmbeddedNonScrolling

    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let table: TableDef
    private let providedRows: [[String: JSONValue]]?
    @State private var rows: [[String: JSONValue]] = []
    @State private var metrics: [String: JSONValue] = [:]
    @State private var input: InputState = InputState()
    @State private var paging: DataSourcePagingDef? = nil
    @State private var selectedRowIndex: Int? = nil
    @State private var controlState = ControlState()
    @State private var sortColumnKey: String? = nil
    @State private var sortAscending = true
    @State private var plannerSelectedRowIndexes: Set<Int> = []
    @State private var plannerSelectionTouched = false
    @State private var plannerSubmitState: PlannerSubmitState = .idle
    @State private var isRefreshing = false

    public init(
        runtime: ForgeRuntime? = nil,
        window: WindowContext? = nil,
        container: ContainerDef,
        table: TableDef,
        rows: [[String: JSONValue]]? = nil
    ) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.table = table
        self.providedRows = rows
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = resolvedTableTitle {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary.opacity(0.9))
            }
            if let toolbar = table.toolbar, !toolbar.items.isEmpty {
                tableToolbar(toolbar)
            }
            if tableRefreshControlVisible(dataSourceRef: resolvedDataSourceRef, usesProvidedRows: providedRows != nil) {
                tableRefreshControl
            }
            if let refreshMessage = currentTableRefreshFeedback.message {
                Text(refreshMessage)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
            if isPlannerTable && !rows.isEmpty {
                plannerToolbar
            }
            if rows.isEmpty {
                placeholderTable
            } else {
                contentTable
            }
            paginationFooter
        }
        .padding(10)
        .background(Color.forgeSystemBackground, in: RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
        .task(id: tableTaskKey) {
            await loadRows()
        }
        .task(id: subscriptionTaskKey) {
            await observeRows()
        }
        .task(id: metricsTaskKey) {
            await observeMetrics()
        }
        .task(id: inputTaskKey) {
            await observeInput()
        }
        .task(id: controlTaskKey) {
            await observeControl()
        }
        .task(id: pagingTaskKey) {
            await loadPaging()
        }
    }

    private var resolvedTableTitle: String? {
        let tableTitle = table.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        let containerTitle = container.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let tableTitle, !tableTitle.isEmpty else {
            return nil
        }
        if let containerTitle, !containerTitle.isEmpty,
           tableTitle.compare(containerTitle, options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame {
            return nil
        }
        return tableTitle
    }

    private var tableTaskKey: String {
        [
            window?.windowID ?? "",
            container.id ?? "",
            container.dataSourceRef ?? "",
            table.title ?? "",
            table.columns.map(\.identityKey).joined(separator: "|"),
            providedRows.map { "provided:\(String(describing: $0).hashValue)" } ?? "runtime"
        ].joined(separator: ":")
    }

    private var subscriptionTaskKey: String {
        [window?.windowID ?? "", container.dataSourceRef ?? ""].joined(separator: ":")
    }

    private var metricsTaskKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, "metrics"].joined(separator: ":")
    }

    private var inputTaskKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, "input"].joined(separator: ":")
    }

    private var controlTaskKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, "control"].joined(separator: ":")
    }

    private var pagingTaskKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, "paging"].joined(separator: ":")
    }

    private var resolvedDataSourceRef: String {
        container.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? ""
    }

    private var isPlannerTable: Bool {
        container.kind?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "planner.table"
    }

    private var plannerSelectionField: String {
        plannerTableSelectionField(table)
    }

    private var plannerDisabledField: String {
        plannerTableDisabledField(table)
    }

    private var plannerRowsWithSelection: [[String: JSONValue]] {
        plannerTableRowsWithSelection(
            rows: rows,
            selectedRowIndexes: plannerSelectedRowIndexes,
            selectionField: plannerSelectionField
        )
    }

    private var plannerCSVText: String {
        plannerTableCSV(
            columns: displayColumns,
            rows: plannerRowsWithSelection,
            selectionField: plannerSelectionField
        )
    }

    private var plannerSubmitExecution: ExecutionDef? {
        table.on.first
    }

    private var plannerSelectedRowCount: Int {
        plannerSelectedRowIndexes.filter { index in
            rows.indices.contains(index) && !plannerTableRowDisabled(rows[index], disabledField: plannerDisabledField)
        }.count
    }

    private var plannerSubmitFeedback: PlannerTableSubmitFeedback {
        plannerTableSubmitFeedback(
            status: plannerSubmitState.feedbackStatus,
            selectedCount: plannerSelectedRowCount,
            selectableCount: plannerTableSelectableRowCount(rows: rows, disabledField: plannerDisabledField),
            failureMessage: plannerSubmitState.failureMessage
        )
    }

    @ViewBuilder
    private var tableRefreshControl: some View {
        let feedback = currentTableRefreshFeedback
        Button {
            refreshRows()
        } label: {
            if feedback.busy {
                ProgressView()
                    .controlSize(.small)
            } else {
                Label("Refresh", systemImage: "arrow.clockwise")
            }
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
        .disabled(feedback.busy)
        .accessibilityLabel(feedback.busy ? "Refreshing table" : "Refresh table")
    }

    private var currentTableRefreshFeedback: TableRefreshFeedback {
        tableRefreshFeedback(control: controlState, isRefreshing: isRefreshing)
    }

    @ViewBuilder
    private var plannerToolbar: some View {
        HStack(spacing: 8) {
            ShareLink(
                item: plannerCSVText,
                preview: SharePreview("\(container.id ?? "planner-table").csv")
            ) {
                Label("CSV", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)

            if plannerSubmitExecution != nil || table.callback != nil {
                let feedback = plannerSubmitFeedback
                Button {
                    submitPlannerTable()
                } label: {
                    if feedback.busy {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Label(feedback.buttonLabel, systemImage: feedback.systemImage)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(feedback.busy)
            }

            if let message = plannerSubmitFeedback.message {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(plannerSubmitFeedback.messageColor)
            }
        }
    }

    private func refreshRows() {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty, providedRows == nil else {
            return
        }
        isRefreshing = true
        Task {
            await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
            let refreshedRows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
            await MainActor.run {
                rows = refreshedRows
                seedPlannerSelectionIfNeeded(refreshedRows)
                isRefreshing = false
            }
        }
    }

    private func loadRows() async {
        if let providedRows {
            rows = providedRows
            seedPlannerSelectionIfNeeded(providedRows)
            return
        }
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else {
            rows = []
            return
        }
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        seedPlannerSelectionIfNeeded(rows)
        guard rows.isEmpty else {
            return
        }
        // Hosted mobile windows can be presented immediately after bridge open,
        // before the async datasource refresh has populated local collection
        // state. Retry a few times so the first visible render can pick up the
        // incoming rows without requiring a second manual open.
        for _ in 0..<5 {
            try? await Task.sleep(for: .milliseconds(200))
            let refreshedRows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
            if !refreshedRows.isEmpty {
                rows = refreshedRows
                seedPlannerSelectionIfNeeded(refreshedRows)
                break
            }
        }
    }

    private func observeRows() async {
        guard providedRows == nil else {
            return
        }
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else {
            return
        }
        let stream = await runtime.dataSourceCollectionUpdates(
            windowID: window.windowID,
            dataSourceRef: resolvedDataSourceRef
        )
        for await next in stream {
            await MainActor.run {
                rows = next
                seedPlannerSelectionIfNeeded(next)
            }
        }
    }

    private func observeMetrics() async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else {
            return
        }
        let initialMetrics = await runtime.dataSourceMetrics(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        await MainActor.run {
            metrics = initialMetrics
        }
        let stream = await runtime.dataSourceMetricsUpdates(
            windowID: window.windowID,
            dataSourceRef: resolvedDataSourceRef
        )
        for await next in stream {
            await MainActor.run {
                metrics = next
            }
        }
    }

    private func observeInput() async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else {
            return
        }
        input = await runtime.dataSourceInputState(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        let stream = await runtime.dataSourceInputUpdates(
            windowID: window.windowID,
            dataSourceRef: resolvedDataSourceRef
        )
        for await next in stream {
            await MainActor.run {
                input = next
            }
        }
    }

    private func observeControl() async {
        guard providedRows == nil else {
            return
        }
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else {
            return
        }
        let initialControl = await runtime.dataSourceControl(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        await MainActor.run {
            controlState = initialControl
        }
        let stream = await runtime.dataSourceControlUpdates(
            windowID: window.windowID,
            dataSourceRef: resolvedDataSourceRef
        )
        for await next in stream {
            await MainActor.run {
                controlState = next
            }
        }
    }

    private func loadPaging() async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else {
            paging = nil
            return
        }
        let metadata = await runtime.windowMetadata(id: window.windowID)
        await MainActor.run {
            paging = metadata?.dataSources[resolvedDataSourceRef]?.paging
        }
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
        let sortedRows = sortedTableRows(rows: rows, sortColumnKey: sortColumnKey, ascending: sortAscending)
        return Group {
            if forgeEmbeddedNonScrolling {
                VStack(alignment: .leading, spacing: 12) {
                    compactSortControls
                    ForEach(sortedRows) { indexed in
                        compactRowCard(row: indexed.row, rowIndex: indexed.originalIndex)
                    }
                }
            } else {
                LazyVStack(alignment: .leading, spacing: 12) {
                    compactSortControls
                    ForEach(sortedRows) { indexed in
                        compactRowCard(row: indexed.row, rowIndex: indexed.originalIndex)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func compactRowCard(row: [String: JSONValue], rowIndex: Int) -> some View {
        let content = VStack(alignment: .leading, spacing: 10) {
            if isPlannerTable {
                plannerSelectionControl(row: row, rowIndex: rowIndex)
            }
            if let primary = displayColumns.first {
                VStack(alignment: .leading, spacing: 3) {
                    Text(primary.displayLabel)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    valueLabel(row: row, column: primary, fallback: primary.displayLabel, font: .headline, color: .primary)
                }
            }
            ForEach(Array(displayColumns.dropFirst()), id: \.identityKey) { column in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text(column.displayLabel)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Spacer(minLength: 8)
                    valueLabel(row: row, column: column, font: .body, color: .primary)
                        .multilineTextAlignment(.trailing)
                }
                if column.identityKey != displayColumns.last?.identityKey {
                    Divider()
                        .overlay(Color.black.opacity(0.04))
                }
            }
            if !actionColumns.isEmpty {
                HStack(spacing: 8) {
                    actionButtons(row: row, rowIndex: rowIndex, compact: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 11)
        .background(Color.forgeSecondarySystemBackground, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(selectedRowIndex == rowIndex ? Color.accentColor.opacity(0.30) : Color.black.opacity(0.06), lineWidth: selectedRowIndex == rowIndex ? 1.5 : 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .accessibilityElement(children: actionColumns.isEmpty ? .combine : .contain)
        .accessibilityLabel(rowAccessibilityLabel(row: row))
        .accessibilityAddTraits(actionColumns.isEmpty ? .isButton : [])

        if !isPlannerTable && actionColumns.isEmpty && !rowHasInteractiveLinks(row) {
            Button {
                handleRowSelection(row: row, rowIndex: rowIndex)
            } label: {
                content
            }
            .buttonStyle(.plain)
        } else {
            content
                .onTapGesture {
                    handleRowSelection(row: row, rowIndex: rowIndex)
                }
        }
    }

    private var regularGridTable: some View {
        let sortedRows = sortedTableRows(rows: rows, sortColumnKey: sortColumnKey, ascending: sortAscending)
        return ScrollView(.horizontal, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                headerRow
                Divider()
                    .overlay(Color.black.opacity(0.05))
                ForEach(Array(sortedRows.enumerated()), id: \.element.id) { displayIndex, indexed in
                    dataRow(row: indexed.row, index: indexed.originalIndex, displayIndex: displayIndex)
                    if displayIndex != sortedRows.indices.last {
                        Divider()
                            .overlay(Color.black.opacity(0.05))
                    }
                }
            }
            .background(Color.forgeSystemBackground, in: RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.black.opacity(0.05), lineWidth: 1)
            )
        }
    }

    private var headerRow: some View {
        HStack(alignment: .top, spacing: 0) {
            if isPlannerTable {
                Text("Selected")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .frame(width: 96, alignment: .leading)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
            }
            ForEach(displayColumns, id: \.identityKey) { column in
                headerCell(column: column)
            }
            if !actionColumns.isEmpty {
                Text("Actions")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .frame(width: 160, alignment: .trailing)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
            }
        }
        .background(Color.forgeSecondarySystemBackground)
    }

    @ViewBuilder
    private func dataRow(row: [String: JSONValue], index: Int, displayIndex: Int) -> some View {
        let content = HStack(alignment: .top, spacing: 0) {
            if isPlannerTable {
                plannerSelectionControl(row: row, rowIndex: index)
                    .frame(width: 96, alignment: .leading)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
            }
            ForEach(displayColumns, id: \.identityKey) { column in
                valueLabel(row: row, column: column, font: .subheadline, color: .primary)
                    .frame(width: Self.columnWidth(for: column), alignment: .leading)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 10)
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
        .background(
            selectedRowIndex == index
                ? Color.accentColor.opacity(0.08)
                : (displayIndex.isMultiple(of: 2) ? Color.clear : Color.black.opacity(0.014))
        )
        .contentShape(Rectangle())
        .accessibilityElement(children: actionColumns.isEmpty ? .combine : .contain)
        .accessibilityLabel(rowAccessibilityLabel(row: row))
        .accessibilityAddTraits(actionColumns.isEmpty ? .isButton : [])

        if !isPlannerTable && actionColumns.isEmpty && !rowHasInteractiveLinks(row) {
            Button {
                handleRowSelection(row: row, rowIndex: index)
            } label: {
                content
            }
            .buttonStyle(.plain)
        } else {
            content
                .onTapGesture {
                    handleRowSelection(row: row, rowIndex: index)
                }
        }
    }

    @ViewBuilder
    private func headerCell(column: ColumnDef) -> some View {
        let key = columnKey(column)
        let label = sortedHeaderLabel(for: column, key: key)
        if column.sortable == true, !key.isEmpty {
            Button {
                toggleSort(columnKey: key)
            } label: {
                Text(label)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .frame(width: Self.columnWidth(for: column), alignment: .leading)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.plain)
        } else {
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .frame(width: Self.columnWidth(for: column), alignment: .leading)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
        }
    }

    private func toggleSort(columnKey: String) {
        if sortColumnKey == columnKey {
            sortAscending.toggle()
        } else {
            sortColumnKey = columnKey
            sortAscending = true
        }
    }

    private func sortedHeaderLabel(for column: ColumnDef, key: String) -> String {
        guard column.sortable == true, !key.isEmpty, sortColumnKey == key else {
            return column.displayLabel
        }
        return "\(column.displayLabel) \(sortAscending ? "^" : "v")"
    }

    @ViewBuilder
    private var paginationFooter: some View {
        if let state = tablePaginationState(paging: paging, metrics: metrics, input: input) {
            HStack(spacing: 8) {
                Button {
                    setPage(1)
                } label: {
                    Image(systemName: "backward.end.fill")
                }
                .disabled(!state.canGoPrevious)
                .accessibilityLabel("First page")

                Button {
                    setPage(max(1, state.currentPage - 1))
                } label: {
                    Image(systemName: "chevron.left")
                }
                .disabled(!state.canGoPrevious)
                .accessibilityLabel("Previous page")

                Text(state.label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 92)

                Button {
                    setPage(state.currentPage + 1)
                } label: {
                    Image(systemName: "chevron.right")
                }
                .disabled(!state.canGoNext)
                .accessibilityLabel("Next page")

                Button {
                    if let totalPages = state.totalPages {
                        setPage(totalPages)
                    }
                } label: {
                    Image(systemName: "forward.end.fill")
                }
                .disabled(!state.canGoLast)
                .accessibilityLabel("Last page")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .padding(.top, 2)
        }
    }

    private func setPage(_ page: Int) {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else {
            return
        }
        Task {
            await runtime.setDataSourcePage(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef, page: page)
        }
    }

    @ViewBuilder
    private var compactSortControls: some View {
        let columns = displayColumns.filter { ($0.sortable == true) && !columnKey($0).isEmpty }
        if !columns.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(columns, id: \.identityKey) { column in
                        let key = columnKey(column)
                        Button {
                            toggleSort(columnKey: key)
                        } label: {
                            Text(sortedHeaderLabel(for: column, key: key))
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(
                                    key == sortColumnKey ? Color.accentColor.opacity(0.14) : Color.forgeSecondarySystemBackground,
                                    in: Capsule()
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
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

    @ViewBuilder
    private func plannerSelectionControl(row: [String: JSONValue], rowIndex: Int) -> some View {
        let disabled = plannerTableRowDisabled(row, disabledField: plannerDisabledField)
        let selected = plannerSelectedRowIndexes.contains(rowIndex)
        Button {
            togglePlannerRow(rowIndex: rowIndex)
        } label: {
            Label(
                selected ? "Selected" : "Not selected",
                systemImage: selected ? "checkmark.square.fill" : "square"
            )
            .font(.caption.weight(.semibold))
            .foregroundStyle(disabled ? Color.secondary : (selected ? Color.accentColor : Color.primary))
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? 0.55 : 1)
        .accessibilityLabel(selected ? "Selected row" : "Unselected row")
    }

    private func seedPlannerSelectionIfNeeded(_ rows: [[String: JSONValue]]) {
        guard isPlannerTable else { return }
        if plannerSelectionTouched {
            plannerSelectedRowIndexes = plannerSelectedRowIndexes.filter { $0 >= 0 && $0 < rows.count }
            return
        }
        plannerSelectedRowIndexes = plannerTableDefaultSelectedIndexes(
            rows: rows,
            selectionField: plannerSelectionField,
            disabledField: plannerDisabledField
        )
    }

    private func togglePlannerRow(rowIndex: Int) {
        guard rows.indices.contains(rowIndex) else { return }
        guard !plannerTableRowDisabled(rows[rowIndex], disabledField: plannerDisabledField) else { return }
        plannerSelectionTouched = true
        if plannerSelectedRowIndexes.contains(rowIndex) {
            plannerSelectedRowIndexes.remove(rowIndex)
        } else {
            plannerSelectedRowIndexes.insert(rowIndex)
        }
        plannerSubmitState = .idle
        publishPlannerSelection(rowIndex: rowIndex)
    }

    private func publishPlannerSelection(rowIndex: Int = -1) {
        guard let runtime, let window, let dataSourceRef = container.dataSourceRef, !dataSourceRef.isEmpty else {
            return
        }
        let selectedRows = plannerTableRowsWithSelection(
            rows: rows,
            selectedRowIndexes: plannerSelectedRowIndexes,
            selectionField: plannerSelectionField
        ).enumerated().compactMap { index, row in
            plannerSelectedRowIndexes.contains(index) ? row : nil
        }
        Task {
            await runtime.setDataSourceSelectionState(
                windowID: window.windowID,
                dataSourceRef: dataSourceRef,
                selection: SelectionState(selection: selectedRows, rowIndex: rowIndex)
            )
        }
    }

    private func submitPlannerTable() {
        guard let runtime, let window else { return }
        let dataSourceRef = container.dataSourceRef ?? ""
        let payload = plannerTableCallbackPayload(
            table: table,
            dataSourceRef: dataSourceRef,
            rows: rows,
            selectedRowIndexes: plannerSelectedRowIndexes
        )
        let csv = plannerTableCSV(
            columns: displayColumns,
            rows: plannerTableRowsWithSelection(
                rows: rows,
                selectedRowIndexes: plannerSelectedRowIndexes,
                selectionField: plannerSelectionField
            ),
            selectionField: plannerSelectionField
        )
        plannerSubmitState = .submitting
        guard let execution = plannerSubmitExecution else {
            plannerSubmitState = table.callback == nil ? .failure("No submit action configured.") : .success
            return
        }
        Task {
            guard await runtime.canExecute(execution) else {
                await MainActor.run {
                    plannerSubmitState = .failure("No submit handler configured.")
                }
                return
            }
            _ = await runtime.execute(
                execution,
                context: ExecutionContext(windowID: window.windowID, dataSourceRef: dataSourceRef),
                args: [
                    "payload": .object(payload),
                    "callback": payload["callback"] ?? .null,
                    "selectedRows": payload["selectedRows"] ?? .array([]),
                    "unselectedRows": payload["unselectedRows"] ?? .array([]),
                    "disabledRows": payload["disabledRows"] ?? .array([]),
                    "selectionField": payload["selectionField"] ?? .string(plannerSelectionField),
                    "csv": .string(csv)
                ]
            )
            await MainActor.run {
                plannerSubmitState = .success
            }
        }
    }

    private func columnKey(_ column: ColumnDef) -> String {
        column.id ?? column.name ?? column.key ?? column.label ?? ""
    }

    private func handleRowSelection(row: [String: JSONValue], rowIndex: Int) {
        if isPlannerTable {
            togglePlannerRow(rowIndex: rowIndex)
            return
        }
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

    private func rowAccessibilityLabel(row: [String: JSONValue]) -> String {
        tableRowAccessibilityLabel(columns: displayColumns, row: row)
    }

    private func rowHasInteractiveLinks(_ row: [String: JSONValue]) -> Bool {
        displayColumns.contains { resolvedLinkTarget(for: $0, row: row) != nil }
    }

    private func displayValue(_ value: JSONValue?, column: ColumnDef? = nil, fallback: String? = nil) -> String {
        if let value {
            if let format = column?.format?.trimmingCharacters(in: .whitespacesAndNewlines),
               !format.isEmpty {
                return DashboardRuntime.formatDashboardValue(value.anyValueValue, format: format)
            }
            return value.displayString
        }
        if let emptyText = column?.emptyText?.trimmingCharacters(in: .whitespacesAndNewlines),
           !emptyText.isEmpty {
            return emptyText
        }
        if let fallback, !fallback.isEmpty {
            return fallback
        }
        return "—"
    }

    @ViewBuilder
    private func valueLabel(row: [String: JSONValue], column: ColumnDef, fallback: String? = nil, font: Font, color: Color) -> some View {
        let text = displayValue(row[columnKey(column)], column: column, fallback: fallback)
        if let resolved = resolvedLinkTarget(for: column, row: row) {
            switch resolved {
            case .external(let destination):
                Link(text, destination: destination)
                    .font(font)
                    .foregroundStyle(.tint)
                    .lineLimit(2)
            case .window(let link):
                Button {
                    Task {
                        await openWindowLink(link)
                    }
                } label: {
                    Text(text)
                        .font(font)
                        .foregroundStyle(.tint)
                        .lineLimit(2)
                }
                .buttonStyle(.plain)
            }
        } else {
            Text(text)
                .font(font)
                .foregroundStyle(color)
                .lineLimit(2)
        }
    }

    private func resolvedLinkTarget(for column: ColumnDef, row: [String: JSONValue]) -> ResolvedLinkTarget? {
        resolveColumnLinkTargetFromContext(
            column: column,
            context: LinkResolutionContext(
                row: row,
                value: row[columnKey(column)]
            )
        )
    }

    private func openWindowLink(_ link: WindowLinkTarget) async {
        guard let runtime, let window else {
            return
        }
        let state = await openResolvedWindowLink(runtime: runtime, window: window, link: link)
        await MainActor.run {
            NotificationCenter.default.post(
                name: hostedWorkspaceDidOpenNotification,
                object: nil,
                userInfo: ["state": state]
            )
        }
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

enum PlannerSubmitState: Equatable {
    case idle
    case submitting
    case success
    case failure(String)

    var feedbackStatus: PlannerTableSubmitStatus {
        switch self {
        case .idle:
            return .idle
        case .submitting:
            return .submitting
        case .success:
            return .submitted
        case .failure:
            return .failure
        }
    }

    var failureMessage: String? {
        if case .failure(let message) = self {
            return message
        }
        return nil
    }
}

enum PlannerTableSubmitStatus: Equatable {
    case idle
    case submitting
    case submitted
    case failure
}

struct PlannerTableSubmitFeedback: Equatable {
    let buttonLabel: String
    let systemImage: String
    let message: String?
    let busy: Bool

    var messageColor: Color {
        switch self {
        case let feedback where feedback.busy:
            return .secondary
        case let feedback where feedback.buttonLabel == "Submitted":
            return .green
        case let feedback where feedback.buttonLabel == "Retry":
            return .red
        default:
            return .secondary
        }
    }
}

struct TablePaginationState: Equatable {
    let currentPage: Int
    let totalPages: Int?
    let totalCount: Int?
    let hasMore: Bool

    var canGoPrevious: Bool { currentPage > 1 }
    var canGoNext: Bool { totalPages.map { currentPage < $0 } ?? hasMore }
    var canGoLast: Bool { totalPages.map { currentPage < $0 } ?? false }

    var label: String {
        var text = totalPages.map { "Page \(currentPage) of \($0)" } ?? "Page \(currentPage)"
        if let totalCount {
            text += " (\(totalCount))"
        }
        return text
    }
}

func tablePaginationState(
    paging: DataSourcePagingDef?,
    metrics: [String: JSONValue],
    input: InputState
) -> TablePaginationState? {
    let enabledByPaging = paging?.enabled == true || (paging?.size ?? 0) > 0
    let pageCount = positiveInt(metrics["pageCount"])
    let totalCount = nonNegativeInt(metrics["totalCount"])
    let hasMore = boolValue(metrics["hasMore"]) ?? false
    guard enabledByPaging || pageCount != nil || hasMore || totalCount != nil else {
        return nil
    }
    let currentPage = max(1, input.page ?? positiveInt(metrics["page"]) ?? 1)
    return TablePaginationState(
        currentPage: currentPage,
        totalPages: pageCount,
        totalCount: totalCount,
        hasMore: hasMore
    )
}

func tableRefreshControlVisible(dataSourceRef: String, usesProvidedRows: Bool) -> Bool {
    !usesProvidedRows && !dataSourceRef.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
}

struct TableRefreshFeedback: Equatable {
    let busy: Bool
    let message: String?
}

func tableRefreshFeedback(control: ControlState, isRefreshing: Bool) -> TableRefreshFeedback {
    TableRefreshFeedback(
        busy: isRefreshing || control.loading,
        message: control.error?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank
    )
}

func tableRowAccessibilityLabel(
    columns: [ColumnDef],
    row: [String: JSONValue],
    limit: Int = 3
) -> String {
    columns
        .prefix(max(limit, 0))
        .map { column in
            let key = tableAccessibilityColumnKey(column)
            let value = tableAccessibilityDisplayValue(row[key], column: column)
            return "\(column.displayLabel) \(value)"
        }
        .joined(separator: ", ")
}

private func tableAccessibilityColumnKey(_ column: ColumnDef) -> String {
    column.id ?? column.name ?? column.key ?? column.label ?? ""
}

private func tableAccessibilityDisplayValue(_ value: JSONValue?, column: ColumnDef) -> String {
    if let value {
        if let format = column.format?.trimmingCharacters(in: .whitespacesAndNewlines),
           !format.isEmpty {
            return DashboardRuntime.formatDashboardValue(value.anyValueValue, format: format)
        }
        return value.displayString
    }
    if let emptyText = column.emptyText?.trimmingCharacters(in: .whitespacesAndNewlines),
       !emptyText.isEmpty {
        return emptyText
    }
    return "—"
}

private func positiveInt(_ value: JSONValue?) -> Int? {
    guard let int = nonNegativeInt(value), int > 0 else {
        return nil
    }
    return int
}

private func nonNegativeInt(_ value: JSONValue?) -> Int? {
    switch value {
    case .number(let number):
        let int = Int(number)
        return int >= 0 ? int : nil
    case .string(let string):
        guard let int = Int(string.trimmingCharacters(in: .whitespacesAndNewlines)), int >= 0 else {
            return nil
        }
        return int
    default:
        return nil
    }
}

private func boolValue(_ value: JSONValue?) -> Bool? {
    switch value {
    case .bool(let bool):
        return bool
    case .number(let number):
        return number != 0
    case .string(let string):
        let normalized = string.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if ["true", "yes", "1"].contains(normalized) {
            return true
        }
        if ["false", "no", "0"].contains(normalized) {
            return false
        }
        return nil
    default:
        return nil
    }
}

struct IndexedTableRow: Identifiable, Equatable {
    let originalIndex: Int
    let row: [String: JSONValue]

    var id: Int { originalIndex }
}

func sortedTableRows(
    rows: [[String: JSONValue]],
    sortColumnKey: String?,
    ascending: Bool
) -> [IndexedTableRow] {
    let indexed = rows.enumerated().map { IndexedTableRow(originalIndex: $0.offset, row: $0.element) }
    guard let sortColumnKey,
          !sortColumnKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    else {
        return indexed
    }
    return indexed.sorted { left, right in
        compareTableSortValues(
            left: tableSortValue(row: left.row, key: sortColumnKey),
            right: tableSortValue(row: right.row, key: sortColumnKey),
            ascending: ascending
        )
    }
}

private func tableSortValue(row: [String: JSONValue], key: String) -> JSONValue? {
    let parts = key.split(separator: ".").map(String.init)
    guard !parts.isEmpty else {
        return nil
    }
    var current: JSONValue? = .object(row)
    for part in parts {
        switch current {
        case .object(let object):
            current = object[part]
        case .array(let array):
            guard let index = Int(part), array.indices.contains(index) else {
                return nil
            }
            current = array[index]
        default:
            return nil
        }
    }
    return current
}

private func compareTableSortValues(left: JSONValue?, right: JSONValue?, ascending: Bool) -> Bool {
    let result: ComparisonResult
    switch (left, right) {
    case (.none, .none), (.null?, .null?):
        result = .orderedSame
    case (.none, _), (.null?, _):
        result = .orderedAscending
    case (_, .none), (_, .null?):
        result = .orderedDescending
    case (.number(let leftNumber)?, .number(let rightNumber)?):
        result = leftNumber == rightNumber ? .orderedSame : (leftNumber < rightNumber ? .orderedAscending : .orderedDescending)
    case (.string(let leftString)?, .string(let rightString)?):
        result = leftString.localizedCaseInsensitiveCompare(rightString)
    default:
        result = tableSortDisplayString(left).localizedCaseInsensitiveCompare(tableSortDisplayString(right))
    }
    if ascending {
        return result == .orderedAscending
    }
    return result == .orderedDescending
}

private func tableSortDisplayString(_ value: JSONValue?) -> String {
    switch value {
    case .string(let string):
        return string
    case .number(let number):
        if number.rounded(.towardZero) == number {
            return String(Int(number))
        }
        return String(number)
    case .bool(let bool):
        return bool ? "true" : "false"
    case .array(let array):
        return array.map { tableSortDisplayString($0) }.joined(separator: ", ")
    case .object(let object):
        return object.keys.sorted().map { "\($0): \(tableSortDisplayString(object[$0]))" }.joined(separator: ", ")
    case .null, .none:
        return ""
    }
}

func plannerTableSelectionField(_ table: TableDef) -> String {
    table.selectionField?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? "selected"
}

func plannerTableDisabledField(_ table: TableDef) -> String {
    table.disabledField?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? "disabled"
}

func plannerTableDefaultSelectedIndexes(
    rows: [[String: JSONValue]],
    selectionField: String,
    disabledField: String
) -> Set<Int> {
    Set(rows.enumerated().compactMap { index, row in
        if plannerTableRowDisabled(row, disabledField: disabledField) {
            return nil
        }
        return plannerTableBool(row[selectionField]) == false ? nil : index
    })
}

func plannerTableRowsWithSelection(
    rows: [[String: JSONValue]],
    selectedRowIndexes: Set<Int>,
    selectionField: String
) -> [[String: JSONValue]] {
    rows.enumerated().map { index, row in
        var next = row
        next[selectionField] = .bool(selectedRowIndexes.contains(index))
        return next
    }
}

func plannerTableSelectableRowCount(rows: [[String: JSONValue]], disabledField: String) -> Int {
    rows.filter { !plannerTableRowDisabled($0, disabledField: disabledField) }.count
}

func plannerTableSubmitFeedback(
    status: PlannerTableSubmitStatus,
    selectedCount: Int = 0,
    selectableCount: Int = 0,
    failureMessage: String? = nil
) -> PlannerTableSubmitFeedback {
    switch status {
    case .idle:
        return PlannerTableSubmitFeedback(
            buttonLabel: "Submit",
            systemImage: "paperplane",
            message: nil,
            busy: false
        )
    case .submitting:
        return PlannerTableSubmitFeedback(
            buttonLabel: "Submitting...",
            systemImage: "paperplane",
            message: plannerTableSelectionSummary(
                prefix: "Submitting",
                selectedCount: selectedCount,
                selectableCount: selectableCount
            ),
            busy: true
        )
    case .submitted:
        return PlannerTableSubmitFeedback(
            buttonLabel: "Submitted",
            systemImage: "checkmark.circle.fill",
            message: plannerTableSelectionSummary(
                prefix: "Submitted",
                selectedCount: selectedCount,
                selectableCount: selectableCount
            ),
            busy: false
        )
    case .failure:
        return PlannerTableSubmitFeedback(
            buttonLabel: "Retry",
            systemImage: "exclamationmark.triangle",
            message: failureMessage?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? "Submit action failed.",
            busy: false
        )
    }
}

func plannerTableCallbackPayload(
    table: TableDef,
    dataSourceRef: String,
    rows: [[String: JSONValue]],
    selectedRowIndexes: Set<Int>
) -> [String: JSONValue] {
    let selectionField = plannerTableSelectionField(table)
    let disabledField = plannerTableDisabledField(table)
    let rowsWithSelection = plannerTableRowsWithSelection(
        rows: rows,
        selectedRowIndexes: selectedRowIndexes,
        selectionField: selectionField
    )
    let disabledRows = rowsWithSelection.filter {
        plannerTableRowDisabled($0, disabledField: disabledField)
    }
    let activeRows = rowsWithSelection.filter {
        !plannerTableRowDisabled($0, disabledField: disabledField)
    }
    return [
        "callback": table.callback ?? .null,
        "dataSourceRef": .string(dataSourceRef),
        "selectedRows": .array(activeRows.enumerated().compactMap { index, row in
            plannerTableBool(row[selectionField]) == true ? .object(row) : nil
        }),
        "unselectedRows": .array(activeRows.enumerated().compactMap { _, row in
            plannerTableBool(row[selectionField]) == true ? nil : .object(row)
        }),
        "disabledRows": .array(disabledRows.map { .object($0) }),
        "selectionField": .string(selectionField)
    ]
}

func plannerTableCSV(
    columns: [ColumnDef],
    rows: [[String: JSONValue]],
    selectionField: String
) -> String {
    var exportColumns = columns
    if !exportColumns.contains(where: { plannerTableColumnKey($0) == selectionField }) {
        exportColumns.append(ColumnDef(id: selectionField, name: selectionField, label: selectionField))
    }
    let headers = exportColumns.map { plannerCSVCell($0.displayLabel) }
    let body = rows.map { row in
        exportColumns.map { column in
            plannerCSVCell(row[plannerTableColumnKey(column)]?.displayString ?? "")
        }.joined(separator: ",")
    }
    return ([headers.joined(separator: ",")] + body).joined(separator: "\n")
}

func plannerTableRowDisabled(_ row: [String: JSONValue], disabledField: String) -> Bool {
    if plannerTableBool(row[disabledField]) == true {
        return true
    }
    if disabledField != "disabled", plannerTableBool(row["disabled"]) == true {
        return true
    }
    return plannerTableBool(row["isDisabled"]) == true
}

private func plannerTableSelectionSummary(prefix: String, selectedCount: Int, selectableCount: Int) -> String {
    let boundedSelected = max(0, selectedCount)
    let boundedSelectable = max(0, selectableCount)
    if boundedSelectable > 0 {
        let rowLabel = boundedSelectable == 1 ? "row" : "rows"
        return "\(prefix) \(boundedSelected) of \(boundedSelectable) selectable \(rowLabel)."
    }
    let rowLabel = boundedSelected == 1 ? "row" : "rows"
    return "\(prefix) \(boundedSelected) selected \(rowLabel)."
}

private func plannerTableBool(_ value: JSONValue?) -> Bool? {
    switch value {
    case .bool(let value):
        return value
    case .number(let value):
        return value != 0
    case .string(let value):
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if ["true", "yes", "1", "selected", "enabled"].contains(normalized) {
            return true
        }
        if ["false", "no", "0", "unselected", "disabled"].contains(normalized) {
            return false
        }
        return nil
    default:
        return nil
    }
}

private func plannerTableColumnKey(_ column: ColumnDef) -> String {
    column.id ?? column.name ?? column.key ?? column.label ?? ""
}

private func plannerCSVCell(_ value: String) -> String {
    if value.contains("\"") || value.contains(",") || value.contains("\n") || value.contains("\r") {
        return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
    }
    return value
}

private extension ColumnDef {
    var identityKey: String {
        id ?? name ?? key ?? label ?? UUID().uuidString
    }

    var displayLabel: String {
        label ?? name ?? id ?? key ?? "Column"
    }
}

private extension JSONValue {
    var anyValueValue: Any? {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return value
        case .bool(let value):
            return value
        case .array(let value):
            return value.map(\.anyValueValue)
        case .object(let value):
            return value.mapValues(\.anyValueValue)
        case .null:
            return nil
        }
    }

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

private extension String {
    var nilIfBlank: String? {
        isEmpty ? nil : self
    }
}
