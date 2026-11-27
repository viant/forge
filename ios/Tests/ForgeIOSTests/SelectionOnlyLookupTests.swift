import XCTest
@testable import ForgeIOSRuntime

private actor LookupReads {
    var requests: [ForgeRuntime.DataSourceFetchRequest] = []
    var pause: CheckedContinuation<Void, Never>?

    func read(_ request: ForgeRuntime.DataSourceFetchRequest, suspend: Bool) async -> ForgeRuntime.DataSourceFetchResult {
        requests.append(request)
        if suspend { await withCheckedContinuation { pause = $0 } }
        return .init(rows: [["id": .number(41)]])
    }

    func resume() { pause?.resume(); pause = nil }
}

final class SelectionOnlyLookupTests: XCTestCase {
    private func metadata(role: String) throws -> WindowMetadata {
        try JSONDecoder().decode(WindowMetadata.self, from: JSONSerialization.data(withJSONObject: [
            "namespace": "Lookup", "authorizationSnapshot": ["principal": ["roles": [role]]],
            "dataSource": ["draft": [:], "picker": [:], "context": ["on": [["event": "onSuccess", "handler": "Lookup.loaded"]]]],
            "dialogs": [["id": "parent", "dataSourceRef": "draft"], ["id": "browse", "dataSourceRef": "picker"]],
            "actions": ["code": #"""
              ({
                chosen: ({context, record, value}) => {
                  if (record.name !== value) throw Error('The live selection was not mapped.');
                  const form = context.signals.form.peek();
                  const allowed = context.authorization.principal.roles.includes('owner');
                  context.signals.form.value = {...form, authorized: allowed};
                  if (allowed) {
                    const reader = context.Context('context');
                    reader.handlers.dataSource.setInputParameters({Id:[record.id]});
                    reader.handlers.dataSource.fetchCollection({cache:{bypassCache:true}});
                  }
                  return true;
                },
                loaded: ({context}) => {
                  const draft = context.Context('draft').signals.form;
                  draft.value = {...draft.peek(), defaultsLoaded:true};
                }
              })
              """#],
        ]))
    }

    private func waitFor(_ check: () async -> Bool) async -> Bool {
        for _ in 0..<500 {
            if await check() { return true }
            try? await Task.sleep(for: .milliseconds(2))
        }
        return false
    }

    private func select(_ runtime: ForgeRuntime, windowID: String, presentation: UUID) async {
        await runtime.openSelectionOnlyLookup(windowID: windowID, source: "draft", dialogID: "browse",
            parameters: [.init(name: "advertiserId", direction: "out", location: .string("id")),
                         .init(name: "advertiserName", direction: "out", location: .string("name"))],
            valueField: "advertiserName", parent: (id: "parent", presentation: presentation),
            callback: .init(action: "Lookup.chosen", event: "onLookup"))
    }

    private func commit(_ runtime: ForgeRuntime, windowID: String) async {
        _ = await runtime.execute(.init(action: "dialog.commit"), context: .init(windowID: windowID, dataSourceRef: "picker"),
            args: ["windowId": .string(windowID), "dialogId": .string("browse"),
                   "payload": .object(["id": .number(41), "name": .string("Selected Advertiser")])])
    }

    func testNativeCapturedLookupPublishesSelectedPairAndRunsOneAuthoredRead() async throws {
        for role in ["owner", "reader"] {
            let runtime = ForgeRuntime(), reads = LookupReads()
            let windowID = await runtime.openWindowInline(key: "fixture", title: "Fixture", metadata: try metadata(role: role)).id
            await runtime.registerDataSourceLoader { request in await reads.read(request, suspend: false) }
            _ = await runtime.presentDialog(windowID: windowID, dialogID: "parent")
            let parent = await runtime.dialogState(windowID: windowID, dialogID: "parent")
            let token = try XCTUnwrap(parent.presentationID)
            async let pending: Void = select(runtime, windowID: windowID, presentation: token)
            let opened = await waitFor { await runtime.dialogState(windowID: windowID, dialogID: "browse").open }
            XCTAssertTrue(opened)
            let original = await runtime.dialogState(windowID: windowID, dialogID: "browse").presentationID
            await select(runtime, windowID: windowID, presentation: token)
            let afterDuplicate = await runtime.dialogState(windowID: windowID, dialogID: "browse").presentationID
            XCTAssertEqual(afterDuplicate, original)
            await commit(runtime, windowID: windowID)
            await pending
            let form = await runtime.dataSourceForm(windowID: windowID, dataSourceRef: "draft")
            XCTAssertEqual(form["advertiserId"], .number(41))
            XCTAssertEqual(form["advertiserName"], .string("Selected Advertiser"))
            XCTAssertEqual(form["authorized"], .bool(role == "owner"))
            let requests = await reads.requests
            XCTAssertEqual(requests.count, role == "owner" ? 1 : 0)
            if role == "owner" {
                XCTAssertEqual(requests.first?.dataSourceRef, "context")
                XCTAssertEqual(requests.first?.input.parameters, ["Id": .array([.number(41)])])
                XCTAssertEqual(requests.first?.bypassCache, true)
                XCTAssertEqual(form["defaultsLoaded"], .bool(true))
            }
        }
    }

    func testCancelledOrSupersededLookupCannotApplySelectionOrLateDefaults() async throws {
        for interruption in ["cancel", "parent", "role", "lateRead"] {
            let runtime = ForgeRuntime(), reads = LookupReads()
            let owner = try metadata(role: "owner"), reader = try metadata(role: "reader")
            let windowID = await runtime.openWindowInline(key: "fixture", title: "Fixture", metadata: owner).id
            await runtime.registerDataSourceLoader { request in await reads.read(request, suspend: interruption == "lateRead") }
            _ = await runtime.presentDialog(windowID: windowID, dialogID: "parent")
            let parent = await runtime.dialogState(windowID: windowID, dialogID: "parent")
            let token = try XCTUnwrap(parent.presentationID)
            async let pending: Void = select(runtime, windowID: windowID, presentation: token)
            let opened = await waitFor { await runtime.dialogState(windowID: windowID, dialogID: "browse").open }
            XCTAssertTrue(opened)
            switch interruption {
            case "cancel":
                await runtime.closeDialogPublic(windowID: windowID, dialogID: "browse")
            case "parent":
                _ = await runtime.presentDialog(windowID: windowID, dialogID: "parent")
                await commit(runtime, windowID: windowID)
            case "role":
                _ = await runtime.updateWindowInline(id: windowID, title: "Fixture", metadata: reader)
                _ = await runtime.updateWindowInline(id: windowID, title: "Fixture", metadata: owner)
                await commit(runtime, windowID: windowID)
            default:
                await commit(runtime, windowID: windowID)
                let started = await waitFor { await reads.pause != nil }
                XCTAssertTrue(started)
                _ = await runtime.presentDialog(windowID: windowID, dialogID: "parent")
                await runtime.setDataSourceForm(windowID: windowID, dataSourceRef: "draft", values: ["advertiserName": .string("Replacement")])
                await reads.resume()
            }
            await pending
            let form = await runtime.dataSourceForm(windowID: windowID, dataSourceRef: "draft")
            XCTAssertEqual(form["advertiserName"], interruption == "lateRead" ? .string("Replacement") : nil)
            XCTAssertNil(form["defaultsLoaded"])
            let requests = await reads.requests
            XCTAssertEqual(requests.count, interruption == "lateRead" ? 1 : 0)
        }
    }
}
