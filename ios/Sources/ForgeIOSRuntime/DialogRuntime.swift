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
        await presentDialogSession(windowID: windowID, dialogID: dialogID, parameters: parameters, selectionMode: selectionMode) != nil
    }

    private func presentDialogSession(windowID: String, dialogID: String, parameters: [String: JSONValue], selectionMode: String?,
                                      waiter: CheckedContinuation<[String: JSONValue]?, Never>? = nil) async -> UUID? {
        guard let metadata = await windowMetadata(id: windowID),
              metadata.dialogs.contains(where: { $0.id == dialogID }) else {
            waiter?.resume(returning:nil)
            return nil
        }
        return await openDialog(windowID: windowID, dialogID: dialogID, parameters: parameters, selectionMode: selectionMode, waiter: waiter)
    }

    public func awaitDialogResult(
        windowID: String,
        dialogID: String
    ) async -> [String: JSONValue]? {
        await waitForDialog("\(windowID)Dialog\(dialogID)")
    }

    public func openDialogAwaitResult(
        windowID: String,
        dialogID: String,
        parameters: [String: JSONValue] = [:],
        selectionMode: String? = nil
    ) async -> [String: JSONValue]? {
        await withCheckedContinuation { waiter in
            Task {
                _ = await presentDialogSession(windowID:windowID, dialogID:dialogID, parameters:parameters, selectionMode:selectionMode, waiter:waiter)
            }
        }
    }
}
