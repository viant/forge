import XCTest
@testable import ForgeIOSRuntime

final class ReportDataSourceClassificationTests: XCTestCase {
    func testEncodedEmptyBuilderMapsDoNotCaptureOrdinaryLookupSources() async throws {
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"plan","kind":"table","dataSourceRef":"plan"}]}},"dialogs":[{"id":"advertiser","content":{"containers":[{"id":"lookup","kind":"table","dataSourceRef":"advertisers"}]}}],"dataSource":{"plan":{"autoFetch":false},"advertisers":{"autoFetch":false}}}"#.utf8))
        let runtime = ForgeRuntime()
        let window = await runtime.openWindowInline(key: "plan", title: "Plan", metadata: metadata)
        let lookupOwned = await runtime.isReportDataSource(windowID: window.id, dataSourceRef: "advertisers")
        let planOwned = await runtime.isReportDataSource(windowID: window.id, dataSourceRef: "plan")
        XCTAssertFalse(lookupOwned)
        XCTAssertFalse(planOwned)
        await runtime.registerDataSourceLoader { request in
            XCTAssertEqual(request.dataSourceRef, "advertisers")
            return ForgeRuntime.DataSourceFetchResult(rows: [["id": .number(7), "name": .string("Advertiser")]])
        }
        await runtime.refreshDataSourceCollection(windowID: window.id, dataSourceRef: "advertisers")
        let rows = await runtime.dataSourceCollection(windowID: window.id, dataSourceRef: "advertisers")
        XCTAssertEqual(rows.count, 1)
    }
    func testActualReportPrimaryStillRequiresPreparation() async throws {
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{"containers":[{"id":"builder","kind":"dashboard.reportBuilder","dataSourceRef":"cube"}]}},"dataSource":{"cube":{"autoFetch":false}}}"#.utf8))
        let runtime = ForgeRuntime()
        let window = await runtime.openWindowInline(key: "report", title: "Report", metadata: metadata)
        let owned = await runtime.isReportDataSource(windowID: window.id, dataSourceRef: "cube")
        XCTAssertTrue(owned)
        await runtime.registerDataSourceLoader { _ in XCTFail("Report without preparation must not dispatch"); return nil }
        await runtime.refreshDataSourceCollection(windowID: window.id, dataSourceRef: "cube")
        let control = await runtime.dataSourceControl(windowID: window.id, dataSourceRef: "cube")
        XCTAssertNotNil(control.error)
    }
}
