import Foundation

public actor ForgeRuntime {
    public struct DataSourceFetchRequest: Sendable {
        public let windowID: String
        public let dataSourceRef: String
        public let dataSource: DataSourceDef
        public let input: InputState

        public init(windowID: String, dataSourceRef: String, dataSource: DataSourceDef, input: InputState) {
            self.windowID = windowID
            self.dataSourceRef = dataSourceRef
            self.dataSource = dataSource
            self.input = input
        }
    }

    public struct DataSourceFetchResult: Sendable {
        public let rows: [[String: JSONValue]]
        public let metrics: [String: JSONValue]
        public let form: [String: JSONValue]?
        public let selection: [String: JSONValue]?
        public let rowIndex: Int?

        public init(
            rows: [[String: JSONValue]] = [],
            metrics: [String: JSONValue] = [:],
            form: [String: JSONValue]? = nil,
            selection: [String: JSONValue]? = nil,
            rowIndex: Int? = nil
        ) {
            self.rows = rows
            self.metrics = metrics
            self.form = form
            self.selection = selection
            self.rowIndex = rowIndex
        }
    }

    public struct WindowState: Sendable, Identifiable {
        public let id: String
        public let key: String
        public let title: String
        public let metadata: WindowMetadata?
        public let inTab: Bool
        public let parameters: [String: JSONValue]
        public let conversationID: String?
        public let presentation: String?
        public let region: String?
        public let workspaceSharePct: Int?
        public let workspaceMinHeight: Int?
        public let parentKey: String?
        public let isModal: Bool

        public init(
            id: String = UUID().uuidString,
            key: String,
            title: String,
            metadata: WindowMetadata?,
            inTab: Bool = true,
            parameters: [String: JSONValue] = [:],
            conversationID: String? = nil,
            presentation: String? = nil,
            region: String? = nil,
            workspaceSharePct: Int? = nil,
            workspaceMinHeight: Int? = nil,
            parentKey: String? = nil,
            isModal: Bool = false
        ) {
            self.id = id
            self.key = key
            self.title = title
            self.metadata = metadata
            self.inTab = inTab
            self.parameters = parameters
            self.conversationID = conversationID
            self.presentation = presentation
            self.region = region
            self.workspaceSharePct = workspaceSharePct
            self.workspaceMinHeight = workspaceMinHeight
            self.parentKey = parentKey
            self.isModal = isModal
        }
    }

    public private(set) var windows: [WindowState] = []
    public let targetContext: ForgeTargetContext
    let signals: SignalRegistry
    let dataSourceRuntime: DataSourceRuntime
    private var windowMetadataEndpoint: URL?
    private var defaultDataSourceBaseURL: URL?
    private let session: URLSession
    private var dataSourceLoader: (@Sendable (DataSourceFetchRequest) async throws -> DataSourceFetchResult?)?
    private var windowMetadataLoader: (@Sendable (String) async throws -> WindowMetadata?)?

    var handlers: [String: ForgeHandler] = [:]
    private var pendingDialogs: [String: PendingDialog] = [:]
    private var pendingDialogResults: [String: CheckedContinuation<[String: JSONValue]?, Never>] = [:]
    private var pendingWindows: [String: PendingWindow] = [:]

    public init(
        targetContext: ForgeTargetContext = ForgeTargetContext(),
        windowMetadataBaseURL: URL? = nil,
        windowMetadataBasePath: String = "/v1/api/forge/window",
        session: URLSession = .shared
    ) {
        self.targetContext = targetContext
        self.signals = SignalRegistry()
        self.dataSourceRuntime = DataSourceRuntime()
        self.session = session
        self.defaultDataSourceBaseURL = windowMetadataBaseURL
        self.windowMetadataEndpoint = Self.makeWindowMetadataEndpoint(
            baseURL: windowMetadataBaseURL,
            path: windowMetadataBasePath
        )
    }

    // MARK: - Window lifecycle

    @discardableResult
    public func openWindowInline(key: String, title: String, metadata: WindowMetadata) -> WindowState {
        let resolved = MetadataResolver.resolve(metadata, for: targetContext)
        let state = WindowState(key: key, title: title, metadata: resolved)
        windows.append(state)
        Task {
            let signal = await signals.metadata(windowID: state.id)
            await signal.set(resolved)
            await reconcileWindowForm(windowID: state.id, metadata: resolved, parameters: [:])
        }
        return state
    }

    @discardableResult
    public func openWindow(
        key: String,
        title: String,
        id: String? = nil,
        inTab: Bool = true,
        parameters: [String: JSONValue] = [:],
        conversationID: String? = nil,
        presentation: String? = nil,
        region: String? = nil,
        workspaceSharePct: Int? = nil,
        workspaceMinHeight: Int? = nil,
        parentKey: String? = nil,
        isModal: Bool = false
    ) async -> WindowState {
        let state = WindowState(
            id: id ?? UUID().uuidString,
            key: key,
            title: title,
            metadata: nil,
            inTab: inTab,
            parameters: parameters,
            conversationID: conversationID,
            presentation: presentation,
            region: region,
            workspaceSharePct: workspaceSharePct,
            workspaceMinHeight: workspaceMinHeight,
            parentKey: parentKey,
            isModal: isModal
        )
        if let existing = windows.first(where: { $0.id == state.id }) {
            return existing
        }
        windows.append(state)
        await loadWindowMetadata(for: state)
        return windows.first(where: { $0.id == state.id }) ?? state
    }

    public func closeWindow(id: String) {
        windows.removeAll { $0.id == id }
        Task {
            await signals.removeWindow(windowID: id)
            await dataSourceRuntime.detachWindow(id)
        }
        pendingWindows.removeValue(forKey: id)
    }

    public func windowContext(id: String) -> WindowContext {
        let parameters = (windows.first(where: { $0.id == id })?.parameters ?? [:]).reduce(into: [String: String]()) { result, entry in
            switch entry.value {
            case .string(let value):
                result[entry.key] = value
            case .number(let value):
                result[entry.key] = String(value)
            case .bool(let value):
                result[entry.key] = value ? "true" : "false"
            default:
                break
            }
        }
        return WindowContext(windowID: id, parameters: parameters)
    }

    public func windowMetadata(id: String) async -> WindowMetadata? {
        let signal = await signals.metadata(windowID: id)
        return await signal.peek()
    }

    public func configureWindowMetadata(baseURL: URL?, path: String = "/v1/api/forge/window") {
        defaultDataSourceBaseURL = baseURL
        windowMetadataEndpoint = Self.makeWindowMetadataEndpoint(baseURL: baseURL, path: path)
    }

    public func registerDataSourceLoader(
        _ loader: @escaping @Sendable (DataSourceFetchRequest) async throws -> DataSourceFetchResult?
    ) {
        dataSourceLoader = loader
    }

    public func registerWindowMetadataLoader(
        _ loader: @escaping @Sendable (String) async throws -> WindowMetadata?
    ) {
        windowMetadataLoader = loader
    }

    // MARK: - Form values

    public func setFormValue(windowID: String, dataSourceRef: String, values: [String: String]) async {
        let payload = values.mapValues { JSONValue.string($0) }
        await setFormValue(windowID: windowID, dataSourceRef: dataSourceRef, values: payload)
    }

    public func setFormValue(windowID: String, dataSourceRef: String, values: [String: JSONValue]) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setForm(dataSourceID: dataSourceID, values: values)
    }

    public func formValue(windowID: String, dataSourceRef: String) async -> [String: String] {
        let values = await formJSONValue(windowID: windowID, dataSourceRef: dataSourceRef)
        return values.reduce(into: [:]) { r, e in r[e.key] = e.value.stringValue ?? "" }
    }

    public func formJSONValue(windowID: String, dataSourceRef: String) async -> [String: JSONValue] {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        return await dataSourceRuntime.form(dataSourceID: dataSourceID)
    }

    public func setDataSourceCollection(windowID: String, dataSourceRef: String, rows: [[String: JSONValue]]) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setCollection(dataSourceID: dataSourceID, rows: rows)
        let signal = await signals.collection(dataSourceID: dataSourceID)
        await signal.set(rows)
    }

    public func setDataSourceForm(windowID: String, dataSourceRef: String, values: [String: JSONValue]) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setForm(dataSourceID: dataSourceID, values: values)
        let signal = await signals.form(dataSourceID: dataSourceID)
        await signal.set(values)
    }

    public func setDataSourceSelection(
        windowID: String,
        dataSourceRef: String,
        selected: [String: JSONValue]?,
        rowIndex: Int = -1
    ) async {
        let selectionState: SelectionState
        if let selected {
            let metadataSignal = await signals.metadata(windowID: windowID)
            let metadata = await metadataSignal.peek()
            let preparedSelection = applySelectionHook(
                metadata: metadata,
                row: selected,
                rowIndex: rowIndex
            )
            selectionState = SelectionState(selected: preparedSelection, rowIndex: rowIndex)
        } else {
            selectionState = SelectionState(rowIndex: rowIndex)
        }
        await setDataSourceSelectionState(
            windowID: windowID,
            dataSourceRef: dataSourceRef,
            selection: selectionState
        )
    }

    public func setDataSourceSelectionState(
        windowID: String,
        dataSourceRef: String,
        selection: SelectionState
    ) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        let selected = selection.selected
            ?? selection.selection.last
        let form = selected ?? [:]
        await dataSourceRuntime.setSelection(
            dataSourceID: dataSourceID,
            selection: selection
        )
        await dataSourceRuntime.setForm(dataSourceID: dataSourceID, values: form)
        let selectionSignal = await signals.selection(dataSourceID: dataSourceID)
        await selectionSignal.set(selection)
        let formSignal = await signals.form(dataSourceID: dataSourceID)
        await formSignal.set(form)
    }

    public func toggleDataSourceSelection(
        windowID: String,
        dataSourceRef: String,
        row: [String: JSONValue],
        rowIndex: Int = -1
    ) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        let metadataSignal = await signals.metadata(windowID: windowID)
        let metadata = await metadataSignal.peek()
        let preparedSelection = applySelectionHook(
            metadata: metadata,
            row: row,
            rowIndex: rowIndex
        )
        let current = await dataSourceRuntime.selection(dataSourceID: dataSourceID)
        if current.selected == preparedSelection {
            await setDataSourceSelection(
                windowID: windowID,
                dataSourceRef: dataSourceRef,
                selected: nil,
                rowIndex: -1
            )
        } else {
            await setDataSourceSelection(
                windowID: windowID,
                dataSourceRef: dataSourceRef,
                selected: row,
                rowIndex: rowIndex
            )
        }
    }

    public func dataSourceCollection(windowID: String, dataSourceRef: String) async -> [[String: JSONValue]] {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        return await dataSourceRuntime.collection(dataSourceID: dataSourceID)
    }

    public func setDataSourceMetrics(windowID: String, dataSourceRef: String, values: [String: JSONValue]) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setMetrics(dataSourceID: dataSourceID, values: values)
        let signal = await signals.metrics(dataSourceID: dataSourceID)
        await signal.set(values)
    }

    public func dataSourceMetrics(windowID: String, dataSourceRef: String) async -> [String: JSONValue] {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        return await dataSourceRuntime.metrics(dataSourceID: dataSourceID)
    }

    public func setDataSourceInputParameters(
        windowID: String,
        dataSourceRef: String,
        parameters: [String: JSONValue],
        fetch: Bool = false
    ) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setInputParameters(dataSourceID: dataSourceID, parameters: parameters, fetch: fetch)
        let signal = await signals.input(dataSourceID: dataSourceID)
        await signal.set(await dataSourceRuntime.input(dataSourceID: dataSourceID))
    }

    public func refreshDataSourceCollection(
        windowID: String,
        dataSourceRef: String,
        baseURL: String = "",
        additionalHeaders: [String: String] = [:]
    ) async {
        let signal = await signals.metadata(windowID: windowID)
        guard let metadata = await signal.peek() else { return }
        guard let dataSource = metadata.dataSources[dataSourceRef] else {
            print("ForgeRuntime datasource missing from metadata for \(dataSourceRef) on window \(windowID)")
            return
        }
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        let input = await dataSourceRuntime.input(dataSourceID: dataSourceID)

        if let dataSourceLoader {
            do {
                if let result = try await dataSourceLoader(
                    DataSourceFetchRequest(
                        windowID: windowID,
                        dataSourceRef: dataSourceRef,
                        dataSource: dataSource,
                        input: input
                    )
                ) {
                    let hookedRows = applyCollectionHook(metadata: metadata, rows: result.rows)
                    await dataSourceRuntime.setCollection(dataSourceID: dataSourceID, rows: hookedRows)
                    await dataSourceRuntime.setMetrics(dataSourceID: dataSourceID, values: result.metrics)
                    await dataSourceRuntime.setControl(dataSourceID: dataSourceID, control: ControlState())
                    let collectionSignal = await signals.collection(dataSourceID: dataSourceID)
                    await collectionSignal.set(hookedRows)
                    let metricsSignal = await signals.metrics(dataSourceID: dataSourceID)
                    await metricsSignal.set(result.metrics)
                    let controlSignal = await signals.control(dataSourceID: dataSourceID)
                    await controlSignal.set(ControlState())
                    if let form = result.form {
                        await dataSourceRuntime.setForm(dataSourceID: dataSourceID, values: form)
                        let formSignal = await signals.form(dataSourceID: dataSourceID)
                        await formSignal.set(form)
                    }
                    if let selection = result.selection {
                        let preparedSelection = applySelectionHook(
                            metadata: metadata,
                            row: selection,
                            rowIndex: result.rowIndex ?? -1
                        )
                        await dataSourceRuntime.setSelection(
                            dataSourceID: dataSourceID,
                            selection: SelectionState(selected: preparedSelection, rowIndex: result.rowIndex ?? -1)
                        )
                        let selectionSignal = await signals.selection(dataSourceID: dataSourceID)
                        await selectionSignal.set(SelectionState(selected: preparedSelection, rowIndex: result.rowIndex ?? -1))
                        if result.form == nil {
                            await dataSourceRuntime.setForm(dataSourceID: dataSourceID, values: preparedSelection)
                            let formSignal = await signals.form(dataSourceID: dataSourceID)
                            await formSignal.set(preparedSelection)
                        }
                    }
                    return
                }
            } catch {
                print("ForgeRuntime datasource load failed for \(dataSourceRef): \(error)")
                await dataSourceRuntime.setControl(
                    dataSourceID: dataSourceID,
                    control: ControlState(error: error.localizedDescription)
                )
                let controlSignal = await signals.control(dataSourceID: dataSourceID)
                await controlSignal.set(ControlState(error: error.localizedDescription))
            }
        }

        let resolvedPath = dataSource.service?.uri ?? dataSource.uri
        guard let path = resolvedPath, !path.isEmpty else { return }
        let resolvedBaseURL: String
        if !baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            resolvedBaseURL = baseURL
        } else if let defaultDataSourceBaseURL {
            resolvedBaseURL = defaultDataSourceBaseURL.absoluteString
        } else {
            return
        }
        await dataSourceRuntime.fetchCollection(
            dataSourceID: dataSourceID,
            baseURL: resolvedBaseURL,
            path: path,
            additionalHeaders: additionalHeaders,
            session: session
        )
        let collectionSignal = await signals.collection(dataSourceID: dataSourceID)
        await collectionSignal.set(await dataSourceRuntime.collection(dataSourceID: dataSourceID))
        let metricsSignal = await signals.metrics(dataSourceID: dataSourceID)
        await metricsSignal.set(await dataSourceRuntime.metrics(dataSourceID: dataSourceID))
        let formSignal = await signals.form(dataSourceID: dataSourceID)
        await formSignal.set(await dataSourceRuntime.form(dataSourceID: dataSourceID))
        let selectionSignal = await signals.selection(dataSourceID: dataSourceID)
        await selectionSignal.set(await dataSourceRuntime.selection(dataSourceID: dataSourceID))
        let controlSignal = await signals.control(dataSourceID: dataSourceID)
        await controlSignal.set(await dataSourceRuntime.control(dataSourceID: dataSourceID))
    }

    // MARK: - Handler registry

    public func registerHandler(_ name: String, _ handler: @escaping ForgeHandler) {
        handlers[name] = handler
    }

    @discardableResult
    public func execute(
        _ execution: ExecutionDef,
        context: ExecutionContext? = nil,
        args: [String: JSONValue] = [:]
    ) async -> JSONValue? {
        if handlers.isEmpty {
            registerBuiltInHandlers()
        }
        let execArgs = ExecutionArgs(execution: execution, context: context, args: args)
        if let handler = handlers[execution.action] {
            return await handler(execArgs)
        }
        return nil
    }

    // MARK: - Pending state

    func registerPendingDialog(_ key: String, _ pending: PendingDialog) {
        pendingDialogs[key] = pending
    }

    func pendingDialog(_ key: String) -> PendingDialog? { pendingDialogs[key] }

    func registerPendingDialogResult(
        _ key: String,
        _ continuation: CheckedContinuation<[String: JSONValue]?, Never>
    ) {
        pendingDialogResults[key] = continuation
    }

    func resolvePendingDialogResult(_ key: String, payload: [String: JSONValue]?) {
        pendingDialogResults.removeValue(forKey: key)?.resume(returning: payload)
    }

    func registerPendingWindow(_ id: String, _ pending: PendingWindow) {
        pendingWindows[id] = pending
    }

    func pendingWindow(_ id: String) -> PendingWindow? { pendingWindows[id] }

    func clearPendingWindow(_ id: String) { pendingWindows.removeValue(forKey: id) }

    func clearPendingDialog(_ key: String) { pendingDialogs.removeValue(forKey: key) }

    // MARK: - Dialog lifecycle

    func openDialog(
        windowID: String,
        dialogID: String,
        parameters: [String: JSONValue],
        selectionMode: String? = nil
    ) async {
        let sig = await signals.dialog(dialogID: "\(windowID)Dialog\(dialogID)")
        await sig.set(DialogState(open: true, selectionMode: selectionMode, props: parameters, args: parameters))
    }

    func closeDialog(windowID: String, dialogID: String) async {
        let key = "\(windowID)Dialog\(dialogID)"
        let sig = await signals.dialog(dialogID: key)
        await sig.set(DialogState(open: false))
        pendingDialogs.removeValue(forKey: key)
        resolvePendingDialogResult(windowID: windowID, dialogID: dialogID, payload: nil)
    }

    // MARK: - Outbound parameter application

    func applyOutbound(
        _ outbound: [ParameterDef],
        payload: [String: JSONValue],
        callerWindowID: String,
        callerDSRef: String
    ) async {
        let dsID = WindowIdentity(windowID: callerWindowID).dataSourceID(ref: callerDSRef)
        var form = await dataSourceRuntime.form(dataSourceID: dsID)
        for param in outbound where param.direction == "out" || param.direction == "inout" {
            if let val = payload[param.name] { form[param.name] = val }
        }
        await dataSourceRuntime.setForm(dataSourceID: dsID, values: form)
    }

    func resolveOutbound(_ parameters: [ParameterDef]) -> [ParameterDef] {
        parameters.filter { $0.direction == "out" || $0.direction == "inout" }
    }

    private func loadWindowMetadata(for state: WindowState) async {
        let signal = await signals.metadata(windowID: state.id)
        if await signal.peek() != nil {
            return
        }
        if let windowMetadataLoader {
            do {
                if let resolved = try await windowMetadataLoader(state.key) {
                    if let index = windows.firstIndex(where: { $0.id == state.id }) {
                        let existing = windows[index]
                        windows[index] = WindowState(
                            id: existing.id,
                            key: existing.key,
                            title: existing.title,
                            metadata: resolved,
                            inTab: existing.inTab,
                            parameters: existing.parameters,
                            conversationID: existing.conversationID,
                            presentation: existing.presentation,
                            region: existing.region,
                            workspaceSharePct: existing.workspaceSharePct,
                            workspaceMinHeight: existing.workspaceMinHeight,
                            parentKey: existing.parentKey,
                            isModal: existing.isModal
                        )
                    }
                    await signal.set(resolved)
                    await reconcileWindowForm(windowID: state.id, metadata: resolved, parameters: state.parameters)
                    return
                }
            } catch {
                print("ForgeRuntime metadata loader failed for \(state.key): \(error)")
            }
        }
        guard let endpoint = metadataURL(for: state.key) else {
            await signal.set(nil)
            return
        }
        do {
            let (data, _) = try await session.data(from: endpoint)
            let resolved = try Self.decodeWindowMetadata(from: data, targetContext: targetContext)
            if let index = windows.firstIndex(where: { $0.id == state.id }) {
                let existing = windows[index]
                windows[index] = WindowState(
                    id: existing.id,
                    key: existing.key,
                    title: existing.title,
                    metadata: resolved,
                    inTab: existing.inTab,
                    parameters: existing.parameters,
                    conversationID: existing.conversationID,
                    presentation: existing.presentation,
                    region: existing.region,
                    workspaceSharePct: existing.workspaceSharePct,
                    workspaceMinHeight: existing.workspaceMinHeight,
                    parentKey: existing.parentKey,
                    isModal: existing.isModal
                )
            }
            await signal.set(resolved)
            await reconcileWindowForm(windowID: state.id, metadata: resolved, parameters: state.parameters)
        } catch {
            print("ForgeRuntime metadata load failed for \(state.key): \(error)")
            await signal.set(nil)
        }
    }

    private func metadataURL(for key: String) -> URL? {
        guard let endpoint = windowMetadataEndpoint else { return nil }
        return endpoint.appendingPathComponent(key)
    }

    private static func makeWindowMetadataEndpoint(baseURL: URL?, path: String) -> URL? {
        guard let baseURL else { return nil }
        let trimmedPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return trimmedPath.isEmpty ? baseURL : baseURL.appendingPathComponent(trimmedPath)
    }

    private static func decodeWindowMetadata(
        from data: Data,
        targetContext: ForgeTargetContext
    ) throws -> WindowMetadata {
        let decoder = JSONDecoder()
        if let direct = try? decoder.decode(WindowMetadata.self, from: data),
           isMeaningfulWindowMetadata(direct) {
            return MetadataResolver.resolve(direct, for: targetContext)
        }
        let wrapped = try decoder.decode(WindowMetadataEnvelope.self, from: data)
        guard let metadata = wrapped.data else {
            throw URLError(.cannotDecodeContentData)
        }
        return MetadataResolver.resolve(metadata, for: targetContext)
    }

    private static func isMeaningfulWindowMetadata(_ metadata: WindowMetadata) -> Bool {
        metadata.namespace != nil
            || metadata.view != nil
            || !metadata.dataSources.isEmpty
    }

    private func applyCollectionHook(
        metadata: WindowMetadata,
        rows: [[String: JSONValue]]
    ) -> [[String: JSONValue]] {
        guard let code = metadata.actions?.code?.trimmingCharacters(in: .whitespacesAndNewlines),
              !code.isEmpty else {
            return rows
        }
        let props: JSONValue = .object([
            "collection": .array(rows.map { .object($0) })
        ])
        guard let result = try? ActionHookRuntime.invoke(
            code: code,
            functionName: "prepareCollection",
            props: props
        ) else {
            return rows
        }
        guard case .array(let transformedRows) = result else {
            return rows
        }
        return transformedRows.compactMap(\.objectValue)
    }

    private func applySelectionHook(
        metadata: WindowMetadata?,
        row: [String: JSONValue],
        rowIndex: Int
    ) -> [String: JSONValue] {
        guard let code = metadata?.actions?.code?.trimmingCharacters(in: .whitespacesAndNewlines),
              !code.isEmpty else {
            return row
        }
        let props: JSONValue = .object([
            "selected": .object(row),
            "rowIndex": .number(Double(rowIndex))
        ])
        guard let result = try? ActionHookRuntime.invoke(
            code: code,
            functionName: "prepareSelection",
            props: props
        ) else {
            return row
        }
        return result.objectValue ?? row
    }
}

private struct WindowMetadataEnvelope: Decodable {
    let data: WindowMetadata?
}
