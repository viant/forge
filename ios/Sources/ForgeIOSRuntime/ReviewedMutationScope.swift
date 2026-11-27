import Foundation

/// Recorded by the runtime when the dialog presentation is created. Authored
/// input parameters cannot supply this proof.
struct ReviewedActor: Sendable, Equatable {
    let subject: String
    let issuer: JSONValue
    let tenant: JSONValue

    init?(_ authorization: [String: JSONValue]) {
        guard let principal = authorization["principal"]?.objectValue, case .string(let subject) = principal["subject"],
              !subject.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        self.subject = subject
        issuer = principal["issuer"] ?? .null
        tenant = principal["tenantId"] ?? .null
    }

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.subject.utf8.elementsEqual(rhs.subject.utf8) && reviewedEqual(lhs.issuer, rhs.issuer) && reviewedEqual(lhs.tenant, rhs.tenant)
    }
}

struct ReviewedDialogPresentation: Sendable {
    let actor: ReviewedActor
    let plans: [String:[MutationReviewedScopeDef]]
    let values: [String:JSONValue]
    var invalidated = Set<String>()
    var pending: [String: ReviewedPendingPatch] = [:]
    var pendingSequence: UInt64 = 0

    init?(_ plans: [String:[MutationReviewedScopeDef]], authorization: [String:JSONValue], arguments: [String:JSONValue]) {
        guard !plans.isEmpty, let actor = ReviewedActor(authorization) else { return nil }
        self.actor = actor
        self.plans = plans
        var values: [String:JSONValue] = [:]
        for rules in plans.values {
            for rule in rules where values[rule.parameter] == nil {
                values[rule.parameter] = resourceResolveValue(.object(arguments), components: rule.parameterPath, strictIndices: true) ?? .null
            }
        }
        self.values = values
    }
}

/// Only top-level keys actually changed by this pending transition are eligible for release.
struct ReviewedPendingPatch: Sendable {
    var release: Task<Void,Never>?
    let sequence: UInt64
    let previous: [String:JSONValue]
    let applied: [String:JSONValue]

    init(sequence: UInt64, keys: Dictionary<String, JSONValue>.Keys, before: [String:JSONValue], after: [String:JSONValue]) {
        self.sequence = sequence
        var previous: [String:JSONValue] = [:], applied: [String:JSONValue] = [:]
        for key in keys where before[key] != after[key] {
            previous[key] = before[key]
            applied[key] = after[key]
        }
        self.previous = previous
        self.applied = applied
    }

    func releasing(from current: [String:JSONValue], restore: Bool) -> [String:JSONValue] {
        var updated = current
        for (key, pending) in applied where current[key].map({ reviewedEqual($0, pending) }) == true {
            updated[key] = restore ? previous[key] : nil
        }
        return updated
    }
}

struct ReviewedScopeChanged: LocalizedError {
    var errorDescription: String? { "The reviewed scope changed. Reopen the dialog." }
}

private func reviewedEqual(_ lhs: JSONValue, _ rhs: JSONValue) -> Bool {
    switch (lhs, rhs) {
    case let (.string(a), .string(b)): return a.utf8.elementsEqual(b.utf8)
    case let (.array(a), .array(b)): return a.count == b.count && zip(a,b).allSatisfy(reviewedEqual)
    case let (.object(a), .object(b)):
        return a.count == b.count && a.allSatisfy { key, value in
            guard let index = b.index(forKey: key) else { return false }
            let candidate = b[index]
            return candidate.key.utf8.elementsEqual(key.utf8) && reviewedEqual(value, candidate.value)
        }
    default: return lhs == rhs
    }
}

private func reviewedRowValue(_ rows: [[String: JSONValue]], _ path: ArraySlice<String>) -> JSONValue? {
    guard let first = path.first else { return .array(rows.map(JSONValue.object)) }
    guard let index = Int(first), String(index) == first, rows.indices.contains(index) else { return nil }
    return resourceResolveValue(.object(rows[index]), components: path.dropFirst(), strictIndices: true)
}

extension MutationScope {
    func admitsReviewed(_ rules: [MutationReviewedScopeDef], review: ReviewedDialogPresentation) -> Bool {
        guard !rules.isEmpty, review.actor == ReviewedActor(metadata.authorizationSnapshot) else { return false }
        return rules.allSatisfy { rule in
            guard rule.valid, let expected = review.values[rule.parameter],
                  expected != .null, expected.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != true, let live = reviewedValue(rule) else { return false }
            return reviewedEqual(expected, live)
        }
    }

    private func reviewedValue(_ rule: MutationReviewedScopeDef) -> JSONValue? {
        let path = rule.fieldPath[...]
        if rule.source == "windowForm" { return resourceResolveValue(.object(windowForm), components: path, strictIndices: true) }
        guard let ref = rule.dataSourceRef, metadata.dataSources[ref] != nil,
              let source = read(identity.dataSourceID(ref: ref)) else { return nil }
        switch rule.source {
        case "collection": return source.collection.flatMap { reviewedRowValue($0, path) }
        case "metrics": return resourceResolveValue(.object(source.metrics), components: path, strictIndices: true)
        case "selection":
            switch path.first {
            case "selection": return reviewedRowValue(source.selection.selection, path.dropFirst())
            case "selected": return source.selection.selected.flatMap { resourceResolveValue(.object($0), components: path.dropFirst(), strictIndices: true) }
            case "rowIndex" where path.count == 1: return .number(Double(source.selection.rowIndex))
            default: return nil
            }
        default: return nil
        }
    }
}
