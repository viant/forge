import XCTest
@testable import ForgeIOSRuntime

private actor InteractionBox {
    var value: ForgeInteraction?
    func set(_ value: ForgeInteraction) { self.value = value }
}

final class ForgeInteractionTests: XCTestCase {
    func testInteractionObserverReceivesWindowIdentityAndAuthoredDetail() async throws {
        let runtime = ForgeRuntime()
        let window = await runtime.openWindowInline(
            key: "feed-catalog",
            title: "Catalog",
            metadata: WindowMetadata()
        )
        let box = InteractionBox()
        await runtime.registerInteractionObserver { interaction in
            await box.set(interaction)
        }

        await runtime.emitInteraction(
            kind: "feed.tab_changed",
            windowID: window.id,
            dataSourceRef: "catalog",
            detail: ["tabId": .string("records")]
        )

        let observed = await box.value
        XCTAssertEqual(observed?.windowKey, "feed-catalog")
        XCTAssertEqual(observed?.dataSourceRef, "catalog")
        XCTAssertEqual(observed?.detail["tabId"], .string("records"))
    }
}
