import Foundation

private enum MutationReceiptID: Hashable, Sendable {
    case string(Data)
    case number(Double)
}

private func mutationIdentity(_ row: JSONValue, path: [String]?) -> MutationReceiptID? {
    let value: JSONValue
    if let path {
        guard row.objectValue != nil, let nested = resourceResolveValue(row, components: path, strictIndices: true) else { return nil }
        value = nested
    } else {
        value = row
    }
    switch value {
    case .string(let value) where !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty:
        return .string(Data(value.utf8))
    case .number(let value) where value.isFinite && value.rounded(.towardZero) == value && abs(value) <= 9_007_199_254_740_991:
        return .number(value)
    default:
        return nil
    }
}

private func mutationIdentitySet(_ rows: [JSONValue], field: String?) -> Set<MutationReceiptID>? {
    guard !rows.isEmpty else { return nil }
    var ids = Set<MutationReceiptID>()
    let path = field?.components(separatedBy: ".")
    for row in rows {
        guard let id = mutationIdentity(row, path: path), ids.insert(id).inserted else { return nil }
    }
    return ids
}

public enum MutationCommandPhase: String, Codable, Sendable {
    case idle
    case validating
    case confirming
    case preparing
    case cleaningUp = "cleaning_up"
    case pending
    case succeeded
    case failed
    case verificationFailed = "verification_failed"
    case partialFailure = "partial_failure"
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
    case verificationFailed = "verification_failed"
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

public struct MutationGroupMemberOutcome: Codable, Sendable, Equatable {
    public let label: String
    public let status: String
    public let invocationId: String?
    public let rows: [JSONValue]?
    public let error: String?

    public init(label: String, status: String, invocationId: String? = nil, rows: [JSONValue]? = nil, error: String? = nil) {
        self.label = label
        self.status = status
        self.invocationId = invocationId
        self.rows = rows
        self.error = error
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
    public let members: [String: MutationGroupMemberOutcome]?

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
        warnings: [MutationCommandWarning] = [],
        members: [String: MutationGroupMemberOutcome]? = nil
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
        self.members = members
    }
}

public struct MutationCommandResult: Sendable, Equatable {
    public let accepted: Bool
    public let status: String
    public let invocationId: String
    public let failedStepId: String?
    public let error: String?
    public let writerRecords: [JSONValue]?
    public let readbackRows: [[String: JSONValue]]?
    public let warnings: [MutationCommandWarning]
    public let members: [String: MutationGroupMemberOutcome]?

    public init(accepted: Bool, status: String, invocationId: String = "", failedStepId: String? = nil, error: String? = nil, warnings: [MutationCommandWarning] = [], members: [String: MutationGroupMemberOutcome]? = nil, readbackRows: [[String: JSONValue]]? = nil, writerRecords: [JSONValue]? = nil) {
        self.accepted = accepted
        self.status = status
        self.failedStepId = failedStepId
        self.invocationId = invocationId
        self.error = error
        self.writerRecords = writerRecords
        self.readbackRows = readbackRows
        self.warnings = warnings
        self.members = members
    }
}

private enum MutationWriterOutcome: Sendable {
    case notInvoked
    case succeeded([JSONValue]?)
    case failed(String)
    case indeterminate
}

struct MutationOperation: Sendable {
    let key: String
    let id: String
    let windowID: String
    let source: String
    let authorization: [String: JSONValue]?
    let selection: SelectionState
    let root: MutationCommandDef
    let transportRevision: UUID
    let footer: ActionDef?
    let dialogSignal: Signal<DialogState>?
    let presentationID: UUID?
    let dialogID: String?
    let selectionFence: DialogSelectionFence?
    let originalPendingFields: [String: JSONValue]
    let fileFields: Set<String>
    let submittedFiles: [String: FormFileSelection]
    var plainDialogFooter: Bool {
        presentationID != nil && footer?.close == false && root.group == nil && root.before?.isEmpty != false && root.clearFormFields.isEmpty && root.receiptWhen == nil && root.receiptIdentity == nil
    }

}

private struct MutationDispatchFailure: Error {
    let status: String
    let message: String
    var invoked = false
    var lostScope = false
    var unknown = false
}

private struct PreparedMutationWriter: Sendable {
    let parameters: [String: JSONValue]
    let identities: Set<MutationReceiptID>?
    var verification: MutationReadback? = nil
}

fileprivate struct MutationReadbackField: Sendable {
    let path: [String]
    let expected: JSONValue

    func matches(_ row: JSONValue) -> Bool {
        resourceResolveValue(row, components: path, strictIndices: true) == expected
    }
}

fileprivate struct MutationReadbackScopeValue: Equatable, Sendable {
    let raw: JSONValue
    let scalar: JSONValue
}

struct MutationReadback: Sendable {
    let reader: String
    let spec: ReconcileVerificationSpec
    let readerIdentity: [String]
    fileprivate let scopeValues: [MutationReadbackScopeValue]
    fileprivate let scopeChecks: [MutationReadbackField]
    fileprivate let submittedByID: [MutationReceiptID: [MutationReadbackField]]
    fileprivate let generatedSubmission: [MutationReadbackField]?
    fileprivate var acknowledgedIDs: Set<MutationReceiptID> = []
    var readerParameters: [String: JSONValue]
}

private struct MutationWriterReceipt: Sendable {
    let rows: [JSONValue]?
    let verification: MutationReadback?
}

struct AcknowledgedDialogMutation: Sendable {
    let operation: MutationOperation
    let verification: MutationReadback?
    let rows: [JSONValue]?
    let submitted: [String: JSONValue]
    let submittedSuccessFields: [String: JSONValue]
    let dialogID: String?
    var retryable = true
    var verifying = true
}

private struct PreparedMutationGroupMember: Sendable {
    let id: String
    let label: String
    let invocation: String
    let command: MutationCommandDef
    let condition: DashboardConditionDef?
    let input: PreparedMutationWriter
}

private actor MutationRace<Outcome: Sendable> {
    private var outcome: Outcome?
    private var continuation: CheckedContinuation<Outcome, Never>?

    func wait() async -> Outcome {
        if let outcome { return outcome }
        return await withCheckedContinuation { continuation = $0 }
    }

    func resolve(_ next: Outcome) {
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
        guard acknowledgedDialogMutations[key] == nil, let state = await mutationCommandStates[key]?.peek(),
              state.phase == .indeterminate || state.phase == .partialFailure else { return false }
        guardedMutationCommands.remove(key)
        mutationTransportOwners = mutationTransportOwners.filter { $0.value != key }
        mutationSerializationOwners = mutationSerializationOwners.filter { $0.value != key }
        await mutationSignal(key).set(MutationCommandState(message: message))
        return true
    }

    public func activateDialogFooter(windowID: String, dialogID: String, sourceDataSourceRef: String, action: ActionDef,
                                     retryVerificationInvocationId: String? = nil, confirm: (@Sendable (String) async -> Bool)? = nil) async -> MutationCommandResult? {
        if let command = action.footerCommand {
            return await executeMutationCommand(windowID: windowID, sourceDataSourceRef: sourceDataSourceRef, command: command, footer: action, dialogID: dialogID,
                retryVerificationInvocationId: retryVerificationInvocationId, confirm: confirm)
        }
        guard retryVerificationInvocationId == nil, await footerAllows(windowID: windowID, source: sourceDataSourceRef, action: action) else {
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
        retryVerificationInvocationId: String? = nil,
        confirm: (@Sendable (String) async -> Bool)? = nil
    ) async -> MutationCommandResult {
        let targetRef = command.dataSourceRef.trimmingCharacters(in: .whitespacesAndNewlines)
        let key = mutationCommandKey(windowID: windowID, command: command)
        if let acknowledged = acknowledgedDialogMutations[key] {
            let requestedPresentation = dialogID.flatMap { pendingDialogScope("\(windowID)Dialog\($0)").id }
            guard retryVerificationInvocationId.map({ $0 == acknowledged.operation.id }) ?? true,
                  sourceDataSourceRef == acknowledged.operation.source,
                  dialogID == acknowledged.dialogID,
                  requestedPresentation == acknowledged.operation.presentationID else {
                return .init(accepted: false, status: "suppressed")
            }
            guard acknowledged.verification != nil else {
                return .init(accepted: false, status: "suppressed", invocationId: acknowledged.operation.id)
            }
            return await retryMutationReadback(acknowledged)
        }
        guard retryVerificationInvocationId == nil, command.group != nil || !targetRef.isEmpty, !guardedMutationCommands.contains(key) else {
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
        if let error = command.groupValidationError() {
            guardedMutationCommands.remove(key)
            await publishMutationState(key, .init(phase: .failed, error: error, message: error, writerStatus: .notInvoked))
            return .init(accepted: false, status: "invalid_payload", error: error)
        }
        await publishMutationState(key, MutationCommandState(
            phase: .validating, guarded: true, retryAllowed: false,
            message: "Validating…", writerStatus: .notInvoked
        ))

        let dialogSignal = if let dialogID { await signals.dialog(dialogID: "\(windowID)Dialog\(dialogID)") } else { nil as Signal<DialogState>? }
        let originalPresentation = await dialogSignal?.peek().presentationID
        let selectionFence: DialogSelectionFence?
        if command.reconcile?.verify != nil, let dialogID, let originalPresentation {
            let presentation = pendingDialogScope("\(windowID)Dialog\(dialogID)")
            selectionFence = presentation.id == originalPresentation ? presentation.selectionFence : nil
        } else {
            selectionFence = nil
        }
        let admittedMetadata = await windowMetadata(id: windowID)
        let admitted = admittedMetadata?.authorizationSnapshot
        if command.reviewedScope != nil,
           await !reviewIsCurrent(command, windowID: windowID, source: sourceDataSourceRef,
                                  dialogID: dialogID, presentationID: originalPresentation) {
            let message = ReviewedScopeChanged().localizedDescription
            guardedMutationCommands.remove(key)
            await publishMutationState(key, .init(phase: .failed, error: message, message: message, writerStatus: .notInvoked))
            return .init(accepted: false, status: "invalid_payload", error: message)
        }
        let originalSelection = await dataSourceSelectionState(windowID: windowID, dataSourceRef: sourceDataSourceRef)
        var submitted: [String: JSONValue] = [:]
        var submittedSuccessFields: [String: JSONValue] = [:]
        let fileFields = Set(command.clearFormFields).union(command.successFormState.keys)
        var submittedFiles: [String: FormFileSelection] = [:]
        if !fileFields.isEmpty {
            let id = WindowIdentity(windowID: windowID).dataSourceID(ref: sourceDataSourceRef)
            submittedFiles = dataSourceRuntime.fileSelections.snapshot(id, fields: fileFields, presentation: originalPresentation)
            if submittedFiles.values.contains(where: \.reading) {
                let message = "Wait for the selected file to finish loading."
                guardedMutationCommands.remove(key)
                await publishMutationState(key, .init(phase: .failed, error: message, message: message, writerStatus: .notInvoked))
                return .init(accepted: false, status: "invalid_payload", error: message)
            }
            let form = await dataSourceForm(windowID: windowID, dataSourceRef: sourceDataSourceRef)
            for field in command.clearFormFields { submitted[field] = form[field] }
            for field in command.successFormState.keys { submittedSuccessFields[field] = form[field] }
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

        // JSONValue is recursively value-typed, so preparation sees two
        // independent snapshots taken before yielding to confirmation.
        let groupParameters: [String: JSONValue]
        if command.group != nil, !command.parameters.isEmpty,
           let scope = await mutationScope(windowID: windowID, source: sourceDataSourceRef) {
            groupParameters = scope.resolvedParameters(command.parameters, target: command.dataSourceRef)
        } else {
            groupParameters = [:]
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

        let requiredWriters = command.group?.map { $0.command.dataSourceRef } ?? [targetRef]
        let freshMetadata = await windowMetadata(id: windowID)
        if let missing = requiredWriters.first(where: { freshMetadata?.dataSources[$0] == nil }) {
            let message = "Command datasource is unavailable: \(missing)"
            guardedMutationCommands.remove(key)
            await publishMutationState(key, MutationCommandState(
                phase: .failed, error: message, message: message, writerStatus: .notInvoked
            ))
            return MutationCommandResult(accepted: false, status: "failed", error: message)
        }


        let invocationId = UUID().uuidString
        var originalPendingFields: [String: JSONValue] = [:]
        if command.group != nil || command.before?.isEmpty == false, !command.pendingState.isEmpty {
            let original = await windowFormJSONValue(windowID: windowID)
            for field in command.pendingState.keys { originalPendingFields[field] = original[field] }
        }
        let operation = MutationOperation(
            key: key, id: invocationId, windowID: windowID, source: sourceDataSourceRef,
            authorization: admitted, selection: originalSelection, root: command, transportRevision: dataSourceTransportRevision, footer: footer, dialogSignal: dialogSignal,
            presentationID: originalPresentation, dialogID: dialogID, selectionFence: selectionFence, originalPendingFields: originalPendingFields, fileFields: fileFields, submittedFiles: submittedFiles)
        if let members = command.group {
            return await executeMutationGroup(members, operation: operation, parameters: groupParameters, extras: extras, dialogID: dialogID)
        }
        let steps = command.before ?? []
        var receipts: [String: JSONValue] = [:]
        var cleanups: [(id: String, command: MutationCommandDef)] = []
        var admittedWrites = false
        var attemptingFinalWriter = false
        var currentStep: String?
        do {
            if !command.successFormState.isEmpty && (originalPresentation == nil || admittedMetadata?.dataSources[sourceDataSourceRef] == nil) {
                throw MutationDispatchFailure(status: "invalid_payload", message: "successFormState requires a live submitting dialog.")
            }
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
                guard let rows = rows.rows else {
                    throw MutationDispatchFailure(
                        status: "indeterminate", message: "The pre-save writer receipt is unavailable.", invoked: true, unknown: true)
                }
                receipts[id] = .object(["invocationId": .string(childInvocation), "rows": .array(rows)])
                admittedWrites = true
                if let cleanup = step.cleanup { cleanups.append((id, cleanup)) }
            }

            currentStep = nil
            attemptingFinalWriter = true
            let receipt = try await dispatchMutationWriter(
                command, invocation: invocationId, operation: operation, extras: extras, receipts: steps.isEmpty ? nil : receipts,
                begin: !admittedWrites, child: false)
            defer {
                mutationTransportOwners.removeValue(forKey: mutationTransportKey(windowID: windowID, dataSourceRef: targetRef))
                if acknowledgedDialogMutations[key] == nil { guardedMutationCommands.remove(key) }
            }
            if let verification = receipt.verification {
                let acknowledged = AcknowledgedDialogMutation(operation: operation, verification: verification,
                    rows: receipt.rows, submitted: submitted, submittedSuccessFields: submittedSuccessFields, dialogID: dialogID)
                acknowledgedDialogMutations[key] = acknowledged
                return await verifyAcknowledgedMutation(acknowledged)
            }
            return await completeMutation(operation: operation, rows: receipt.rows, submitted: submitted,
                submittedSuccessFields: submittedSuccessFields, dialogID: dialogID)
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
                            let receipt = JSONValue.array(records.rows ?? [])
                            let confirmed = DashboardRuntime.evaluateDashboardCondition(condition, valueForCondition: { node in
                                guard node.source == "collection", let field = node.field else { return nil }
                                return Self.receiptLeafValue(node, value: resourceResolveValue(receipt, path: field))
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
            var heldReview = false
            if !unresolved, !receipts.isEmpty, command.reviewedScope != nil, await !reviewIsCurrent(operation) {
                heldReview = retainReviewedAcknowledgement(operation, dialogID: dialogID, rows: [.object(receipts)])
            }
            defer { if !unresolved && !heldReview { guardedMutationCommands.remove(key) } }
            if !failure.lostScope, await completionIsCurrent(operation) {
                if !unresolved, admittedWrites || failure.invoked {
                    await clearSubmittedFields(windowID: windowID, source: sourceDataSourceRef, submitted: submitted, files: submittedFiles, presentation: operation.presentationID)
                }
                await applyMutationWindowState(windowID: windowID, patch: unresolved ? command.indeterminateState : command.errorState)
            }
            if command.reviewedScope != nil { await finishReviewedPending(operation, stale: await !reviewIsCurrent(operation)) }
            let cleanupUnconfirmed = warnings.contains { $0.stage == "cleanup" }
            let message = cleanupUnconfirmed ? "\(failure.message) Cleanup could not be confirmed." : failure.message
            await publishMutationState(
                key,
                MutationCommandState(
                    phase: unresolved ? .indeterminate : .failed, guarded: unresolved || heldReview, retryAllowed: !unresolved && !heldReview,
                    error: failure.unknown ? nil : failure.message,
                    message: message, invocationId: invocationId, failedStepId: currentStep, writerStatus: writerStatus,
                    warnings: warnings))
            return MutationCommandResult(
                accepted: admittedWrites || failure.invoked, status: failure.status, invocationId: invocationId, failedStepId: currentStep,
                error: failure.unknown ? nil : failure.message, warnings: warnings)
        }
    }

    func releaseAcknowledgedDialogMutations(windowID: String, presentationID: UUID) async {
        let retired = acknowledgedDialogMutations.filter {
            $0.value.operation.windowID == windowID && $0.value.operation.presentationID == presentationID
        }
        for (key, pending) in retired {
            guard acknowledgedDialogMutations[key]?.operation.id == pending.operation.id else { continue }
            acknowledgedDialogMutations.removeValue(forKey: key)
            await publishMutationState(key, .init())
            if !pending.verifying {
                guardedMutationCommands.remove(key)
                mutationSerializationOwners = mutationSerializationOwners.filter { $0.value != key }
            }
        }
    }

    private func mutationReadbackPresentationIsCurrent(_ acknowledged: AcknowledgedDialogMutation) -> Bool {
        guard let dialogID = acknowledged.dialogID else { return true }
        let windowID = acknowledged.operation.windowID
        return pendingDialogScope("\(windowID)Dialog\(dialogID)").id == acknowledged.operation.presentationID
    }

    private func retryMutationReadback(_ acknowledged: AcknowledgedDialogMutation) async -> MutationCommandResult {
        let key = acknowledged.operation.key
        guard let pending = acknowledgedDialogMutations[key], pending.operation.id == acknowledged.operation.id, !pending.verifying else {
            return .init(accepted: false, status: "suppressed")
        }
        guard pending.retryable else {
            return .init(accepted: true, status: "verification_failed", invocationId: pending.operation.id)
        }
        acknowledgedDialogMutations[key]?.verifying = true
        defer {
            if acknowledgedDialogMutations[key] == nil {
                guardedMutationCommands.remove(key)
                mutationSerializationOwners = mutationSerializationOwners.filter { $0.value != key }
            }
        }
        return await verifyAcknowledgedMutation(pending)
    }

    private func mutationReadbackScopeIsCurrent(_ acknowledged: AcknowledgedDialogMutation) async -> Bool {
        let operation = acknowledged.operation
        guard await reviewIsCurrent(operation) else { return false }
        if let fence = operation.selectionFence, await !dataSourceRuntime.dialogSelectionIsCurrent(fence) { return false }
        guard operation.transportRevision == dataSourceTransportRevision,
              mutationReadbackPresentationIsCurrent(acknowledged),
              await presentationIsCurrent(operation),
              let scope = await mutationScope(windowID: operation.windowID, source: operation.source),
              windows.contains(where: { $0.id == operation.windowID }),
              scope.metadata.authorizationSnapshot == operation.authorization,
              (scope.snapshot(operation.source)?.selection ?? .init()) == operation.selection,
              operation.transportRevision == dataSourceTransportRevision,
              mutationReadbackPresentationIsCurrent(acknowledged) else { return false }
        guard let verification = acknowledged.verification else { return false }
        return Self.readbackScopeValues(verification.spec, reader: verification.reader, scope: scope) == verification.scopeValues
    }

    private func verifyAcknowledgedMutation(_ acknowledged: AcknowledgedDialogMutation) async -> MutationCommandResult {
        guard let verification = acknowledged.verification else { return .init(accepted: false, status: "suppressed") }
        let operation = acknowledged.operation
        let invocationId = operation.id
        let current: @Sendable () async -> Bool = {
            guard !Task.isCancelled else { return false }
            return await self.mutationReadbackScopeIsCurrent(acknowledged)
        }

        var issue = "The reader did not confirm the submitted rows."
        if await current() {
            await publishMutationState(operation.key, .init(phase: .pending, guarded: true, pending: true, retryAllowed: false,
                message: "Verifying saved data…", invocationId: invocationId, writerStatus: .succeeded))
            do {
                guard let metadata = await windowMetadata(id: operation.windowID), await current() else { throw scopeFailure(invoked: true) }
                let rows = try await readMutationVerification(operation, metadata: metadata, verification: verification, current: current)
                if await current(), Self.mutationReadbackMatches(rows, verification: verification) {
                    acknowledgedDialogMutations.removeValue(forKey: operation.key)
                    return await completeMutation(operation: operation, rows: acknowledged.rows, submitted: acknowledged.submitted,
                        submittedSuccessFields: acknowledged.submittedSuccessFields, dialogID: acknowledged.dialogID, readbackRows: rows)
                }
            } catch {
                if Task.isCancelled || isForgeCancellationError(error) {
                    issue = "The verification read was cancelled."
                } else if (error as? URLError)?.code == .timedOut {
                    issue = "The verification read timed out."
                } else if (error as NSError).domain == "Forge.DataSource.HTTP" {
                    issue = "The verification reader returned HTTP \((error as NSError).code)."
                } else if let failure = error as? SelectionPreparationError {
                    issue = failure.message
                } else {
                    issue = "The verification reader could not return records."
                }
            }
        } else if Task.isCancelled {
            issue = "The verification read was cancelled."
        }

        let canRetry = await mutationReadbackScopeIsCurrent(acknowledged)
        if !canRetry, operation.root.reviewedScope != nil, await !reviewIsCurrent(operation) {
            await finishReviewedPending(operation, stale: true)
        }
        let message = canRetry ? "Saved. \(issue)" : "Saved. The original verification scope is no longer current."
        if windows.contains(where: { $0.id == operation.windowID }), mutationReadbackPresentationIsCurrent(acknowledged) {
            await publishMutationState(operation.key, .init(phase: .verificationFailed, guarded: true, retryAllowed: canRetry,
                error: message, message: message, invocationId: invocationId, writerStatus: .succeeded, syncStatus: .verificationFailed))
            acknowledgedDialogMutations[operation.key]?.retryable = canRetry
            acknowledgedDialogMutations[operation.key]?.verifying = false
        } else if acknowledgedDialogMutations[operation.key]?.operation.id == invocationId {
            acknowledgedDialogMutations.removeValue(forKey: operation.key)
            await publishMutationState(operation.key, .init())
        }
        return .init(accepted: true, status: "verification_failed", invocationId: invocationId, error: message,
            writerRecords: canRetry ? acknowledged.rows : nil)
    }

    private static func readbackValue(_ value: JSONValue, path: String) -> JSONValue? {
        resourceResolveValue(value, components: path.components(separatedBy: "."), strictIndices: true)
    }

    private func readMutationVerification(_ operation: MutationOperation, metadata: WindowMetadata,
                                          verification: MutationReadback, current: @escaping @Sendable () async -> Bool) async throws -> [[String: JSONValue]] {
        let race = MutationRace<Result<[[String: JSONValue]], Error>>()
        let reader = Task {
            do {
                let rows = try await readPreparedSelection(windowID: operation.windowID, metadata: metadata, ref: verification.reader,
                    parameters: verification.readerParameters, invocationId: UUID().uuidString, useExactParameters: true, current: current)
                await race.resolve(.success(rows))
            } catch {
                await race.resolve(.failure(error))
            }
        }
        let timeout = Task {
            try await Task.sleep(for: .milliseconds(max(1_000, operation.root.timeoutMs ?? 30_000)))
            await race.resolve(.failure(URLError(.timedOut)))
        }
        defer {
            reader.cancel()
            timeout.cancel()
        }
        return try await withTaskCancellationHandler {
            try await race.wait().get()
        } onCancel: {
            Task { await race.resolve(.failure(CancellationError())) }
        }
    }

    private static func readbackScopeScalar(_ value: JSONValue) -> JSONValue? {
        let scalar: JSONValue
        if case .array(let values) = value {
            guard values.count == 1 else { return nil }
            scalar = values[0]
        } else {
            scalar = value
        }
        switch scalar {
        case .bool: return scalar
        case .number(let number) where number.isFinite: return scalar
        case .string(let text) where !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty: return scalar
        default: return nil
        }
    }

    private static func readbackScopeValues(_ verification: ReconcileVerificationSpec, reader: String, scope: MutationScope) -> [MutationReadbackScopeValue]? {
        let context = scope.parameterContext(source: scope.source)
        var values: [MutationReadbackScopeValue] = []
        values.reserveCapacity(verification.scope.count)
        for binding in verification.scope {
            let resolved = ParameterResolver.resolve(parameters: [binding.parameter], context: context, operationBindings: true)
            let inputs = MutationScope.targetParameters(resolved[reader]?.objectValue ?? resolved)
            guard let value = inputs[binding.parameter.name], let scalar = readbackScopeScalar(value) else { return nil }
            values.append(.init(raw: value, scalar: scalar))
        }
        return values
    }

    private static func mutationReadbackMatches(_ rows: [[String: JSONValue]], verification: MutationReadback) -> Bool {
        guard rows.count == verification.acknowledgedIDs.count else { return false }
        var remaining = verification.acknowledgedIDs
        let comparesSubmittedFields = verification.spec.fields?.isEmpty == false
        for record in rows {
            let row = JSONValue.object(record)
            guard let id = mutationIdentity(row, path: verification.readerIdentity), remaining.remove(id) != nil,
                  verification.scopeChecks.allSatisfy({ $0.matches(row) }) else { return false }
            if comparesSubmittedFields {
                guard let submitted = verification.generatedSubmission ?? verification.submittedByID[id],
                      submitted.allSatisfy({ $0.matches(row) }) else { return false }
            }
        }
        return true
    }

    private func prepareMutationReadback(_ command: MutationCommandDef, parameters: [String: JSONValue], scope: MutationScope) throws -> MutationReadback? {
        guard let reconcile = command.reconcile, let spec = reconcile.verify else { return nil }
        let identifier = MutationCommandDef.isPlainID
        func path(_ value: String) -> Bool { value.components(separatedBy: ".").allSatisfy(identifier) }

        let invalid = MutationDispatchFailure(status: "invalid_payload", message: "Verification requires a distinct refetch reader, receipt identities, and valid named scope bindings.")
        guard reconcile.mode == "refetch", let identity = command.receiptIdentity,
              let reader = reconcile.dataSourceRef, reader != command.dataSourceRef, let readerSource = scope.metadata.dataSources[reader],
              identifier(spec.idsParameter), !spec.scope.isEmpty,
              reconcile.identityFields.isEmpty, reconcile.rowsPath == nil, reconcile.resultPath.map(path) ?? true,
              command.refresh.allSatisfy({ $0.dataSourceRef != reader && $0.dataSourceRef != command.dataSourceRef }),
              (command.before ?? []).allSatisfy({ $0.command.dataSourceRef != reader && $0.cleanup?.dataSourceRef != reader }),
              identity.generated == true || spec.submittedRows == nil || spec.submittedRows == identity.submittedRows else { throw invalid }
        let readerMethod = (readerSource.service?.method ?? readerSource.method ?? "GET").trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard ["GET", "POST"].contains(readerMethod) else { throw invalid }
        let readerIdentity = reconcile.identityField ?? identity.field
        guard path(readerIdentity) else { throw invalid }
        var names: Set<String> = [spec.idsParameter]
        var scopeFields: Set<String> = []
        for binding in spec.scope {
            guard path(binding.field), scopeFields.insert(binding.field).inserted,
                  identifier(binding.parameter.name), names.insert(binding.parameter.name).inserted else { throw invalid }
        }

        let fields = (spec.fields ?? [:]).map {
            (submitted: $0.key.components(separatedBy: "."), reader: $0.value.components(separatedBy: "."))
        }
        guard fields.allSatisfy({ $0.submitted.allSatisfy(identifier) && $0.reader.allSatisfy(identifier) }) else { throw invalid }
        func submittedChecks(_ row: JSONValue) -> [MutationReadbackField] {
            fields.compactMap { mapping in
                resourceResolveValue(row, components: mapping.submitted, strictIndices: true).map {
                    MutationReadbackField(path: mapping.reader, expected: $0)
                }
            }
        }
        let submittedPath = spec.submittedRows ?? identity.submittedRows
        let submittedRows: [JSONValue]
        if let submittedPath {
            guard path(submittedPath), let rows = Self.readbackValue(.object(parameters), path: submittedPath)?.arrayValue,
                  !rows.isEmpty, rows.allSatisfy({ $0.objectValue != nil }) else { throw invalid }
            submittedRows = rows
        } else {
            submittedRows = []
        }
        var submittedByID: [MutationReceiptID: [MutationReadbackField]] = [:]
        var generatedSubmission: [MutationReadbackField]?
        if !fields.isEmpty {
            if identity.generated == true {
                guard submittedRows.count == 1 else { throw invalid }
                generatedSubmission = submittedChecks(submittedRows[0])
            } else {
                guard identity.submittedRows != nil else { throw invalid }
                let submittedField = (identity.submittedField ?? identity.field).components(separatedBy: ".")
                for row in submittedRows {
                    guard let id = mutationIdentity(row, path: submittedField),
                          submittedByID.updateValue(submittedChecks(row), forKey: id) == nil else { throw invalid }
                }
            }
        }
        guard let scopeValues = Self.readbackScopeValues(spec, reader: reader, scope: scope) else { throw invalid }
        var readerParameters: [String: JSONValue] = [:]
        let scopeChecks = zip(spec.scope, scopeValues).map { binding, value in
            if binding.passToReader == true { readerParameters[binding.parameter.name] = value.raw }
            return MutationReadbackField(path: binding.field.components(separatedBy: "."), expected: value.scalar)
        }
        return MutationReadback(reader: reader, spec: spec, readerIdentity: readerIdentity.components(separatedBy: "."),
            scopeValues: scopeValues, scopeChecks: scopeChecks, submittedByID: submittedByID, generatedSubmission: generatedSubmission,
            readerParameters: readerParameters)
    }

    /// A receipt whose original presentation is still open must not be replayed if the scope switches back.
    private func retainReviewedAcknowledgement(_ operation: MutationOperation, dialogID: String?, rows: [JSONValue]?) -> Bool {
        guard operation.root.reviewedScope != nil, let id = operation.presentationID, let dialogID,
              pendingDialogScope("\(operation.windowID)Dialog\(dialogID)").id == id else { return false }
        acknowledgedDialogMutations[operation.key] = .init(operation: operation, verification: nil, rows: rows,
            submitted: [:], submittedSuccessFields: [:], dialogID: dialogID, retryable: false, verifying: false)
        return true
    }

    private func completeMutation(operation: MutationOperation, rows: [JSONValue]?, submitted: [String: JSONValue],
                                  submittedSuccessFields: [String: JSONValue], dialogID: String?,
                                  readbackRows: [[String: JSONValue]]? = nil) async -> MutationCommandResult {
        let command = operation.root, windowID = operation.windowID, targetRef = command.dataSourceRef
        let sourceDataSourceRef = operation.source, admitted = operation.authorization, footer = operation.footer
        let key = operation.key, invocationId = operation.id, submittedFiles = operation.submittedFiles
        let steps = command.before ?? []
        var warnings: [MutationCommandWarning] = []
        let formPatch = await applySuccessFormState(operation, dialogID: dialogID, submitted: submittedSuccessFields)
        if await completionIsCurrent(operation) {
            warnings = await synchronizeMutationUI(
                windowID: windowID, targetDataSourceRef: targetRef, command: command, authorization: admitted,
                receipt: steps.isEmpty && command.receiptWhen == nil && command.receiptIdentity == nil ? nil : rows?.compactMap(\.objectValue),
                presentation: operation.root.reviewedScope != nil || operation.plainDialogFooter || command.receiptWhen != nil || command.receiptIdentity != nil ? operation : nil)
        }
        guard await completionIsCurrent(operation) else {
            if command.reconcile?.verify == nil, command.receiptWhen != nil || command.receiptIdentity != nil, await operationIsCurrent(operation), await !presentationIsCurrent(operation) {
                await publishMutationState(key, .init(phase: .succeeded, message: "Completed", invocationId: invocationId, writerStatus: .succeeded, syncStatus: .succeeded))
                return .init(accepted: true, status: "succeeded", invocationId: invocationId)
            }
            let held = retainReviewedAcknowledgement(operation, dialogID: dialogID, rows: rows)
            await finishReviewedPending(operation, stale: true)
            await publishMutationState(
                key,
                MutationCommandState(
                    phase: .succeeded, guarded: held, retryAllowed: !held, message: "Authorization changed after the write.", invocationId: invocationId,
                    writerStatus: .succeeded, syncStatus: .partialFailure))
            return MutationCommandResult(accepted: true, status: "superseded", invocationId: invocationId)
        }
        await finishReviewedPending(operation, stale: false)
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
        await clearSubmittedFields(windowID: windowID, source: sourceDataSourceRef, submitted: submitted, files: submittedFiles, presentation: operation.presentationID)
        await applyMutationWindowState(windowID: windowID, patch: patch)
        var message = "Completed"
        if !warnings.isEmpty {
            message = "Saved. Some related data could not be refreshed."
        } else if formPatch == .conflict, await presentationIsCurrent(operation) {
            message = "Saved the submitted version. Your newer changes are still in the form."
        }
        await publishMutationState(
            key,
            MutationCommandState(
                phase: .succeeded, message: message,
                invocationId: invocationId, writerStatus: .succeeded, syncStatus: warnings.isEmpty ? .succeeded : .partialFailure,
                warnings: warnings))
        if footer?.close == true, let dialogID, let presentationID = operation.presentationID, await operationIsCurrent(operation) {
            await closeDialog(windowID: windowID, dialogID: dialogID, presentationID: presentationID)
        }
        return MutationCommandResult(accepted: true, status: "succeeded", invocationId: invocationId, warnings: warnings,
            readbackRows: readbackRows, writerRecords: readbackRows == nil ? nil : rows)
    }

    private func executeMutationGroup(
        _ members: [MutationGroupMemberDef], operation: MutationOperation, parameters: [String: JSONValue],
        extras: [String: JSONValue], dialogID: String?
    ) async -> MutationCommandResult {
        let root = operation.root
        let windowID = operation.windowID
        func preflightFailure(_ message: String, status: String = "invalid_payload") async -> MutationCommandResult {
            await publishMutationState(operation.key, .init(phase: .failed, error: message, message: message,
                invocationId: operation.id, writerStatus: .notInvoked))
            guardedMutationCommands.remove(operation.key)
            return .init(accepted: false, status: status, invocationId: operation.id, error: message)
        }

        guard !Task.isCancelled, await operationIsCurrent(operation), await presentationIsCurrent(operation),
              let scope = await mutationScope(windowID: windowID, source: operation.source) else {
            return await preflightFailure("The command scope changed.", status: "superseded")
        }
        var outcomes: [String: MutationGroupMemberOutcome] = [:]
        var plans: [PreparedMutationGroupMember] = []
        do {
            let mapped: [String: JSONValue]?
            if let prepare = root.prepare, !prepare.isEmpty {
                let result = try scope.invoke(prepare, props: ["extras": .object(extras), "parameters": .object(parameters)])
                guard let map = result?.objectValue,
                      Set(map.keys).isSubset(of: Set(members.compactMap { $0.command.commandId })),
                      map.values.allSatisfy({ $0.objectValue != nil }) else {
                    return await preflightFailure("Group preparation must return input maps keyed by member command ID.")
                }
                mapped = map
            } else { mapped = nil }

            let base = mapped == nil ? deepMergeMutationValues(parameters, extras) : [:]
            for member in members {
                guard let id = member.command.commandId else { continue }
                let command = member.command
                let label = command.label ?? id
                guard scope.allows(member.when), mapped == nil || mapped?[id] != nil else {
                    outcomes[id] = .init(label: label, status: "skipped")
                    continue
                }
                guard scope.allows(command.validateWhen) else {
                    return await preflightFailure(command.invalidMessage ?? "\(label): This action is not currently valid.", status: "invalid")
                }
                let invocation = UUID().uuidString
                let input = try prepareMutationWriter(
                    command, invocation: invocation, scope: scope, extras: mapped?[id]?.objectValue ?? base, receipts: nil, compensating: false)
                plans.append(.init(id: id, label: label, invocation: invocation, command: command, condition: member.when, input: input))
            }
        } catch {
            return await preflightFailure((error as? MutationDispatchFailure)?.message ?? error.localizedDescription)
        }
        let writers = plans.map { mutationTransportKey(windowID: windowID, dataSourceRef: $0.command.dataSourceRef) }
        if !plans.isEmpty {
            guard !Task.isCancelled, await operationIsCurrent(operation), await presentationIsCurrent(operation) else {
                return await preflightFailure("The command scope changed.", status: "superseded")
            }
            guard writers.allSatisfy({ mutationTransportOwners[$0] == nil }) else {
                return await preflightFailure("Another command is using a group writer.", status: "transport_busy")
            }
            for writer in writers { mutationTransportOwners[writer] = operation.key }
            guard await applyPendingState(operation) else {
                for writer in writers where mutationTransportOwners[writer] == operation.key { mutationTransportOwners.removeValue(forKey: writer) }
                return await preflightFailure("The command scope changed.", status: "superseded")
            }
            await publishMutationState(operation.key, .init(phase: .pending, guarded: true, pending: true, retryAllowed: false,
                message: "Saving…", invocationId: operation.id, writerStatus: .pending, members: outcomes))
        }
        await withTaskGroup(of: (String, MutationGroupMemberOutcome).self) { tasks in
            for plan in plans {
                tasks.addTask { await self.executeMutationGroupMember(plan, operation: operation) }
            }
            for await (id, result) in tasks {
                outcomes[id] = result
                await publishMutationState(operation.key, .init(phase: .pending, guarded: true, pending: true, retryAllowed: false,
                    message: "Saving…", invocationId: operation.id, writerStatus: .pending, members: outcomes))
            }
        }
        for (plan, writer) in zip(plans, writers)
        where outcomes[plan.id]?.status != "indeterminate" && mutationTransportOwners[writer] == operation.key {
            mutationTransportOwners.removeValue(forKey: writer)
        }
        let committed = outcomes.values.filter { $0.status == "succeeded" }.count
        let failed = outcomes.values.contains { $0.status == "failed" }
        let unknown = outcomes.values.contains { $0.status == "indeterminate" }
        let attempted = outcomes.values.contains { $0.invocationId != nil }
        let interrupted = outcomes.values.contains { $0.status == "not_invoked" }

        let partial = committed > 0 && (failed || interrupted)
        let held = partial || unknown
        let succeeded = committed > 0 && !held && !failed && !interrupted
        let status = if unknown { "indeterminate" } else if partial { "partial_failure" }
            else if succeeded { "succeeded" } else if interrupted { "superseded" } else if failed { "failed" } else { "skipped" }
        let phase: MutationCommandPhase = if unknown { .indeterminate } else if partial { .partialFailure }
            else if succeeded { .succeeded } else if status == "skipped" { .idle } else { .failed }
        let message = members.compactMap { member -> String? in
            guard let id = member.command.commandId, let outcome = outcomes[id] else { return nil }
            let summary = switch outcome.status {
            case "succeeded": "completed"
            case "failed": outcome.error ?? "failed"
            case "indeterminate": "verify the outcome"
            case "not_invoked": "not submitted"
            default: "skipped"
            }
            return "\(outcome.label): \(summary)"
        }.joined(separator: "\n")
        let current = await completionIsCurrent(operation)
        if current {
            let patch = if succeeded { root.successState } else if unknown { root.indeterminateState }
                else if failed || partial { root.errorState } else { [:] as [String: JSONValue] }
            await applyMutationWindowState(windowID: windowID, patch: patch)
        }
        let warnings = committed == 0 || (root.reviewedScope != nil && !current) ? [] : await synchronizeMutationUI(
            windowID: windowID, targetDataSourceRef: operation.source, command: root,
            authorization: operation.authorization, receipt: nil, presentation: operation)
        // Clearing the owner's selection is an authorized refresh effect. It
        // cannot invalidate this presentation's terminal state or close.
        let currentPresentation = await operationOwnerIsCurrent(operation) ? await presentationIsCurrent(operation) : false
        if root.reviewedScope != nil { await finishReviewedPending(operation, stale: await !reviewIsCurrent(operation)) }
        let staleReview = root.reviewedScope != nil && !currentPresentation && committed > 0 && !unknown
        let heldReview = staleReview && retainReviewedAcknowledgement(operation, dialogID: dialogID, rows: nil)
        defer { if !held && !heldReview { guardedMutationCommands.remove(operation.key) } }
        await publishMutationState(operation.key, .init(phase: phase, guarded: held || heldReview, retryAllowed: !held && !heldReview,
            error: currentPresentation && failed && !held ? message : nil, message: currentPresentation ? message : "", invocationId: operation.id,
            writerStatus: unknown ? .indeterminate : succeeded ? .succeeded : attempted ? .failed : .notInvoked,
            syncStatus: committed == 0 ? .notStarted : warnings.isEmpty ? .succeeded : .partialFailure, warnings: warnings, members: outcomes))
        if succeeded, currentPresentation, operation.footer?.close == true, let dialogID, let presentationID = operation.presentationID {
            await closeDialog(windowID: windowID, dialogID: dialogID, presentationID: presentationID)
        }
        return .init(accepted: attempted, status: staleReview && succeeded ? "superseded" : status, invocationId: operation.id, error: failed && !held ? message : nil,
            warnings: warnings, members: outcomes)
    }

    private func executeMutationGroupMember(
        _ member: PreparedMutationGroupMember, operation: MutationOperation
    ) async -> (String, MutationGroupMemberOutcome) {
        do {
            let rows = try await dispatchMutationWriter(
                member.command, invocation: member.invocation, operation: operation, extras: [:], receipts: nil,
                begin: false, child: true, memberWhen: member.condition, prepared: member.input)
            return (member.id, .init(label: member.label, status: "succeeded", invocationId: member.invocation, rows: rows.rows))
        } catch {
            let failure = error as? MutationDispatchFailure ?? .init(status: "invalid_payload", message: error.localizedDescription)
            let status = if failure.status == "skipped" { "skipped" } else if failure.lostScope && !failure.invoked { "not_invoked" }
                else if failure.unknown { "indeterminate" } else { "failed" }
            return (member.id, .init(label: member.label, status: status, invocationId: failure.invoked ? member.invocation : nil,
                error: status == "skipped" ? nil : failure.message))
        }
    }

    private func applySuccessFormState(_ operation: MutationOperation, dialogID: String?, submitted: [String: JSONValue]) async -> SubmittedFormPatchDisposition {
        let patch = operation.root.successFormState
        guard !patch.isEmpty, let dialogID, let presentation = operation.presentationID else { return .unchanged }
        let id = WindowIdentity(windowID: operation.windowID).dataSourceID(ref: operation.source)
        let signal = await signals.form(dataSourceID: id)
        let visible = await signal.checkSubmittedFormPatch(submitted: submitted, patch: patch)
        guard await completionIsCurrent(operation), pendingDialogScope("\(operation.windowID)Dialog\(dialogID)").id == presentation else { return .unchanged }
        guard visible != .conflict else { return visible }
        let stored = await dataSourceRuntime.applySubmittedFormPatch(dataSourceID: id, submitted: submitted, patch: patch, files: operation.submittedFiles, guardedFields: operation.fileFields, presentation: presentation)
        guard stored == .apply else { return stored }
        return await signal.applySubmittedFormPatch(submitted: submitted, patch: patch, id: id, files: dataSourceRuntime.fileSelections, original: operation.submittedFiles, guardedFields: operation.fileFields, presentation: presentation)
    }

    private func clearSubmittedFields(windowID: String, source: String, submitted: [String: JSONValue], files: [String: FormFileSelection], presentation: UUID?) async {
        guard !submitted.isEmpty else { return }
        let id = WindowIdentity(windowID: windowID).dataSourceID(ref: source)
        let signal = await signals.form(dataSourceID: id)
        let eligible = await dataSourceRuntime.clearSubmittedFormFields(dataSourceID: id, submitted: submitted, files: files, presentation: presentation)
        if !eligible.isEmpty {
            await signal.clearSubmittedFormFields(eligible, id: id, files: dataSourceRuntime.fileSelections, original: files, presentation: presentation)
        }
    }

    private func presentationIsCurrent(_ operation: MutationOperation) async -> Bool {
        guard let id = operation.presentationID else { return true }
        return await operation.dialogSignal?.peek().presentationID == id
    }

    // The window owns configured state and external readback after an ordinary
    // footer write. A replacement dialog owns its own form and selection.
    private func completionIsCurrent(_ operation: MutationOperation) async -> Bool {
        if operation.plainDialogFooter {
            guard await reviewIsCurrent(operation) else { return false }
            return await windowMetadata(id: operation.windowID)?.authorizationSnapshot == operation.authorization
                && windows.contains(where: { $0.id == operation.windowID })
        }
        guard await operationIsCurrent(operation) else { return false }
        return await presentationIsCurrent(operation)
    }

    private func reviewIsCurrent(_ command: MutationCommandDef, windowID: String, source: String,
                                 dialogID: String?, presentationID: UUID?) async -> Bool {
        guard let dialogID, let presentationID, let scope = await mutationScope(windowID: windowID, source: source) else { return false }
        return admitsDialogReview(key: "\(windowID)Dialog\(dialogID)", presentationID: presentationID, command: command, scope: scope)
    }

    private func reviewIsCurrent(_ operation: MutationOperation) async -> Bool {
        guard operation.root.reviewedScope != nil else { return true }
        return await reviewIsCurrent(operation.root, windowID: operation.windowID, source: operation.source,
                                     dialogID: operation.dialogID, presentationID: operation.presentationID)
    }

    private func operationOwnerIsCurrent(_ operation: MutationOperation) async -> Bool {
        guard await reviewIsCurrent(operation) else { return false }
        guard windows.contains(where: { $0.id == operation.windowID }) else { return false }
        return await windowMetadata(id: operation.windowID)?.authorizationSnapshot == operation.authorization
    }

    private func operationIsCurrent(_ operation: MutationOperation) async -> Bool {
        if let fence = operation.selectionFence, await !dataSourceRuntime.dialogSelectionIsCurrent(fence) { return false }
        if operation.root.reviewedScope != nil {
            guard let dialog = operation.dialogID, let presentation = operation.presentationID,
                  let scope = await mutationScope(windowID: operation.windowID, source: operation.source),
                  scope.metadata.authorizationSnapshot == operation.authorization,
                  (scope.snapshot(operation.source)?.selection ?? .init()) == operation.selection else { return false }
            return admitsDialogReview(key: "\(operation.windowID)Dialog\(dialog)", presentationID: presentation, command: operation.root, scope: scope)
        }
        guard await operationOwnerIsCurrent(operation) else { return false }
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
        receipts: [String: JSONValue]?, begin: Bool, child: Bool, compensating: Bool = false, memberWhen: DashboardConditionDef? = nil, prepared: PreparedMutationWriter? = nil
    ) async throws -> MutationWriterReceipt {
        let windowID = operation.windowID, source = operation.source, target = command.dataSourceRef
        guard (!Task.isCancelled || operation.root.group == nil), await operationIsCurrent(operation) else { throw scopeFailure() }
        guard let scope = await mutationScope(windowID: windowID, source: source), scope.metadata.dataSources[target] != nil else {
            throw MutationDispatchFailure(status: "failed", message: "Command datasource is unavailable: \(target)")
        }
        let grouped = operation.root.group != nil
        let ordered = receipts != nil || grouped
        func eligibilityScope(_ scope: MutationScope) -> MutationScope {
            var live = scope
            if ordered && !begin {
                for (field, pending) in operation.root.pendingState where live.windowForm[field] == pending {
                    live.windowForm[field] = operation.originalPendingFields[field]
                }
            }
            return live
        }
        func eligible(_ scope: MutationScope) -> Bool {
            let live = eligibilityScope(scope)
            guard live.allows(operation.root.validateWhen), live.allows(operation.footer?.visibleWhen) else { return false }
            return !(operation.footer?.disabledWhen.map { live.allows($0) } ?? false)
        }
        if !compensating && (begin || ordered) {
            guard await presentationIsCurrent(operation) else { throw scopeFailure() }
            guard eligible(scope) else {
                throw MutationDispatchFailure(status:"invalid_payload", message:"The action is no longer eligible.")
            }
        }
        let childScope = grouped ? eligibilityScope(scope) : scope
        if grouped, !childScope.allows(memberWhen) { throw MutationDispatchFailure(status: "skipped", message: "") }
        if child && !childScope.allows(command.validateWhen) {
            throw MutationDispatchFailure(status: "invalid", message: command.invalidMessage ?? "This action is not currently valid.")
        }
        let lease = mutationTransportKey(windowID: windowID, dataSourceRef: target)
        guard grouped ? mutationTransportOwners[lease] == operation.key : mutationTransportOwners[lease] == nil else {
            throw MutationDispatchFailure(status: "transport_busy", message: "Another command is using this datasource.")
        }
        if !grouped { mutationTransportOwners[lease] = operation.key }
        var retainLease = false
        defer { if !grouped && !retainLease { mutationTransportOwners.removeValue(forKey: lease) } }
        if begin && command.prepare?.isEmpty == false {
            await publishMutationState(
                operation.key, .init(phase: .preparing, guarded: true, retryAllowed: false, message: "Preparing…", writerStatus: .notInvoked))
        }
        let input = try prepared ?? prepareMutationWriter(
            command, invocation: invocation, scope: scope, extras: extras, receipts: receipts, compensating: compensating)
        guard await operationIsCurrent(operation) else { throw scopeFailure() }
        if ordered, !compensating, let fresh = await mutationScope(windowID: windowID, source: source) {
            guard await presentationIsCurrent(operation) else { throw scopeFailure() }
            let freshChild = grouped ? eligibilityScope(fresh) : fresh
            if grouped, !freshChild.allows(memberWhen) { throw MutationDispatchFailure(status: "skipped", message: "") }
            guard eligible(fresh), !child || freshChild.allows(command.validateWhen) else {
                throw MutationDispatchFailure(status:"invalid", message: command.invalidMessage ?? "The action is no longer eligible.")
            }
        }
        if begin {
            guard await applyPendingState(operation) else { throw scopeFailure() }
            await publishMutationState(
                operation.key,
                .init(
                    phase: .pending, guarded: true, pending: true, retryAllowed: false, message: "Saving…",
                    invocationId: operation.id, writerStatus: child ? .notInvoked : .pending))
        }
        let submittedInput: InputState?
        if operation.root.reviewedScope != nil {
            let id = WindowIdentity(windowID: windowID).dataSourceID(ref: target)
            let signal = await signals.input(dataSourceID: id)
            let captured = await dataSourceRuntime.installInputParameters(dataSourceID: id, parameters: input.parameters, fetch: false, preservePendingFetch: false)
            await signal.set(captured)
            submittedInput = captured
        } else {
            await setDataSourceInputParameters(windowID: windowID, dataSourceRef: target, parameters: input.parameters, preservePendingFetch: false)
            submittedInput = nil
        }
        guard await operationIsCurrent(operation) else { throw scopeFailure() }
        if !child && !begin {
            await publishMutationState(
                operation.key,
                .init(
                    phase: .pending, guarded: true, pending: true, retryAllowed: false, message: "Saving…", invocationId: operation.id,
                    writerStatus: .pending))
        }
        if !compensating && !operation.fileFields.isEmpty {
            let id = WindowIdentity(windowID: windowID).dataSourceID(ref: source)
            guard dataSourceRuntime.fileSelections.snapshot(id, fields: operation.fileFields, presentation: operation.presentationID) == operation.submittedFiles else {
                throw MutationDispatchFailure(status: "invalid_payload", message: "The selected file changed. Review it before saving.")
            }
        }
        let exactReceipt = ordered || (!compensating && (command.receiptWhen != nil || command.receiptIdentity != nil)) || (!child && operation.footer?.close == true)
        if let verification = input.verification {
            guard await presentationIsCurrent(operation), dataSourceTransportRevision == operation.transportRevision,
                  let live = await mutationScope(windowID: windowID, source: source),
                  Self.readbackScopeValues(verification.spec, reader: verification.reader, scope: live) == verification.scopeValues else { throw scopeFailure() }
        }
        if grouped, Task.isCancelled { throw scopeFailure() }
        let admitTransport: (@Sendable () async -> Bool)?
        if operation.root.reviewedScope != nil { admitTransport = { await self.operationIsCurrent(operation) } }
        else { admitTransport = nil }
        let outcome = await awaitMutationWriter(
            windowID: windowID, dataSourceRef: target, timeoutMs: max(1_000, command.timeoutMs ?? 30_000),
            requireRecords: child || !command.resultState.isEmpty || exactReceipt, ordered: exactReceipt,
            guardTransportErrors: exactReceipt || !command.successFormState.isEmpty, groupInvocation: grouped ? invocation : nil, admitTransport: admitTransport, submittedInput: submittedInput)
        if case .indeterminate = outcome {
            retainLease = true
            throw MutationDispatchFailure(
                status: "indeterminate",
                message: "The writer outcome is unknown because the client stopped waiting or received no invocation receipt.", invoked: true,
                unknown: true)
        }
        switch outcome {
        case .notInvoked: throw scopeFailure()
        case .succeeded(let rows):
            if child && !grouped && operation.root.reviewedScope == nil, await !operationIsCurrent(operation) { throw scopeFailure(invoked: true) }
            if !compensating, (command.receiptWhen != nil || command.rejectedWhen != nil),
               let failure = Self.classifyWriterReceipt(rows ?? [], accepted: command.receiptWhen, rejected: command.rejectedWhen) {
                retainLease = failure.unknown
                throw failure
            }
            var verification = input.verification
            if !compensating, let identity = command.receiptIdentity {
                let identityRows = if verification != nil, let path = command.reconcile?.resultPath {
                    rows.flatMap { Self.readbackValue(.array($0), path: path)?.arrayValue }
                } else { rows }
                let actual = identityRows.flatMap { mutationIdentitySet($0, field: identity.field) }
                let valid = identity.generated == true ? (identityRows?.count == 1 && actual?.count == 1) : actual != nil && actual == input.identities
                guard valid else {
                    retainLease = true
                    throw MutationDispatchFailure(status: "indeterminate", message: "The producer did not confirm the requested identities. Verify the outcome before retrying.", invoked: true, unknown: true)
                }
                if var captured = verification, let actual, let identityRows {
                    captured.acknowledgedIDs = actual
                    captured.readerParameters[captured.spec.idsParameter] = .array(identityRows.compactMap { Self.readbackValue($0, path: identity.field) })
                    verification = captured
                }
            }
            retainLease = !child  // final synchronization still owns its writer's collection.
            return .init(rows: rows, verification: verification)
        case .failed(let error):
            if !grouped, await !operationIsCurrent(operation) {
                if operation.root.reviewedScope != nil { throw MutationDispatchFailure(status: "failed", message: error, invoked: true, lostScope: true) }
                throw scopeFailure(invoked: true)
            }
            throw MutationDispatchFailure(status: "failed", message: error, invoked: true)
        case .indeterminate: preconditionFailure("Handled above")
        }
    }

    private func prepareMutationWriter(
        _ command: MutationCommandDef, invocation: String, scope: MutationScope, extras: [String: JSONValue],
        receipts: [String: JSONValue]?, compensating: Bool
    ) throws -> PreparedMutationWriter {
        var parameters = try scope.parameters(command: command, extras: extras, stepReceipts: receipts)
        if let field = command.invocationParameter?.trimmingCharacters(in: .whitespacesAndNewlines), !field.isEmpty {
            parameters[field] = .string(invocation)
        }
        let verification = try compensating ? nil : prepareMutationReadback(command, parameters: parameters, scope: scope)
        guard !compensating, let identity = command.receiptIdentity, identity.generated != true else {
            return .init(parameters: parameters, identities: nil, verification: verification)
        }
        guard let path = identity.submittedRows ?? identity.submittedValues,
              let rows = resourceResolveValue(.object(parameters), components: path.components(separatedBy: "."), strictIndices: true)?.arrayValue,
              let ids = mutationIdentitySet(rows, field: identity.submittedValues == nil ? identity.submittedField ?? identity.field : nil) else {
            throw MutationDispatchFailure(status: "invalid_payload", message: "Submitted receipt identities are missing or invalid.")
        }
        return .init(parameters: parameters, identities: ids, verification: verification)
    }

    private static func classifyWriterReceipt(_ rows: [JSONValue], accepted: DashboardConditionDef?, rejected: DashboardConditionDef?) -> MutationDispatchFailure? {
        let receipt = JSONValue.array(rows)
        var rejection: Bool? = false
        if let rejected { rejection = writerReceiptMatches(rejected, receipt: receipt) }
        if rejection == true {
            let message = rows.first?.objectValue?["message"]?.stringValue
            let reason = message.flatMap { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0 }
            return .init(status: "failed", message: reason ?? "The producer rejected the write.", invoked: true)
        }
        if rejection == false && (accepted == nil || writerReceiptMatches(accepted!, receipt: receipt) == true) { return nil }
        return .init(status: "indeterminate", message: "The producer did not confirm the write. Verify its outcome before retrying.", invoked: true, unknown: true)
    }

    private static func receiptLeafValue(_ node: DashboardConditionDef, value: JSONValue?) -> Any? {
        if node.equals != nil || node.notEquals != nil || !node.inValues.isEmpty { return CanonicalPredicateValue(value: value) }
        return value?.anyValue
    }

    // Only invocation assertions distinguish a missing field from a false comparison.
    // A definitive sibling can resolve an otherwise unknown all/any group.
    private static func writerReceiptMatches(_ condition: DashboardConditionDef, receipt: JSONValue) -> Bool? {
        if let negated = condition.not { return writerReceiptMatches(negated, receipt: receipt).map { !$0 } }
        if !condition.all.isEmpty || !condition.any.isEmpty {
            let any = !condition.any.isEmpty
            var missing = false
            for child in any ? condition.any : condition.all {
                guard let match = writerReceiptMatches(child, receipt: receipt) else { missing = true; continue }
                if match == any { return any }
            }
            return missing ? nil : !any
        }
        guard let path = condition.field ?? condition.selector ?? condition.key else { return nil }
        let parts = path.split(separator: ".")
        guard let first = parts.first, let index = Int(first), let rows = receipt.arrayValue, rows.indices.contains(index),
              rows[index].objectValue != nil, let value = resourceResolveValue(rows[index], components: parts.dropFirst()) else { return nil }
        if condition.writerReceiptBoundCount > 0 {
            guard case .number(let number) = value, number.isFinite else { return nil }
        }
        if condition.writerReceiptOperandCount == 0 { return NativeWidgetContract.truthy(value) }
        return DashboardRuntime.evaluateDashboardCondition(condition, valueForCondition: { node in receiptLeafValue(node, value: value) })
    }

    private func awaitMutationWriter(
        windowID: String, dataSourceRef: String, timeoutMs: Int, requireRecords: Bool, ordered: Bool, guardTransportErrors: Bool, groupInvocation: String?, admitTransport: (@Sendable () async -> Bool)?, submittedInput: InputState?
    ) async -> MutationWriterOutcome {
        let race = MutationRace<MutationWriterOutcome>()
        let writer = Task {
            let receipt = await self.refreshDataSourceRows(windowID: windowID, dataSourceRef: dataSourceRef, requireInvocationRecords: ordered,
                bypassCache: groupInvocation != nil, invocationId: groupInvocation, admitTransport: admitTransport, submittedInput: submittedInput)
            switch receipt {
            case .success(let rows): await race.resolve(.succeeded(requireRecords ? rows : nil))
            case .failure(let error) where error is ReviewedScopeChanged: await race.resolve(.notInvoked)
            case .failure(let error):
                let transport = error as NSError
                if (guardTransportErrors
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
        let outcome = if groupInvocation != nil {
            await withTaskCancellationHandler(operation: { await race.wait() }, onCancel: {
                Task { await race.resolve(.indeterminate) }
            })
        } else { await race.wait() }
        writer.cancel()
        timeout.cancel()
        return outcome
    }

    private func groupSynchronizationIsCurrent(_ operation: MutationOperation, afterClearingSource: Bool) async -> Bool {
        guard await operationOwnerIsCurrent(operation), await presentationIsCurrent(operation) else { return false }
        let expected = afterClearingSource ? SelectionState() : operation.selection
        return await dataSourceSelectionState(windowID: operation.windowID, dataSourceRef: operation.source) == expected
    }

    private func synchronizeMutationUI(windowID: String, targetDataSourceRef: String, command: MutationCommandDef, authorization: [String: JSONValue]?, receipt: [[String: JSONValue]]?, presentation: MutationOperation? = nil) async -> [MutationCommandWarning] {
        var warnings: [MutationCommandWarning] = []
        func originalDialog() async -> Bool {
            guard let presentation else { return true }
            guard await reviewIsCurrent(presentation) else { return false }
            return await presentationIsCurrent(presentation)
        }
        if let reconcile = command.reconcile, reconcile.verify == nil, await originalDialog() {
            do {
                let destinationRef = reconcile.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines)
                let ref = destinationRef?.isEmpty == false ? destinationRef! : targetDataSourceRef
                if reconcile.mode?.lowercased() == "refetch" {
                    if let presentation, presentation.root.reviewedScope != nil {
                        _ = await refreshDataSourceRows(windowID: windowID, dataSourceRef: ref, current: { await self.reviewIsCurrent(presentation) })
                    } else {
                        await refreshDataSourceCollection(windowID: windowID, dataSourceRef: ref)
                    }
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
        var clearedSource = false
        for refresh in command.refresh {
            if let presentation, presentation.root.reviewedScope != nil, await !reviewIsCurrent(presentation) { break }
            if command.group != nil, let presentation {
                let ref = refresh.dataSourceRef
                guard await groupSynchronizationIsCurrent(presentation, afterClearingSource: clearedSource) else {
                    warnings.append(.init(stage: "refresh", dataSourceRef: ref, message: "The original command presentation is no longer current."))
                    break
                }
                if refresh.clearSelection {
                    await setDataSourceSelection(windowID: windowID, dataSourceRef: ref, selected: nil)
                    if ref == presentation.source { clearedSource = true }
                }
                let afterClear = clearedSource
                let receipt = await refreshDataSourceRows(windowID: windowID, dataSourceRef: ref, bypassCache: refresh.bypassCache, current: {
                    await self.groupSynchronizationIsCurrent(presentation, afterClearingSource: afterClear)
                })
                guard await groupSynchronizationIsCurrent(presentation, afterClearingSource: clearedSource) else {
                    warnings.append(.init(stage: "refresh", dataSourceRef: ref, message: "The original command presentation is no longer current."))
                    break
                }
                if case .failure(let error) = receipt {
                    warnings.append(.init(stage: "refresh", dataSourceRef: ref, message: error.localizedDescription))
                }
                continue
            }
            guard await windowMetadata(id: windowID)?.authorizationSnapshot == authorization else { break }
            let original = await originalDialog()
            if !original && (command.receiptWhen != nil || command.receiptIdentity != nil) { break }
            if !original && refresh.dataSourceRef == presentation?.source { continue }
            if refresh.clearSelection && original {
                await setDataSourceSelection(windowID: windowID, dataSourceRef: refresh.dataSourceRef, selected: nil)
            }
            if let presentation, presentation.root.reviewedScope != nil {
                _ = await refreshDataSourceRows(windowID: windowID, dataSourceRef: refresh.dataSourceRef,
                    bypassCache: refresh.bypassCache, current: { await self.reviewIsCurrent(presentation) })
            } else {
                await refreshDataSourceCollection(windowID: windowID, dataSourceRef: refresh.dataSourceRef)
            }
            if let error = await dataSourceControl(windowID: windowID, dataSourceRef: refresh.dataSourceRef).error, !error.isEmpty {
                warnings.append(MutationCommandWarning(stage: "refresh", dataSourceRef: refresh.dataSourceRef, message: error))
            }
        }
        return warnings
    }

    func mutationScope(windowID: String, source: String) async -> MutationScope? {
        guard let metadata = await windowMetadata(id: windowID) else { return nil }
        let read = await dataSourceRuntime.snapshotReader()
        let identity = WindowIdentity(windowID: windowID)
        return MutationScope(windowKey: metadata.windowKey ?? windows.first(where: { $0.id == windowID })?.key ?? "",
            identity: identity, source: source, metadata: metadata,
            windowForm: read(identity.windowFormID())?.form ?? [:], read: read)
    }

    public func mutationPredicateAllows(windowID: String, dataSourceRef: String, condition: DashboardConditionDef?) async -> Bool {
        guard let condition else { return true }
        return await mutationScope(windowID: windowID, source: dataSourceRef)?.allows(condition) == true
    }

    public func dialogFooterPresentation(windowID: String, sourceDataSourceRef: String, actions: [ActionDef]) async -> [(visible: Bool, disabled: Bool)] {
        guard let scope = await mutationScope(windowID: windowID, source: sourceDataSourceRef) else { return actions.map { _ in (false,true) } }
        return actions.map { action in
            let visible = scope.allows(action.visibleWhen)
            return (visible, !visible || (action.disabledWhen.map { scope.allows($0) } ?? false) || !scope.allows(action.mutationCommand?.validateWhen))
        }
    }

    private func applyPendingState(_ operation: MutationOperation) async -> Bool {
        let patch = operation.root.pendingState
        guard !patch.isEmpty else { return true }
        return await updateWindowFormValue(windowID: operation.windowID, values: patch,
            pending: operation.root.reviewedScope == nil ? nil : operation)
    }

    func releaseReviewedPending(_ patch: ReviewedPendingPatch, actor: ReviewedActor, windowID: String, owner: String, presentation: UUID) async {
        let ref = WindowIdentity(windowID: windowID).windowFormID()
        let signal = await signals.form(dataSourceID: ref)
        while pendingDialogScope(owner).id == presentation {
            let current = await dataSourceRuntime.form(dataSourceID: ref)
            let metadata = await windowMetadata(id: windowID)
            let sameActor = metadata.flatMap { ReviewedActor($0.authorizationSnapshot) } == actor
            let next = patch.releasing(from: current, restore: sameActor)
            guard pendingDialogScope(owner).id == presentation else { return }
            if current != next {
                guard await dataSourceRuntime.restoreForm(dataSourceID: ref, ifCurrent: current, previous: next) else { continue }
                guard pendingDialogScope(owner).id == presentation else {
                    _ = await dataSourceRuntime.restoreForm(dataSourceID: ref, ifCurrent: next, previous: current)
                    return
                }
            }
            await signal.releasePending(patch, restore: sameActor)
            return
        }
    }

    private func applyMutationWindowState(windowID: String, patch: [String: JSONValue]) async {
        guard !patch.isEmpty else { return }
        await setWindowFormValue(windowID: windowID, values: patch, bumpPrefillRevision: false)
    }

    private func publishMutationState(_ key: String, _ state: MutationCommandState) async {
        await mutationSignal(key).set(state)
    }
}

private extension RegisteredDataSourceSnapshot {
    var projectedControl: JSONValue {
        .object(["loaded": .bool(collection != nil), "loading": .bool(control.loading),
                 "stale": .bool(stale), "inactive": .bool(control.inactive), "error": control.error.map(JSONValue.string) ?? .null])
    }
}

struct MutationScope: Sendable {
    let windowKey: String
    let identity: WindowIdentity
    let source: String
    let metadata: WindowMetadata
    var windowForm: [String: JSONValue]
    let read: @Sendable (String) -> RegisteredDataSourceSnapshot?

    func snapshot(_ ref: String) -> RegisteredDataSourceSnapshot? {
        guard metadata.dataSources[ref] != nil else { return nil }
        return read(identity.dataSourceID(ref: ref)) ?? RegisteredDataSourceSnapshot(input: .init(), control: .init(),
            form: [:], selection: .init(), collection: nil, metrics: [:])
    }

    func allows(_ condition: DashboardConditionDef?, row: [String: JSONValue]? = nil) -> Bool {
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
                case "control": value = state.projectedControl
                default: value = .object(row ?? state.form)
                }
            }
            return resourceResolveValue(value, path: path)?.anyValue
        })
    }

    func actionState(_ ref: String, includeFetchFlags: Bool = false) -> JSONValue? {
        guard let state = snapshot(ref) else { return nil }
        let input = state.input, selection = state.selection
        var inputState: [String: JSONValue] = ["parameters": .object(input.parameters), "filter": .object(input.filter),
                                               "page": input.page.map { .number(Double($0)) } ?? .null]
        if includeFetchFlags {
            inputState["fetch"] = .bool(input.fetch)
            inputState["refresh"] = .bool(input.refresh)
        }
        return .object([
            "form": .object(state.form), "collection": .array((state.collection ?? []).map(JSONValue.object)),
            "selection": .object(["selected": selection.selected.map(JSONValue.object) ?? .null, "selection": .array(selection.selection.map(JSONValue.object)), "rowIndex": .number(Double(selection.rowIndex))]),
            "input": .object(inputState),
            "pageSize": metadata.dataSources[ref]?.paging?.size.map { .number(Double($0)) } ?? .null,
            "metrics": .object(state.metrics), "dataInfo": .object(state.dataInfo),
            "control": state.projectedControl
        ])
    }

    private func preparationSignal(_ key: String) -> JSONValue? {
        switch key {
        case "authorization": return .object(metadata.authorizationSnapshot)
        case "windowForm": return .object(windowForm)
        default:
            guard let state = snapshot(source) else { return nil }
            switch key {
            case "form": return .object(state.form)
            case "input": return .object(["parameters":.object(state.input.parameters),"filter":.object(state.input.filter),
                                          "page":state.input.page.map{.number(Double($0))} ?? .null])
            case "selection": return .object(["selected":state.selection.selected.map(JSONValue.object) ?? .null,
                                               "selection":.array(state.selection.selection.map(JSONValue.object)),"rowIndex":.number(Double(state.selection.rowIndex))])
            default: return nil
            }
        }
    }

    func invoke(_ name: String, props: [String: JSONValue], selectionPreparation: Bool = false) throws -> JSONValue? {
        guard let code = metadata.actions?.code, !code.isEmpty else { throw MutationRuntimeError.message("Action module is unavailable: \(name)") }
        let result = try UIActionProjection.invoke(code: code, function: name, namespace: metadata.actionNamespace(for: name),
            source: source, snapshots: [:], windowForm: selectionPreparation ? [:] : windowForm, props: props, authorization: selectionPreparation ? [:] : metadata.authorizationSnapshot, windowKey: windowKey,
            aliases: metadata.actionNamespaces, selectionPreparation: selectionPreparation, snapshot: { selectionPreparation ? self.preparationSignal($0) : self.actionState($0) })
        guard result.effects.isEmpty else { throw MutationRuntimeError.message("Command preparation cannot apply UI or network effects: \(name)") }
        return result.result ?? (result.returnedValue ? .null : nil)
    }

    func parameterContext(source ref: String, input: InputState? = nil) -> ParameterResolver.ResolutionContext {
        var context = ParameterResolver.ResolutionContext(identityDataSourceRef: ref, windowForm: windowForm, metadata: metadata)
        context.lookup = { source in
            guard let state = snapshot(source) else { return nil }
            return .init(selectionMode: metadata.dataSources[source]?.selectionMode, form: state.form, metrics: state.metrics, collection: state.collection,
                         selection: state.selection, input: source == ref ? (input ?? state.input) : state.input)
        }
        return context
    }

    func resolvedParameters(_ parameters: [ParameterDef], target: String, operationBindings: Bool = false) -> [String:JSONValue] {
        let context = parameterContext(source: source)
        let resolved = ParameterResolver.resolve(parameters: parameters, context: context, operationBindings: operationBindings)
        return Self.targetParameters(resolved[target]?.objectValue ?? resolved)
    }

    static func targetParameters(_ envelope: [String:JSONValue]) -> [String:JSONValue] {
        envelope["input"]?.objectValue?["parameters"]?.objectValue ?? envelope["parameters"]?.objectValue ?? envelope
    }

    func parameters(command: MutationCommandDef, extras: [String: JSONValue], stepReceipts: [String: JSONValue]? = nil) throws -> [String: JSONValue] {
        var parametersExtras = extras
        if stepReceipts != nil { parametersExtras.removeValue(forKey: "steps") }
        var invocationExtras = parametersExtras
        if let stepReceipts { invocationExtras["steps"] = .object(stepReceipts) }
        let base = resolvedParameters(command.parameters, target:command.dataSourceRef)
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
