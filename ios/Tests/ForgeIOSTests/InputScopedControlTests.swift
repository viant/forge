import XCTest
@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

final class InputScopedControlTests: XCTestCase {
    private func item(_ selector: String) throws -> ItemDef {
        let json = ["id":"measure","type":"number","scope":"input","dataField":selector]
        return try JSONDecoder().decode(ItemDef.self, from: JSONSerialization.data(withJSONObject:json))
    }

    func testControlBindingEditsOnlySelectedInputAndFooterWritesTheNewValueOnce() async throws {
        let raw = #"{"view":{"content":{}},"dialogs":[{"id":"editor","dataSourceRef":"draft","fetchOnOpen":false,"actions":[{"id":"apply","label":"Apply","mutationCommand":{"dataSourceRef":"writer","parameters":[{"name":"body","in":"input","location":"draft.parameters.row"}]}}]}],"dataSource":{"draft":{},"writer":{}}}"#
        let metadata = try JSONDecoder().decode(WindowMetadata.self,from:Data(raw.utf8))
        let runtime = ForgeRuntime()
        let window = await runtime.openWindowInline(key:"records",title:"Records",metadata:metadata)
        let ref = "draft"
        let originalForm: [String:JSONValue] = ["hours":.number(12),"parameters":.object(["row":.object(["hours":.number(8)])])]
        let originalRow: [String:JSONValue] = ["hours":.number(48),"zero":.number(0),"flag":.bool(false),"clear":.null]
        let originalInput: [String:JSONValue] = ["row":.object(originalRow),"owner":.string("selected")]
        let calls = InputControlWrites()
        await runtime.registerDataSourceLoader { request in
            await calls.add(request.dataSourceRef, request.input.parameters)
            return .init(rows:[["accepted":.bool(true)]])
        }
        _ = await runtime.presentDialog(windowID:window.id,dialogID:"editor",parameters:originalInput)
        await runtime.setDataSourceForm(windowID:window.id,dataSourceRef:ref,values:originalForm)
        let id = WindowIdentity(windowID:window.id).dataSourceID(ref:ref)
        let filter: [String:JSONValue] = ["selected":.bool(false)]
        await runtime.dataSourceRuntime.setInput(dataSourceID:id,input:.init(filter:filter,parameters:originalInput,page:2,fetch:true,refresh:true))

        // This is the same binding MenuListRenderer gives NativeWidgetView.
        let binding = try XCTUnwrap(MenuInputBinding(try item("parameters.row.hours")))
        let before = await runtime.dataSourceInputState(windowID:window.id,dataSourceRef:ref)
        XCTAssertEqual(binding.value(in:before),.number(48))
        let changed = await binding.set(.number(91),runtime:runtime,windowID:window.id,dataSourceRef:ref)
        XCTAssertTrue(changed)
        let current = await runtime.dataSourceInputState(windowID:window.id,dataSourceRef:ref)
        var expectedRow = originalRow
        expectedRow["hours"] = .number(91)
        XCTAssertEqual(current.parameters,["row":.object(expectedRow),"owner":.string("selected")])
        XCTAssertEqual(current.filter,filter)
        XCTAssertEqual(current.page,2)
        XCTAssertFalse(current.fetch)
        XCTAssertFalse(current.refresh)
        XCTAssertEqual(binding.value(in:current),.number(91))
        let form = await runtime.formJSONValue(windowID:window.id,dataSourceRef:ref)
        XCTAssertEqual(form,originalForm)
        let reads = await calls.entries
        XCTAssertTrue(reads.isEmpty)

        let footer = try XCTUnwrap(metadata.dialogs.first?.actions.first)
        let outcome = await runtime.activateDialogFooter(windowID:window.id,dialogID:"editor",sourceDataSourceRef:ref,action:footer)
        XCTAssertEqual(outcome?.status,"succeeded",outcome?.error ?? "")
        let dispatched = await calls.entries
        XCTAssertEqual(dispatched.map(\.0),["writer"])
        XCTAssertEqual(dispatched.first?.1,["body":.object(expectedRow)])
    }

    func testConcurrentSiblingInputEditsAndInvalidSelectorPreserveCanonicalState() async throws {
        let runtime = ForgeRuntime()
        let window = await runtime.openWindowInline(key:"scope",title:"Scope",metadata:WindowMetadata(dataSources:["draft":DataSourceDef()]))
        let ref = "draft"
        let left = try XCTUnwrap(MenuInputBinding(try item("parameters.rows.0.left"))), right = try XCTUnwrap(MenuInputBinding(try item("parameters.rows.0.right")))
        await runtime.setDataSourceInputParameters(windowID:window.id,dataSourceRef:ref,parameters:["rows":.array([.object([:])])])
        async let a = left.set(.number(0),runtime:runtime,windowID:window.id,dataSourceRef:ref)
        async let b = right.set(.bool(false),runtime:runtime,windowID:window.id,dataSourceRef:ref)
        let success = await (a,b)
        XCTAssertTrue(success.0 && success.1)
        let bad = try XCTUnwrap(MenuInputBinding(try item("parameters.rows.2.left")))
        let rejected = await bad.set(.null,runtime:runtime,windowID:window.id,dataSourceRef:ref)
        XCTAssertFalse(rejected)
        let current = await runtime.dataSourceInputState(windowID:window.id,dataSourceRef:ref)
        XCTAssertEqual(left.value(in:current),.number(0))
        XCTAssertEqual(right.value(in:current),.bool(false))
    }
}

private actor InputControlWrites {
    var entries: [(String,[String:JSONValue])] = []
    func add(_ ref: String, _ values: [String:JSONValue]) { entries.append((ref,values)) }
}
