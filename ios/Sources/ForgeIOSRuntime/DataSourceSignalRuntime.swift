import Foundation

extension ForgeRuntime {
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
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setFilter(dataSourceID: dataSourceID, filter: filter)
        let signal = await signals.input(dataSourceID: dataSourceID)
        let next = await dataSourceRuntime.input(dataSourceID: dataSourceID)
        await signal.set(next)
        if next.fetch {
            await refreshDataSourceCollection(windowID: windowID, dataSourceRef: dataSourceRef)
        }
    }

    public func windowFormUpdates(windowID: String) async -> AsyncStream<[String: JSONValue]> {
        let signal = await signals.form(
            dataSourceID: WindowIdentity(windowID: windowID).windowFormID()
        )
        return await signal.stream()
    }
}
