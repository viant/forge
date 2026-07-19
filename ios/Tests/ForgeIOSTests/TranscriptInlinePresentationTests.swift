import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

final class TranscriptInlinePresentationTests: XCTestCase {
    func testInlinePolicyUsesOnlyFormFactor() {
        let metadata = WindowMetadata(namespace: "unrelated")
        XCTAssertEqual(
            TranscriptInlinePresentationPolicy.resolve(metadata: metadata, horizontalSizeClass: .compact).maximumHeight,
            340
        )
        XCTAssertEqual(
            TranscriptInlinePresentationPolicy.resolve(metadata: metadata, horizontalSizeClass: .regular).maximumHeight,
            420
        )
    }
}
