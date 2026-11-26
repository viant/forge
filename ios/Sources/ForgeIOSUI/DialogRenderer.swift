import SwiftUI
import ForgeIOSRuntime

private struct ForgeDialogPresentationKey: EnvironmentKey {
    static let defaultValue: (id: String, presentation: UUID)? = nil
}

private struct ForgeDialogSelectionModeKey: EnvironmentKey {
    static let defaultValue = ""
}

private struct ForgeDialogCommitSelectionKey: EnvironmentKey {
    static let defaultValue: (([String: JSONValue], Int) -> Void)? = nil
}

extension EnvironmentValues {
    var forgeDialogPresentation: (id: String, presentation: UUID)? {
        get { self[ForgeDialogPresentationKey.self] }
        set { self[ForgeDialogPresentationKey.self] = newValue }
    }

    var forgeDialogSelectionMode: String {
        get { self[ForgeDialogSelectionModeKey.self] }
        set { self[ForgeDialogSelectionModeKey.self] = newValue }
    }

    var forgeDialogCommitSelection: (([String: JSONValue], Int) -> Void)? {
        get { self[ForgeDialogCommitSelectionKey.self] }
        set { self[ForgeDialogCommitSelectionKey.self] = newValue }
    }
}

public struct DialogRenderer<Content: View>: View {
    private let title: String
    private let style: [String: String]
    private let content: Content

    public init(title: String, style: [String: String] = [:], @ViewBuilder content: () -> Content) {
        self.title = title
        self.style = style
        self.content = content()
    }

    public var body: some View {
        if let headerBackgroundColor {
            VStack(alignment: .leading, spacing: 0) {
                Text(title)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(headerTextColor ?? .white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 14)
                    .background(headerBackgroundColor)
                content
                    .padding(16)
            }
        } else {
            VStack(alignment: .leading, spacing: 12) {
                Text(title).font(.headline)
                content
            }
            .padding()
        }
    }

    private var headerBackgroundColor: Color? {
        color(for: ["headerBackgroundColor", "headerBackground", "titleBackgroundColor"])
    }

    private var headerTextColor: Color? {
        color(for: ["headerTextColor", "headerColor", "titleColor"])
    }

    private func color(for keys: [String]) -> Color? {
        for key in keys {
            if let value = style[key]?.trimmingCharacters(in: .whitespacesAndNewlines),
               let color = Color(forgeHex: value) {
                return color
            }
        }
        return nil
    }
}

public struct WindowDialogLayer: View {
    private let runtime: ForgeRuntime
    private let window: WindowContext
    private let dialogs: [DialogDef]
    private let defaultDataSourceRef: String

    public init(
        runtime: ForgeRuntime,
        window: WindowContext,
        dialogs: [DialogDef],
        defaultDataSourceRef: String
    ) {
        self.runtime = runtime
        self.window = window
        self.dialogs = dialogs
        self.defaultDataSourceRef = defaultDataSourceRef
    }

    public var body: some View {
        ForEach(dialogs) { dialog in
            WindowDialogHost(
                runtime: runtime,
                window: window,
                dialog: dialog,
                defaultDataSourceRef: defaultDataSourceRef
            )
        }
    }
}

private struct WindowDialogHost: View {
    private let runtime: ForgeRuntime
    private let window: WindowContext
    private let dialog: DialogDef
    private let defaultDataSourceRef: String

    @State private var quickFilterValues: [String: String]
    @State private var footerPresentation: [(visible: Bool, disabled: Bool)] = []
    @StateObject private var observer: DialogStateObserver
    @StateObject private var dataObserver: DialogDataObserver

    init(
        runtime: ForgeRuntime,
        window: WindowContext,
        dialog: DialogDef,
        defaultDataSourceRef: String
    ) {
        self.runtime = runtime
        self.window = window
        self.dialog = dialog
        self.defaultDataSourceRef = defaultDataSourceRef
        _observer = StateObject(
            wrappedValue: DialogStateObserver(
                runtime: runtime,
                windowID: window.windowID,
                dialogID: dialog.id ?? ""
            )
        )
        _dataObserver = StateObject(
            wrappedValue: DialogDataObserver(
                runtime: runtime,
                windowID: window.windowID,
                dataSourceRef: dialog.content?.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
                    ?? dialog.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
                    ?? defaultDataSourceRef
            )
        )
        _quickFilterValues = State(initialValue: Self.initialQuickFilterValues(dialog: dialog))
    }

    private var dialogID: String {
        dialog.id ?? ""
    }

    private var dialogDataSourceRef: String {
        dialog.content?.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            ?? dialog.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            ?? defaultDataSourceRef
    }

    private var effectiveSelectionMode: String {
        observer.state.selectionMode?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            ?? dialog.selectionMode?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            ?? ""
    }

    private var stateSignature: String {
        [
            observer.state.open ? "open" : "closed",
            observer.state.args
                .keys
                .sorted()
                .map { "\($0)=\(observer.state.args[$0]?.dialogSignature ?? "")" }
                .joined(separator: "|"),
            observer.state.props
                .keys
                .sorted()
                .map { "\($0)=\(observer.state.props[$0]?.dialogSignature ?? "")" }
                .joined(separator: "|")
        ].joined(separator: "::")
    }

    var body: some View {
        Group {
            if observer.state.open, !dialogID.isEmpty {
                ZStack {
                    Color.black.opacity(0.24)
                        .ignoresSafeArea()

                    VStack {
                        DialogRenderer(title: dialog.title ?? dialogID, style: dialog.style) {
                            VStack(alignment: .leading, spacing: 12) {
                                if !quickFilterSpecs.isEmpty {
                                    quickFilterBar
                                }
                                ScrollView {
                                    if let content = dialog.content {
                                        ContainerRenderer(
                                            runtime: runtime,
                                            window: window,
                                            container: content
                                        )
                                        .environment(\.forgeDialogSelectionMode, effectiveSelectionMode)
                                        .environment(\.forgeDialogPresentation, observer.state.presentationID.map { (dialogID, $0) })
                                        .environment(
                                            \.forgeDialogCommitSelection,
                                            shouldAutoCommitSelection
                                                ? { row, rowIndex in
                                                    commitSelection(row: row, rowIndex: rowIndex)
                                                }
                                                : nil
                                        )
                                    } else {
                                        Text("Dialog content")
                                            .font(.footnote)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                .frame(maxHeight: dialogContentMaxHeight)
                                Divider()
                                actionsRow
                            }
                            .frame(maxWidth: 520, alignment: .leading)
                        }
                        .frame(maxWidth: 560)
                        .background(.background, in: RoundedRectangle(cornerRadius: 20))
                        .shadow(radius: 18)
                        .padding(.horizontal, 20)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .padding(.top, 96)
                }
            }
        }
        .task(id: stateSignature) {
            await bindAndFetchDialogIfNeeded()
        }
        .task(id: autoSelectionSignature) {
            await autoSelectSingleRowIfNeeded()
        }
    }

    private var quickFilterSpecs: [DialogQuickFilterSpec] {
        Self.quickFilterSpecs(dialog: dialog)
    }

    @ViewBuilder
    private var quickFilterBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(quickFilterSpecs, id: \.field) { spec in
                TextField(
                    spec.placeholder,
                    text: Binding(
                        get: { quickFilterValues[spec.field] ?? "" },
                        set: { quickFilterValues[spec.field] = $0 }
                    )
                )
                .textFieldStyle(.roundedBorder)
            }
            HStack(spacing: 8) {
                Spacer(minLength: 0)
                Button("Search") {
                    Task {
                        await applyQuickFilters()
                    }
                }
                .buttonStyle(.bordered)
            }
        }
    }

    @ViewBuilder
    private var actionsRow: some View {
        HStack(spacing: 10) {
            Spacer(minLength: 0)
            let hasOnlyDismissActions = dialog.actions.allSatisfy { ["cancel", "close", "dismiss"].contains(($0.id ?? "").lowercased()) && $0.mutationCommand == nil }
            if hasOnlyDismissActions {
                Button("Select") { commitDialog() }.buttonStyle(.borderedProminent).disabled(!dataObserver.canSelect)
            }
            if !dialog.actions.contains(where: { ["cancel", "close", "dismiss"].contains(($0.id ?? "").lowercased()) || $0.close }) {
                Button("Close") { Task { await runtime.closeDialogPublic(windowID: window.windowID, dialogID: dialogID) } }.buttonStyle(.bordered)
            }
            ForEach(Array(dialog.actions.enumerated()), id: \.offset) { index, action in
                let presentation = footerPresentation.indices.contains(index) ? footerPresentation[index] : nil
                if presentation?.visible ?? (action.visibleWhen == nil) {
                    let disabled = presentation?.disabled ?? (action.disabledWhen != nil || action.mutationCommand?.validateWhen != nil)
                    if let command = action.footerCommand {
                        MutationCommandButton(runtime: runtime, window: window, sourceDataSourceRef: dialogDataSourceRef, command: command,
                            labelOverride: action.label ?? action.id ?? command.label, externallyDisabled: disabled, dialogFooter: (dialogID, action))
                    } else {
                        Button(action.label ?? action.id ?? "Action") {
                            Task { _ = await runtime.activateDialogFooter(windowID: window.windowID, dialogID: dialogID, sourceDataSourceRef: dialogDataSourceRef, action: action) }
                        }.disabled(disabled)
                    }
                }
            }
        }
        .controlSize(.small)
        .task { await observeFooterConditions() }
    }

    @MainActor
    private func refreshFooterConditions() async {
        let next = await runtime.dialogFooterPresentation(windowID: window.windowID, sourceDataSourceRef: dialogDataSourceRef, actions: dialog.actions)
        if !Task.isCancelled { footerPresentation = next }
    }

    private func observeFooterConditions() async {
        let conditions = dialog.actions.flatMap { [$0.visibleWhen, $0.disabledWhen, $0.mutationCommand?.validateWhen] }
        await observeWorkflowPredicates(runtime:runtime, windowID:window.windowID, source:dialogDataSourceRef, conditions:conditions) {
            await refreshFooterConditions()
        }
    }

    private func bindAndFetchDialogIfNeeded() async {
        guard observer.state.open, !dialogDataSourceRef.isEmpty else { return }
        // Explicit dialog sources receive their arguments before the runtime
        // publishes onOpen. Only the inherited source is known solely to the host.
        if dialog.content?.dataSourceRef == nil && dialog.dataSourceRef == nil {
            let args = scopedDialogArgs()
            if !args.isEmpty {
                await runtime.setDataSourceInputParameters(windowID: window.windowID, dataSourceRef: dialogDataSourceRef,
                    parameters: args, preservePendingFetch: false)
            }
        }
        if dialog.shouldFetchOnOpen && !Task.isCancelled {
            await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: dialogDataSourceRef)
        }
    }

    private func applyQuickFilters() async {
        guard !dialogDataSourceRef.isEmpty else { return }
        let filter = quickFilterValues.reduce(into: [String: JSONValue]()) { result, entry in
            let trimmed = entry.value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            result[entry.key] = .string(trimmed)
        }
        await runtime.setDataSourceFilter(
            windowID: window.windowID,
            dataSourceRef: dialogDataSourceRef,
            filter: filter
        )
    }

    private var autoSelectionSignature: String {
        "\(observer.state.open)::\(dataObserver.collection.count)::\(dataObserver.selection.rowIndex)"
    }

    @MainActor
    private func autoSelectSingleRowIfNeeded() async {
        guard observer.state.open else { return }
        guard observer.state.selectionMode?.lowercased() != "multi" else { return }
        guard dataObserver.collection.count == 1 else { return }
        guard dataObserver.selection.selected == nil || dataObserver.selection.rowIndex < 0 else { return }
        guard let row = dataObserver.collection.first else { return }
        await runtime.setDataSourceSelection(
            windowID: window.windowID,
            dataSourceRef: dialogDataSourceRef,
            selected: row,
            rowIndex: 0
        )
    }

    private func scopedDialogArgs() -> [String: JSONValue] {
        if let nested = observer.state.args[dialogDataSourceRef]?.objectValue, !nested.isEmpty {
            return nested
        }
        return observer.state.args
    }

    private var dialogContentMaxHeight: CGFloat {
        if dialog.content?.treeBrowser != nil {
            return 320
        }
        return 180
    }

    private func commitDialog() {
        let context = ExecutionContext(windowID: window.windowID, dataSourceRef: dialogDataSourceRef)
        Task {
            _ = await runtime.execute(
                ExecutionDef(action: "dialog.commit"),
                context: context,
                args: [
                    "dialogId": .string(dialogID),
                    "windowId": .string(window.windowID)
                ]
            )
        }
    }

    private var shouldAutoCommitSelection: Bool {
        let dismissIDs = Set(["cancel", "close", "dismiss"])
        let primaryActions = dialog.actions.filter { $0.mutationCommand != nil || !dismissIDs.contains(($0.id ?? "").lowercased()) }
        return effectiveSelectionMode == "single" && primaryActions.isEmpty
    }

    private func commitSelection(row: [String: JSONValue], rowIndex: Int) {
        let context = ExecutionContext(windowID: window.windowID, dataSourceRef: dialogDataSourceRef)
        Task {
            await runtime.setDataSourceSelection(
                windowID: window.windowID,
                dataSourceRef: dialogDataSourceRef,
                selected: row,
                rowIndex: rowIndex
            )
            _ = await runtime.execute(
                ExecutionDef(action: "dialog.commit"),
                context: context,
                args: [
                    "dialogId": .string(dialogID),
                    "windowId": .string(window.windowID),
                    "payload": .object(row)
                ]
            )
        }
    }


}

@MainActor
private final class DialogStateObserver: ObservableObject {
    @Published var state: DialogState = DialogState()

    private var task: Task<Void, Never>?

    init(runtime: ForgeRuntime, windowID: String, dialogID: String) {
        guard !dialogID.isEmpty else { return }
        task = Task {
            let stream = await runtime.dialogUpdates(windowID: windowID, dialogID: dialogID)
            for await next in stream {
                await MainActor.run {
                    self.state = next
                }
            }
        }
    }

    deinit {
        task?.cancel()
    }
}

@MainActor
private final class DialogDataObserver: ObservableObject {
    @Published var selection: SelectionState = SelectionState()
    @Published var collection: [[String: JSONValue]] = []

    private var selectionTask: Task<Void, Never>?
    private var collectionTask: Task<Void, Never>?

    init(runtime: ForgeRuntime, windowID: String, dataSourceRef: String) {
        guard !dataSourceRef.isEmpty else { return }
        selectionTask = Task {
            let stream = await runtime.dataSourceSelectionUpdates(windowID: windowID, dataSourceRef: dataSourceRef)
            for await next in stream {
                await MainActor.run {
                    self.selection = next
                }
            }
        }
        collectionTask = Task {
            let stream = await runtime.dataSourceCollectionUpdates(windowID: windowID, dataSourceRef: dataSourceRef)
            for await next in stream {
                await MainActor.run {
                    self.collection = next
                }
            }
        }
    }

    var canSelect: Bool {
        selection.selected != nil || !selection.selection.isEmpty
    }

    deinit {
        selectionTask?.cancel()
        collectionTask?.cancel()
    }
}

private struct DialogQuickFilterSpec: Equatable {
    let field: String
    let placeholder: String
}

private extension Color {
    init?(forgeHex rawValue: String) {
        var value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") {
            value.removeFirst()
        }
        guard value.count == 6 || value.count == 8,
              let integer = UInt64(value, radix: 16) else {
            return nil
        }

        let red: UInt64
        let green: UInt64
        let blue: UInt64
        let alpha: UInt64
        if value.count == 8 {
            alpha = (integer >> 24) & 0xff
            red = (integer >> 16) & 0xff
            green = (integer >> 8) & 0xff
            blue = integer & 0xff
        } else {
            alpha = 0xff
            red = (integer >> 16) & 0xff
            green = (integer >> 8) & 0xff
            blue = integer & 0xff
        }

        self.init(
            red: Double(red) / 255.0,
            green: Double(green) / 255.0,
            blue: Double(blue) / 255.0,
            opacity: Double(alpha) / 255.0
        )
    }
}

private extension WindowDialogHost {
    static func quickFilterSpecs(dialog: DialogDef) -> [DialogQuickFilterSpec] {
        guard let values = dialog.properties["quickFilters"]?.arrayValue else {
            return []
        }
        return values.compactMap { entry in
            guard let object = entry.objectValue else { return nil }
            let field = object["field"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !field.isEmpty else { return nil }
            let placeholder = object["placeholder"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Search"
            return DialogQuickFilterSpec(
                field: field,
                placeholder: placeholder.isEmpty ? "Search" : placeholder
            )
        }
    }

    static func initialQuickFilterValues(dialog: DialogDef) -> [String: String] {
        Dictionary(uniqueKeysWithValues: quickFilterSpecs(dialog: dialog).map { ($0.field, "") })
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}

private extension JSONValue {
    var dialogSignature: String {
        switch self {
        case .string(let value):
            return "s:\(value)"
        case .number(let value):
            return "n:\(value)"
        case .bool(let value):
            return "b:\(value)"
        case .null:
            return "null"
        case .array(let values):
            return "a:[\(values.map(\.dialogSignature).joined(separator: ","))]"
        case .object(let values):
            return "o:{\(values.keys.sorted().map { "\($0)=\(values[$0]?.dialogSignature ?? "null")" }.joined(separator: ","))}"
        }
    }
}


/// Subscribe only to source/signal pairs named by these controls' predicates.
func observeWorkflowPredicates(runtime:ForgeRuntime, windowID:String, source:String, conditions:[DashboardConditionDef?],
                               observeSelection:Bool = false, refresh:@escaping @Sendable () async -> Void) async {
        var sources: [String: Set<String>] = [:]
        func collect(_ condition: DashboardConditionDef?) {
            guard let condition else { return }
            if condition.field != nil || condition.selector != nil || condition.source != nil || condition.key != nil {
                sources[condition.dataSourceRef ?? source, default: []].insert((condition.source ?? "form").lowercased())
            }
            condition.all.forEach(collect); condition.any.forEach(collect); collect(condition.not)
        }
        conditions.forEach(collect)
        if observeSelection { sources[source,default:[]].insert("selection") }
        guard !sources.isEmpty else { return }
        await refresh()
        await withTaskGroup(of: Void.self) { group in
            if sources.values.contains(where: { $0.contains("windowform") }) { group.addTask { for await _ in await runtime.windowFormUpdates(windowID: windowID) { await refresh() } } }
            if sources.values.contains(where: { $0.contains("authorization") }) { group.addTask { for await _ in await runtime.windowMetadataUpdates(id: windowID) { await refresh() } } }
            for (ref, scopes) in sources {
            if scopes.contains("form") { group.addTask { for await _ in await runtime.dataSourceFormUpdates(windowID: windowID, dataSourceRef: ref) { await refresh() } } }

            if scopes.contains("selection") { group.addTask { for await _ in await runtime.dataSourceSelectionUpdates(windowID: windowID, dataSourceRef: ref) { await refresh() } } }
            if scopes.contains("collection") { group.addTask { for await _ in await runtime.dataSourceCollectionUpdates(windowID: windowID, dataSourceRef: ref) { await refresh() } } }
            if scopes.contains("metrics") { group.addTask { for await _ in await runtime.dataSourceMetricsUpdates(windowID: windowID, dataSourceRef: ref) { await refresh() } } }
            if !scopes.isDisjoint(with: ["input", "filter", "filters"]) { group.addTask { for await _ in await runtime.dataSourceInputUpdates(windowID: windowID, dataSourceRef: ref) { await refresh() } } }
            }
        }
    }
