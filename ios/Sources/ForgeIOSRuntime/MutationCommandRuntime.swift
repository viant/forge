import Foundation

public enum MutationCommandPhase: String, Codable, Sendable {
    case idle
    case validating
    case confirming
    case preparing
    case cleaningUp = "cleaning_up"
    case pending
    case succeeded
    case failed
    case indeterminate
}

public enum MutationWriterStatus: String, Codable, Sendable {
    case idle
    case notInvoked = "not_invoked"
    case pending
    case succeeded
    case failed
    case indeterminate
}

public enum MutationSyncStatus: String, Codable, Sendable {
    case notStarted = "not_started"
    case succeeded
    case partialFailure = "partial_failure"
}

public struct MutationCommandWarning: Codable, Sendable, Equatable {
    public let stage: String
    public let dataSourceRef: String?
    public let message: String

    public init(stage: String, dataSourceRef: String? = nil, message: String) {
        self.stage = stage
        self.dataSourceRef = dataSourceRef
        self.message = message
    }
}

public struct MutationCommandState: Codable, Sendable, Equatable {
    public let phase: MutationCommandPhase
    public let guarded: Bool
    public let pending: Bool
    public let retryAllowed: Bool
    public let error: String?
    public let message: String
    public let invocationId: String
    public let failedStepId: String?
    public let writerStatus: MutationWriterStatus
    public let syncStatus: MutationSyncStatus
    public let warnings: [MutationCommandWarning]

    public init(
        phase: MutationCommandPhase = .idle,
        guarded: Bool = false,
        pending: Bool = false,
        retryAllowed: Bool = true,
        error: String? = nil,
        message: String = "",
        invocationId: String = "",
        failedStepId: String? = nil,
        writerStatus: MutationWriterStatus = .idle,
        syncStatus: MutationSyncStatus = .notStarted,
        warnings: [MutationCommandWarning] = []
    ) {
        self.phase = phase
        self.guarded = guarded
        self.pending = pending
        self.retryAllowed = retryAllowed
        self.error = error
        self.message = message
        self.failedStepId = failedStepId
        self.invocationId = invocationId
        self.writerStatus = writerStatus
        self.syncStatus = syncStatus
        self.warnings = warnings
    }
}

public struct MutationCommandResult: Sendable, Equatable {
    public let accepted: Bool
    public let status: String
    public let invocationId: String
    public let failedStepId: String?
    public let error: String?
    public let warnings: [MutationCommandWarning]

    public init(accepted: Bool, status: String, invocationId: String = "", failedStepId: String? = nil, error: String? = nil, warnings: [MutationCommandWarning] = []) {
        self.accepted = accepted
        self.status = status
        self.failedStepId = failedStepId
        self.invocationId = invocationId
        self.error = error
        self.warnings = warnings
    }
}

private enum MutationWriterOutcome: Sendable {
    case succeeded([JSONValue]?)
    case failed(String)
    case indeterminate
}

private struct MutationOperation {
    let key: String
    let id: String
    let windowID: String
    let source: String
    let authorization: [String: JSONValue]?
    let selection: SelectionState
    let root: MutationCommandDef
    let footer: ActionDef?
    let dialogSignal: Signal<DialogState>?
    let presentationID: UUID?
    let originalPendingFields: [String: JSONValue]
}

private struct MutationDispatchFailure: Error {
    let status: String
    let message: String
    var invoked = false
    var lostScope = false
    var unknown = false
}

private actor MutationWriterRace {
    private var outcome: MutationWriterOutcome?
    private var continuation: CheckedContinuation<MutationWriterOutcome, Never>?

    func wait() async -> MutationWriterOutcome {
        if let outcome { return outcome }
        return await withCheckedContinuation { continuation = $0 }
    }

    func resolve(_ next: MutationWriterOutcome) {
        guard outcome == nil else { return }
        outcome = next
        continuation?.resume(returning: next)
        continuation = nil
    }
}

extension ForgeRuntime {
    private func mutationSignal(_ key: String) -> Signal<MutationCommandState> {
        if let signal = mutationCommandStates[key] { return signal }
        let signal = Signal(MutationCommandState())
        mutationCommandStates[key] = signal
        return signal
    }

    public func mutationCommandState(windowID: String, command: MutationCommandDef) async -> MutationCommandState {
        await mutationSignal(mutationCommandKey(windowID: windowID, command: command)).peek()
    }

    public func mutationCommandUpdates(windowID: String, command: MutationCommandDef) async -> AsyncStream<MutationCommandState> {
        await mutationSignal(mutationCommandKey(windowID: windowID, command: command)).stream()
    }

    public func resolveIndeterminateMutationCommand(
        windowID: String,
        command: MutationCommandDef,
        message: String = ""
    ) async -> Bool {
        let key = mutationCommandKey(windowID: windowID, command: command)
        guard await mutationCommandStates[key]?.peek().phase == .indeterminate else { return false }
        guardedMutationCommands.remove(key)
        mutationTransportOwners = mutationTransportOwners.filter { $0.value != key }
        mutationSerializationOwners = mutationSerializationOwners.filter { $0.value != key }
        await mutationSignal(key).set(MutationCommandState(message: message))
        return true
    }

    public func activateDialogFooter(windowID: String, dialogID: String, sourceDataSourceRef: String, action: ActionDef,
                                     confirm: (@Sendable (String) async -> Bool)? = nil) async -> MutationCommandResult? {
        if let command = action.footerCommand {
            return await executeMutationCommand(windowID: windowID, sourceDataSourceRef: sourceDataSourceRef, command: command, footer: action, dialogID: dialogID, confirm: confirm)
        }
        guard await footerAllows(windowID: windowID, source: sourceDataSourceRef, action: action) else {
            return MutationCommandResult(accepted: false, status: "invalid")
        }
        let context = ExecutionContext(windowID: windowID, dataSourceRef: sourceDataSourceRef)
        let args: [String: JSONValue] = ["dialogId": .string(dialogID), "windowId": .string(windowID)]
        for execution in action.on where execution.event == nil || execution.event == "onClick" {
            if await execute(execution, context: context, args: args) == .bool(false) { return nil }
        }
        if action.close { await closeDialogPublic(windowID: windowID, dialogID: dialogID) }
        return nil
    }

    private func footerAllows(windowID: String, source: String, action: ActionDef?) async -> Bool {
        guard let action else { return true }
        guard await mutationPredicateAllows(windowID: windowID, dataSourceRef: source, condition: action.visibleWhen) else { return false }
        if let disabled = action.disabledWhen { return await !mutationPredicateAllows(windowID: windowID, dataSourceRef: source, condition: disabled) }
        return true
    }

    public func executeMutationCommand(
        windowID: String,
        sourceDataSourceRef: String,
        command: MutationCommandDef,
        extras: [String: JSONValue] = [:],
        footer: ActionDef? = nil,
        dialogID: String? = nil,
        confirm: (@Sendable (String) async -> Bool)? = nil
    ) async -> MutationCommandResult {
        let targetRef = command.dataSourceRef.trimmingCharacters(in: .whitespacesAndNewlines)
        let key = mutationCommandKey(windowID: windowID, command: command)
        guard !targetRef.isEmpty, !guardedMutationCommands.contains(key) else {
            return MutationCommandResult(accepted: false, status: "suppressed")
        }
        let group = command.serializationGroup?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let groupKey = "\(windowID)::\(group)"
        if !group.isEmpty {
            guard mutationSerializationOwners[groupKey] == nil else { return MutationCommandResult(accepted: false, status: "group_busy") }
            mutationSerializationOwners[groupKey] = key
        }
        defer {
            if !group.isEmpty, !guardedMutationCommands.contains(key), mutationSerializationOwners[groupKey] == key {
                mutationSerializationOwners.removeValue(forKey: groupKey)
            }
        }
        guardedMutationCommands.insert(key)
        await publishMutationState(key, MutationCommandState(
            phase: .validating, guarded: true, retryAllowed: false,
            message: "Validating…", writerStatus: .notInvoked
        ))

        let dialogSignal = if let dialogID { await signals.dialog(dialogID: "\(windowID)Dialog\(dialogID)") } else { nil as Signal<DialogState>? }
        let originalPresentation = await dialogSignal?.peek().presentationID
        let admitted = await windowMetadata(id: windowID)?.authorizationSnapshot
        let originalSelection = await dataSourceSelectionState(windowID: windowID, dataSourceRef: sourceDataSourceRef)
        var submitted: [String: JSONValue] = [:]
        if !command.clearFormFields.isEmpty {
            let form = await dataSourceForm(windowID: windowID, dataSourceRef: sourceDataSourceRef)
            for field in command.clearFormFields { submitted[field] = form[field] }
        }
        guard await footerAllows(windowID: windowID, source: sourceDataSourceRef, action: footer),
              await mutationPredicateAllows(windowID: windowID, dataSourceRef: sourceDataSourceRef, condition: command.validateWhen) else {
            let message = command.invalidMessage ?? "This action is not currently valid."
            guardedMutationCommands.remove(key)
            await applyMutationWindowState(windowID: windowID, patch: command.errorState)
            await publishMutationState(key, MutationCommandState(
                phase: .failed, error: message, message: message, writerStatus: .notInvoked
            ))
            return MutationCommandResult(accepted: false, status: "invalid", error: message)
        }

        let resolvedConfirmation = resolveMutationConfirmation(command: command, extras: extras)
        if !resolvedConfirmation.isEmpty {
            let confirmation = resolvedConfirmation
            guard let confirm else {
                let message = "Confirmation is required but no confirmation service is available."
                guardedMutationCommands.remove(key)
                await publishMutationState(key, MutationCommandState(
                    phase: .failed, error: message, message: message, writerStatus: .notInvoked
                ))
                return MutationCommandResult(accepted: false, status: "confirmation_unavailable", error: message)
            }
            await publishMutationState(key, MutationCommandState(
                phase: .confirming, guarded: true, retryAllowed: false,
                message: confirmation, writerStatus: .notInvoked
            ))
            guard await confirm(confirmation) else {
                guardedMutationCommands.remove(key)
                await publishMutationState(key, MutationCommandState(writerStatus: .notInvoked))
                return MutationCommandResult(accepted: false, status: "cancelled")
            }
        }

        guard await mutationDataSourceExists(windowID: windowID, dataSourceRef: targetRef) else {
            let message = "Command datasource is unavailable: \(targetRef)"
            guardedMutationCommands.remove(key)
            await publishMutationState(key, MutationCommandState(
                phase: .failed, error: message, message: message, writerStatus: .notInvoked
            ))
            return MutationCommandResult(accepted: false, status: "failed", error: message)
        }


        let invocationId = UUID().uuidString
        var originalPendingFields: [String: JSONValue] = [:]
        if command.before?.isEmpty == false, !command.pendingState.isEmpty {
            let original = await windowFormJSONValue(windowID: windowID)
            for field in command.pendingState.keys { originalPendingFields[field] = original[field] }
        }
        let operation = MutationOperation(
            key: key, id: invocationId, windowID: windowID, source: sourceDataSourceRef,
            authorization: admitted, selection: originalSelection, root: command, footer: footer, dialogSignal: dialogSignal,
            presentationID: originalPresentation, originalPendingFields: originalPendingFields)
        let steps = command.before ?? []
        var receipts: [String: JSONValue] = [:]
        var cleanups: [(id: String, command: MutationCommandDef)] = []
        var admittedWrites = false
        var attemptingFinalWriter = false
        var currentStep: String?
        do {
            if command.receiptWhen != nil { throw MutationDispatchFailure(status: "invalid_payload", message: "Only cleanup commands may assert their receipt.") }
            if let error = command.beforeValidationError {
                throw MutationDispatchFailure(status: "invalid_payload", message: error)
            }
            for step in steps {
                guard await operationIsCurrent(operation) else { throw scopeFailure() }
                if let when = step.when, await !mutationPredicateAllows(windowID: windowID, dataSourceRef: sourceDataSourceRef, condition: when)
                {
                    continue
                }
                let child = step.command
                currentStep = child.commandId
                guard let id = child.commandId else {
                    throw MutationDispatchFailure(status: "invalid_payload", message: "Missing pre-save command ID.")
                }
                let childInvocation = UUID().uuidString
                let rows = try await dispatchMutationWriter(
                    child, invocation: childInvocation, operation: operation, extras: extras, receipts: receipts,
                    begin: !admittedWrites, child: true)
                // Child calls require records, including a confirmed empty array.
                guard let rows else {
                    throw MutationDispatchFailure(
                        status: "indeterminate", message: "The pre-save writer receipt is unavailable.", invoked: true, unknown: true)
                }
                receipts[id] = .object(["invocationId": .string(childInvocation), "rows": .array(rows)])
                admittedWrites = true
                if let cleanup = step.cleanup { cleanups.append((id, cleanup)) }
            }

            currentStep = nil
            attemptingFinalWriter = true
            let rows = try await dispatchMutationWriter(
                command, invocation: invocationId, operation: operation, extras: extras, receipts: steps.isEmpty ? nil : receipts,
                begin: !admittedWrites, child: false)
            defer {
                mutationTransportOwners.removeValue(forKey: mutationTransportKey(windowID: windowID, dataSourceRef: targetRef))
                guardedMutationCommands.remove(key)
            }
            let currentBeforeSync = await operationIsCurrent(operation)
            var warnings: [MutationCommandWarning] = []
            if currentBeforeSync, await presentationIsCurrent(operation) {
                warnings = await synchronizeMutationUI(
                    windowID: windowID, targetDataSourceRef: targetRef, command: command, authorization: admitted,
                    receipt: steps.isEmpty ? nil : rows?.compactMap(\.objectValue))
            }
            guard await operationIsCurrent(operation), await presentationIsCurrent(operation) else {
                await publishMutationState(
                    key,
                    MutationCommandState(
                        phase: .succeeded, message: "Authorization changed after the write.", invocationId: invocationId,
                        writerStatus: .succeeded, syncStatus: .partialFailure))
                return MutationCommandResult(accepted: true, status: "superseded", invocationId: invocationId)
            }
            var patch = command.successState
            let receipt = JSONValue.array(rows ?? [])
            for (field, selectors) in command.resultState {
                let value = selectors.lazy.compactMap { resourceResolveValue(receipt, path: $0) }.first
                if value == nil {
                    warnings.append(
                        .init(stage: "resultState", dataSourceRef: targetRef, message: "Writer receipt omitted the value for \(field)."))
                }
                patch[field] = value ?? .null
            }
            await clearSubmittedFields(windowID: windowID, source: sourceDataSourceRef, submitted: submitted)
            await applyMutationWindowState(windowID: windowID, patch: patch)
            await publishMutationState(
                key,
                MutationCommandState(
                    phase: .succeeded, message: warnings.isEmpty ? "Completed" : "Saved. Some related data could not be refreshed.",
                    invocationId: invocationId, writerStatus: .succeeded, syncStatus: warnings.isEmpty ? .succeeded : .partialFailure,
                    warnings: warnings))
            return MutationCommandResult(accepted: true, status: "succeeded", invocationId: invocationId, warnings: warnings)
        } catch {
            let failure = error as? MutationDispatchFailure ?? .init(status: "invalid_payload", message: error.localizedDescription)
            var warnings: [MutationCommandWarning] = []
            var unresolved = failure.unknown
            let writerStatus: MutationWriterStatus =
                !attemptingFinalWriter || !failure.invoked ? .notInvoked : failure.unknown ? .indeterminate : .failed
            if !unresolved && !failure.lostScope && !cleanups.isEmpty, await operationIsCurrent(operation) {
                await publishMutationState(
                    key,
                    MutationCommandState(
                        phase: .cleaningUp, guarded: true, retryAllowed: false,
                        error: failure.message, message: "Cleaning up…", invocationId: invocationId, failedStepId: currentStep,
                        writerStatus: writerStatus))
                if await presentationIsCurrent(operation) {
                    await applyMutationWindowState(windowID: windowID, patch: command.cleanupState)
                }
                for entry in cleanups.reversed() {
                    guard await operationIsCurrent(operation) else { break }
                    do {
                        let records = try await dispatchMutationWriter(
                            entry.command, invocation: UUID().uuidString, operation: operation, extras: extras,
                            receipts: receipts, begin: false, child: true, compensating: true)
                        if let condition = entry.command.receiptWhen {
                            let receipt = JSONValue.array(records ?? [])
                            let confirmed = DashboardRuntime.evaluateDashboardCondition(condition, valueForCondition: { node in
                                guard node.source == "collection", let field = node.field else { return nil }
                                let value = resourceResolveValue(receipt, path: field)
                                if node.equals != nil || node.notEquals != nil || !node.inValues.isEmpty {
                                    return CanonicalPredicateValue(value: value)
                                }
                                return value?.anyValue
                            })
                            if !confirmed { throw MutationDispatchFailure(status: "failed", message: "Cleanup was not acknowledged by the producer.") }
                        }
                    } catch {
                        let cleanup = error as? MutationDispatchFailure ?? .init(status: "invalid_payload", message: error.localizedDescription)
                        warnings.append(
                            .init(
                                stage: "cleanup", dataSourceRef: entry.command.dataSourceRef,
                                message: "Cleanup for \(entry.id): \(cleanup.message)"))
                        unresolved = cleanup.unknown
                        if unresolved || cleanup.lostScope { break }
                    }
                }
            }
            defer { if !unresolved { guardedMutationCommands.remove(key) } }
            if !failure.lostScope, await operationIsCurrent(operation), await presentationIsCurrent(operation) {
                if !unresolved, admittedWrites || failure.invoked {
                    await clearSubmittedFields(windowID: windowID, source: sourceDataSourceRef, submitted: submitted)
                }
                await applyMutationWindowState(windowID: windowID, patch: unresolved ? command.indeterminateState : command.errorState)
            }
            let cleanupUnconfirmed = warnings.contains { $0.stage == "cleanup" }
            let message = cleanupUnconfirmed ? "\(failure.message) Cleanup could not be confirmed." : failure.message
            await publishMutationState(
                key,
                MutationCommandState(
                    phase: unresolved ? .indeterminate : .failed, guarded: unresolved, retryAllowed: !unresolved,
                    error: failure.unknown ? nil : failure.message,
                    message: message, invocationId: invocationId, failedStepId: currentStep, writerStatus: writerStatus,
                    warnings: warnings))
            return MutationCommandResult(
                accepted: admittedWrites || failure.invoked, status: failure.status, invocationId: invocationId, failedStepId: currentStep,
                error: failure.unknown ? nil : failure.message, warnings: warnings)
        }
    }

    private func clearSubmittedFields(windowID: String, source: String, submitted: [String: JSONValue]) async {
        guard !submitted.isEmpty else { return }
        let id = WindowIdentity(windowID: windowID).dataSourceID(ref: source)
        let signal = await signals.form(dataSourceID: id)
        if await dataSourceRuntime.clearSubmittedFormFields(dataSourceID: id, submitted: submitted) {
            await signal.clearSubmittedFormFields(submitted)
        }
    }

    private func presentationIsCurrent(_ operation: MutationOperation) async -> Bool {
        guard let id = operation.presentationID else { return true }
        return await operation.dialogSignal?.peek().presentationID == id
    }

    private func operationIsCurrent(_ operation: MutationOperation) async -> Bool {
        guard windows.contains(where: { $0.id == operation.windowID }),
            await windowMetadata(id: operation.windowID)?.authorizationSnapshot == operation.authorization
        else { return false }
        return await dataSourceSelectionState(windowID: operation.windowID, dataSourceRef: operation.source) == operation.selection
    }

    private func scopeFailure(invoked: Bool = false) -> MutationDispatchFailure {
        .init(
            status: invoked ? "superseded" : "invalid_payload", message: "Access or selection changed during the command.", invoked: invoked,
            lostScope: true)
    }

    /// Every terminal, pre-save and compensating write takes this same scoped
    /// preparation, transport lease and invocation-bound receipt path.
    private func dispatchMutationWriter(
        _ command: MutationCommandDef, invocation: String, operation: MutationOperation, extras: [String: JSONValue],
        receipts: [String: JSONValue]?, begin: Bool, child: Bool, compensating: Bool = false
    ) async throws -> [JSONValue]? {
        let windowID = operation.windowID, source = operation.source, target = command.dataSourceRef
        guard await operationIsCurrent(operation) else { throw scopeFailure() }
        guard let scope = await mutationScope(windowID: windowID, source: source), scope.metadata.dataSources[target] != nil else {
            throw MutationDispatchFailure(status: "failed", message: "Command datasource is unavailable: \(target)")
        }
        let ordered = receipts != nil
        func eligible(_ scope: MutationScope) -> Bool {
            var live = scope
            if ordered && !begin {
                for (field, pending) in operation.root.pendingState where live.windowForm[field] == pending {
                    live.windowForm[field] = operation.originalPendingFields[field]
                }
            }
            guard live.allows(operation.root.validateWhen), live.allows(operation.footer?.visibleWhen) else { return false }
            return !(operation.footer?.disabledWhen.map(live.allows) ?? false)
        }
        if !compensating && (begin || ordered) {
            guard await presentationIsCurrent(operation) else { throw scopeFailure() }
            guard eligible(scope) else {
                throw MutationDispatchFailure(status:"invalid_payload", message:"The action is no longer eligible.")
            }
        }
        if child && !scope.allows(command.validateWhen) {
            throw MutationDispatchFailure(status: "invalid", message: command.invalidMessage ?? "This action is not currently valid.")
        }
        let lease = mutationTransportKey(windowID: windowID, dataSourceRef: target)
        guard mutationTransportOwners[lease] == nil else {
            throw MutationDispatchFailure(status: "transport_busy", message: "Another command is using this datasource.")
        }
        mutationTransportOwners[lease] = operation.key
        var retainLease = false
        defer { if !retainLease { mutationTransportOwners.removeValue(forKey: lease) } }
        if begin && command.prepare?.isEmpty == false {
            await publishMutationState(
                operation.key, .init(phase: .preparing, guarded: true, retryAllowed: false, message: "Preparing…", writerStatus: .notInvoked))
        }
        var parameters = try scope.parameters(command: command, extras: extras, stepReceipts: receipts)
        guard await operationIsCurrent(operation) else { throw scopeFailure() }
        if ordered, !compensating, let fresh = await mutationScope(windowID: windowID, source: source) {
            guard await presentationIsCurrent(operation) else { throw scopeFailure() }
            guard eligible(fresh), !child || fresh.allows(command.validateWhen) else {
                throw MutationDispatchFailure(status:"invalid", message: command.invalidMessage ?? "The action is no longer eligible.")
            }
        }
        if let field = command.invocationParameter?.trimmingCharacters(in: .whitespacesAndNewlines), !field.isEmpty {
            parameters[field] = .string(invocation)
        }
        if begin {
            await applyMutationWindowState(windowID: windowID, patch: operation.root.pendingState)
            await publishMutationState(
                operation.key,
                .init(
                    phase: .pending, guarded: true, pending: true, retryAllowed: false, message: "Saving…",
                    invocationId: operation.id, writerStatus: child ? .notInvoked : .pending))
        }
        await setDataSourceInputParameters(windowID: windowID, dataSourceRef: target, parameters: parameters, preservePendingFetch: false)
        guard await operationIsCurrent(operation) else { throw scopeFailure() }
        if !child && !begin {
            await publishMutationState(
                operation.key,
                .init(
                    phase: .pending, guarded: true, pending: true, retryAllowed: false, message: "Saving…", invocationId: operation.id,
                    writerStatus: .pending))
        }
        let outcome = await awaitMutationWriter(
            windowID: windowID, dataSourceRef: target, timeoutMs: max(1_000, command.timeoutMs ?? 30_000),
            requireRecords: child || !command.resultState.isEmpty || receipts != nil, ordered: receipts != nil)
        if case .indeterminate = outcome {
            retainLease = true
            throw MutationDispatchFailure(
                status: "indeterminate",
                message: "The writer outcome is unknown because the client stopped waiting or received no invocation receipt.", invoked: true,
                unknown: true)
        }
        switch outcome {
        case .succeeded(let rows):
            if child, await !operationIsCurrent(operation) { throw scopeFailure(invoked: true) }
            retainLease = !child  // final synchronization still owns its writer's collection.
            return rows
        case .failed(let error):
            guard await operationIsCurrent(operation) else { throw scopeFailure(invoked: true) }
            throw MutationDispatchFailure(status: "failed", message: error, invoked: true)
        case .indeterminate: preconditionFailure("Handled above")
        }
    }

    private func awaitMutationWriter(
        windowID: String, dataSourceRef: String, timeoutMs: Int, requireRecords: Bool = false, ordered: Bool = false
    ) async -> MutationWriterOutcome {
        let race = MutationWriterRace()
        let writer = Task {
            let receipt = await self.refreshDataSourceRows(windowID: windowID, dataSourceRef: dataSourceRef, requireInvocationRecords: ordered)
            switch receipt {
            case .success(let rows): await race.resolve(.succeeded(requireRecords ? rows : nil))
            case .failure(let error):
                let transport = error as NSError
                if (ordered
                    && ((transport.domain == "Forge.DataSource.HTTP" && (transport.code == 408 || (500...599).contains(transport.code)))
                        || error is DecodingError))
                    || error is CancellationError
                    || (transport.domain == NSURLErrorDomain
                        && [NSURLErrorTimedOut, NSURLErrorCancelled, NSURLErrorNetworkConnectionLost].contains(transport.code))
                {
                    await race.resolve(.indeterminate)
                } else {
                    await race.resolve(.failed(error.localizedDescription))
                }
            case nil: await race.resolve(.indeterminate)
            }
        }
        let timeout = Task {
            try? await Task.sleep(for: .milliseconds(timeoutMs))
            if !Task.isCancelled { await race.resolve(.indeterminate) }
        }
        let outcome = await race.wait()
        writer.cancel()
        timeout.cancel()
        return outcome
    }

    private func synchronizeMutationUI(windowID: String, targetDataSourceRef: String, command: MutationCommandDef, authorization: [String: JSONValue]?, receipt: [[String: JSONValue]]?) async -> [MutationCommandWarning] {
        var warnings: [MutationCommandWarning] = []
        if let reconcile = command.reconcile {
            do {
                let destinationRef = reconcile.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines)
                let ref = destinationRef?.isEmpty == false ? destinationRef! : targetDataSourceRef
                if reconcile.mode?.lowercased() == "refetch" {
                    await refreshDataSourceCollection(windowID: windowID, dataSourceRef: ref)
                    if let error = await dataSourceControl(windowID: windowID, dataSourceRef: ref).error {
                        throw MutationRuntimeError.message(error)
                    }
                } else {
                    let current = await dataSourceCollection(windowID: windowID, dataSourceRef: ref)
                    let writerRows = if let receipt { receipt } else { await dataSourceCollection(windowID: windowID, dataSourceRef: targetDataSourceRef) }
                    let incoming = try mutationResultRows(writerRows, path: reconcile.resultPath ?? reconcile.rowsPath)
                    let reconciled = try reconcileMutationRows(current: current, incoming: incoming, spec: reconcile)
                    await setDataSourceCollection(windowID: windowID, dataSourceRef: ref, rows: reconciled)
                }
            } catch {
                warnings.append(MutationCommandWarning(stage: "reconcile", dataSourceRef: reconcile.dataSourceRef, message: error.localizedDescription))
            }
        }
        for refresh in command.refresh {
            guard await windowMetadata(id: windowID)?.authorizationSnapshot == authorization else { break }
            if refresh.clearSelection {
                await setDataSourceSelection(windowID: windowID, dataSourceRef: refresh.dataSourceRef, selected: nil)
            }
            await refreshDataSourceCollection(windowID: windowID, dataSourceRef: refresh.dataSourceRef)
            if let error = await dataSourceControl(windowID: windowID, dataSourceRef: refresh.dataSourceRef).error, !error.isEmpty {
                warnings.append(MutationCommandWarning(stage: "refresh", dataSourceRef: refresh.dataSourceRef, message: error))
            }
        }
        return warnings
    }

    private func mutationScope(windowID: String, source: String) async -> MutationScope? {
        guard let metadata = await windowMetadata(id: windowID) else { return nil }
        return MutationScope(windowKey: metadata.windowKey ?? windows.first(where: { $0.id == windowID })?.key ?? "",
            identity: WindowIdentity(windowID: windowID), source: source, metadata: metadata,
            windowForm: await windowFormJSONValue(windowID: windowID), read: await dataSourceRuntime.snapshotReader())
    }

    public func mutationPredicateAllows(windowID: String, dataSourceRef: String, condition: DashboardConditionDef?) async -> Bool {
        guard let condition else { return true }
        return await mutationScope(windowID: windowID, source: dataSourceRef)?.allows(condition) == true
    }

    public func dialogFooterPresentation(windowID: String, sourceDataSourceRef: String, actions: [ActionDef]) async -> [(visible: Bool, disabled: Bool)] {
        guard let scope = await mutationScope(windowID: windowID, source: sourceDataSourceRef) else { return actions.map { _ in (false,true) } }
        return actions.map { action in
            let visible = scope.allows(action.visibleWhen)
            return (visible, !visible || (action.disabledWhen.map(scope.allows) ?? false) || !scope.allows(action.mutationCommand?.validateWhen))
        }
    }

    private func mutationDataSourceExists(windowID: String, dataSourceRef: String) async -> Bool {
        await windowMetadata(id: windowID)?.dataSources[dataSourceRef] != nil
    }

    private func applyMutationWindowState(windowID: String, patch: [String: JSONValue]) async {
        guard !patch.isEmpty else { return }
        await setWindowFormValue(windowID: windowID, values: patch, bumpPrefillRevision: false)
    }

    private func publishMutationState(_ key: String, _ state: MutationCommandState) async {
        await mutationSignal(key).set(state)
    }
}

private struct MutationScope: Sendable {
    let windowKey: String
    let identity: WindowIdentity
    let source: String
    let metadata: WindowMetadata
    var windowForm: [String: JSONValue]
    let read: @Sendable (String) -> RegisteredDataSourceSnapshot?

    private func snapshot(_ ref: String) -> RegisteredDataSourceSnapshot? {
        guard metadata.dataSources[ref] != nil else { return nil }
        return read(identity.dataSourceID(ref: ref)) ?? RegisteredDataSourceSnapshot(input: .init(), control: .init(),
            form: [:], selection: .init(), collection: nil, metrics: [:])
    }

    func allows(_ condition: DashboardConditionDef?) -> Bool {
        DashboardRuntime.evaluateDashboardCondition(condition, valueForCondition: { node in
            let path = node.field ?? node.selector ?? node.key ?? ""
            let value: JSONValue
            switch (node.source ?? "form").lowercased() {
            case "authorization": value = .object(metadata.authorizationSnapshot)
            case "windowform": value = .object(windowForm)
            default:
                guard let state = snapshot(node.dataSourceRef ?? source) else { return nil }
                switch (node.source ?? "form").lowercased() {
                case "selection", "selectionvalues": value = .object(["selected":state.selection.selected.map(JSONValue.object) ?? .null,
                    "selection":.array(state.selection.selection.map(JSONValue.object)), "rowIndex":.number(Double(state.selection.rowIndex))])
                case "filter", "filters": value = .object(state.input.filter)
                case "input": value = .object(["filter":.object(state.input.filter),"parameters":.object(state.input.parameters),"page":state.input.page.map{.number(Double($0))} ?? .null])
                case "metrics": value = .object(state.metrics)
                case "collection": value = .array((state.collection ?? []).map(JSONValue.object))
                default: value = .object(state.form)
                }
            }
            return resourceResolveValue(value, path: path)?.anyValue
        })
    }

    private func actionState(_ ref: String) -> JSONValue? {
        guard let state = snapshot(ref) else { return nil }
        let input = state.input, selection = state.selection
        return .object([
            "form": .object(state.form), "collection": .array((state.collection ?? []).map(JSONValue.object)),
            "selection": .object(["selected": selection.selected.map(JSONValue.object) ?? .null, "selection": .array(selection.selection.map(JSONValue.object)), "rowIndex": .number(Double(selection.rowIndex))]),
            "input": .object(["parameters": .object(input.parameters), "filter": .object(input.filter), "page": input.page.map { .number(Double($0)) } ?? .null]),
            "pageSize": metadata.dataSources[ref]?.paging?.size.map { .number(Double($0)) } ?? .null,
            "metrics": .object(state.metrics), "dataInfo": .object(state.dataInfo),
            "control": .object(["loaded": .bool(state.collection != nil), "loading": .bool(state.control.loading),
                                "stale": .bool(state.stale), "inactive": .bool(state.control.inactive), "error": state.control.error.map(JSONValue.string) ?? .null])
        ])
    }

    private func invoke(_ name: String, props: [String: JSONValue]) throws -> JSONValue? {
        guard let code = metadata.actions?.code, !code.isEmpty else { throw MutationRuntimeError.message("Action module is unavailable: \(name)") }
        let result = try UIActionProjection.invoke(code: code, function: name, namespace: metadata.actionNamespace(for: name),
            source: source, snapshots: [:], windowForm: windowForm, props: props, authorization: metadata.authorizationSnapshot, windowKey: windowKey,
            aliases: ([metadata.namespace].compactMap { $0 } + (metadata.actionAliases ?? [])), snapshot: { self.actionState($0) })
        guard result.effects.isEmpty else { throw MutationRuntimeError.message("Command preparation cannot apply UI or network effects: \(name)") }
        return result.result ?? (result.returnedValue ? .null : nil)
    }

    func parameters(command: MutationCommandDef, extras: [String: JSONValue], stepReceipts: [String: JSONValue]? = nil) throws -> [String: JSONValue] {
        var parametersExtras = extras
        if stepReceipts != nil { parametersExtras.removeValue(forKey: "steps") }
        var invocationExtras = parametersExtras
        if let stepReceipts { invocationExtras["steps"] = .object(stepReceipts) }
        var context = ParameterResolver.ResolutionContext(identityDataSourceRef: source, windowForm: windowForm, metadata: metadata)
        context.lookup = { ref in
            guard let state = snapshot(ref) else { return nil }
            return .init(selectionMode: metadata.dataSources[ref]?.selectionMode, form: state.form, metrics: state.metrics, selection: state.selection, input: state.input)
        }
        let resolved = ParameterResolver.resolve(parameters: command.parameters, context: context)
        let envelope = resolved[command.dataSourceRef]?.objectValue ?? resolved
        let base = envelope["input"]?.objectValue?["parameters"]?.objectValue ?? envelope["parameters"]?.objectValue ?? envelope
        var prepared = parametersExtras
        if let payload = command.payload {
            var environment = ResourceValueEnvironment(identityDataSourceRef: source, dataSources: [:], windowForm: windowForm, extras: invocationExtras)
            environment.lookup = { ref in
                guard let state = snapshot(ref) else { return nil }
                return .init(form: state.form, collection: state.collection ?? [], selection: state.selection, metrics: state.metrics, input: state.input)
            }
            prepared = try ResourceModelRuntime.prepare(payload: payload, environment: environment, schemas: metadata.schemas, models: metadata.resourceModels) { name, phase, ref, value, baseline in
                if self.metadata.actionNamespace(for: name) == nil {
                    if phase == "beforeMarshalBaseline" { return value }
                    guard let code = self.metadata.actions?.code else { throw MutationRuntimeError.message("Missing action module: \(name)") }
                    return try ActionHookRuntime.invoke(code: code, functionName: name, props: value) ?? value
                }
                func json<T: Encodable>(_ value: T) throws -> JSONValue {
                    try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(value))
                }
                guard let model = metadata.resourceModels[ref], let schema = metadata.schemas[model.schemaRef] else { throw MutationRuntimeError.message("Unknown resource model: \(ref)") }
                let authored = metadata.runtimeAuthoring?.objectValue
                let modelValue = try authored?["resourceModels"]?.objectValue?[ref] ?? json(model)
                let schemaValue = try authored?["schemas"]?.objectValue?[model.schemaRef] ?? json(schema)
                return try invoke(name, props: ["phase": .string(phase), "modelRef": .string(ref), "value": value, "baseline": baseline ?? .null, "model": modelValue, "schema": schemaValue]) ?? value
            }
        }
        let merged = deepMergeMutationValues(base, prepared)
        guard let name = command.prepare, !name.isEmpty else { return merged }
        guard let result = try invoke(name, props: ["parameters": .object(merged), "extras": .object(invocationExtras)])?.objectValue else {
            throw MutationRuntimeError.message("Command preparation must return a parameter map.")
        }
        return result
    }
}

public func resolveMutationConfirmation(command: MutationCommandDef, extras: [String: JSONValue]) -> String {
    guard let spec = command.confirmSelection,
          let values = extras["selectedRows"]?.arrayValue else {
        return command.confirm ?? ""
    }
    let rows = values.compactMap(\.objectValue)
    guard !rows.isEmpty else { return command.confirm ?? "" }
    let count = rows.count
    let maxItems = min(20, max(1, spec.maxItems ?? 5))
    let labelField = spec.labelField ?? "name"
    let identityField = spec.identityField ?? "id"
    var items = rows.prefix(maxItems).map { row -> String in
        let label = resolveMutationSelectionValue(row, selector: labelField)
        let identity = resolveMutationSelectionValue(row, selector: identityField)
        if !label.isEmpty && !identity.isEmpty { return "\(label) (\(identity))" }
        if !label.isEmpty { return label }
        if !identity.isEmpty { return identity }
        return "Unnamed item"
    }
    if count > maxItems { items.append("+\(count - maxItems) more") }
    let action = spec.action?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? spec.action!.trimmingCharacters(in: .whitespacesAndNewlines) : "Confirm"
    let singular = spec.singularLabel?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? spec.singularLabel! : "item"
    let entity = count == 1 ? singular : (spec.pluralLabel?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? spec.pluralLabel! : "\(singular)s")
    let suffix = spec.suffix?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return "\(action) \(count) \(entity): \(items.joined(separator: ", "))?\(suffix.isEmpty ? "" : " \(suffix)")"
}

private func resolveMutationSelectionValue(_ row: [String: JSONValue], selector: String) -> String {
    guard let value = JSONValue(any: SelectorUtil.resolve(row.compactMapValues(\.anyValue), selector: selector)) else { return "" }
    switch value {
    case .string(let value): return value.trimmingCharacters(in: .whitespacesAndNewlines)
    case .number(let value): return value.rounded() == value ? String(Int(value)) : String(value)
    case .bool(let value): return value ? "true" : "false"
    default: return ""
    }
}

private enum MutationRuntimeError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self { case .message(let message): return message }
    }
}

private func mutationCommandKey(windowID: String, command: MutationCommandDef) -> String {
    let id = command.commandId?.trimmingCharacters(in: .whitespacesAndNewlines)
    return "\(windowID)::\((id?.isEmpty == false ? id! : command.dataSourceRef))"
}

private func mutationTransportKey(windowID: String, dataSourceRef: String) -> String {
    "\(windowID)::\(dataSourceRef)"
}

private func deepMergeMutationValues(_ base: [String: JSONValue], _ override: [String: JSONValue]) -> [String: JSONValue] {
    var result = base
    for (key, value) in override {
        if case .object(let left)? = result[key], case .object(let right) = value {
            result[key] = .object(deepMergeMutationValues(left, right))
        } else {
            result[key] = value
        }
    }
    return result
}

private func mutationResultRows(_ rows: [[String: JSONValue]], path: String?) throws -> [[String: JSONValue]] {
    guard let path = path?.trimmingCharacters(in: .whitespacesAndNewlines), !path.isEmpty else { return rows }
    let holder: [String: Any] = ["rows": rows.map { $0.compactMapValues(\.anyValue) }]
    let selected = SelectorUtil.resolve(holder, selector: path)
    if let result = selected as? [[String: Any]] {
        return result.map { $0.compactMapValues(JSONValue.init(any:)) }
    }
    if let result = selected as? [String: Any] {
        return [result.compactMapValues(JSONValue.init(any:))]
    }
    throw MutationRuntimeError.message("Reconciliation result path did not resolve to rows: \(path)")
}

private func reconcileMutationRows(current: [[String: JSONValue]], incoming: [[String: JSONValue]], spec: ReconcileSpec) throws -> [[String: JSONValue]] {
    let mode = spec.mode?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "merge"
    if mode == "replace" { return incoming }
    guard mode == "merge" || mode == "remove" else {
        throw MutationRuntimeError.message("Unsupported reconciliation mode: \(mode)")
    }
    let identities = spec.identityFields.isEmpty ? [spec.identityField ?? "id"] : spec.identityFields
    func key(_ row: [String: JSONValue]) throws -> String {
        try identities.map { field in
            guard let value = row[field], value != .null else {
                throw MutationRuntimeError.message("Reconciliation row is missing identity field: \(field)")
            }
            if case .string(let text) = value, text.isEmpty {
                throw MutationRuntimeError.message("Reconciliation row is missing identity field: \(field)")
            }
            return value.stringValue ?? String(describing: value.anyValue ?? "")
        }.joined(separator: "\u{001f}")
    }
    let incomingKeys = try Set(incoming.map(key))
    if mode == "remove" { return try current.filter { !incomingKeys.contains(try key($0)) } }
    var result = current
    var indexes: [String: Int] = [:]
    for (index, row) in current.enumerated() { indexes[try key(row)] = index }
    for row in incoming {
        let identity = try key(row)
        if let index = indexes[identity] {
            result[index] = deepMergeMutationValues(result[index], row)
        } else {
            indexes[identity] = result.count
            result.append(row)
        }
    }
    return result
}
