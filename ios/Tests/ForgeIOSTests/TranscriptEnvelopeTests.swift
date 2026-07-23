import XCTest
@testable import ForgeIOSRuntime

final class TranscriptEnvelopeTests: XCTestCase {
    func testSuppressesProgressiveTransportWithoutRemovingNarration() {
        let content = """
        Forecast ready.
        ```forge-data
        {"version":2,"scope":"forecast","reportRef":"review","id":"states","sequence":2,"data":[{"stateCode":"CA"}]}
        ```
        ```forge-report
        {"version":1,"scope":"forecast","id":"review","sequence":3,"mode":"commit"}
        ```
        """

        XCTAssertEqual(
            TranscriptEnvelope.suppressProgressiveTransport(in: content)
                .trimmingCharacters(in: .whitespacesAndNewlines),
            "Forecast ready."
        )
    }

    func testMaterializesLegacyDataHeadersAndAppendModeBeforeUI() {
        let content = """
        before
        ```forge-data id="rows"
        [{"id":"first"}]
        ```
        ```forge-data id="rows" mode=append
        [{"id":"second"}]
        ```
        ```forge-ui
        {"title":"Rows","blocks":[]}
        ```
        after
        """

        let parts = TranscriptEnvelope.parse(content)

        XCTAssertEqual(parts.count, 3)
        guard case .forgeUI(let payload, let store) = parts[1] else {
            return XCTFail("Expected Forge UI part")
        }
        XCTAssertEqual(payload.title, "Rows")
        guard case .array(let rows)? = store["rows"]?.rows else {
            return XCTFail("Expected materialized array")
        }
        XCTAssertEqual(rows.count, 2)
    }

    func testScopesDataFencesToTheNextForgeUIBlock() {
        let content = """
        ```forge-data id=rows
        [{"id":"first"}]
        ```
        ```forge-ui
        {"blocks":[]}
        ```
        ```forge-ui
        {"blocks":[]}
        ```
        """

        let parts = TranscriptEnvelope.parse(content)

        guard parts.count == 2,
              case .forgeUI(_, let firstStore) = parts[0],
              case .forgeUI(_, let secondStore) = parts[1] else {
            return XCTFail("Expected two Forge UI parts")
        }
        XCTAssertEqual(TranscriptEnvelope.rows(from: firstStore["rows"]?.rows ?? .null).count, 1)
        XCTAssertTrue(secondStore.isEmpty)
    }

    func testPreservesMalformedForgeFencesAsMarkdown() {
        let parts = TranscriptEnvelope.parse("```forge-data id=\"rows\"\nnot-json\n```")
        XCTAssertEqual(parts, [.markdown("```forge-data id=\"rows\"\nnot-json\n```")])
    }

    func testUsesLegacyHeaderIdentifierForJSONWithABlankIdentifier() {
        let content = """
        ```forge-data id=rows
        {"id":"","name":"kept"}
        ```
        ```forge-ui
        {"blocks":[]}
        ```
        """

        let parts = TranscriptEnvelope.parse(content)
        guard parts.count == 1, case .forgeUI(_, let store) = parts[0] else {
            return XCTFail("Expected Forge UI part")
        }
        XCTAssertEqual(TranscriptEnvelope.rows(from: store["rows"]?.rows ?? .null).first?["name"], .string("kept"))
    }

    func testMaterializesCSVDataFromStructuredAndLegacyFences() {
        let content = """
        ```forge-data id=legacy format=csv
        name,spend
        one,12.5
        ```
        ```forge-data
        {"id":"structured","format":"csv","data":"name,enabled\\ntwo,true"}
        ```
        ```forge-ui
        {"blocks":[]}
        ```
        """
        let parts = TranscriptEnvelope.parse(content)
        guard case .forgeUI(_, let store) = parts.last else {
            return XCTFail("Expected Forge UI part")
        }
        XCTAssertEqual(TranscriptEnvelope.rows(from: store["legacy"]!.rows).count, 1)
        XCTAssertEqual(TranscriptEnvelope.rows(from: store["structured"]!.rows).count, 1)
    }

    func testBuildsSummaryMetadataAndSyntheticDataInsideForge() throws {
        let payload = TranscriptForgeUIPayload(
            title: "Delivery",
            blocks: [
                .object([
                    "kind": .string("dashboard.summary"),
                    "id": .string("delivery-summary"),
                    "items": .array([
                        .object([
                            "label": .string("Total Spend"),
                            "value": .number(12.5)
                        ])
                    ])
                ])
            ]
        )

        let presentation = try TranscriptWindowBuilder.presentation(payload: payload, dataStore: [:])

        XCTAssertNotNil(presentation.metadata.view)
        XCTAssertEqual(presentation.dataStore["inline_deliverySummary"]?.rows, .array([
            .object(["totalSpend": .number(12.5)])
        ]))
    }

    func testBuildsCamelCaseSyntheticSummaryDataSource() throws {
        let payload = TranscriptForgeUIPayload(
            title: "Delivery",
            blocks: [
                .object([
                    "kind": .string("dashboard.summary"),
                    "id": .string("deliverySummary"),
                    "items": .array([
                        .object([
                            "label": .string("Total Spend"),
                            "value": .number(12.5)
                        ])
                    ])
                ])
            ]
        )

        let presentation = try TranscriptWindowBuilder.presentation(payload: payload, dataStore: [:])

        XCTAssertNotNil(presentation.dataStore["inline_deliverySummary"])
    }

    func testBuildsExplicitEmptyDataForAnUnfencedTranscriptDataSource() throws {
        let payload = TranscriptForgeUIPayload(
            title: "Current snapshot",
            blocks: [
                .object([
                    "id": .string("orders"),
                    "kind": .string("dashboard.table"),
                    "dataSourceRef": .string("orders"),
                    "columns": .array([
                        .object(["key": .string("name")])
                    ])
                ])
            ]
        )

        let presentation = try TranscriptWindowBuilder.presentation(payload: payload, dataStore: [:])

        XCTAssertEqual(presentation.dataStore["orders"]?.rows, .array([]))
        XCTAssertNotNil(presentation.metadata.dataSources["orders"])
    }

    func testDoesNotSynthesizeDataForANonSummaryBlockWithoutAReference() throws {
        let payload = TranscriptForgeUIPayload(
            title: "Notice",
            blocks: [
                .object([
                    "id": .string("notes"),
                    "kind": .string("dashboard.messages"),
                    "items": .array([.object(["title": .string("Observe")])])
                ])
            ]
        )

        let presentation = try TranscriptWindowBuilder.presentation(payload: payload, dataStore: [:])

        XCTAssertTrue(presentation.metadata.dataSources.isEmpty)
    }

    func testPreservesDataFenceWhenNoForgeUIAppears() {
        let content = "before\n```forge-data id=rows\n[{\"id\":\"one\"}]\n```\nafter"
        XCTAssertEqual(TranscriptEnvelope.parse(content), [.markdown(content)])
    }

    func testMaterializesQuotedMultilineCSVField() {
        let content = """
        ```forge-data id=rows format=csv
        name,note
        one,"line 1
        line 2"
        ```
        ```forge-ui
        {"blocks":[]}
        ```
        """
        let parts = TranscriptEnvelope.parse(content)
        guard case .forgeUI(_, let store) = parts.last,
              case .array(let rows)? = store["rows"]?.rows,
              case .object(let row) = rows.first else {
            return XCTFail("Expected materialized CSV row")
        }
        XCTAssertEqual(row["note"], .string("line 1\nline 2"))
    }

    func testPreservesDuplicateCSVHeadersAsRawData() {
        let content = """
        ```forge-data id=rows format=csv
        name,name
        one,two
        ```
        ```forge-ui
        {"blocks":[]}
        ```
        """
        let parts = TranscriptEnvelope.parse(content)
        guard case .forgeUI(_, let store) = parts.last else {
            return XCTFail("Expected Forge UI part")
        }
        XCTAssertEqual(store["rows"]?.rows, .string("name,name\none,two\n"))
    }

    func testDoesNotCarryDataAcrossInterveningMarkdown() {
        let content = """
        ```forge-data id=rows
        [{"id":"stale"}]
        ```
        This explanation separates data from the UI.
        ```forge-ui
        {"blocks":[]}
        ```
        """

        let parts = TranscriptEnvelope.parse(content)

        guard parts.count == 2,
              case .markdown(let markdown) = parts[0],
              case .forgeUI(_, let store) = parts[1] else {
            return XCTFail("Expected markdown followed by Forge UI")
        }
        XCTAssertTrue(markdown.contains("forge-data"))
        XCTAssertTrue(store.isEmpty)
    }

    func testRendersCanonicalSDKPartsWithoutReparsingMarkdown() {
        let parts = TranscriptEnvelope.fromCanonical([
            TranscriptCanonicalPart(
                kind: "forgeData",
                source: "```forge-data id=rows\n[{\"name\":\"kept\"}]\n```",
                data: TranscriptCanonicalData(
                    id: "rows",
                    payload: .array([.object(["name": .string("kept")])])
                )
            ),
            TranscriptCanonicalPart(
                kind: "forgeUI",
                source: "```forge-ui\n{\"blocks\":[]}\n```",
                payload: .object(["blocks": .array([])])
            )
        ])

        guard parts.count == 1,
              case .forgeUI(_, let store) = parts[0],
              case .array(let rows)? = store["rows"]?.rows,
              case .object(let row) = rows.first else {
            return XCTFail("Expected Forge UI with canonical data")
        }
        XCTAssertEqual(row["name"], .string("kept"))
    }

    func testProgressiveDataDoesNotLeakIntoLegacyForgeUI() {
        let parts = TranscriptEnvelope.fromCanonical([
            TranscriptCanonicalPart(
                kind: "forgeData",
                source: "progressive source must stay hidden",
                data: TranscriptCanonicalData(
                    version: 2,
                    scope: "campaign",
                    reportRef: "delivery",
                    sequence: 1,
                    id: "rows",
                    payload: .array([.object(["name": .string("leaked")])])
                )
            ),
            TranscriptCanonicalPart(
                kind: "forgeUI",
                payload: .object(["blocks": .array([])])
            )
        ])

        guard parts.count == 1, case .forgeUI(_, let store) = parts[0] else {
            return XCTFail("Expected one legacy Forge UI part")
        }
        XCTAssertTrue(store.isEmpty)
    }

    func testCanonicalReportAtomsStayHiddenBehindCompiledReport() {
        let parts = TranscriptEnvelope.fromCanonical([
            TranscriptCanonicalPart(kind: "markdown", text: "Forecast ready."),
            TranscriptCanonicalPart(
                kind: "forgeData",
                source: "hidden data",
                data: TranscriptCanonicalData(
                    version: 2,
                    scope: "forecast",
                    reportRef: "review",
                    sequence: 1,
                    id: "rows",
                    payload: .array([])
                )
            ),
            TranscriptCanonicalPart(kind: "forgeReport", source: "hidden report atom")
        ])

        XCTAssertEqual(parts, [.markdown("Forecast ready.")])
    }

    func testUpdatesInlineWindowWithoutAllocatingAnotherWindow() async {
        let runtime = ForgeRuntime()
        let initial = await runtime.openWindowInline(
            key: "transcript",
            title: "Initial",
            metadata: WindowMetadata()
        )

        let updated = await runtime.updateWindowInline(
            id: initial.id,
            title: "Updated",
            metadata: WindowMetadata(namespace: "updated")
        )
        let windowCount = await runtime.windows.count
        let metadata = await runtime.windowMetadata(id: initial.id)

        XCTAssertEqual(updated?.id, initial.id)
        XCTAssertEqual(updated?.title, "Updated")
        XCTAssertEqual(windowCount, 1)
        XCTAssertEqual(metadata?.namespace, "updated")
    }
}
