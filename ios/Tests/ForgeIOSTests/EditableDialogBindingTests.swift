import XCTest

@testable import ForgeIOSRuntime

final class EditableDialogBindingTests: XCTestCase {
    func testOrdinaryOperationBindsTypedInputsAndReopensWithACleanDraft() async throws {
        let document = #"""
            {
              "view":{"content":{}},
              "dataSource":{"records":{},"parent":{},"draft":{"autoFetch":false}},
              "dialogs":[{"id":"edit","dataSourceRef":"draft","fetchOnOpen":false,"content":{"dataSourceRef":"draft","fetchData":false},
                "on":[{"event":"onOpen","handler":"dataSource.setFormData","parameters":[
                  {"name":"id","in":"input","location":"draft.parameters.parentId"},
                  {"name":"enabled","in":"input","location":"draft.parameters.enabled"},
                  {"name":"limit","in":"input","location":"draft.parameters.limit"},
                  {"name":"optional","in":"const","location":"null","codec":{"name":"json"}},
                  {"name":"note","in":"const","location":"\"\"","codec":{"name":"json"}}
                ]}]}]
            }
            """#
        let action = #"""
            {"id":"new","label":"New","dialogId":"edit","parameters":[
              {"name":"parentId","in":"form","location":"parent.id","codec":{"name":"int"}},
              {"name":"enabled","in":"const","location":"false","codec":{"name":"boolean"}},
              {"name":"limit","in":"form","location":"parent.missing","default":0},
              {"name":"nullable","in":"form","location":"parent.nullable","default":"fallback"},
              {"name":"ids","in":"form","location":"parent.ids","codec":{"name":"int[]"}},
              {"name":"missing","default":null},
              {"name":"operationId","in":"const","location":"ignored"}
            ]}
            """#
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(document.utf8))
        let operation = try JSONDecoder().decode(EditableCollectionOperationSpec.self, from: Data(action.utf8))
        let runtime = ForgeRuntime()
        let id = await runtime.openWindowInline(key: "records", title: "Records", metadata: metadata).id
        await runtime.registerDataSourceLoader { request in
            XCTFail("An ordinary local dialog unexpectedly fetched " + request.dataSourceRef)
            return .init(rows: [])
        }
        let reader = WindowIdentity(windowID: id).dataSourceID(ref: "draft")
        await runtime.dataSourceRuntime.setInput(dataSourceID: reader, input: InputState(parameters: ["stale": .bool(true)], fetch: true))
        for number in [17, 29] {
            let selection: [[String: JSONValue]] = [["id": .number(Double(number))], ["id": .number(8)]]
            let sourceID = WindowIdentity(windowID:id).dataSourceID(ref:"records")
            let current = SelectionState(selected:selection.first, selection:selection, rowIndex:0)
            await runtime.dataSourceRuntime.setSelection(dataSourceID:sourceID, selection:current)
            await (await runtime.signals.selection(dataSourceID:sourceID)).set(current)
            await runtime.setDataSourceForm(
                windowID: id, dataSourceRef: "parent",
                values: ["id": .string(String(number)), "nullable": .null, "ids": .array([.string("8"), .number(9)])])
            await runtime.setDataSourceForm(
                windowID: id, dataSourceRef: "draft", values: ["stale": .bool(true), "note": .string("previous edit")])
            await runtime.openEditableOperationDialog(
                windowID: id, source: "records", collection: EditableCollectionSpec(operations: [operation]), operation: operation)
            let opened = await runtime.dialogState(windowID: id, dialogID: "edit")
            XCTAssertTrue(opened.open)
            let expected: [String: JSONValue] = [
                "parentId": .number(Double(number)), "enabled": .bool(false), "limit": .number(0),
                "operationId": .string("new"), "selectedRows": .array(selection.map(JSONValue.object)),
                "nullable": .null, "missing": .null, "ids": .array([.number(8), .number(9)]),
            ]
            XCTAssertEqual(opened.args, expected)
            let input = await runtime.dataSourceRuntime.input(dataSourceID: reader)
            XCTAssertEqual(input.parameters, expected)
            XCTAssertFalse(input.fetch)
            let draft = await runtime.dataSourceForm(windowID: id, dataSourceRef: "draft")
            XCTAssertEqual(
                draft, ["id": .number(Double(number)), "enabled": .bool(false), "limit": .number(0), "optional": .null, "note": .string("")])
            await runtime.closeDialogPublic(windowID: id, dialogID: "edit")
        }
    }

    func testSetFormDataExplicitValuesWinAndAnEmptyResetReplacesTheForm() async throws {
        let runtime = ForgeRuntime()
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(#"{"view":{"content":{}},"dataSource":{"draft":{}}}"#.utf8))
        let id = await runtime.openWindowInline(key: "draft", title: "Draft", metadata: metadata).id
        let context = ExecutionContext(windowID: id, dataSourceRef: "draft")
        _ = await runtime.execute(
            ExecutionDef(action: "dataSource.setFormData"), context: context, args: ["values": .object(["flag": .bool(false)])])
        let seeded = await runtime.dataSourceForm(windowID: id, dataSourceRef: "draft")
        XCTAssertEqual(seeded, ["flag": .bool(false)])
        _ = await runtime.execute(ExecutionDef(action: "dataSource.setFormData"), context: context)
        let empty = await runtime.dataSourceForm(windowID: id, dataSourceRef: "draft")
        XCTAssertTrue(empty.isEmpty)
    }
}

extension EditableDialogBindingTests {
    func testCreateWithAnEmptyListUsesItsNamedParentForDisplayAndActivation() async throws {
        let raw =
            #"{"view":{"content":{}},"dataSource":{"records":{},"parent":{},"draft":{}},"dialogs":[{"id":"edit","dataSourceRef":"draft"}]}"#
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: Data(raw.utf8))
        let definition =
            #"{"id":"create","label":"Create","dialogId":"edit","disabledWhen":{"not":{"source":"collection","dataSourceRef":"parent","field":"0.id","gt":0}}}"#
        let op = try JSONDecoder().decode(EditableCollectionOperationSpec.self, from: Data(definition.utf8))
        let spec = EditableCollectionSpec(operations: [op])
        let runtime = ForgeRuntime()
        let id = await runtime.openWindowInline(key: "example", title: "Records", metadata: metadata).id
        for eligible in [false, true, false] {
            await runtime.setDataSourceCollection(windowID: id, dataSourceRef: "parent", rows: eligible ? [["id": .number(7)]] : [])
            let state = await runtime.editableOperationPresentation(windowID: id, source: "records", collection: spec)
            XCTAssertEqual(state["create"]?.visible, true)
            XCTAssertEqual(state["create"]?.disabled, !eligible)
            await runtime.openEditableOperationDialog(windowID: id, source: "records", collection: spec, operation: op)
            let dialog = await runtime.dialogState(windowID: id, dialogID: "edit")
            XCTAssertEqual(dialog.open, eligible)
            if eligible {
                XCTAssertEqual(dialog.args["selectedRows"], .array([]))
                await runtime.closeDialogPublic(windowID: id, dialogID: "edit")
            }
        }
    }
}
