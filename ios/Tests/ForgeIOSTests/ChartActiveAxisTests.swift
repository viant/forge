import XCTest
@testable import ForgeIOSUI

final class ChartActiveAxisTests: XCTestCase {
    func testAccessibilityRemainderCountsOnlyAnnouncedPreviewValues() {
        let rows = (0..<8).map { ChartAccessibleDataRow(id: "\($0)", category: "Day \($0)", seriesLabel: "Spend", valueLabel: "$1") }
        XCTAssertTrue(chartAccessibleDataSummary(rows: rows, totalCount: 14).hasSuffix("11 more values."))
        XCTAssertTrue(chartAccessibleDataSummary(rows: Array(rows.prefix(7)), totalCount: 7).hasSuffix("4 more values."))
    }

    func testDeselectingEitherSeriesKeepsAxisAndPlotUnitsConsistent() {
        let spend = SeriesDatum(rowIndex: 0, category: "Sep 5", seriesKey: "spend", seriesLabel: "Spend", value: 1570, format: "currency")
        let impressions = SeriesDatum(rowIndex: 0, category: "Sep 5", seriesKey: "impressions", seriesLabel: "Impressions", value: 560000, format: "compactNumber")
        let mapping = ["spend": "left", "impressions": "right"]
        let order = ["spend", "impressions"]
        XCTAssertEqual(activeChartAxisOrder(data: [spend, impressions], seriesOrder: order, axisBySeries: mapping), ["left", "right"])
        XCTAssertEqual(normalizedChartSeriesDataByAxis(data: [spend, impressions], axisBySeries: mapping).map(\.chartValue), [1, 1])
        XCTAssertEqual(activeChartAxisOrder(data: [spend], seriesOrder: order, axisBySeries: mapping), ["left"])
        XCTAssertEqual(normalizedChartSeriesDataByAxis(data: [spend], axisBySeries: mapping).map(\.chartValue), [1570])
        XCTAssertEqual(activeChartAxisOrder(data: [impressions], seriesOrder: order, axisBySeries: mapping), ["right"])
        XCTAssertEqual(normalizedChartSeriesDataByAxis(data: [impressions], axisBySeries: mapping).map(\.chartValue), [560000])
        XCTAssertEqual(activeChartAxisOrder(data: [], seriesOrder: order, axisBySeries: mapping), [])
    }
}
