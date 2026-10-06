import XCTest
@testable import ForgeIOSRuntime

final class NativeReportAdmissionDigestTests: XCTestCase {
    func testSharedCrossPlatformVectors() throws {
        struct Fixture: Decodable { let profile: String; let cases: [Case] }
        struct Case: Decodable { let name: String; let json: String; let sha256: String?; let error: String? }
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: root.appendingPathComponent("testdata/native-report-preparation/admission-digest-v1.json")))
        XCTAssertEqual(fixture.profile, nativeReportDigestProfile)
        for item in fixture.cases {
            let value = try JSONDecoder().decode(JSONValue.self, from: Data(item.json.utf8))
            if item.error != nil { XCTAssertThrowsError(try nativeReportAdmissionDigest(value), item.name) }
            else { XCTAssertEqual(try nativeReportAdmissionDigest(value), item.sha256, item.name) }
        }
    }
    func testRejectsNonfiniteNumbers() {
        for value in [Double.nan, Double.infinity, -Double.infinity] { XCTAssertThrowsError(try nativeReportAdmissionDigest(.number(value))) }
    }
}
