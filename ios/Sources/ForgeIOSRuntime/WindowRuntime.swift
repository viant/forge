import Foundation

public struct WindowIdentity: Sendable {
    public let windowID: String

    public init(windowID: String) {
        self.windowID = windowID
    }

    public func dataSourceID(ref: String) -> String {
        "\(windowID)DS\(ref)"
    }
}

public struct WindowContext: Sendable {
    public let windowID: String
    public let identity: WindowIdentity
    public let parameters: [String: String]

    public init(windowID: String, parameters: [String: String] = [:]) {
        self.windowID = windowID
        self.identity = WindowIdentity(windowID: windowID)
        self.parameters = parameters
    }
}
