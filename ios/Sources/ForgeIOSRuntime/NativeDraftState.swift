import Foundation

public struct NativeDraftState: Sendable, Equatable {
    public var baseline: [String: JSONValue]?
    public init(baseline: [String: JSONValue]? = nil) { self.baseline = baseline }
    public func dirty(_ form: [String: JSONValue]) -> Bool { form != (baseline ?? form) }
    public func resetValue(_ form: [String: JSONValue]) -> [String: JSONValue] { baseline ?? form }
    public static func submitExtras(_ form: [String: JSONValue]) -> [String: JSONValue] { ["data": .object(form)] }
    public func resetExtras(_ form: [String: JSONValue]) -> [String: JSONValue] { ["values": .object(resetValue(form))] }
}
