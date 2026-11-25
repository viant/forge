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

extension LiveAuthorizationTests {
    func testOrdinaryActionUsesCurrentWindowAuthorizationAndStopsEffectsAfterRevocation() async throws {
        // A synthetic editor opens a dialog using its published window principal.
        let code = """
            ({
                open: ({context}) => {
                    const principal = context.signals.authorization.peek().principal;
                    if (!principal?.roles.includes('editor')) return false;
                    return context.handlers.window.openDialog({execution: {args: ['editor']}});
                },
                review: ({context}) => {
                    if (!context.authorization.principal?.roles.includes('editor')) return false;
                    window.open('https://example.test/review');
                    return context.handlers.window.openDialog({execution: {args: ['editor']}});
                }
            })
            """
        func metadata(roles: [String]?) throws -> WindowMetadata {
            var value: [String: Any] = [
                "namespace": "Records", "actions": ["code": code], "dataSource": ["records": [:]],
                "dialogs": [["id": "editor"]]
            ]
            if let roles { value["authorizationSnapshot"] = ["principal": ["subject": "member", "roles": roles]] }
            return try JSONDecoder().decode(WindowMetadata.self, from: JSONSerialization.data(withJSONObject: value))
        }
        let editor = try metadata(roles: ["editor"]), viewer = try metadata(roles: ["viewer"])
        let runtime = ForgeRuntime()
        let id = await runtime.openWindowInline(key: "records", title: "Records", metadata: editor).id
        let context = ExecutionContext(windowID: id, dataSourceRef: "records")
        let signal = await runtime.signals.metadata(windowID: id)
        let open = ExecutionDef(action: "Records.open", event: "onClick")
        for (current, allowed) in [(editor, true), (viewer, false), (try metadata(roles: nil), false)] {
            await signal.set(current)
            let result = await runtime.execute(open, context: context, args: ["authorization": .object(editor.authorizationSnapshot)])
            let dialog = await runtime.dialogState(windowID: id, dialogID: "editor")
            XCTAssertEqual(result, .bool(allowed))
            XCTAssertEqual(dialog.open, allowed)
            if dialog.open { await runtime.closeDialogPublic(windowID: id, dialogID: "editor") }
        }

        await signal.set(editor)
        await runtime.registerExternalURLHandler { _ in await signal.set(viewer) }
        let result = await runtime.execute(ExecutionDef(action: "Records.review", event: "onClick"), context: context)
        let dialog = await runtime.dialogState(windowID: id, dialogID: "editor")
        let current = await runtime.windowMetadata(id: id)
        XCTAssertEqual(current?.authorizationSnapshot, viewer.authorizationSnapshot)
        XCTAssertNil(result)
        XCTAssertFalse(dialog.open)
    }
}
