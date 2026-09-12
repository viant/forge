import XCTest
@testable import ForgeIOSUI

final class ChartActiveAxisTests: XCTestCase {
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
