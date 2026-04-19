import Foundation

public actor ForgeRuntime {
    public struct WindowState: Sendable, Identifiable {
        public let id: String
        public let key: String
        public let title: String
        public let metadata: WindowMetadata?

        public init(id: String = UUID().uuidString, key: String, title: String, metadata: WindowMetadata?) {
            self.id = id
            self.key = key
            self.title = title
            self.metadata = metadata
        }
    }

    public private(set) var windows: [WindowState] = []
    public let targetContext: ForgeTargetContext
    let signals: SignalRegistry
    let dataSourceRuntime: DataSourceRuntime
    private var windowMetadataEndpoint: URL?
    private let session: URLSession

    var handlers: [String: ForgeHandler] = [:]
    private var pendingDialogs: [String: PendingDialog] = [:]
    private var pendingWindows: [String: PendingWindow] = [:]

    public init(
        targetContext: ForgeTargetContext = ForgeTargetContext(),
        windowMetadataBaseURL: URL? = nil,
        windowMetadataBasePath: String = "/v1/api/agently/forge/window",
        session: URLSession = .shared
    ) {
        self.targetContext = targetContext
        self.signals = SignalRegistry()
        self.dataSourceRuntime = DataSourceRuntime()
        self.session = session
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
        }
        return state
    }

    @discardableResult
    public func openWindow(key: String, title: String) async -> WindowState {
        let state = WindowState(key: key, title: title, metadata: nil)
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
        let parameters = windows.first(where: { $0.id == id })?.metadata?.namespace
            .map { ["namespace": $0] } ?? [:]
        return WindowContext(windowID: id, parameters: parameters)
    }

    public func configureWindowMetadata(baseURL: URL?, path: String = "/v1/api/agently/forge/window") {
        windowMetadataEndpoint = Self.makeWindowMetadataEndpoint(baseURL: baseURL, path: path)
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
    }

    public func dataSourceCollection(windowID: String, dataSourceRef: String) async -> [[String: JSONValue]] {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        return await dataSourceRuntime.collection(dataSourceID: dataSourceID)
    }

    public func setDataSourceMetrics(windowID: String, dataSourceRef: String, values: [String: JSONValue]) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setMetrics(dataSourceID: dataSourceID, values: values)
    }

    public func dataSourceMetrics(windowID: String, dataSourceRef: String) async -> [String: JSONValue] {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        return await dataSourceRuntime.metrics(dataSourceID: dataSourceID)
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

    func registerPendingWindow(_ id: String, _ pending: PendingWindow) {
        pendingWindows[id] = pending
    }

    func pendingWindow(_ id: String) -> PendingWindow? { pendingWindows[id] }

    func clearPendingWindow(_ id: String) { pendingWindows.removeValue(forKey: id) }

    func clearPendingDialog(_ key: String) { pendingDialogs.removeValue(forKey: key) }

    // MARK: - Dialog lifecycle

    func openDialog(windowID: String, dialogID: String, parameters: [String: JSONValue]) {
        Task {
            let sig = await signals.dialog(dialogID: "\(windowID)Dialog\(dialogID)")
            await sig.set(DialogState(open: true, props: parameters))
        }
    }

    func closeDialog(windowID: String, dialogID: String) {
        let key = "\(windowID)Dialog\(dialogID)"
        Task {
            let sig = await signals.dialog(dialogID: key)
            await sig.set(DialogState(open: false))
        }
        pendingDialogs.removeValue(forKey: key)
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
        guard let endpoint = metadataURL(for: state.key) else {
            await signal.set(nil)
            return
        }
        do {
            let (data, _) = try await session.data(from: endpoint)
            let decoded = try JSONDecoder().decode(WindowMetadata.self, from: data)
            let resolved = MetadataResolver.resolve(decoded, for: targetContext)
            if let index = windows.firstIndex(where: { $0.id == state.id }) {
                windows[index] = WindowState(id: state.id, key: state.key, title: state.title, metadata: resolved)
            }
            await signal.set(resolved)
        } catch {
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
}
