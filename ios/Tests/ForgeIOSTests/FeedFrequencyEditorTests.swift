import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

private actor FeedInteractionCapture {
    var value: ForgeInteraction?
    func set(_ value: ForgeInteraction) { self.value = value }
}

final class FeedFrequencyEditorTests: XCTestCase {
    func testParsesSharedFrequencyValueAndPluralUnit() {
        XCTAssertEqual(
            feedFrequencyParts("4 per 1 day", units: ["hour", "day", "week"]),
            FeedFrequencyParts(count: "4", interval: "1", unit: "day")
        )
        XCTAssertEqual(
            feedFrequencyParts("3.5 per 2 weeks", units: ["hour", "day", "week"]),
            FeedFrequencyParts(count: "3.5", interval: "2", unit: "week")
        )
    }

    func testBlankSharedFrequencyDefaultsToDay() {
        XCTAssertEqual(
            feedFrequencyParts("", units: ["hour", "day", "week"]),
            FeedFrequencyParts(count: "", interval: "1", unit: "day")
        )
    }

    func testFormatsSharedFrequencyValueAndKeepsBlankCountEmpty() {
        XCTAssertEqual(formatFeedFrequency(FeedFrequencyParts(count: "4", interval: "1", unit: "day")), "4 per 1 day")
        XCTAssertEqual(formatFeedFrequency(FeedFrequencyParts(count: "", interval: "1", unit: "day")), "")
    }

    func testEditableTablePatchEmitsInspectableFeedChange() async throws {
        let runtime = ForgeRuntime()
        let window = await runtime.openWindowInline(
            key: "feed-catalog-conversation",
            title: "Catalog",
            metadata: WindowMetadata()
        )
        await runtime.registerFeedPatchHandler { _, _ in true }
        let capture = FeedInteractionCapture()
        await runtime.registerInteractionObserver { interaction in
            await capture.set(interaction)
        }

        try await dispatchEditableFeedPatchAndEmit(
            runtime: runtime,
            windowID: window.id,
            operation: FeedPatchOperation(
                dataSourceRef: "frequency",
                op: "replace",
                path: "/collection/0/Freq~1Cap",
                value: .string("7 per 1 day")
            )
        )

        let interaction = await capture.value
        XCTAssertEqual(interaction?.kind, "feed.form_changed")
        XCTAssertEqual(interaction?.windowKey, "feed-catalog-conversation")
        XCTAssertEqual(interaction?.dataSourceRef, "frequency")
        XCTAssertEqual(interaction?.detail["field"], .string("Freq/Cap"))
        XCTAssertEqual(interaction?.detail["path"], .string("/collection/0/Freq~1Cap"))
        XCTAssertEqual(interaction?.detail["value"], .string("7 per 1 day"))
    }
}
