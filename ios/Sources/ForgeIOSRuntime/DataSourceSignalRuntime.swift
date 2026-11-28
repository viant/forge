import Foundation

extension ForgeRuntime {
    public func dataSourceForm(windowID: String, dataSourceRef: String) async -> [String: JSONValue] {
        let signal = await signals.form(
            dataSourceID: WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        )
        return await signal.peek()
    }

    /// Called directly by the picker at accepted selection, before its read task starts.
    package nonisolated func beginFormFile(windowID: String, source: String, field: String, presentation: UUID?) -> UUID {
        let id = WindowIdentity(windowID: windowID).dataSourceID(ref: source)
        return dataSourceRuntime.fileSelections.begin(id, field: field, presentation: presentation)
    }

    package func editFormFile(windowID: String, source: String, field: String, revision: UUID, dialog: (id: String, presentation: UUID)?,
                              read: @Sendable () async throws -> JSONValue) async throws -> JSONValue? {
        let id = WindowIdentity(windowID: windowID).dataSourceID(ref: source)
        let files = dataSourceRuntime.fileSelections
        defer { files.finish(id, field: field, revision: revision) }
        func ownsPresentation() -> Bool {
            guard windowState(id: windowID) != nil, !Task.isCancelled else { return false }
            guard let dialog else { return true }
            return pendingDialogScope("\(windowID)Dialog\(dialog.id)").id == dialog.presentation
        }
        guard ownsPresentation() else { return nil }
        let authorization = await windowMetadata(id: windowID)?.authorizationSnapshot
        let value = try await read()
        let signal = await signals.form(dataSourceID: id)
        guard await windowMetadata(id: windowID)?.authorizationSnapshot == authorization, ownsPresentation(),
              await dataSourceRuntime.publishFormFile(id, field: field, revision: revision, value: value) else { return nil }
        return await signal.setFormFile(field: field, value: value, id: id, revision: revision, files: files) ? value : nil
    }

    public func dataSourceFormUpdates(
        windowID: String,
        dataSourceRef: String
    ) async -> AsyncStream<[String: JSONValue]> {
        let signal = await signals.form(
            dataSourceID: WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        )
        return await signal.stream()
    }

    public func dataSourceMetricsUpdates(
        windowID: String,
        dataSourceRef: String
    ) async -> AsyncStream<[String: JSONValue]> {
        let signal = await signals.metrics(
            dataSourceID: WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        )
        return await signal.stream()
    }

    public func dataSourceSelectionState(
        windowID: String,
        dataSourceRef: String
    ) async -> SelectionState {
        let signal = await signals.selection(
            dataSourceID: WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        )
        return await signal.peek()
    }

    public func dataSourceSelectionUpdates(
        windowID: String,
        dataSourceRef: String
    ) async -> AsyncStream<SelectionState> {
        let signal = await signals.selection(
            dataSourceID: WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        )
        return await signal.stream()
    }

    public func dataSourceCollectionUpdates(
        windowID: String,
        dataSourceRef: String
    ) async -> AsyncStream<[[String: JSONValue]]> {
        let signal = await signals.collection(
            dataSourceID: WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        )
        return await signal.stream()
    }

    public func dataSourceInputState(
        windowID: String,
        dataSourceRef: String
    ) async -> InputState {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        return await dataSourceRuntime.input(dataSourceID: dataSourceID)
    }

    package func editInputParameter(windowID: String, dataSourceRef: String, selector: String, value: JSONValue) async -> Bool {
        let id = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        let signal = await signals.input(dataSourceID: id)
        guard let input = await dataSourceRuntime.editInputParameter(dataSourceID: id, selector: selector, value: value) else { return false }
        await signal.set(input)
        return true
    }

    public func dataSourceInputUpdates(
        windowID: String,
        dataSourceRef: String
    ) async -> AsyncStream<InputState> {
        let signal = await signals.input(
            dataSourceID: WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        )
        return await signal.stream()
    }

    public func dataSourceControlUpdates(
        windowID: String,
        dataSourceRef: String
    ) async -> AsyncStream<ControlState> {
        let signal = await signals.control(
            dataSourceID: WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        )
        return await signal.stream()
    }

    public func setDataSourceFilter(
        windowID: String,
        dataSourceRef: String,
        filter: [String: JSONValue]
    ) async {
        await replaceDataSourceFilter(windowID: windowID, dataSourceRef: dataSourceRef, filter: filter, resetPage: false)
    }

    func replaceDataSourceFilter(
        windowID: String,
        dataSourceRef: String,
        filter: [String: JSONValue],
        resetPage: Bool,
        fetch: Bool = true
    ) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.replaceFilter(dataSourceID: dataSourceID, filter: filter, resetPage: resetPage, fetch: fetch)
        let signal = await signals.input(dataSourceID: dataSourceID)
        let next = await dataSourceRuntime.input(dataSourceID: dataSourceID)
        await signal.set(next)
        if next.fetch {
            await refreshDataSourceCollection(windowID: windowID, dataSourceRef: dataSourceRef)
        }
    }

    public func windowFormUpdates(windowID: String) async -> AsyncStream<[String: JSONValue]> {
        return await dataSourceRuntime.formUpdates(dataSourceID: WindowIdentity(windowID: windowID).windowFormID())
    }
}
