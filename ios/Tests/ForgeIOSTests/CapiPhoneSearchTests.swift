import XCTest
@testable import ForgeIOSRuntime

final class CapiPhoneSearchTests: XCTestCase {
    func testLayoutAcceptsNumericAndUnitBearingSpacing() throws {
        let numeric = try JSONDecoder().decode(LayoutDef.self, from: Data(#"{"gap":8,"rowGap":4.5}"#.utf8))
        XCTAssertEqual(numeric.gap, "8.0")
        XCTAssertEqual(numeric.rowGap, "4.5")
        let units = try JSONDecoder().decode(LayoutDef.self, from: Data(#"{"gap":"8px","rowGap":"1rem"}"#.utf8))
        XCTAssertEqual(units.gap, "8px")
        XCTAssertEqual(units.rowGap, "1rem")
    }

    func testLivePhoneSearchResolutionWhenRequested() throws {
        guard ProcessInfo.processInfo.environment["FORGE_LIVE_PREVIEW_TEST"] == "1" else {
            throw XCTSkip("Opt-in read-only local preview integration test")
        }
        let data = try Data(contentsOf: URL(string: "http://127.0.0.1:8120/api/windows/advertiser?platform=ios&formFactor=phone&surface=app")!)
        struct Envelope: Decodable { let data: WindowMetadata }
        let metadata = try JSONDecoder().decode(Envelope.self, from: data).data
        let raw = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(metadata))
        let projected = try XCTUnwrap(MetadataResolver.resolveValue(raw, for: ForgeTargetContext(platform: "ios", formFactor: "phone", surface: "app")))
        _ = try JSONDecoder().decode(WindowMetadata.self, from: JSONEncoder().encode(projected))
        let resolved = MetadataResolver.resolve(metadata, for: ForgeTargetContext(platform: "ios", formFactor: "phone", surface: "app"))
        func find(_ containers: [ContainerDef]) -> ContainerDef? {
            for container in containers {
                if container.id == "advertiserCapiTab" { return container }
                if let found = find(container.containers) { return found }
            }
            return nil
        }
        let capi = find(resolved.view?.content?.containers ?? [])
        let search = capi?.table?.toolbar?.items.first { $0.type?.lowercased() == "quicksearch" }
        XCTAssertEqual(search?.properties["field"], .string("firstPartyDataSource"))
    }

    func testPhoneSearchOverrideSurvivesTypedResolution() throws {
        let payload = #"""
{"view":{"content":{"id":"root","containers":[{"id":"advertiserCapiTab","table":{"fillRemainingWidth":true,"minRows":10,"rowHeight":32,"columns":[{"id":"firstPartyDataSource","name":"1st Party Data Source","width":600,"sticky":"left","type":"link","link":{"kind":"dialog","label":"firstPartyDataSource","dialogId":"advertiserCapiOnboardedData","parameters":{"AdvertiserId":{"selector":"AdvertiserId.0","source":"windowForm"},"FirstPartyDataSource":{"selector":"firstPartyDataSource","source":"row"}}},"tooltip":""},{"id":"dataFirstActivity","name":"Data First Activity","width":180,"format":"date","tooltip":""},{"id":"dataLastActivity","name":"Data Last Activity","width":180,"format":"date","tooltip":""}],"density":"compact","toolbar":{"items":[{"id":"exportCsv","label":"Export CSV","align":"left","icon":"export","tooltip":"Export visible rows as CSV","type":"tableExport","hideLabel":true,"properties":{"filename":"advertiser_capi_sources","formats":["csv"],"scope":"page"}},{"id":"nameSearch","label":"Search","align":"center","icon":"search","type":"quickSearch","properties":{"field":"Name","label":"Source contains"}},{"id":"settings","label":"Customize","align":"right","icon":"settings","tooltip":"Customize columns","hideLabel":true},{"id":"refresh","label":"Refresh","align":"right","icon":"refresh","tooltip":"Refresh data","hideLabel":true},{"id":"filterList","label":"Filter","align":"right","icon":"filter","tooltip":"Filter rows","hideLabel":true}],"density":"compact","layout":"responsive"},"enforceColumnSize":false,"pagination":{"pageSize":10,"pageSizeOptions":[10]},"emptyState":{"action":{"appearance":"outlined","icon":"help","id":"capiLearnMore","label":"Learn more","on":[{"event":"onClick","handler":"Advertiser Workspace.openCapiHelp"}]},"body":"The Conversions API (CAPI) helps advertisers activate and manage first-party data within the Viant DSP. No data has been onboarded yet for this advertiser.","compact":true,"icon":"cloud-upload","kicker":"First-party data","sizingMode":"content","title":"No CAPI data onboarded yet"}},"targetOverrides":{"phone":{"table":{"toolbar":{"density":"compact","items":[{"align":"left","hideLabel":true,"icon":"export","id":"exportCsv","label":"Export CSV","properties":{"filename":"advertiser_capi_sources","formats":["csv"],"scope":"page"},"tooltip":"Export visible rows as CSV","type":"tableExport"},{"align":"center","icon":"search","id":"nameSearch","label":"Search","properties":{"field":"firstPartyDataSource","label":"Source contains"},"type":"quickSearch"},{"align":"right","hideLabel":true,"icon":"settings","id":"settings","label":"Customize","tooltip":"Customize columns"},{"align":"right","hideLabel":true,"icon":"refresh","id":"refresh","label":"Refresh","tooltip":"Refresh data"},{"align":"right","hideLabel":true,"icon":"filter","id":"filterList","label":"Filter","tooltip":"Filter rows"}],"layout":"responsive"}}}}}]}}}
"""#
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(payload.utf8))
        let resolved = MetadataResolver.resolve(metadata, for: ForgeTargetContext(platform: "ios", formFactor: "phone", surface: "app"))
        let search = resolved.view?.content?.containers.first?.table?.toolbar?.items.first { $0.type?.lowercased() == "quicksearch" }
        XCTAssertEqual(search?.properties["field"], .string("firstPartyDataSource"))
    }
}
