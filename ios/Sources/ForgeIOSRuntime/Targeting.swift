import Foundation

public struct ForgeTargetContext: Sendable, Equatable {
    public let platform: String
    public let formFactor: String
    public let capabilities: [String]

    public init(platform: String = "ios", formFactor: String = "phone", capabilities: [String] = []) {
        self.platform = platform
        self.formFactor = formFactor
        self.capabilities = capabilities
    }
}
