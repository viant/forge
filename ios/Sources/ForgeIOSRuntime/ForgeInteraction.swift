import Foundation

/// Host-neutral description of a user interaction with authored Forge UI.
public struct ForgeInteraction: Sendable, Equatable {
    public let kind: String
    public let windowID: String
    public let windowKey: String?
    public let dataSourceRef: String?
    public let detail: [String: JSONValue]

    public init(
        kind: String,
        windowID: String,
        windowKey: String? = nil,
        dataSourceRef: String? = nil,
        detail: [String: JSONValue] = [:]
    ) {
        self.kind = kind
        self.windowID = windowID
        self.windowKey = windowKey
        self.dataSourceRef = dataSourceRef
        self.detail = detail
    }
}
