import Foundation

public struct ForgeTargetContext: Sendable, Equatable {
    public let platform: String
    public let formFactor: String
    public let surface: String
    public let capabilities: [String]

    public init(
        platform: String = "ios",
        formFactor: String = "phone",
        surface: String = "",
        capabilities: [String] = []
    ) {
        self.platform = platform
        self.formFactor = formFactor
        self.surface = surface
        self.capabilities = capabilities
    }
}
