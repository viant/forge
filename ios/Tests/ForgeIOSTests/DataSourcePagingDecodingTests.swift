import XCTest
@testable import ForgeIOSRuntime

final class DataSourcePagingDecodingTests: XCTestCase {
    func testMissingOptionalPagingMapsDecodeAsEmpty() throws {
        let paging = try JSONDecoder().decode(
            DataSourcePagingDef.self,
            from: Data(#"{"size":20,"enabled":true}"#.utf8)
        )

        XCTAssertEqual(paging.size, 20)
        XCTAssertEqual(paging.enabled, true)
        XCTAssertEqual(paging.parameters, [:])
        XCTAssertEqual(paging.dataInfoSelectors, [:])
    }

    func testCompositeContainerVisibilityUsesCollectionAndWindowForm() throws {
        let condition = try JSONDecoder().decode(
            DashboardConditionDef.self,
            from: Data(#"{"all":[{"source":"collection","empty":true},{"source":"windowForm","field":"automationView","notEquals":"editor"}]}"#.utf8)
        )

        XCTAssertTrue(
            DashboardRuntime.evaluateDashboardCondition(
                condition,
                windowForm: [:],
                collection: []
            )
        )
        XCTAssertFalse(
            DashboardRuntime.evaluateDashboardCondition(
                condition,
                windowForm: ["automationView": "editor"],
                collection: []
            )
        )
        XCTAssertFalse(
            DashboardRuntime.evaluateDashboardCondition(
                condition,
                windowForm: [:],
                collection: [["id": "schedule-1"]]
            )
        )
    }
}
