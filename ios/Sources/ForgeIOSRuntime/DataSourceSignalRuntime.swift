import Foundation

extension ForgeRuntime {
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

    public func setDataSourceFilter(
        windowID: String,
        dataSourceRef: String,
        filter: [String: JSONValue]
    ) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setFilter(dataSourceID: dataSourceID, filter: filter)
        let signal = await signals.input(dataSourceID: dataSourceID)
        await signal.set(await dataSourceRuntime.input(dataSourceID: dataSourceID))
    }
}
