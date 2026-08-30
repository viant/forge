import XCTest
@testable import ForgeIOSRuntime

final class FeedDraftRuntimeTests: XCTestCase {
    func testFeedEditorMetadataAndPatchDispatchRemainGeneric() async throws {
        let data = #"{"view":{"content":{"containers":[{"id":"frequency","kind":"dashboard.editableTable","dataSourceRef":"rows","quickFilter":true,"addRow":{"label":"Add","defaults":{"value":0}},"removeRowLabel":"Remove","columns":[{"key":"value","editor":{"type":"number"}}],"lookup":{"options":[{"label":"One","value":1}]}}]}}}"#.data(using: .utf8)!
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: data)
        let container = try XCTUnwrap(metadata.view?.content?.containers.first)
        XCTAssertEqual(container.kind, "dashboard.editableTable")
        XCTAssertEqual(container.quickFilter, true)
        XCTAssertEqual(container.addRow?.objectValue?["label"], .string("Add"))
        XCTAssertEqual(container.columns.first?.editor?.objectValue?["type"], .string("number"))

        let runtime = ForgeRuntime()
        let operation = FeedPatchOperation(dataSourceRef: "rows", op: "replace", path: "/collection/0/value", value: .number(3))
        await runtime.registerFeedPatchHandler { _, incoming in incoming == operation }
        let handled = try await runtime.dispatchFeedPatch(windowID: "window", operation: operation)
        XCTAssertTrue(handled)
    }

    func testPatchesFirstMiddleLastAndSnapshotsAllViews() async throws {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(dataSources: ["items": DataSourceDef(selectionMode: "multi")])
        let window = await runtime.openWindowInline(key: "feed-test", title: "Feed", metadata: metadata)
        await runtime.setDataSourceCollection(windowID: window.id, dataSourceRef: "items", rows: [row(1), row(2), row(3)])
        await runtime.setDataSourceSelectionState(
            windowID: window.id,
            dataSourceRef: "items",
            selection: SelectionState(selection: [row(1)])
        )
        await runtime.setDataSourceForm(windowID: window.id, dataSourceRef: "items", values: ["title": .string("Draft")])

        let changed = try await runtime.applyFeedPatchOperations(
            windowID: window.id,
            operations: [
                FeedPatchOperation(dataSourceRef: "items", op: "replace", path: "/collection/0/value", value: .number(10)),
                FeedPatchOperation(dataSourceRef: "items", op: "remove", path: "/collection/1"),
                FeedPatchOperation(dataSourceRef: "items", op: "add", path: "/collection/-", value: .object(row(4))),
                FeedPatchOperation(dataSourceRef: "items", op: "replace", path: "/form/title", value: .string("Changed")),
                FeedPatchOperation(dataSourceRef: "items", op: "add", path: "/selection/selection/-", value: .object(row(4)))
            ]
        )

        XCTAssertEqual(changed, Set(["items"]))
        let snapshot = try await runtime.snapshotFeedDataSources(windowID: window.id, dataSourceRefs: ["items"])["items"]
        XCTAssertEqual(snapshot?.collection.compactMap { $0["value"]?.intValue }, [10, 3, 4])
        XCTAssertEqual(snapshot?.form["title"], .string("Changed"))
        XCTAssertEqual(snapshot?.selection["selection"]?.arrayValue?.count, 2)
    }

    func testRejectsRelativeAndOutOfBoundsPaths() async throws {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(dataSources: ["items": DataSourceDef()])
        let window = await runtime.openWindowInline(key: "feed-test", title: "Feed", metadata: metadata)
        await runtime.setDataSourceCollection(windowID: window.id, dataSourceRef: "items", rows: [row(1)])

        do {
            _ = try await runtime.applyFeedPatchOperations(
                windowID: window.id,
                operations: [FeedPatchOperation(dataSourceRef: "items", op: "remove", path: "collection/0")]
            )
            XCTFail("relative pointers must fail")
        } catch let error as FeedDraftRuntimeError {
            XCTAssertEqual(error, .invalidPointer("collection/0"))
        }

        do {
            _ = try await runtime.applyFeedPatchOperations(
                windowID: window.id,
                operations: [FeedPatchOperation(dataSourceRef: "items", op: "remove", path: "/collection/4")]
            )
            XCTFail("out-of-bounds pointers must fail")
        } catch let error as FeedDraftRuntimeError {
            XCTAssertEqual(error, .invalidArrayIndex("4"))
        }
    }

    private func row(_ value: Double) -> [String: JSONValue] { ["value": .number(value)] }
}
