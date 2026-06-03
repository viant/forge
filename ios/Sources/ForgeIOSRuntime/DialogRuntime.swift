import Foundation

extension ForgeRuntime {
    public func dialogState(windowID: String, dialogID: String) async -> DialogState {
        let signal = await signals.dialog(dialogID: "\(windowID)Dialog\(dialogID)")
        return await signal.peek()
    }

    public func dialogUpdates(windowID: String, dialogID: String) async -> AsyncStream<DialogState> {
        let signal = await signals.dialog(dialogID: "\(windowID)Dialog\(dialogID)")
        return await signal.stream()
    }

    public func closeDialogPublic(windowID: String, dialogID: String) async {
        await closeDialog(windowID: windowID, dialogID: dialogID)
    }

    public func presentDialog(
        windowID: String,
        dialogID: String,
        parameters: [String: JSONValue] = [:],
        selectionMode: String? = nil
    ) async -> Bool {
        guard let metadata = await windowMetadata(id: windowID),
              metadata.dialogs.contains(where: { $0.id == dialogID }) else {
            return false
        }
        await openDialog(
            windowID: windowID,
            dialogID: dialogID,
            parameters: parameters,
            selectionMode: selectionMode
        )
        return true
    }

    public func awaitDialogResult(
        windowID: String,
        dialogID: String
    ) async -> [String: JSONValue]? {
        await withCheckedContinuation { continuation in
            Task {
                let key = "\(windowID)Dialog\(dialogID)"
                await registerPendingDialogResult(key, continuation)
            }
        }
    }

    public func openDialogAwaitResult(
        windowID: String,
        dialogID: String,
        parameters: [String: JSONValue] = [:],
        selectionMode: String? = nil
    ) async -> [String: JSONValue]? {
        let opened = await presentDialog(
            windowID: windowID,
            dialogID: dialogID,
            parameters: parameters,
            selectionMode: selectionMode
        )
        guard opened else {
            return nil
        }
        return await awaitDialogResult(windowID: windowID, dialogID: dialogID)
    }

    func resolvePendingDialogResult(
        windowID: String,
        dialogID: String,
        payload: [String: JSONValue]?
    ) {
        let key = "\(windowID)Dialog\(dialogID)"
        resolvePendingDialogResult(key, payload: payload)
    }
}
