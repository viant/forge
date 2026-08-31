import XCTest
@testable import ForgeIOSUI

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
}
