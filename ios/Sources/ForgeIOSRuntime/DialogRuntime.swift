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

    package func editableOperationPresentation(windowID: String, source: String, collection: EditableCollectionSpec) async -> [String:(visible:Bool,disabled:Bool)] {
        guard let scope = await mutationScope(windowID: windowID, source: source) else { return [:] }
        let rows = scope.editableSelectedRows
        return Dictionary(uniqueKeysWithValues: (collection.operations ?? []).map { operation in
            (operation.id, scope.editablePresentation(operation:operation, collection:collection, rows:rows))
        })
    }

    /// Opens an ordinary collection dialog with the same parameter envelope
    /// used by collection commands. The dialog owns input binding and onOpen.
    package func openEditableOperationDialog(windowID: String, source: String, collection: EditableCollectionSpec, operation: EditableCollectionOperationSpec) async {
        guard let dialogID = operation.dialogId, !dialogID.isEmpty,
              let scope = await mutationScope(windowID: windowID, source: source) else { return }
        let selectedRows = scope.editableSelectedRows
        let state = scope.editablePresentation(operation:operation, collection:collection, rows:selectedRows)
        guard state.visible, !state.disabled else { return }
        var seed = scope.resolvedParameters(operation.parameters ?? [], target: source, operationBindings: true)
        seed["operationId"] = .string(operation.id)
        seed["selectedRows"] = .array(selectedRows.map(JSONValue.object))
        await openDialog(windowID: windowID, dialogID: dialogID, parameters: seed)
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

extension MutationScope {
    var editableSelectedRows: [[String:JSONValue]] {
        let selection = snapshot(source)?.selection ?? SelectionState()
        return selection.selection.isEmpty ? selection.selected.map { [$0] } ?? [] : selection.selection
    }

    func editablePresentation(operation: EditableCollectionOperationSpec, collection: EditableCollectionSpec,
                              rows: [[String:JSONValue]]) -> (visible:Bool, disabled:Bool) {
        guard allows(operation.visibleWhen) else { return (false,true) }
        let spec = operation.selection ?? collection.selection
        if rows.count < (spec?.min ?? (operation.requiresSelection == true ? 1 : 0)) || spec?.max.map({ $0 > 0 && rows.count > $0 }) == true
            || operation.disabledWhen.map({ allows($0) }) == true || spec?.disabledWhen.map({ allows($0) }) == true { return (true,true) }
        if let condition = spec?.every, rows.isEmpty || !rows.allSatisfy({ allows(condition,row:$0) }) { return (true,true) }
        if let condition = spec?.any, !rows.contains(where:{ allows(condition,row:$0) }) { return (true,true) }
        if let condition = spec?.none, rows.contains(where:{ allows(condition,row:$0) }) { return (true,true) }
        return (true,false)
    }
}
