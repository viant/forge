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
    private let signals: SignalRegistry
    private let dataSourceRuntime: DataSourceRuntime

    public init(targetContext: ForgeTargetContext = ForgeTargetContext()) {
        self.targetContext = targetContext
        self.signals = SignalRegistry()
        self.dataSourceRuntime = DataSourceRuntime()
    }

    @discardableResult
    public func openWindowInline(key: String, title: String, metadata: WindowMetadata) -> WindowState {
        let resolved = MetadataResolver.resolve(metadata, for: targetContext)
        let state = WindowState(key: key, title: title, metadata: resolved)
        windows.append(state)
        return state
    }

    public func closeWindow(id: String) {
        windows.removeAll { $0.id == id }
        Task {
            await signals.removeWindow(windowID: id)
            await dataSourceRuntime.detachWindow(id)
        }
    }

    public func windowContext(id: String) -> WindowContext {
        let parameters = windows.first(where: { $0.id == id })?.metadata?.namespace.map { ["namespace": $0] } ?? [:]
        return WindowContext(windowID: id, parameters: parameters)
    }

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
        return values.reduce(into: [:]) { partialResult, entry in
            partialResult[entry.key] = entry.value.stringValue ?? ""
        }
    }

    public func formJSONValue(windowID: String, dataSourceRef: String) async -> [String: JSONValue] {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        return await dataSourceRuntime.form(dataSourceID: dataSourceID)
    }
}
