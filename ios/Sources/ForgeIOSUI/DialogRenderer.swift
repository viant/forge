import SwiftUI
import ForgeIOSRuntime

private struct ForgeDialogSelectionModeKey: EnvironmentKey {
    static let defaultValue = ""
}

private struct ForgeDialogCommitSelectionKey: EnvironmentKey {
    static let defaultValue: (([String: JSONValue], Int) -> Void)? = nil
}

extension EnvironmentValues {
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

    @State private var hydratedArgsSignature = ""
    @State private var quickFilterValues: [String: String]
    @State private var didInitialFetch = false
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
            await hydrateDialogInputIfNeeded()
        }
        .task(id: autoSelectionSignature) {
            await autoSelectSingleRowIfNeeded()
        }
        .task(id: initialFetchSignature) {
            await fetchDialogCollectionIfNeeded()
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
        let dismissIDs = Set(["cancel", "close", "dismiss"])
        let primaryActions = dialog.actions.filter { !dismissIDs.contains(($0.id ?? "").lowercased()) }
        let dismissAction = dialog.actions.first { dismissIDs.contains(($0.id ?? "").lowercased()) }
        let canSelect = dataObserver.canSelect

        HStack(spacing: 10) {
            Spacer(minLength: 0)

            if primaryActions.isEmpty {
                Button("Select") {
                    commitDialog()
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canSelect)
                .controlSize(.small)

                Button("Close") {
                    Task {
                        await runtime.closeDialogPublic(windowID: window.windowID, dialogID: dialogID)
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            } else {
                if let dismissAction {
                    Button(dismissAction.label ?? dismissAction.id ?? "Close") {
                        execute(dismissAction)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                } else {
                    Button("Close") {
                        Task {
                            await runtime.closeDialogPublic(windowID: window.windowID, dialogID: dialogID)
                        }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
                ForEach(primaryActions) { action in
                    Button(action.label ?? action.id ?? "Action") {
                        execute(action)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                }
            }
        }
    }

    private func hydrateDialogInputIfNeeded() async {
        guard observer.state.open else { return }
        let scopedArgs = scopedDialogArgs()
        if scopedArgs.isEmpty {
            return
        }
        let signature = scopedArgs
            .keys
            .sorted()
            .map { "\($0)=\(scopedArgs[$0]?.stringValue ?? scopedArgs[$0]?.intValue.map(String.init) ?? "")" }
            .joined(separator: "|")
        guard signature != hydratedArgsSignature else { return }
        hydratedArgsSignature = signature
        guard !dialogDataSourceRef.isEmpty else { return }
        await runtime.setDataSourceInputParameters(
            windowID: window.windowID,
            dataSourceRef: dialogDataSourceRef,
            parameters: scopedArgs,
            fetch: true
        )
    }

    private var initialFetchSignature: String {
        "\(observer.state.open)::\(dialogDataSourceRef)"
    }

    @MainActor
    private func fetchDialogCollectionIfNeeded() async {
        guard observer.state.open else {
            didInitialFetch = false
            return
        }
        guard !didInitialFetch else { return }
        guard !dialogDataSourceRef.isEmpty else { return }
        didInitialFetch = true
        await runtime.refreshDataSourceCollection(
            windowID: window.windowID,
            dataSourceRef: dialogDataSourceRef
        )
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
        let primaryActions = dialog.actions.filter { !dismissIDs.contains(($0.id ?? "").lowercased()) }
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

    private func execute(_ action: ActionDef) {
        let context = ExecutionContext(windowID: window.windowID, dataSourceRef: dialogDataSourceRef)
        Task {
            for execution in action.on {
                _ = await runtime.execute(
                    execution,
                    context: context,
                    args: [
                        "dialogId": .string(dialogID),
                        "windowId": .string(window.windowID)
                    ]
                )
            }
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
