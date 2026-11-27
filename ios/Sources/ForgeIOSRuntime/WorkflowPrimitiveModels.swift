import Foundation

struct WriterReceiptCondition: Decodable {
    let value: DashboardConditionDef
    init(from decoder: Decoder) throws { value = try DashboardConditionDef(from: decoder, receipt: true) }
}

extension DashboardConditionDef {
    var writerReceiptBoundCount: Int { [gt,gte,lt,lte].compactMap { $0 }.count }

    var writerReceiptOperandCount: Int {
        let predicates = [equals != nil, notEquals != nil, containsValue != nil, !inValues.isEmpty,
                          exists != nil, matches != nil, empty != nil, notEmpty != nil]
        return predicates.filter { $0 }.count + writerReceiptBoundCount
    }
}

// Platform-neutral metadata contracts from doc/workflow-primitives.md.
// Rendering and authoritative datasource behavior remain owned by the runtime.

public struct MutationReceiptIdentityDef: Codable, Sendable {
    public let field: String
    public let submittedRows: String?
    public let submittedValues: String?
    public let submittedField: String?
    public let generated: Bool?

    public init(field: String, submittedRows: String? = nil, submittedField: String? = nil, generated: Bool? = nil, submittedValues: String? = nil) {
        self.field = field
        self.submittedRows = submittedRows
        self.submittedValues = submittedValues
        self.submittedField = submittedField
        self.generated = generated
    }
}

public struct MutationReviewedScopeDef: Codable, Sendable, Equatable {
    public let parameter: String
    public let source: String
    public let dataSourceRef: String?
    public let field: String
    let parameterPath: [String]
    let fieldPath: [String]
    let valid: Bool

    private enum CodingKeys: String, CodingKey { case parameter, source, dataSourceRef, field }

    public init(parameter: String, source: String, dataSourceRef: String? = nil, field: String) {
        self.parameter = parameter
        self.source = source
        self.dataSourceRef = dataSourceRef
        self.field = field
        parameterPath = parameter.components(separatedBy: ".")
        fieldPath = field.components(separatedBy: ".")
        let sourceValid = source == "windowForm" ? dataSourceRef?.isEmpty != false
            : ["collection", "metrics", "selection"].contains(source) && dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
        valid = sourceValid && parameterPath.allSatisfy(MutationCommandDef.isPlainID) && fieldPath.allSatisfy(MutationCommandDef.isPlainID)
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        try self.init(parameter: values.decode(String.self, forKey: .parameter), source: values.decode(String.self, forKey: .source),
                      dataSourceRef: values.decodeIfPresent(String.self, forKey: .dataSourceRef), field: values.decode(String.self, forKey: .field))
    }
}

public final class MutationCommandDef: Codable, @unchecked Sendable {
    public let serializationGroup: String?
    let beforeValidationError: String?
    public let before: [MutationBeforeStepDef]?
    public let group: [MutationGroupMemberDef]?
    public let commandId: String?
    public let label: String?
    public let icon: String?
    public let hideLabel: Bool
    public let intent: String?
    public let confirm: String?
    public let confirmSelection: SelectionConfirmationDef?
    public let invalidMessage: String?
    public let timeoutMs: Int?
    public let invocationParameter: String?
    public let dataSourceRef: String
    public let parameters: [ParameterDef]
    public let prepare: String?
    public let payload: ResourcePayloadPreparationDef?
    public let validateWhen: DashboardConditionDef?
    public let receiptWhen: DashboardConditionDef?
    public let rejectedWhen: DashboardConditionDef?
    public let receiptIdentity: MutationReceiptIdentityDef?
    public let reviewedScope: [MutationReviewedScopeDef]?
    public let clearFormFields: [String]
    public let cleanupState: [String: JSONValue]
    public let pendingState: [String: JSONValue]
    public let resultState: [String: [String]]
    public let successState: [String: JSONValue]
    public let successFormState: [String: JSONValue]
    public let errorState: [String: JSONValue]
    public let indeterminateState: [String: JSONValue]
    public let reconcile: ReconcileSpec?
    public let refresh: [RefreshSpec]

    public init(
        commandId: String? = nil,
        before: [MutationBeforeStepDef]? = nil,
        group: [MutationGroupMemberDef]? = nil,
        serializationGroup: String? = nil,
        label: String? = nil,
        icon: String? = nil,
        hideLabel: Bool = false,
        intent: String? = nil,
        confirm: String? = nil,
        confirmSelection: SelectionConfirmationDef? = nil,
        invalidMessage: String? = nil,
        timeoutMs: Int? = nil,
        invocationParameter: String? = nil,
        dataSourceRef: String = "",
        parameters: [ParameterDef] = [],
        payload: ResourcePayloadPreparationDef? = nil,
        prepare: String? = nil,
        validateWhen: DashboardConditionDef? = nil,
        receiptWhen: DashboardConditionDef? = nil,
        rejectedWhen: DashboardConditionDef? = nil,
        receiptIdentity: MutationReceiptIdentityDef? = nil,
        reviewedScope: [MutationReviewedScopeDef]? = nil,
        clearFormFields: [String] = [],
        cleanupState: [String: JSONValue] = [:],
        pendingState: [String: JSONValue] = [:],
        successState: [String: JSONValue] = [:],
        successFormState: [String: JSONValue] = [:],
        resultState: [String: [String]] = [:],
        errorState: [String: JSONValue] = [:],
        indeterminateState: [String: JSONValue] = [:],
        reconcile: ReconcileSpec? = nil,
        refresh: [RefreshSpec] = []
    ) {
        self.beforeValidationError = Self.validateBefore(before, root: commandId ?? dataSourceRef, fields: clearFormFields, successFormState: successFormState, receiptWhen: receiptWhen, rejectedWhen: rejectedWhen, receiptIdentity: receiptIdentity)
        self.before = before
        self.group = group
        self.commandId = commandId
        self.serializationGroup = serializationGroup
        self.label = label
        self.icon = icon
        self.hideLabel = hideLabel
        self.intent = intent
        self.confirm = confirm
        self.confirmSelection = confirmSelection
        self.invalidMessage = invalidMessage
        self.timeoutMs = timeoutMs
        self.invocationParameter = invocationParameter
        self.dataSourceRef = dataSourceRef
        self.parameters = parameters
        self.payload = payload
        self.prepare = prepare
        self.validateWhen = validateWhen
        self.receiptWhen = receiptWhen
        self.rejectedWhen = rejectedWhen
        self.reviewedScope = reviewedScope
        self.receiptIdentity = receiptIdentity
        self.clearFormFields = clearFormFields
        self.cleanupState = cleanupState
        self.pendingState = pendingState
        self.resultState = resultState
        self.successState = successState
        self.successFormState = successFormState
        self.errorState = errorState
        self.indeterminateState = indeterminateState
        self.reconcile = reconcile
        self.refresh = refresh
    }

    static func isPlainID(_ name: String) -> Bool {
        !name.isEmpty && name == name.trimmingCharacters(in: .whitespacesAndNewlines)
            && name.rangeOfCharacter(from: CharacterSet(charactersIn: ".:/[]")) == nil
            && !["__proto__", "constructor", "prototype"].contains(name)
    }

    private static func isReceiptCondition(_ condition: DashboardConditionDef) -> Bool {
        if let negated = condition.not { return isReceiptCondition(negated) }
        if !condition.any.isEmpty || !condition.all.isEmpty {
            return (condition.any + condition.all).allSatisfy(isReceiptCondition)
        }
        return condition.source == "collection" && condition.dataSourceRef == nil && condition.field?.isEmpty == false
    }

    private static func writerReceiptError(_ receipt: DashboardConditionDef?, _ rejection: DashboardConditionDef?, _ identity: MutationReceiptIdentityDef?) -> String? {
        if rejection != nil && receipt == nil && identity == nil { return "rejectedWhen requires receiptWhen or receiptIdentity." }
        for rule in [receipt, rejection].compactMap({ $0 }) where !isWriterReceiptCondition(rule) {
            return "Writer receipt conditions may read only their invocation records."
        }
        return nil
    }

    private static func isWriterReceiptCondition(_ node: DashboardConditionDef) -> Bool {
        let selectors = [node.selector, node.field, node.key].compactMap { $0 }
        let groups = [!node.all.isEmpty, !node.any.isEmpty, node.not != nil].filter { $0 }.count
        guard node.validWriterReceiptKeys, node.dataSourceRef == nil, node.whenValue == nil else { return false }
        if groups > 0 {
            guard groups == 1, node.source == nil, selectors.isEmpty,
                  node.whenValue == nil, node.equals == nil, node.notEquals == nil, node.containsValue == nil, node.inValues.isEmpty,
                  node.gt == nil, node.gte == nil, node.lt == nil, node.lte == nil, node.exists == nil, node.matches == nil,
                  node.empty == nil, node.notEmpty == nil else { return false }
            if let negated = node.not { return isWriterReceiptCondition(negated) }
            return (node.all + node.any).allSatisfy(isWriterReceiptCondition)
        }
        let operands = node.writerReceiptOperandCount
        guard node.source == "collection", selectors.count == 1, operands <= 1 || operands == node.writerReceiptBoundCount else { return false }
        let scalars = [node.equals, node.notEquals, node.containsValue].compactMap { $0 } + node.inValues
        guard scalars.allSatisfy({ $0.objectValue == nil && $0.arrayValue == nil }) else { return false }
        let parts = selectors[0].components(separatedBy: ".")
        return UInt32(parts[0]).map(String.init) == parts[0] && parts.dropFirst().allSatisfy(isPlainID)
    }

    private static func identityError(_ identity: MutationReceiptIdentityDef?) -> String? {
        guard let identity else { return nil }
        func safe(_ path: String) -> Bool { !path.isEmpty && path.components(separatedBy: ".").allSatisfy(isPlainID) }
        guard safe(identity.field), identity.submittedField.map(safe) ?? true else { return "receiptIdentity requires safe field paths." }
        if identity.generated == true {
            guard identity.submittedRows == nil, identity.submittedValues == nil, identity.submittedField == nil else {
                return "Generated receiptIdentity cannot specify submitted values, rows or field."
            }
        } else if let values = identity.submittedValues {
            guard safe(values), identity.submittedRows == nil, identity.submittedField == nil else {
                return "receiptIdentity submittedValues cannot be combined with submittedRows or submittedField."
            }
        } else {
            guard let rows = identity.submittedRows, safe(rows) else { return "receiptIdentity requires submittedRows, submittedValues or generated: true." }
        }
        return nil
    }

    private static func validateBefore(_ steps: [MutationBeforeStepDef]?, root: String, fields: [String], successFormState: [String: JSONValue], receiptWhen: DashboardConditionDef?, rejectedWhen: DashboardConditionDef?, receiptIdentity: MutationReceiptIdentityDef?) -> String? {
        var seen = Set<String>()
        for field in fields where !isPlainID(field) || !seen.insert(field).inserted {
            return "Fields cleared by a command must be distinct, top-level names."
        }
        for field in successFormState.keys {
            guard isPlainID(field) else { return "successFormState requires top-level form field names." }
            guard !seen.contains(field) else { return "successFormState and clearFormFields cannot target the same field." }
        }
        if let error = writerReceiptError(receiptWhen, rejectedWhen, receiptIdentity) { return error }
        if let error = identityError(receiptIdentity) { return error }
        guard let steps else { return nil }
        var ids = Set([root])
        for step in steps {
            if step.command.reviewedScope != nil || step.cleanup?.reviewedScope != nil { return "Only a root dialog command can declare reviewedScope." }
            if let error = writerReceiptError(step.command.receiptWhen, step.command.rejectedWhen, step.command.receiptIdentity) { return error }
            if let error = identityError(step.command.receiptIdentity) { return error }
            if step.cleanup?.receiptIdentity != nil { return "Cleanup commands do not support receiptIdentity." }
            if step.cleanup?.rejectedWhen != nil { return "Cleanup commands do not support rejectedWhen." }
            if let condition = step.cleanup?.receiptWhen, !isReceiptCondition(condition) { return "Cleanup conditions may read only their invocation records." }
            for child in [step.command, step.cleanup].compactMap({ $0 }) {
                guard let id = child.commandId, isPlainID(id), ids.insert(id).inserted,
                      !child.dataSourceRef.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                    return "Pre-save and cleanup commands require distinct, plain command IDs and a writer reference."
                }
                guard child.group == nil, child.before?.isEmpty != false, child.confirm?.isEmpty != false, child.confirmSelection == nil,
                      child.serializationGroup?.isEmpty != false, child.reconcile == nil, child.refresh.isEmpty,
                      child.pendingState.isEmpty, child.successState.isEmpty, child.successFormState.isEmpty, child.resultState.isEmpty, child.errorState.isEmpty,
                      child.clearFormFields.isEmpty, child.cleanupState.isEmpty, child.indeterminateState.isEmpty else {
                    return "The root command owns confirmation, sequencing and UI synchronization."
                }
            }
        }
        return nil
    }

    func groupValidationError() -> String? {
        guard let group else { return nil }
        guard !group.isEmpty, let commandId, Self.isPlainID(commandId) else {
            return "A command group requires a plain command ID and at least one member."
        }
        guard dataSourceRef.isEmpty, before == nil, payload == nil,
              invocationParameter == nil, receiptWhen == nil, rejectedWhen == nil, receiptIdentity == nil,
              resultState.isEmpty, reconcile == nil, cleanupState.isEmpty, clearFormFields.isEmpty, successFormState.isEmpty else {
            return "A command group cannot own a writer, receipt, cleanup, result mapping or form synchronization."
        }
        var ids: Set<String> = [commandId]
        var writers = Set<String>()
        for member in group {
            let child = member.command
            let writer = child.dataSourceRef.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let id = child.commandId, Self.isPlainID(id), ids.insert(id).inserted,
                  !writer.isEmpty, writer == child.dataSourceRef, writers.insert(writer).inserted else {
                return "Command group members require distinct plain command IDs and writer references."
            }
            guard child.group == nil, child.before == nil, child.confirm == nil, child.confirmSelection == nil,
                  child.serializationGroup == nil, child.reconcile == nil, child.refresh.isEmpty,
                  child.pendingState.isEmpty, child.successState.isEmpty, child.successFormState.isEmpty,
                  child.resultState.isEmpty, child.errorState.isEmpty, child.clearFormFields.isEmpty,
                  child.cleanupState.isEmpty, child.indeterminateState.isEmpty else {
                return "The command group owns confirmation and UI synchronization."
            }
            if child.reviewedScope != nil { return "Only a root dialog command can declare reviewedScope." }
            if let error = child.beforeValidationError { return error }
        }
        var refreshed = Set<String>()
        for target in refresh {
            let ref = target.dataSourceRef
            guard !ref.isEmpty, ref == ref.trimmingCharacters(in: .whitespacesAndNewlines),
                  !writers.contains(ref), refreshed.insert(ref).inserted else {
                return "A command group must refresh distinct reader datasources."
            }
        }
        return nil
    }

    private enum CodingKeys: String, CodingKey {
        case before, group, commandId, serializationGroup, label, icon, hideLabel, intent, confirm, confirmSelection, invalidMessage, timeoutMs
        case invocationParameter, dataSourceRef, parameters, payload, prepare, validateWhen, receiptWhen, rejectedWhen, receiptIdentity, reviewedScope
        case clearFormFields, cleanupState, pendingState, resultState, successState, successFormState, errorState, indeterminateState, reconcile, refresh
    }

    public convenience init(from decoder: Decoder) throws {
        try self.init(from: decoder, cleanup: false)
    }

    fileprivate init(from decoder: Decoder, cleanup: Bool) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        serializationGroup = try values.decodeIfPresent(String.self, forKey: .serializationGroup)
        before = try values.decodeIfPresent([MutationBeforeStepDef].self, forKey: .before)
        group = try values.decodeIfPresent([MutationGroupMemberDef].self, forKey: .group)
        commandId = try values.decodeIfPresent(String.self, forKey: .commandId)
        label = try values.decodeIfPresent(String.self, forKey: .label)
        icon = try values.decodeIfPresent(String.self, forKey: .icon)
        hideLabel = try values.decodeIfPresent(Bool.self, forKey: .hideLabel) ?? false
        intent = try values.decodeIfPresent(String.self, forKey: .intent)
        confirm = try values.decodeIfPresent(String.self, forKey: .confirm)
        confirmSelection = try values.decodeIfPresent(SelectionConfirmationDef.self, forKey: .confirmSelection)
        invalidMessage = try values.decodeIfPresent(String.self, forKey: .invalidMessage)
        timeoutMs = try values.decodeIfPresent(Int.self, forKey: .timeoutMs)
        invocationParameter = try values.decodeIfPresent(String.self, forKey: .invocationParameter)
        dataSourceRef = if group != nil { try values.decodeIfPresent(String.self, forKey: .dataSourceRef) ?? "" }
            else { try values.decode(String.self, forKey: .dataSourceRef) }
        parameters = try values.decodeIfPresent([ParameterDef].self, forKey: .parameters) ?? []
        prepare = try values.decodeIfPresent(String.self, forKey: .prepare)
        payload = try values.decodeIfPresent(ResourcePayloadPreparationDef.self, forKey: .payload)
        validateWhen = try values.decodeIfPresent(DashboardConditionDef.self, forKey: .validateWhen)
        receiptWhen = cleanup ? try values.decodeIfPresent(DashboardConditionDef.self, forKey: .receiptWhen)
            : try values.decodeIfPresent(WriterReceiptCondition.self, forKey: .receiptWhen)?.value
        rejectedWhen = try values.decodeIfPresent(WriterReceiptCondition.self, forKey: .rejectedWhen)?.value
        reviewedScope = try values.decodeIfPresent([MutationReviewedScopeDef].self, forKey: .reviewedScope)
        receiptIdentity = try values.decodeIfPresent(MutationReceiptIdentityDef.self, forKey: .receiptIdentity)
        clearFormFields = try values.decodeIfPresent([String].self, forKey: .clearFormFields) ?? []
        cleanupState = try values.decodeIfPresent([String: JSONValue].self, forKey: .cleanupState) ?? [:]
        pendingState = try values.decodeIfPresent([String: JSONValue].self, forKey: .pendingState) ?? [:]
        resultState = try values.decodeIfPresent([String: [String]].self, forKey: .resultState) ?? [:]
        successState = try values.decodeIfPresent([String: JSONValue].self, forKey: .successState) ?? [:]
        successFormState = try values.decodeIfPresent([String: JSONValue].self, forKey: .successFormState) ?? [:]
        errorState = try values.decodeIfPresent([String: JSONValue].self, forKey: .errorState) ?? [:]
        indeterminateState = try values.decodeIfPresent([String: JSONValue].self, forKey: .indeterminateState) ?? [:]
        reconcile = try values.decodeIfPresent(ReconcileSpec.self, forKey: .reconcile)
        refresh = try values.decodeIfPresent([RefreshSpec].self, forKey: .refresh) ?? []
        beforeValidationError = Self.validateBefore(before, root: commandId ?? dataSourceRef, fields: clearFormFields, successFormState: successFormState, receiptWhen: receiptWhen, rejectedWhen: rejectedWhen, receiptIdentity: receiptIdentity)
    }
}

extension ActionDef {
    public var footerCommand: MutationCommandDef? {
        guard let command = mutationCommand else { return nil }
        guard command.commandId?.isEmpty != false, let id, !id.isEmpty else { return command }
        return MutationCommandDef(commandId: id, before: command.before, group: command.group, serializationGroup: command.serializationGroup, label: command.label, icon: command.icon, hideLabel: command.hideLabel, intent: command.intent,
            confirm: command.confirm, confirmSelection: command.confirmSelection, invalidMessage: command.invalidMessage,
            timeoutMs: command.timeoutMs, invocationParameter: command.invocationParameter, dataSourceRef: command.dataSourceRef,
            parameters: command.parameters, payload: command.payload, prepare: command.prepare, validateWhen: command.validateWhen, receiptWhen: command.receiptWhen, rejectedWhen: command.rejectedWhen, receiptIdentity: command.receiptIdentity, reviewedScope: command.reviewedScope,
            clearFormFields: command.clearFormFields, cleanupState: command.cleanupState, pendingState: command.pendingState, successState: command.successState, successFormState: command.successFormState, resultState: command.resultState,
            errorState: command.errorState, indeterminateState: command.indeterminateState, reconcile: command.reconcile, refresh: command.refresh)
    }
}

public struct MutationGroupMemberDef: Codable, Sendable {
    public let when: DashboardConditionDef?
    public let command: MutationCommandDef

    public init(when: DashboardConditionDef? = nil, command: MutationCommandDef) {
        self.when = when
        self.command = command
    }
}

public struct MutationBeforeStepDef: Codable, Sendable {
    public let when: DashboardConditionDef?
    public let command: MutationCommandDef
    public let cleanup: MutationCommandDef?

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        when = try values.decodeIfPresent(DashboardConditionDef.self, forKey: .when)
        command = try values.decode(MutationCommandDef.self, forKey: .command)
        cleanup = try values.contains(.cleanup) && !values.decodeNil(forKey: .cleanup)
            ? try MutationCommandDef(from: values.superDecoder(forKey: .cleanup), cleanup: true) : nil
    }

    public init(when: DashboardConditionDef? = nil, command: MutationCommandDef, cleanup: MutationCommandDef? = nil) {
        self.when = when
        self.command = command
        self.cleanup = cleanup
    }
}

public struct SelectionConfirmationDef: Codable, Sendable {
    public let action: String?
    public let singularLabel: String?
    public let pluralLabel: String?
    public let labelField: String?
    public let identityField: String?
    public let maxItems: Int?
    public let suffix: String?

    public init(action: String? = nil, singularLabel: String? = nil, pluralLabel: String? = nil, labelField: String? = nil, identityField: String? = nil, maxItems: Int? = nil, suffix: String? = nil) {
        self.action = action
        self.singularLabel = singularLabel
        self.pluralLabel = pluralLabel
        self.labelField = labelField
        self.identityField = identityField
        self.maxItems = maxItems
        self.suffix = suffix
    }
}

public struct ReconcileVerificationSpec: Codable, Sendable {
    public struct Scope: Codable, Sendable {
        public let field: String
        public let parameter: ParameterDef
        public let passToReader: Bool?

        public init(field: String, parameter: ParameterDef, passToReader: Bool? = nil) {
            self.field = field
            self.parameter = parameter
            self.passToReader = passToReader
        }
    }

    public let idsParameter: String
    public let scope: [Scope]
    public let fields: [String: String]?
    public let submittedRows: String?

    public init(idsParameter: String, scope: [Scope], fields: [String: String]? = nil, submittedRows: String? = nil) {
        self.idsParameter = idsParameter
        self.scope = scope
        self.fields = fields
        self.submittedRows = submittedRows
    }
}

public struct ReconcileSpec: Codable, Sendable {
    public let mode: String?
    public let dataSourceRef: String?
    public let identityField: String?
    public let identityFields: [String]
    public let resultPath: String?
    public let rowsPath: String?
    public let verify: ReconcileVerificationSpec?

    public init(mode: String? = nil, dataSourceRef: String? = nil, identityField: String? = nil, identityFields: [String] = [], resultPath: String? = nil, rowsPath: String? = nil, verify: ReconcileVerificationSpec? = nil) {
        self.mode = mode
        self.dataSourceRef = dataSourceRef
        self.identityField = identityField
        self.identityFields = identityFields
        self.resultPath = resultPath
        self.rowsPath = rowsPath
        self.verify = verify
    }

    private enum CodingKeys: String, CodingKey { case mode, dataSourceRef, identityField, identityFields, resultPath, rowsPath, verify }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        mode = try values.decodeIfPresent(String.self, forKey: .mode)
        dataSourceRef = try values.decodeIfPresent(String.self, forKey: .dataSourceRef)
        identityField = try values.decodeIfPresent(String.self, forKey: .identityField)
        identityFields = try values.decodeIfPresent([String].self, forKey: .identityFields) ?? []
        resultPath = try values.decodeIfPresent(String.self, forKey: .resultPath)
        rowsPath = try values.decodeIfPresent(String.self, forKey: .rowsPath)
        verify = try values.decodeIfPresent(ReconcileVerificationSpec.self, forKey: .verify)
    }
}

public struct RefreshSpec: Codable, Sendable {
    public let dataSourceRef: String
    public let bypassCache: Bool
    public let clearSelection: Bool

    public init(dataSourceRef: String, bypassCache: Bool = false, clearSelection: Bool = false) {
        self.dataSourceRef = dataSourceRef
        self.bypassCache = bypassCache
        self.clearSelection = clearSelection
    }

    private enum CodingKeys: String, CodingKey { case dataSourceRef, bypassCache, clearSelection }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        dataSourceRef = try values.decode(String.self, forKey: .dataSourceRef)
        bypassCache = try values.decodeIfPresent(Bool.self, forKey: .bypassCache) ?? false
        clearSelection = try values.decodeIfPresent(Bool.self, forKey: .clearSelection) ?? false
    }
}

public struct PrimitiveSelectionSpec: Codable, Sendable {
    public let mode: String?
    public let min: Int?
    public let max: Int?
    public let disabledWhen: DashboardConditionDef?
    public let every: DashboardConditionDef?
    public let any: DashboardConditionDef?
    public let none: DashboardConditionDef?

    public init(mode: String? = nil, min: Int? = nil, max: Int? = nil, disabledWhen: DashboardConditionDef? = nil, every: DashboardConditionDef? = nil, any: DashboardConditionDef? = nil, none: DashboardConditionDef? = nil) {
        self.mode = mode
        self.min = min
        self.max = max
        self.disabledWhen = disabledWhen
        self.every = every
        self.any = any
        self.none = none
    }
}

public final class EditableCollectionSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let identityFields: [String]?
    public let selection: PrimitiveSelectionSpec?
    public let selectionStatus: Bool?
    public let selectionPrompt: String?
    public let operations: [EditableCollectionOperationSpec]?
    public let mutation: MutationCommandDef?

    public init(dataSourceRef: String? = nil, identityFields: [String]? = nil, selection: PrimitiveSelectionSpec? = nil, selectionStatus: Bool? = nil, selectionPrompt: String? = nil, operations: [EditableCollectionOperationSpec]? = nil, mutation: MutationCommandDef? = nil) {
        self.dataSourceRef = dataSourceRef
        self.identityFields = identityFields
        self.selection = selection
        self.selectionStatus = selectionStatus
        self.selectionPrompt = selectionPrompt
        self.operations = operations
        self.mutation = mutation
    }
}

public struct EditableCollectionOperationSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let label: String
    public let tooltip: String?
    public let intent: String?
    public let dialogId: String?
    public let handler: String?
    public let requiresSelection: Bool?
    public let selection: PrimitiveSelectionSpec?
    public let visibleWhen: DashboardConditionDef?
    public let disabledWhen: DashboardConditionDef?
    public let parameters: [ParameterDef]?
    public let prepareSelection: SelectionPreparationDef?
    public let mutation: MutationCommandDef?

    public init(id: String, label: String, tooltip: String? = nil, intent: String? = nil, dialogId: String? = nil, handler: String? = nil, requiresSelection: Bool? = nil, selection: PrimitiveSelectionSpec? = nil, visibleWhen: DashboardConditionDef? = nil, disabledWhen: DashboardConditionDef? = nil, parameters: [ParameterDef]? = nil, mutation: MutationCommandDef? = nil, prepareSelection: SelectionPreparationDef? = nil) {
        self.id = id
        self.label = label
        self.tooltip = tooltip
        self.intent = intent
        self.dialogId = dialogId
        self.handler = handler
        self.requiresSelection = requiresSelection
        self.selection = selection
        self.visibleWhen = visibleWhen
        self.disabledWhen = disabledWhen
        self.parameters = parameters
        self.prepareSelection = prepareSelection
        self.mutation = mutation
    }
}

public final class AssignmentPickerSpec: Codable, @unchecked Sendable {
    public let availableDataSourceRef: String
    public let assignedDataSourceRef: String
    public let identityFields: [String]?
    public let labelField: String?
    public let assign: MutationCommandDef?
    public let unassign: MutationCommandDef?
    public let allowMultiple: Bool?
}

public final class StatusWorkflowSpec: Codable, @unchecked Sendable {
    public let stateField: String
    public let transitions: [StatusWorkflowTransitionSpec]
}

public struct StatusWorkflowTransitionSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let from: [JSONValue]?
    public let to: JSONValue
    public let label: String
    public let confirm: String?
    public let availableWhen: DashboardConditionDef?
    public let command: MutationCommandDef
}

public final class TreeEditorSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let childrenField: String?
    public let identityField: String?
    public let labelField: String?
    public let selectionMode: String?
    public let selectedField: String?
    public let excludedField: String?
    public let searchable: Bool?
    public let collapsible: Bool?
    public let defaultExpandedDepth: Int?
    public let cascade: String?
    public let emptyMessage: String?
    public let mutation: MutationCommandDef?

    public init(dataSourceRef: String? = nil, childrenField: String? = nil, identityField: String? = nil, labelField: String? = nil, selectionMode: String? = nil, selectedField: String? = nil, excludedField: String? = nil, searchable: Bool? = nil, collapsible: Bool? = nil, defaultExpandedDepth: Int? = nil, cascade: String? = nil, emptyMessage: String? = nil, mutation: MutationCommandDef? = nil) {
        self.dataSourceRef = dataSourceRef
        self.childrenField = childrenField
        self.identityField = identityField
        self.labelField = labelField
        self.selectionMode = selectionMode
        self.selectedField = selectedField
        self.excludedField = excludedField
        self.searchable = searchable
        self.collapsible = collapsible
        self.defaultExpandedDepth = defaultExpandedDepth
        self.cascade = cascade
        self.emptyMessage = emptyMessage
        self.mutation = mutation
    }
}

public final class WizardSpec: Codable, @unchecked Sendable {
    public let stateKey: String?
    public let steps: [WizardStepSpec]
    public let submit: MutationCommandDef?
}

public struct WizardStepSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let label: String
    public let containerId: String?
    public let visibleWhen: DashboardConditionDef?
    public let validWhen: DashboardConditionDef?
}

public final class UploadCollectionSpec: Codable, @unchecked Sendable {
    public let accept: [String]?
    public let multiple: Bool?
    public let maxFiles: Int?
    public let maxBytes: Int64?
    public let transport: String?
    public let blobField: String?
    public let metadataField: String?
    public let emptyMessage: String?
    public let upload: MutationCommandDef

    public init(accept: [String]? = nil, multiple: Bool? = nil, maxFiles: Int? = nil, maxBytes: Int64? = nil, transport: String? = nil, blobField: String? = nil, metadataField: String? = nil, emptyMessage: String? = nil, upload: MutationCommandDef) {
        self.accept = accept
        self.multiple = multiple
        self.maxFiles = maxFiles
        self.maxBytes = maxBytes
        self.transport = transport
        self.blobField = blobField
        self.metadataField = metadataField
        self.emptyMessage = emptyMessage
        self.upload = upload
    }
}

public final class DerivedDataSourceSpec: Codable, @unchecked Sendable {
    public let version: String?
    public let maxRows: Int?
    public let sources: [String]
    public let optionalSources: [String]?
    public let pipeline: [DerivedDataStepSpec]
}

public struct DerivedDataStepSpec: Codable, Sendable {
    public let operation: String
    public let source: String?
    public let on: [String]?
    public let fields: [String: JSONValue]?
    public let projections: [DerivedProjectionSpec]?
    public let groupBy: [String]?
    public let measures: [DerivedMeasureSpec]?
    public let joinType: String?
    public let joinCardinality: String?
    public let when: DashboardConditionDef?
    public let orderBy: [JSONValue]?
}

public struct DerivedProjectionSpec: Codable, Sendable {
    public let target: String
    public let source: String?
    public let value: JSONValue?
}

public struct DerivedMeasureSpec: Codable, Sendable {
    public let target: String
    public let source: String?
    public let operation: String
}

public final class PermissionBoundarySpec: Codable, @unchecked Sendable {
    public let mode: String?
    public let dataSourceRef: String?
    public let identityField: String?
    public let capability: String?
    public let visibleWhen: DashboardConditionDef?
    public let deniedMessage: String?

    public init(mode: String? = nil, dataSourceRef: String? = nil, identityField: String? = nil, capability: String? = nil, visibleWhen: DashboardConditionDef? = nil, deniedMessage: String? = nil) {
        self.mode = mode
        self.dataSourceRef = dataSourceRef
        self.identityField = identityField
        self.capability = capability
        self.visibleWhen = visibleWhen
        self.deniedMessage = deniedMessage
    }
}

public final class ResponsiveDataGridSpec: Codable, @unchecked Sendable {
    public let identityColumns: [String]?
    public let breakpoints: [String: ResponsiveDataGridStateSpec]?
}

public struct ResponsiveDataGridStateSpec: Codable, Sendable {
    public let columns: [String]?
    public let stickyColumns: [String]?
    public let columnOverrides: [String: [String: JSONValue]]?
    public let density: String?
    public let rowLayout: String?
    public let readOnlyCards: Bool?
    public let style: [String: JSONValue]?
}

public final class HistoryDiffSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let identityField: String?
    public let beforeField: String?
    public let afterField: String?
    public let ignoreFields: [String]?
    public let fieldLabels: [String: String]?
    public let redactFields: [String]?
    public let arrayStrategy: String?
    public let recordLabelField: String?

    public init(dataSourceRef: String? = nil, identityField: String? = nil, beforeField: String? = nil, afterField: String? = nil, ignoreFields: [String]? = nil, fieldLabels: [String: String]? = nil, redactFields: [String]? = nil, arrayStrategy: String? = nil, recordLabelField: String? = nil) {
        self.dataSourceRef = dataSourceRef
        self.identityField = identityField
        self.beforeField = beforeField
        self.afterField = afterField
        self.ignoreFields = ignoreFields
        self.fieldLabels = fieldLabels
        self.redactFields = redactFields
        self.arrayStrategy = arrayStrategy
        self.recordLabelField = recordLabelField
    }
}

public final class ScheduleEditorSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let startField: String?
    public let endField: String?
    public let timeZoneField: String?
    public let allowOverlap: Bool?
    public let minDuration: String?
    public let allowAdd: Bool?
    public let allowRemove: Bool?
    public let ambiguousTimePolicy: String?
    public let mutation: MutationCommandDef?

    public init(dataSourceRef: String? = nil, startField: String? = nil, endField: String? = nil, timeZoneField: String? = nil, allowOverlap: Bool? = nil, minDuration: String? = nil, allowAdd: Bool? = nil, allowRemove: Bool? = nil, ambiguousTimePolicy: String? = nil, mutation: MutationCommandDef? = nil) {
        self.dataSourceRef = dataSourceRef
        self.startField = startField
        self.endField = endField
        self.timeZoneField = timeZoneField
        self.allowOverlap = allowOverlap
        self.minDuration = minDuration
        self.allowAdd = allowAdd
        self.allowRemove = allowRemove
        self.ambiguousTimePolicy = ambiguousTimePolicy
        self.mutation = mutation
    }
}

public final class DraftFormSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let saveLabel: String?
    public let resetLabel: String?
    public let validWhen: DashboardConditionDef?
    public let dirtyWhen: DashboardConditionDef?
    public let confirmDiscard: String?
    public let onReset: String?
    public let submit: MutationCommandDef?
}

public final class QueryToolbarSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let items: [ItemDef]?
    public let density: String?
    public let layout: String?
}

public final class StableTabsSpec: Codable, @unchecked Sendable {
    public let defaultSelectedTabId: String?
    public let dataSourceFetchMode: String?
    public let appearance: String?
    public let compact: Bool?
    public let keepVisitedTabPanelsMounted: Bool?
    public let renderActiveTabPanelOnly: Bool?
}

public final class ResourceHeaderSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let titleField: String?
    public let subtitleField: String?
    public let fields: [ResourceHeaderFieldSpec]?
    public let actions: [ResourceHeaderActionSpec]?
}

public struct ResourceHeaderFieldSpec: Codable, Sendable {
    public let label: String
    public let field: String
    public let format: String?
}

public struct ResourceHeaderActionSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let label: String?
    public let icon: String?
    public let hideLabel: Bool?
    public let intent: String?
    public let handler: String?
    public let visibleWhen: DashboardConditionDef?
    public let disabledWhen: DashboardConditionDef?
    public let mutation: MutationCommandDef?
}

public final class DataStateBoundarySpec: Codable, @unchecked Sendable {
    public let dataSourceRefs: [String]
    public let allowPartial: Bool
    public let renderEmptyContent: Bool
    public let loadingMessage: String?
    public let emptyMessage: String?
    public let errorMessage: String?
    public let staleMessage: String?
    public let suppressErrorWhen: DashboardConditionDef?
    public let errorAction: DataStateErrorActionSpec?

    public init(
        dataSourceRefs: [String] = [],
        allowPartial: Bool = false,
        renderEmptyContent: Bool = false,
        loadingMessage: String? = nil,
        emptyMessage: String? = nil,
        errorMessage: String? = nil,
        staleMessage: String? = nil,
        suppressErrorWhen: DashboardConditionDef? = nil,
        errorAction: DataStateErrorActionSpec? = nil
    ) {
        self.dataSourceRefs = dataSourceRefs
        self.allowPartial = allowPartial
        self.renderEmptyContent = renderEmptyContent
        self.loadingMessage = loadingMessage
        self.emptyMessage = emptyMessage
        self.errorMessage = errorMessage
        self.staleMessage = staleMessage
        self.suppressErrorWhen = suppressErrorWhen
        self.errorAction = errorAction
    }

    private enum CodingKeys: String, CodingKey { case dataSourceRefs, allowPartial, renderEmptyContent, loadingMessage, emptyMessage, errorMessage, staleMessage, suppressErrorWhen, errorAction }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        dataSourceRefs = try values.decodeIfPresent([String].self, forKey: .dataSourceRefs) ?? []
        allowPartial = try values.decodeIfPresent(Bool.self, forKey: .allowPartial) ?? false
        renderEmptyContent = try values.decodeIfPresent(Bool.self, forKey: .renderEmptyContent) ?? false
        loadingMessage = try values.decodeIfPresent(String.self, forKey: .loadingMessage)
        emptyMessage = try values.decodeIfPresent(String.self, forKey: .emptyMessage)
        errorMessage = try values.decodeIfPresent(String.self, forKey: .errorMessage)
        staleMessage = try values.decodeIfPresent(String.self, forKey: .staleMessage)
        suppressErrorWhen = try values.decodeIfPresent(DashboardConditionDef.self, forKey: .suppressErrorWhen)
        errorAction = try values.decodeIfPresent(DataStateErrorActionSpec.self, forKey: .errorAction)
    }
}

public struct DataStateErrorActionSpec: Codable, Sendable {
    public let label: String?
    public let icon: String?
    public let dataSourceRef: String?
    public let bypassCache: Bool?

    public init(label: String? = nil, icon: String? = nil, dataSourceRef: String? = nil, bypassCache: Bool? = nil) {
        self.label = label
        self.icon = icon
        self.dataSourceRef = dataSourceRef
        self.bypassCache = bypassCache
    }
}

public final class RelationDrillSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let labelField: String?
    public let countField: String?
    public let singularLabel: String?
    public let pluralLabel: String?
    public let emptyText: String?
    public let link: LinkDef?

    public init(
        dataSourceRef: String? = nil,
        labelField: String? = nil,
        countField: String? = nil,
        singularLabel: String? = nil,
        pluralLabel: String? = nil,
        emptyText: String? = nil,
        link: LinkDef? = nil
    ) {
        self.dataSourceRef = dataSourceRef
        self.labelField = labelField
        self.countField = countField
        self.singularLabel = singularLabel
        self.pluralLabel = pluralLabel
        self.emptyText = emptyText
        self.link = link
    }
}

public final class NotificationRulesSpec: Codable, @unchecked Sendable {
    public let rules: [NotificationRuleSpec]

    public init(rules: [NotificationRuleSpec] = []) {
        self.rules = rules
    }

    private enum CodingKeys: String, CodingKey { case rules }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        rules = try values.decodeIfPresent([NotificationRuleSpec].self, forKey: .rules) ?? []
    }
}

public struct NotificationRuleSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let intent: String?
    public let icon: String?
    public let message: String
    public let visibleWhen: DashboardConditionDef?
    public let action: ResourceHeaderActionSpec?

    public init(
        id: String,
        intent: String? = nil,
        icon: String? = nil,
        message: String,
        visibleWhen: DashboardConditionDef? = nil,
        action: ResourceHeaderActionSpec? = nil
    ) {
        self.id = id
        self.intent = intent
        self.icon = icon
        self.message = message
        self.visibleWhen = visibleWhen
        self.action = action
    }
}

public final class MetricSummarySpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let columns: Int?
    public let metrics: [MetricSummaryItemSpec]

    public init(dataSourceRef: String? = nil, columns: Int? = nil, metrics: [MetricSummaryItemSpec] = []) {
        self.dataSourceRef = dataSourceRef
        self.columns = columns
        self.metrics = metrics
    }

    private enum CodingKeys: String, CodingKey { case dataSourceRef, columns, metrics }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        dataSourceRef = try values.decodeIfPresent(String.self, forKey: .dataSourceRef)
        columns = try values.decodeIfPresent(Int.self, forKey: .columns)
        metrics = try values.decodeIfPresent([MetricSummaryItemSpec].self, forKey: .metrics) ?? []
    }
}

public struct MetricSummaryItemSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let label: String
    public let field: String
    public let format: String?
    public let currencyField: String?
    public let comparisonField: String?
    public let comparisonFormat: String?
    public let betterWhen: String?
    public let emptyText: String?

    public init(
        id: String,
        label: String,
        field: String,
        format: String? = nil,
        currencyField: String? = nil,
        comparisonField: String? = nil,
        comparisonFormat: String? = nil,
        betterWhen: String? = nil,
        emptyText: String? = nil
    ) {
        self.id = id
        self.label = label
        self.field = field
        self.format = format
        self.currencyField = currencyField
        self.comparisonField = comparisonField
        self.comparisonFormat = comparisonFormat
        self.betterWhen = betterWhen
        self.emptyText = emptyText
    }
}

public final class DetailViewSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let source: String?
    public let columns: Int?
    public let responsiveColumns: [String: Int]
    public let emptyText: String?
    public let sections: [DetailViewSectionSpec]
    public let fields: [DetailViewFieldSpec]

    public init(
        dataSourceRef: String? = nil,
        source: String? = nil,
        columns: Int? = nil,
        responsiveColumns: [String: Int] = [:],
        emptyText: String? = nil,
        sections: [DetailViewSectionSpec] = [],
        fields: [DetailViewFieldSpec] = []
    ) {
        self.dataSourceRef = dataSourceRef
        self.source = source
        self.columns = columns
        self.responsiveColumns = responsiveColumns
        self.emptyText = emptyText
        self.sections = sections
        self.fields = fields
    }

    private enum CodingKeys: String, CodingKey { case dataSourceRef, source, columns, responsiveColumns, emptyText, sections, fields }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        dataSourceRef = try values.decodeIfPresent(String.self, forKey: .dataSourceRef)
        source = try values.decodeIfPresent(String.self, forKey: .source)
        columns = try values.decodeIfPresent(Int.self, forKey: .columns)
        responsiveColumns = try values.decodeIfPresent([String: Int].self, forKey: .responsiveColumns) ?? [:]
        emptyText = try values.decodeIfPresent(String.self, forKey: .emptyText)
        sections = try values.decodeIfPresent([DetailViewSectionSpec].self, forKey: .sections) ?? []
        fields = try values.decodeIfPresent([DetailViewFieldSpec].self, forKey: .fields) ?? []
    }
}

public struct DetailViewSectionSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let label: String?
    public let description: String?
    public let visibleWhen: DashboardConditionDef?
    public let fields: [DetailViewFieldSpec]

    public init(
        id: String,
        label: String? = nil,
        description: String? = nil,
        visibleWhen: DashboardConditionDef? = nil,
        fields: [DetailViewFieldSpec] = []
    ) {
        self.id = id
        self.label = label
        self.description = description
        self.visibleWhen = visibleWhen
        self.fields = fields
    }

    private enum CodingKeys: String, CodingKey { case id, label, description, visibleWhen, fields }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        label = try values.decodeIfPresent(String.self, forKey: .label)
        description = try values.decodeIfPresent(String.self, forKey: .description)
        visibleWhen = try values.decodeIfPresent(DashboardConditionDef.self, forKey: .visibleWhen)
        fields = try values.decodeIfPresent([DetailViewFieldSpec].self, forKey: .fields) ?? []
    }
}

public struct DetailViewFieldSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let label: String
    public let field: String
    public let format: String?
    public let currencyField: String?
    public let timeZoneField: String?
    public let timeZone: String?
    public let timeZoneSelector: String?
    public let emptyText: String?
    public let span: Int?
    public let copyable: Bool
    public let visibleWhen: DashboardConditionDef?
    public let link: LinkDef?

    public init(
        id: String,
        label: String,
        field: String,
        format: String? = nil,
        currencyField: String? = nil,
        timeZoneField: String? = nil,
        timeZone: String? = nil,
        timeZoneSelector: String? = nil,
        emptyText: String? = nil,
        span: Int? = nil,
        copyable: Bool = false,
        visibleWhen: DashboardConditionDef? = nil,
        link: LinkDef? = nil
    ) {
        self.id = id
        self.label = label
        self.field = field
        self.format = format
        self.currencyField = currencyField
        self.timeZoneField = timeZoneField
        self.timeZone = timeZone
        self.timeZoneSelector = timeZoneSelector
        self.emptyText = emptyText
        self.span = span
        self.copyable = copyable
        self.visibleWhen = visibleWhen
        self.link = link
    }

    private enum CodingKeys: String, CodingKey { case id, label, field, format, currencyField, timeZoneField, timeZone, timeZoneSelector, emptyText, span, copyable, visibleWhen, link }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        label = try values.decode(String.self, forKey: .label)
        field = try values.decode(String.self, forKey: .field)
        format = try values.decodeIfPresent(String.self, forKey: .format)
        currencyField = try values.decodeIfPresent(String.self, forKey: .currencyField)
        timeZoneField = try values.decodeIfPresent(String.self, forKey: .timeZoneField)
        timeZone = try values.decodeIfPresent(String.self, forKey: .timeZone)
        timeZoneSelector = try values.decodeIfPresent(String.self, forKey: .timeZoneSelector)
        emptyText = try values.decodeIfPresent(String.self, forKey: .emptyText)
        span = try values.decodeIfPresent(Int.self, forKey: .span)
        copyable = try values.decodeIfPresent(Bool.self, forKey: .copyable) ?? false
        visibleWhen = try values.decodeIfPresent(DashboardConditionDef.self, forKey: .visibleWhen)
        link = try values.decodeIfPresent(LinkDef.self, forKey: .link)
    }
}

public final class MasterDetailSpec: Codable, @unchecked Sendable {
    public let stateKey: String?
    public let identityFields: [String]
    public let master: MasterDetailRegionSpec
    public let detail: MasterDetailRegionSpec
    public let emptyDetail: MasterDetailEmptySpec?
    public let selectionInvalidation: String?
    public let responsive: [String: String]

    public init(
        stateKey: String? = nil,
        identityFields: [String] = [],
        master: MasterDetailRegionSpec,
        detail: MasterDetailRegionSpec,
        emptyDetail: MasterDetailEmptySpec? = nil,
        selectionInvalidation: String? = nil,
        responsive: [String: String] = [:]
    ) {
        self.stateKey = stateKey
        self.identityFields = identityFields
        self.master = master
        self.detail = detail
        self.emptyDetail = emptyDetail
        self.selectionInvalidation = selectionInvalidation
        self.responsive = responsive
    }

    private enum CodingKeys: String, CodingKey { case stateKey, identityFields, master, detail, emptyDetail, selectionInvalidation, responsive }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        stateKey = try values.decodeIfPresent(String.self, forKey: .stateKey)
        identityFields = try values.decodeIfPresent([String].self, forKey: .identityFields) ?? []
        master = try values.decode(MasterDetailRegionSpec.self, forKey: .master)
        detail = try values.decode(MasterDetailRegionSpec.self, forKey: .detail)
        emptyDetail = try values.decodeIfPresent(MasterDetailEmptySpec.self, forKey: .emptyDetail)
        selectionInvalidation = try values.decodeIfPresent(String.self, forKey: .selectionInvalidation)
        responsive = try values.decodeIfPresent([String: String].self, forKey: .responsive) ?? [:]
    }
}

public struct MasterDetailRegionSpec: Codable, Sendable {
    public let containerId: String
    public let parameters: [String: JSONValue]
    public let allowedWhen: DashboardConditionDef?

    public init(containerId: String, parameters: [String: JSONValue] = [:], allowedWhen: DashboardConditionDef? = nil) {
        self.containerId = containerId
        self.parameters = parameters
        self.allowedWhen = allowedWhen
    }

    private enum CodingKeys: String, CodingKey { case containerId, parameters, allowedWhen }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        containerId = try values.decode(String.self, forKey: .containerId)
        parameters = try values.decodeIfPresent([String: JSONValue].self, forKey: .parameters) ?? [:]
        allowedWhen = try values.decodeIfPresent(DashboardConditionDef.self, forKey: .allowedWhen)
    }
}

public struct MasterDetailEmptySpec: Codable, Sendable {
    public let message: String?

    public init(message: String? = nil) {
        self.message = message
    }
}
