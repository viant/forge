import Foundation

extension ForgeRuntime {

    /// Register all 12 built-in handlers. Call once after init.
    public func registerBuiltInHandlers() {
        handlers = Self.makeBuiltInHandlers(for: self)
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
            let outbound = await runtime.resolveOutbound(args.execution.parameters)
            if let ctx = args.context, !outbound.isEmpty {
                await runtime.registerPendingDialog(dialogKey, PendingDialog(
                    callerWindowID: ctx.windowID,
                    callerDataSourceRef: ctx.dataSourceRef,
                    outbound: outbound
                ))
            }
            await runtime.openDialog(windowID: windowID, dialogID: dialogID,
                                  parameters: [:])
            return nil
        }

        // 2. window.openWindow
        handlers["window.openWindow"] = { [weak runtime] args in
            guard let runtime else { return nil }
            guard let windowKey = args.execution.args.first else { return nil }
            let title = args.execution.args.dropFirst().first ?? windowKey
            let state = await runtime.openWindow(key: windowKey, title: title)
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
                let form = await runtime.dataSourceRuntime.form(dataSourceID: dsID)
                if !form.isEmpty {
                    payload = form
                } else {
                    payload = await runtime.dataSourceRuntime.selection(
                        dataSourceID: dsID).selected ?? [:]
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
                let form = await runtime.dataSourceRuntime.form(dataSourceID: dsID)
                if !form.isEmpty {
                    payload = form
                } else {
                    payload = await runtime.dataSourceRuntime.selection(
                        dataSourceID: dsID).selected ?? [:]
                }
            }
            if let pending = await runtime.pendingDialog(dialogKey) {
                await runtime.applyOutbound(pending.outbound, payload: payload,
                                         callerWindowID: pending.callerWindowID,
                                         callerDSRef: pending.callerDataSourceRef)
            }
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
                let dsID = WindowIdentity(windowID: windowID).dataSourceID(ref: dsRef)
                await runtime.dataSourceRuntime.triggerFetch(dataSourceID: dsID)
            }
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
            let dsID = WindowIdentity(windowID: ctx.windowID)
                .dataSourceID(ref: ctx.dataSourceRef)
            // If a direct "filter" dict was passed, use it verbatim
            if let direct = args.args["filter"]?.objectValue, !direct.isEmpty {
                await runtime.dataSourceRuntime.setFilter(dataSourceID: dsID, filter: direct)
                return nil
            }
            // Otherwise merge non-reserved args into current filter
            var next = await runtime.dataSourceRuntime.input(dataSourceID: dsID).filter
            let skip = Set(["row", "rowIndex", "windowId"])
            for (k, v) in args.args where !skip.contains(k) {
                next[k] = v
            }
            await runtime.dataSourceRuntime.setFilter(dataSourceID: dsID, filter: next)
            return nil
        }

        // 12. dataSource.toggleSelection
        handlers["dataSource.toggleSelection"] = { [weak runtime] args in
            guard let runtime, let ctx = args.context, !ctx.dataSourceRef.isEmpty else {
                return nil
            }
            guard let row = args.args["row"]?.objectValue else { return nil }
            let rowIndex = args.args["rowIndex"]?.intValue ?? -1
            let dsID = WindowIdentity(windowID: ctx.windowID)
                .dataSourceID(ref: ctx.dataSourceRef)
            await runtime.dataSourceRuntime.toggleSelection(
                dataSourceID: dsID, row: row, rowIndex: rowIndex)
            return nil
        }
        return handlers
    }
}
