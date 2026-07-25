import SwiftUI
import ForgeIOSRuntime

public struct ForgeContainerRendererContext {
    public let runtime: ForgeRuntime?
    public let window: WindowContext?
    public let container: ContainerDef
    public let inheritedDataSourceRef: String?
    public let suppressTitle: Bool
    public let presentationDensity: ForgePresentationDensity
    public let targetContext: ForgeTargetContext?

    public init(
        runtime: ForgeRuntime?,
        window: WindowContext?,
        container: ContainerDef,
        inheritedDataSourceRef: String?,
        suppressTitle: Bool,
        presentationDensity: ForgePresentationDensity,
        targetContext: ForgeTargetContext?
    ) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.inheritedDataSourceRef = inheritedDataSourceRef
        self.suppressTitle = suppressTitle
        self.presentationDensity = presentationDensity
        self.targetContext = targetContext
    }
}

public protocol ForgeContainerRendererExtension {
    var kind: String { get }
    func render(context: ForgeContainerRendererContext) throws -> AnyView
}

public enum ForgeContainerRendererRegistryError: Error, Equatable {
    case emptyKind
    case duplicateKind(String)
}

public struct ForgeContainerRendererRegistry {
    private var renderers: [String: any ForgeContainerRendererExtension]

    public init(_ renderers: [any ForgeContainerRendererExtension] = []) throws {
        self.renderers = [:]
        for renderer in renderers {
            try register(renderer)
        }
    }

    public mutating func register(_ renderer: any ForgeContainerRendererExtension) throws {
        let kind = renderer.kind.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !kind.isEmpty else {
            throw ForgeContainerRendererRegistryError.emptyKind
        }
        guard renderers[kind] == nil else {
            throw ForgeContainerRendererRegistryError.duplicateKind(kind)
        }
        renderers[kind] = renderer
    }

    public func renderer(for kind: String?) -> (any ForgeContainerRendererExtension)? {
        guard let kind else { return nil }
        return renderers[kind.trimmingCharacters(in: .whitespacesAndNewlines)]
    }

    public var registeredKinds: Set<String> {
        Set(renderers.keys)
    }

    public static var empty: ForgeContainerRendererRegistry {
        try! ForgeContainerRendererRegistry()
    }
}

private struct ForgeContainerRendererRegistryKey: EnvironmentKey {
    static let defaultValue = ForgeContainerRendererRegistry.empty
}

extension EnvironmentValues {
    public var forgeContainerRendererRegistry: ForgeContainerRendererRegistry {
        get { self[ForgeContainerRendererRegistryKey.self] }
        set { self[ForgeContainerRendererRegistryKey.self] = newValue }
    }
}
