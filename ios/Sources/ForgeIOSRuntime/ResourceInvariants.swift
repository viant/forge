import Foundation

/// A rule over the canonical object being validated. The condition is compiled
/// at schema decode time. Its original JSON preserves explicit null on encoding.
public struct ResourceInvariantCondition: Codable, Sendable {
    private let declaration: JSONValue
    let predicate: DashboardConditionDef
    private struct Operands: Sendable {
        let field: [String]
        var peers: [InvariantNumericBound: [String]] = [:]
    }
    private let selectors: [ObjectIdentifier: Operands]

    public init(from decoder: Decoder) throws {
        declaration = try JSONValue(from: decoder)
        var compiled: [ObjectIdentifier: Operands] = [:]
        predicate = try Self.compile(declaration, selectors: &compiled)
        selectors = compiled
    }

    public func encode(to encoder: Encoder) throws { try declaration.encode(to: encoder) }

    private static func compile(_ declaration: JSONValue, selectors: inout [ObjectIdentifier: Operands]) throws -> DashboardConditionDef {
        let invalid = DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "Invalid canonical resource invariant condition"))
        guard let fields = declaration.objectValue else { throw invalid }
        let groups = ["all", "any", "not"].filter { fields[$0] != nil }
        if let group = groups.first {
            guard fields.count == 1 else { throw invalid }
            if group == "not" { return DashboardConditionDef(not: try compile(fields[group]!, selectors: &selectors)) }
            guard let children = fields[group]?.arrayValue, !children.isEmpty else { throw invalid }
            let conditions = try children.map { try compile($0, selectors: &selectors) }
            return group == "all" ? DashboardConditionDef(all: conditions) : DashboardConditionDef(any: conditions)
        }
        let allowed: Set<String> = ["source","field","equals","notEquals","in","gt","gte","lt","lte","gtField","gteField","ltField","lteField","exists","empty","notEmpty"]
        guard fields.keys.allSatisfy(allowed.contains), fields["source"] == nil || fields["source"] == .string("form"),
              case .string(let field) = fields["field"], !field.isEmpty,
              !Set(fields.keys).subtracting(["source","field"]).isEmpty else { throw invalid }
        let operators = Set(fields.keys).subtracting(["source", "field"])
        guard operators.count == 1 || operators.isSubset(of: ["gt","gte","lt","lte","gtField","gteField","ltField","lteField"]) else { throw invalid }
        func scalar(_ value: JSONValue) -> Bool {
            switch value { case .object, .array: return false; default: return true }
        }
        if let equals = fields["equals"] ?? fields["notEquals"], !scalar(equals) { throw invalid }
        func bound(_ name: String) throws -> Double? {
            guard let value = fields[name] else { return nil }
            guard case .number(let number) = value, number.isFinite else { throw invalid }
            return number
        }
        func flag(_ name: String) throws -> Bool? {
            guard let value = fields[name] else { return nil }
            guard case .bool(let result) = value else { throw invalid }
            return result
        }
        if let choices = fields["in"] {
            guard let values = choices.arrayValue, !values.isEmpty, values.allSatisfy(scalar) else { throw invalid }
        }
        let predicate = try DashboardConditionDef(source: "form", field: field, equals: fields["equals"], notEquals: fields["notEquals"],
            inValues: fields["in"]?.arrayValue ?? [], gt: bound("gt"), gte: bound("gte"), lt: bound("lt"), lte: bound("lte"),
            exists: flag("exists"), empty: flag("empty"), notEmpty: flag("notEmpty"))
        var operands = Operands(field: field.split(separator: ".").map(String.init))
        for op in InvariantNumericBound.allCases {
            if let peer = fields[op.rawValue + "Field"] {
                guard case .string(let path) = peer, !path.isEmpty else { throw invalid }
                operands.peers[op] = path.split(separator: ".").map(String.init)
            }
        }
        selectors[ObjectIdentifier(predicate)] = operands
        return predicate
    }
}

public struct ResourceSchemaInvariantDef: Codable, Sendable {
    public let when: ResourceInvariantCondition?
    public let assertion: ResourceInvariantCondition
    public let path: String?
    public let message: String

    private enum CodingKeys: String, CodingKey { case when, assertion = "assert", path, message }
}

/// Preserves JSON type, explicit null and missing identity for the shared
/// predicate evaluator. Presentation callers retain their existing coercions.
enum InvariantNumericBound: String, CaseIterable, Sendable { case gt, gte, lt, lte }

struct CanonicalPredicateValue {
    let value: JSONValue?
    var peerBounds: [InvariantNumericBound: Double] = [:]
    var missingNumericPeer = false

    var exists: Bool { value != nil && value != .null }
    var empty: Bool {
        switch value {
        case nil, .null: return true
        case .string(let text): return text.isEmpty
        case .array(let rows): return rows.isEmpty
        case .object(let fields): return fields.isEmpty
        default: return false
        }
    }

    var number: Double? {
        switch value {
        case .number(let number): return number.isFinite ? number : nil
        case .string(let text):
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            let decimal = !trimmed.isEmpty && trimmed.utf8.allSatisfy { byte in
                switch byte { case 43, 45, 46, 48...57, 69, 101: return true; default: return false }
            }
            guard decimal,
                  let number = Double(trimmed), number.isFinite else { return nil }
            return number
        default: return nil
        }
    }
}

extension ResourceInvariantCondition {
    func allows(_ object: JSONValue) -> Bool {
        DashboardRuntime.evaluateDashboardCondition(predicate, valueForCondition: { node in
            guard let fields = selectors[ObjectIdentifier(node)] else { return CanonicalPredicateValue(value: nil) }
            var operand = CanonicalPredicateValue(value: resourceResolveValue(object, components: fields.field))
            for (op, field) in fields.peers {
                let peer = CanonicalPredicateValue(value: resourceResolveValue(object, components: field))
                guard let number = peer.number else { operand.missingNumericPeer = true; break }
                operand.peerBounds[op] = number
            }
            return operand
        })
    }
}
