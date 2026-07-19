import XCTest
@testable import ForgeIOSUI
@testable import ForgeIOSRuntime

final class MarkdownFenceParserTests: XCTestCase {
    func testSegmentsAdjacentFencesAndPreservesSurroundingText() {
        let parts = MarkdownFenceParser.parse(
            "before```forge-data{\"id\":\"rows\"}```between```forge-ui\n{\"blocks\":[]}\n```after"
        )

        XCTAssertEqual(parts.count, 5)
        XCTAssertEqual(parts[0], .text("before"))
        XCTAssertEqual(parts[1], .fence(raw: "```forge-data{\"id\":\"rows\"}```", language: "forge-data", header: "", body: "{\"id\":\"rows\"}", closed: true))
        XCTAssertEqual(parts[2], .text("between"))
        XCTAssertEqual(parts[4], .text("after"))
    }

    func testKeepsMalformedMarkerAsTextAndReportsUnfinishedFence() {
        XCTAssertEqual(
            MarkdownFenceParser.parse("start```forge-ui invalid```end"),
            [.text("start```forge-ui invalid```end")]
        )

        let parts = MarkdownFenceParser.parse("start```forge-ui\n{\"blocks\":[]}")
        XCTAssertEqual(parts[0], .text("start"))
        XCTAssertEqual(parts[1], .fence(raw: "```forge-ui\n{\"blocks\":[]}", language: "forge-ui", header: "", body: "{\"blocks\":[]}", closed: false))
    }

    func testPreservesAFencedHeaderBeforeThePayload() {
        XCTAssertEqual(
            MarkdownFenceParser.parse("```forge-data id=\"summary_metrics\"\n[{\"label\":\"Spend\"}]\n```"),
            [
                .fence(
                    raw: "```forge-data id=\"summary_metrics\"\n[{\"label\":\"Spend\"}]\n```",
                    language: "forge-data",
                    header: "id=\"summary_metrics\"",
                    body: "[{\"label\":\"Spend\"}]\n",
                    closed: true
                )
            ]
        )
    }

    func testParsesQuotedAndUnquotedHeaderAttributes() {
        XCTAssertEqual(
            MarkdownFenceHeader.attributes("id=\"summary_metrics\" mode=append format='json'"),
            ["id": "summary_metrics", "mode": "append", "format": "json"]
        )
    }

    func testDoesNotTerminateJSONFenceOnBackticksInsideAString() {
        let parts = MarkdownFenceParser.parse("```forge-data{\"id\":\"rows\",\"data\":[{\"note\":\"has ``` inside\"}]}```")
        XCTAssertEqual(parts.count, 1)
        guard case .fence(_, _, _, let body, let closed) = parts[0] else {
            return XCTFail("Expected a fence")
        }
        XCTAssertTrue(closed)
        XCTAssertTrue(body.contains("has ``` inside"))
    }

    func testMalformedHeaderAttributeDoesNotCrash() {
        XCTAssertEqual(MarkdownFenceHeader.attributes("id="), ["id": ""])
    }
}
