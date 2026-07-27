import SwiftUI
import XCTest
@testable import ForgeIOSUI

private struct TestContainerRendererExtension: ForgeContainerRendererExtension {
    let kind: String

    func render(context: ForgeContainerRendererContext) throws -> AnyView {
        AnyView(Text(context.container.id ?? "container"))
    }
}

final class ContainerRendererRegistryTests: XCTestCase {
    func testRegistryUsesExactKind() throws {
        let registry = try ForgeContainerRendererRegistry([
            TestContainerRendererExtension(kind: "vendor.custom-panel")
        ])

        XCTAssertNotNil(registry.renderer(for: "vendor.custom-panel"))
        XCTAssertNil(registry.renderer(for: "Vendor.Custom-Panel"))
        XCTAssertEqual(registry.registeredKinds, ["vendor.custom-panel"])
    }

    func testRegistryRejectsDuplicateKind() throws {
        var registry = try ForgeContainerRendererRegistry([
            TestContainerRendererExtension(kind: "vendor.custom-panel")
        ])

        XCTAssertThrowsError(
            try registry.register(
                TestContainerRendererExtension(kind: "vendor.custom-panel")
            )
        ) { error in
            XCTAssertEqual(
                error as? ForgeContainerRendererRegistryError,
                .duplicateKind("vendor.custom-panel")
            )
        }
    }
}
