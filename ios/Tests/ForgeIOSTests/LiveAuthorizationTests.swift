import XCTest
@testable import ForgeIOSRuntime

final class LiveAuthorizationTests: XCTestCase {
    func testMetadataStreamPublishesGrantAndRevocationWithoutReopening() async throws {
        let runtime = ForgeRuntime()
        let initial = WindowMetadata(authorizationSnapshot: ["principal": .object(["roles": .array([]), "features": .array([])])])
        await runtime.registerWindowMetadataLoader { _ in initial }
        let window = await runtime.openWindow(key: "test", title: "Test")
        await runtime.setWindowFormValue(windowID: window.id, values: ["draft": .string("keep")])
        let stream = await runtime.windowMetadataUpdates(id: window.id)
        var iterator = stream.makeAsyncIterator()
        _ = await iterator.next()
        let granted = WindowMetadata(authorizationSnapshot: ["principal": .object(["roles": .array([.string("REVIEWER")]), "features": .array([.string("REPORTING")])])])
        let signal = await runtime.signals.metadata(windowID: window.id)
        await signal.set(granted)
        let grantEvent = await iterator.next()
        XCTAssertEqual(grantEvent??.authorizationSnapshot, granted.authorizationSnapshot)
        await signal.set(initial)
        let revokeEvent = await iterator.next()
        XCTAssertEqual(revokeEvent??.authorizationSnapshot, initial.authorizationSnapshot)
        let retained = await runtime.windowFormJSONValue(windowID: window.id)
        XCTAssertEqual(retained["draft"], .string("keep"))
    }
}
