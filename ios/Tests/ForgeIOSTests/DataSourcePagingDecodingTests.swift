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

    func testMobileTableAndLookupMetadataDecodeWithoutLosingAuthoredUI() throws {
        let table = try JSONDecoder().decode(
            TableDef.self,
            from: Data(#"{"presentation":"tabular","columns":[{"id":"name","name":"Name"}],"emptyState":{"title":"Create your first automation","hideToolbarItems":["pagination"],"action":{"id":"addNew","icon":"plus","label":"New automation","on":[{"event":"onClick","handler":"schedule.addNewSchedule"}]}}}"#.utf8)
        )
        let item = try JSONDecoder().decode(
            ItemDef.self,
            from: Data(#"{"id":"agentRef","type":"text","lookup":{"dialogId":"agentLov","outputs":[{"name":"agentRef","location":"id"}]}}"#.utf8)
        )

        XCTAssertEqual(table.presentation, "tabular")
        XCTAssertEqual(table.emptyState?.title, "Create your first automation")
        XCTAssertEqual(table.emptyState?.action?.on.first?.action, "schedule.addNewSchedule")
        XCTAssertEqual(item.lookup?.objectValue?["dialogId"]?.stringValue, "agentLov")
    }
}
