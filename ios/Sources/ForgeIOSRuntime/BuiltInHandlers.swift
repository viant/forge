import Foundation

extension ForgeRuntime {

    /// Register built-in handlers without replacing application-provided handlers.
    public func registerBuiltInHandlers() {
        for (name, handler) in Self.makeBuiltInHandlers(for: self) where handlers[name] == nil {
            handlers[name] = handler
        }
    }

    static func makeBuiltInHandlers(for runtime: ForgeRuntime) -> [String: ForgeHandler] {
        var handlers: [String: ForgeHandler] = [:]
        // 1. window.openDialog
        handlers["window.openDialog"] = { [weak runtime] args in
            guard let runtime else { return nil }
            guard let dialogID = args.execution.args.first else { return nil }
            let windowID = args.args["windowId"]?.stringValue
                ?? args.context?.windowID ?? ""
            guard !windowID.isEmpty else { return nil }
            let dialogKey = "\(windowID)Dialog\(dialogID)"
            let inbound = await buildInboundParameters(runtime: runtime, args: args, windowID: windowID)
            let outbound = await runtime.resolveOutbound(args.execution.parameters)
            let selectionMode = args.args["multiple"]?.boolValue == true ? "multi" : (args.args["multiple"]?.boolValue == false ? "single" : nil)
            if let ctx = args.context, !outbound.isEmpty {
                await runtime.registerPendingDialog(dialogKey, PendingDialog(
                    callerWindowID: ctx.windowID,
                    callerDataSourceRef: ctx.dataSourceRef,
                    outbound: outbound
                ))
            }
            await runtime.openDialog(
                windowID: windowID,
                dialogID: dialogID,
                parameters: inbound,
                selectionMode: selectionMode
            )
            return nil
        }

        // 2. window.openWindow
        handlers["window.openWindow"] = { [weak runtime] args in
            guard let runtime else { return nil }
            guard let windowKey = args.execution.args.first else { return nil }
            let title = args.execution.args.dropFirst().first ?? windowKey
            let windowID = args.args["windowId"]?.stringValue
                ?? args.context?.windowID ?? ""
            let inbound = await buildInboundParameters(runtime: runtime, args: args, windowID: windowID)
            let state = await runtime.openWindow(key: windowKey, title: title, parameters: inbound)
            let outbound = await runtime.resolveOutbound(args.execution.parameters)
            if let ctx = args.context, !outbound.isEmpty {
                await runtime.registerPendingWindow(state.id, PendingWindow(
                    callerWindowID: ctx.windowID,
                    callerDataSourceRef: ctx.dataSourceRef,
                    outbound: outbound
                ))
            }
            return nil
        }

        // 3. window.closeWindow
        handlers["window.closeWindow"] = { [weak runtime] args in
            guard let runtime else { return nil }
            let windowID = args.args["windowId"]?.stringValue
                ?? args.context?.windowID ?? ""
            guard !windowID.isEmpty else { return nil }
            await runtime.clearPendingWindow(windowID)
            await runtime.closeWindow(id: windowID)
            return nil
        }

        // 4. window.commit / window.commitWindow
        let commitWindow: ForgeHandler = { [weak runtime] args in
            guard let runtime else { return nil }
            let windowID = args.args["windowId"]?.stringValue
                ?? args.context?.windowID ?? ""
            guard !windowID.isEmpty else { return nil }
            let payload: [String: JSONValue]
            if let p = args.args["payload"]?.objectValue, !p.isEmpty {
                payload = p
            } else {
                let dsRef = args.context?.dataSourceRef ?? ""
                let dsID = WindowIdentity(windowID: windowID).dataSourceID(ref: dsRef)
                let selection = await runtime.dataSourceRuntime.selection(dataSourceID: dsID)
                let form = await runtime.dataSourceRuntime.form(dataSourceID: dsID)
                if !selection.selection.isEmpty {
                    var selectionPayload: [String: JSONValue] = [
                        "selection": .array(selection.selection.map(JSONValue.object))
                    ]
                    if let selected = selection.selected ?? selection.selection.last {
                        selectionPayload["selected"] = .object(selected)
                    }
                    payload = selectionPayload
                } else if !form.isEmpty {
                    payload = form
                } else {
                    payload = selection.selected ?? [:]
                }
            }
            if let pending = await runtime.pendingWindow(windowID) {
                await runtime.applyOutbound(pending.outbound, payload: payload,
                                         callerWindowID: pending.callerWindowID,
                                         callerDSRef: pending.callerDataSourceRef)
                await runtime.clearPendingWindow(windowID)
            }
            await runtime.closeWindow(id: windowID)
            return nil
        }
        handlers["window.commit"] = commitWindow
        handlers["window.commitWindow"] = commitWindow

        // 5. dialog.commit
        handlers["dialog.commit"] = { [weak runtime] args in
            guard let runtime else { return nil }
            let dialogID = args.args["dialogId"]?.stringValue
                ?? args.execution.args.first ?? ""
            let windowID = args.args["windowId"]?.stringValue
                ?? args.context?.windowID ?? ""
            guard !dialogID.isEmpty, !windowID.isEmpty else { return nil }
            let dialogKey = "\(windowID)Dialog\(dialogID)"
            let payload: [String: JSONValue]
            if let p = args.args["payload"]?.objectValue, !p.isEmpty {
                payload = p
            } else {
                let dsRef = args.context?.dataSourceRef ?? ""
                let dsID = WindowIdentity(windowID: windowID).dataSourceID(ref: dsRef)
                let selection = await runtime.dataSourceRuntime.selection(dataSourceID: dsID)
                let form = await runtime.dataSourceRuntime.form(dataSourceID: dsID)
                if !selection.selection.isEmpty {
                    var selectionPayload: [String: JSONValue] = [
                        "selection": .array(selection.selection.map(JSONValue.object))
                    ]
                    if let selected = selection.selected ?? selection.selection.last {
                        selectionPayload["selected"] = .object(selected)
                    }
                    payload = selectionPayload
                } else if !form.isEmpty {
                    payload = form
                } else {
                    payload = selection.selected ?? [:]
                }
            }
            if let pending = await runtime.pendingDialog(dialogKey) {
                await runtime.applyOutbound(pending.outbound, payload: payload,
                                         callerWindowID: pending.callerWindowID,
                                         callerDSRef: pending.callerDataSourceRef)
            }
            await runtime.resolvePendingDialogResult(windowID: windowID, dialogID: dialogID, payload: payload)
            await runtime.closeDialog(windowID: windowID, dialogID: dialogID)
            return nil
        }

        // 6. dialog.close
        handlers["dialog.close"] = { [weak runtime] args in
            guard let runtime else { return nil }
            let dialogID = args.args["dialogId"]?.stringValue
                ?? args.execution.args.first ?? ""
            let windowID = args.args["windowId"]?.stringValue
                ?? args.context?.windowID ?? ""
            guard !dialogID.isEmpty, !windowID.isEmpty else { return nil }
            await runtime.closeDialog(windowID: windowID, dialogID: dialogID)
            return nil
        }

        // 7. dataSource.fetchCollection
        handlers["dataSource.fetchCollection"] = { [weak runtime] args in
            guard let runtime else { return nil }
            if let dsRef = args.context?.dataSourceRef, !dsRef.isEmpty,
               let windowID = args.context?.windowID {
                await runtime.refreshDataSourceCollection(windowID: windowID, dataSourceRef: dsRef)
            }
            return nil
        }

        // 7A. dataSource.setWindowFormData
        handlers["dataSource.setWindowFormData"] = { [weak runtime] args in
            guard let runtime else { return nil }
            let windowID = args.args["windowId"]?.stringValue
                ?? args.context?.windowID ?? ""
            guard !windowID.isEmpty else { return nil }
            let payload: [String: JSONValue]
            if let direct = args.args["payload"]?.objectValue, !direct.isEmpty {
                payload = direct
            } else {
                payload = await buildInboundParameters(runtime: runtime, args: args, windowID: windowID)
            }
            guard !payload.isEmpty else { return nil }
            await runtime.setWindowFormValue(windowID: windowID, values: payload)
            return nil
        }

        // 8. dataSource.handleAddNew
        handlers["dataSource.handleAddNew"] = { [weak runtime] args in
            guard let runtime else { return nil }
            if let ctx = args.context, !ctx.dataSourceRef.isEmpty {
                let dsID = WindowIdentity(windowID: ctx.windowID)
                    .dataSourceID(ref: ctx.dataSourceRef)
                await runtime.dataSourceRuntime.setSelection(
                    dataSourceID: dsID, selection: SelectionState())
                await runtime.dataSourceRuntime.setForm(dataSourceID: dsID, values: [:])
            }
            return nil
        }

        // 9. dataSource.noSelection  → returns .bool(true) when nothing selected
        handlers["dataSource.noSelection"] = { [weak runtime] args in
            guard let runtime, let ctx = args.context, !ctx.dataSourceRef.isEmpty else {
                return .bool(true)
            }
            let dsID = WindowIdentity(windowID: ctx.windowID)
                .dataSourceID(ref: ctx.dataSourceRef)
            let sel = await runtime.dataSourceRuntime.selection(dataSourceID: dsID)
            return .bool(sel.selected == nil)
        }

        // 10. dataSource.isFormNotDirty
        handlers["dataSource.isFormNotDirty"] = { [weak runtime] args in
            guard let runtime, let ctx = args.context, !ctx.dataSourceRef.isEmpty else {
                return .bool(true)
            }
            let dsID = WindowIdentity(windowID: ctx.windowID)
                .dataSourceID(ref: ctx.dataSourceRef)
            let form = await runtime.dataSourceRuntime.form(dataSourceID: dsID)
            return .bool(form.isEmpty)
        }

        // 11. dataSource.setFilter
        handlers["dataSource.setFilter"] = { [weak runtime] args in
            guard let runtime, let ctx = args.context, !ctx.dataSourceRef.isEmpty else {
                return nil
            }
            // If a direct "filter" dict was passed, use it verbatim
            if let direct = args.args["filter"]?.objectValue, !direct.isEmpty {
                await runtime.setDataSourceFilter(
                    windowID: ctx.windowID,
                    dataSourceRef: ctx.dataSourceRef,
                    filter: direct
                )
                return nil
            }
            // Otherwise merge non-reserved args into current filter
            let current = await runtime.dataSourceInputState(windowID: ctx.windowID, dataSourceRef: ctx.dataSourceRef)
            var next = current.filter
            let skip = Set(["row", "rowIndex", "windowId"])
            for (k, v) in args.args where !skip.contains(k) {
                next[k] = v
            }
            await runtime.setDataSourceFilter(
                windowID: ctx.windowID,
                dataSourceRef: ctx.dataSourceRef,
                filter: next
            )
            return nil
        }

        // 11A. reportRuntime.executeAction
        handlers["reportRuntime.executeAction"] = { [weak runtime] args in
            guard let runtime else { return nil }
            let execution = args.args["execution"]?.objectValue ?? args.args
            guard let kind = execution["kind"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !kind.isEmpty else {
                return nil
            }

            let handlerName: String
            var forwardedArgs: [String: JSONValue]
            switch kind {
            case "keep", "exclude":
                guard let refinement = execution["refinement"]?.objectValue else { return nil }
                handlerName = "reportRuntime.applyRefinement"
                forwardedArgs = ["refinement": .object(refinement)]
            case "drill":
                guard let refinement = execution["refinement"]?.objectValue else { return nil }
                handlerName = "reportRuntime.applyDrillTransition"
                forwardedArgs = ["refinement": .object(refinement)]
                if let transition = execution["transition"]?.objectValue {
                    for (key, value) in transition {
                        forwardedArgs[key] = value
                    }
                }
            case "detail":
                guard let detailRequest = execution["detailRequest"]?.objectValue else { return nil }
                handlerName = "reportRuntime.openDetailTarget"
                forwardedArgs = ["detailRequest": .object(detailRequest)]
            case "removeRefinement":
                let refinementID = execution["refinementId"] ?? execution["refinementID"] ?? .null
                guard refinementID.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false else {
                    return nil
                }
                handlerName = "reportRuntime.removeRefinement"
                forwardedArgs = ["refinementId": refinementID]
            case "clearRefinements":
                handlerName = "reportRuntime.clearRefinements"
                forwardedArgs = [:]
            case "undoRefinements":
                handlerName = "reportRuntime.undoRefinements"
                forwardedArgs = [:]
            case "redoRefinements":
                handlerName = "reportRuntime.redoRefinements"
                forwardedArgs = [:]
            default:
                return nil
            }
            guard let handler = await runtime.registeredHandler(named: handlerName) else {
                return .object(["executed": .bool(false), "reason": .string("unsupportedExecution")])
            }
            let result = await handler(ExecutionArgs(
                execution: ExecutionDef(action: handlerName),
                context: args.context,
                args: forwardedArgs
            ))
            return result ?? .object(["executed": .bool(true), "branch": .string(kind)])
        }

        // 12. dataSource.toggleSelection
        handlers["dataSource.toggleSelection"] = { [weak runtime] args in
            guard let runtime, let ctx = args.context, !ctx.dataSourceRef.isEmpty else {
                return nil
            }
            guard let row = args.args["row"]?.objectValue else { return nil }
            let rowIndex = args.args["rowIndex"]?.intValue ?? -1
            await runtime.toggleDataSourceSelection(
                windowID: ctx.windowID,
                dataSourceRef: ctx.dataSourceRef,
                row: row,
                rowIndex: rowIndex
            )
            return nil
        }
        return handlers
    }

    private static func buildInboundParameters(
        runtime: ForgeRuntime,
        args: ExecutionArgs,
        windowID: String
    ) async -> [String: JSONValue] {
        guard !args.execution.parameters.isEmpty else { return [:] }
        let metadata = await runtime.windowMetadata(id: windowID)
        let context = await runtime.buildParameterResolutionContext(
            windowID: windowID,
            metadata: metadata,
            identityDataSourceRef: args.context?.dataSourceRef ?? ""
        )
        return ParameterResolver.resolve(parameters: args.execution.parameters, context: context)
    }
}
