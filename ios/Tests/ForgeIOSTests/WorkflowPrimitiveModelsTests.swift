import XCTest
@testable import ForgeIOSRuntime

final class WorkflowPrimitiveModelsTests: XCTestCase {
    func testPresentationPrimitiveContractsDecodeAndRoundTrip() throws {
        let source = #"""
        {
          "id": "record",
          "dataSourceRef": "record",
          "dataStateBoundary": {"dataSourceRefs":["record","summary"],"allowPartial":true,"emptyMessage":"No record","suppressErrorWhen":{"source":"windowForm","field":"sharedError","notEmpty":true},"errorAction":{"label":"Retry records","icon":"refresh","dataSourceRef":"record","bypassCache":true}},
          "relationDrill": {"countField":"childCount","singularLabel":"child","pluralLabel":"children","link":{"windowKey":"children"}},
          "notificationRules": {"rules":[{"id":"missing","intent":"warning","message":"Missing input","visibleWhen":{"source":"form","field":"name","empty":true}}]},
          "metricSummary": {"columns":3,"metrics":[{"id":"spend","label":"Spend","field":"spend","format":"currency2","comparisonField":"delta","betterWhen":"lower"}]},
          "detailView": {"columns":2,"responsiveColumns":{"phone":1},"sections":[{"id":"general","label":"General","fields":[{"id":"name","label":"Name","field":"name","copyable":true}]}]},
          "masterDetail": {"stateKey":"selectedRecord","identityFields":["id"],"master":{"containerId":"list"},"detail":{"containerId":"detail"},"selectionInvalidation":"clear","responsive":{"wide":"split","narrow":"drill"}}
        }
        """#.data(using: .utf8)!

        let decoded = try JSONDecoder().decode(ContainerDef.self, from: source)
        XCTAssertEqual(decoded.dataStateBoundary?.dataSourceRefs, ["record", "summary"])
        XCTAssertEqual(decoded.dataStateBoundary?.errorAction?.label, "Retry records")
        XCTAssertEqual(decoded.dataStateBoundary?.errorAction?.bypassCache, true)
        XCTAssertEqual(decoded.relationDrill?.pluralLabel, "children")
        XCTAssertEqual(decoded.notificationRules?.rules.first?.id, "missing")
        XCTAssertEqual(decoded.metricSummary?.metrics.first?.betterWhen, "lower")
        XCTAssertEqual(decoded.detailView?.sections.first?.fields.first?.copyable, true)
        XCTAssertEqual(decoded.masterDetail?.detail.containerId, "detail")

        let encoded = try JSONEncoder().encode(decoded)
        let roundTrip = try JSONDecoder().decode(ContainerDef.self, from: encoded)
        XCTAssertEqual(roundTrip.metricSummary?.columns, 3)
        XCTAssertEqual(roundTrip.detailView?.responsiveColumns["phone"], 1)
    }

    func testDataBoundaryStateDistinguishesPartialFailure() {
        let state = WorkflowPrimitiveRuntime.dataStateBoundaryKind(
            controls: [ControlState(), ControlState(error: "failed")],
            collections: [[["id": .number(1)]], []],
            allowPartial: true
        )
        XCTAssertEqual(state, .partial)
    }

    func testCompletePrimitiveCatalogDecodesAndRoundTrips() throws {
        let source = #"""
        {
          "id":"catalog",
          "mutationCommand":{"commandId":"save","dataSourceRef":"writer"},
          "editableCollection":{"identityFields":["id"],"operations":[{"id":"edit","label":"Edit","tooltip":"Requires one row","requiresSelection":true}]},
          "assignmentPicker":{"availableDataSourceRef":"available","assignedDataSourceRef":"assigned"},
          "statusWorkflow":{"stateField":"status","transitions":[{"id":"approve","to":"approved","label":"Approve","command":{"dataSourceRef":"writer"}}]},
          "treeEditor":{"dataSourceRef":"tree","childrenField":"children"},
          "wizard":{"steps":[{"id":"one","label":"One","containerId":"stepOne"}]},
          "uploadCollection":{"accept":["image/*"],"upload":{"dataSourceRef":"upload"}},
          "derivedDataSource":{"sources":["left"],"pipeline":[{"operation":"select","source":"left"}]},
          "permissionBoundary":{"mode":"resource","capability":"read"},
          "responsiveDataGrid":{"identityColumns":["id"],"breakpoints":{"phone":{"columns":["name"],"stickyColumns":[],"columnOverrides":{"name":{"label":"Compact name","width":180}},"rowLayout":"cards","readOnlyCards":true}}},
          "historyDiff":{"beforeField":"before","afterField":"after","redactFields":["secret"]},
          "scheduleEditor":{"startField":"start","endField":"end","timeZoneField":"timeZone"},
          "draftForm":{"dataSourceRef":"draft","submit":{"dataSourceRef":"writer"}},
          "queryToolbar":{"items":[{"id":"filter","type":"filter"}],"density":"compact"},
          "stableTabs":{"defaultSelectedTabId":"one","renderActiveTabPanelOnly":true},
          "resourceHeader":{"titleField":"name","fields":[{"label":"ID","field":"id"}],"actions":[{"id":"watch","label":"Watch"}]}
        }
        """#.data(using: .utf8)!

        let decoded = try JSONDecoder().decode(ContainerDef.self, from: source)
        XCTAssertEqual(decoded.mutationCommand?.commandId, "save")
        XCTAssertEqual(decoded.editableCollection?.operations?.first?.id, "edit")
        XCTAssertEqual(decoded.editableCollection?.operations?.first?.tooltip, "Requires one row")
        XCTAssertEqual(decoded.assignmentPicker?.assignedDataSourceRef, "assigned")
        XCTAssertEqual(decoded.statusWorkflow?.transitions.first?.id, "approve")
        XCTAssertEqual(decoded.treeEditor?.childrenField, "children")
        XCTAssertEqual(decoded.wizard?.steps.first?.containerId, "stepOne")
        XCTAssertEqual(decoded.uploadCollection?.upload.dataSourceRef, "upload")
        XCTAssertEqual(decoded.derivedDataSource?.pipeline.first?.operation, "select")
        XCTAssertEqual(decoded.permissionBoundary?.capability, "read")
        XCTAssertEqual(decoded.responsiveDataGrid?.breakpoints?["phone"]?.rowLayout, "cards")
        XCTAssertEqual(decoded.responsiveDataGrid?.breakpoints?["phone"]?.columnOverrides?["name"]?["label"], .string("Compact name"))
        XCTAssertEqual(decoded.historyDiff?.redactFields, ["secret"])
        XCTAssertEqual(decoded.scheduleEditor?.timeZoneField, "timeZone")
        XCTAssertEqual(decoded.draftForm?.submit?.dataSourceRef, "writer")
        XCTAssertEqual(decoded.queryToolbar?.items?.first?.id, "filter")
        XCTAssertEqual(decoded.stableTabs?.defaultSelectedTabId, "one")
        XCTAssertEqual(decoded.resourceHeader?.actions?.first?.id, "watch")

        let roundTrip = try JSONDecoder().decode(ContainerDef.self, from: JSONEncoder().encode(decoded))
        XCTAssertEqual(roundTrip.statusWorkflow?.transitions.first?.command.dataSourceRef, "writer")
        XCTAssertEqual(roundTrip.responsiveDataGrid?.breakpoints?["phone"]?.readOnlyCards, true)
    }

    func testPresentationRecordUsesFormThenCollectionThenMetrics() {
        XCTAssertEqual(
            WorkflowPrimitiveRuntime.presentationRecord(
                form: ["id": .number(3)],
                collection: [["id": .number(2)]],
                metrics: ["id": .number(1)]
            )["id"],
            .number(3)
        )
    }

    func testHistoryDiffIgnoresNoiseAndRedactsSensitiveValues() {
        let spec = HistoryDiffSpec(
            beforeField: "before",
            afterField: "after",
            ignoreFields: ["updatedAt"],
            fieldLabels: ["name": "Display name"],
            redactFields: ["secret"]
        )
        let entries = WorkflowPrimitiveRuntime.historyDiffEntries(
            before: .object(["name": .string("Old"), "secret": .string("one"), "updatedAt": .string("a")]),
            after: .object(["name": .string("New"), "secret": .string("two"), "updatedAt": .string("b")]),
            spec: spec
        )
        XCTAssertEqual(entries.map(\.path), ["name", "secret"])
        XCTAssertEqual(entries.first?.label, "Display name")
        XCTAssertEqual(entries.last?.before, "••••")
        XCTAssertTrue(entries.last?.redacted == true)
    }

    func testPermissionBoundaryFailsClosedForMissingRowGrant() {
        let authorization: [String: JSONValue] = [
            "resource": .object(["capabilities": .object(["read": .bool(true)])])
        ]
        XCTAssertTrue(WorkflowPrimitiveRuntime.permissionAllows(
            spec: PermissionBoundarySpec(mode: "resource", capability: "read"),
            authorization: authorization
        ))
        XCTAssertFalse(WorkflowPrimitiveRuntime.permissionAllows(
            spec: PermissionBoundarySpec(mode: "selection", identityField: "id", capability: "edit"),
            authorization: authorization,
            rows: [["id": .number(1)], ["id": .number(2)]],
            grants: [["resourceId": .number(1), "capabilities": .object(["edit": .bool(true)])]]
        ))
    }

    func testDerivedPipelineJoinsGroupsSortsAndEnforcesCardinality() throws {
        let specData = #"""
        {"sources":["left","right"],"maxRows":20,"pipeline":[
          {"operation":"join","source":"right","on":["id"],"fields":{"category":"category"}},
          {"operation":"group","groupBy":["category"],"measures":[{"target":"total","source":"amount","operation":"sum"}]},
          {"operation":"sort","orderBy":[{"columnId":"total","direction":"desc"}]}
        ]}
        """#.data(using: .utf8)!
        let spec = try JSONDecoder().decode(DerivedDataSourceSpec.self, from: specData)
        let rows = try DerivedDataSourceRuntime.run(
            sources: [
                "left": [["id": .number(1), "amount": .number(3)], ["id": .number(2), "amount": .number(8)]],
                "right": [["id": .number(1), "category": .string("A")], ["id": .number(2), "category": .string("B")]]
            ],
            spec: spec
        )
        XCTAssertEqual(rows.map { $0["category"] }, [.string("B"), .string("A")])
        XCTAssertEqual(rows.first?["total"], .number(8))

        let duplicateRight: [String: [[String: JSONValue]]] = [
            "left": [["id": .number(1)]],
            "right": [["id": .number(1)], ["id": .number(1)]]
        ]
        XCTAssertThrowsError(try DerivedDataSourceRuntime.run(sources: duplicateRight, spec: spec))
    }

    func testResponsiveGridFallsBackFromPhoneToNarrowThenDesktop() throws {
        let data = #"{"breakpoints":{"narrow":{"columns":["name"],"rowLayout":"cards"},"desktop":{"columns":["id","name"],"rowLayout":"table"}}}"#.data(using: .utf8)!
        let spec = try JSONDecoder().decode(ResponsiveDataGridSpec.self, from: data)
        XCTAssertEqual(WorkflowPrimitiveRuntime.responsiveDataGridState(spec: spec, target: "phone")?.columns, ["name"])
        XCTAssertEqual(WorkflowPrimitiveRuntime.responsiveDataGridState(spec: spec, target: "tablet")?.columns, ["id", "name"])
    }

    func testScheduleValidationCoversRangeDurationOverlapAndTimezoneErrors() {
        let spec = ScheduleEditorSpec(startField: "start", endField: "end", allowOverlap: false, minDuration: "30m")
        let rows: [[String: JSONValue]] = [
            ["start": .string("2026-09-08T10:00:00Z"), "end": .string("2026-09-08T11:00:00Z")],
            ["start": .string("2026-09-08T10:30:00Z"), "end": .string("2026-09-08T10:40:00Z")],
            ["start": .string("bad"), "end": .string("2026-09-08T12:00:00Z"), "_scheduleErrors": .object(["start": .string("DST gap")])]
        ]
        let result = WorkflowPrimitiveRuntime.validateSchedule(rows: rows, spec: spec)
        XCTAssertFalse(result.valid)
        XCTAssertTrue(result.errors.contains(ScheduleValidationError(index: 1, code: "min_duration")))
        XCTAssertTrue(result.errors.contains(ScheduleValidationError(index: 1, code: "overlap")))
        XCTAssertTrue(result.errors.contains(ScheduleValidationError(index: 2, code: "invalid_date")))
        XCTAssertTrue(result.errors.contains(ScheduleValidationError(index: 2, code: "timezone")))
    }

    func testTreeSelectionCascadesToDescendants() {
        let nodes: [[String: JSONValue]] = [[
            "id": .string("root"),
            "children": .array([
                .object(["id": .string("a")]),
                .object(["id": .string("b"), "children": .array([.object(["id": .string("c")])])])
            ])
        ]]
        let spec = TreeEditorSpec(childrenField: "children", identityField: "id", cascade: "descendants")
        let selected = WorkflowPrimitiveRuntime.toggleTreeSelection(nodes: nodes, selected: [], key: "root", checked: true, spec: spec)
        XCTAssertEqual(selected, Set(["root", "a", "b", "c"]))
        XCTAssertTrue(WorkflowPrimitiveRuntime.toggleTreeSelection(nodes: nodes, selected: selected, key: "b", checked: false, spec: spec).isDisjoint(with: ["b", "c"]))
    }

    func testUploadValidationAndMCPBlobEncodingUseActualBytes() throws {
        let spec = UploadCollectionSpec(
            accept: ["image/*", ".txt"], multiple: true, maxFiles: 2, maxBytes: 4,
            transport: "mcpBlob", blobField: "attachments",
            upload: MutationCommandDef(dataSourceRef: "upload")
        )
        let files = [UploadFileValue(name: "a.txt", mimeType: "text/plain", data: Data([0, 1, 2]))]
        XCTAssertTrue(WorkflowPrimitiveRuntime.validateUpload(files: files, spec: spec).valid)
        let payload = try WorkflowPrimitiveRuntime.encodeUpload(files: files, spec: spec)
        let blob = payload["attachments"]?.arrayValue?.first?.objectValue
        XCTAssertEqual(blob?["filename"], .string("a.txt"))
        XCTAssertEqual(blob?["data"], .string("AAEC"))
        let oversized = [UploadFileValue(name: "large.png", mimeType: "image/png", data: Data(repeating: 1, count: 5))]
        XCTAssertFalse(WorkflowPrimitiveRuntime.validateUpload(files: oversized, spec: spec).valid)
    }

    func testMasterDetailRestoresByIdentityAndBuildsTypedParameters() {
        let rows: [[String: JSONValue]] = [["id": .number(1), "name": .string("One")], ["id": .number(2), "name": .string("Two")]]
        let restored = WorkflowPrimitiveRuntime.resolveMasterDetailSelection(
            rows: rows, selected: nil, persisted: ["id": .number(2)], identityFields: ["id"]
        )
        XCTAssertEqual(restored?["name"], .string("Two"))
        let region = MasterDetailRegionSpec(
            containerId: "detail",
            parameters: ["RecordId": .object(["source": .string("row"), "selector": .string("id"), "wrap": .string("array")])]
        )
        XCTAssertEqual(WorkflowPrimitiveRuntime.masterDetailParameters(spec: region, row: restored ?? [:])["RecordId"], .array([.number(2)]))
        XCTAssertNil(WorkflowPrimitiveRuntime.resolveMasterDetailSelection(rows: rows, selected: nil, persisted: ["id": .number(3)], identityFields: ["id"]))
    }

    func testResourceModelUnmarshalsValidatesAndMarshalsChangedPayload() throws {
        let metadataData = #"""
        {
          "schemas":{"record":{"type":"object","identity":["id"],"required":["id","name"],"additionalProperties":false,"properties":{"id":{"type":"integer"},"name":{"type":"string","minLength":1},"cap":{"type":"integer","nullable":true}}}},
          "resourceModels":{"record":{"schemaRef":"record","read":{"dataSourceRef":"record_read"},"write":{"dataSourceRef":"record_patch","inputPath":"Records","mode":"changed"},"fields":{"id":{"read":"id","write":"Id","codec":"integer"},"name":{"read":"display_name","write":"Name","codec":"string","trim":true},"cap":{"read":"daily_cap","write":"DailyCap","codec":"integer","empty":"null"}}}}
        }
        """#.data(using: .utf8)!
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: metadataData)
        let canonical = try ResourceModelRuntime.unmarshal(
            value: .object(["id": .number(1), "display_name": .string(" Old "), "daily_cap": .string("")]),
            modelRef: "record", schemas: metadata.schemas, models: metadata.resourceModels
        )
        XCTAssertEqual(canonical.objectValue?["name"], .string("Old"))
        XCTAssertEqual(canonical.objectValue?["cap"], .null)
        let payload = try ResourceModelRuntime.marshal(
            draft: .object(["id": .number(1), "name": .string("New"), "cap": .null]),
            baseline: .object(["id": .number(1), "name": .string("Old"), "cap": .null]),
            modelRef: "record", schemas: metadata.schemas, models: metadata.resourceModels
        )
        XCTAssertEqual(payload["Records"]?.objectValue?["Id"], .number(1))
        XCTAssertEqual(payload["Records"]?.objectValue?["Name"], .string("New"))
        XCTAssertNil(payload["Records"]?.objectValue?["DailyCap"])
        XCTAssertThrowsError(try ResourceModelRuntime.marshal(
            draft: .object(["id": .number(2), "name": .string("New")]),
            baseline: .object(["id": .number(1), "name": .string("Old")]),
            modelRef: "record", schemas: metadata.schemas, models: metadata.resourceModels
        ))
    }

    func testResourceModelHooksAndNestedCollectionSemantics() throws {
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: #"""
        {
          "schemas": {
            "root": {"type":"object","identity":["id"],"required":["id","name"],"properties":{"id":{"type":"integer"},"name":{"type":"string"},"rows":{"type":"array","items":{"$ref":"row"}}}},
            "row": {"type":"object","identity":["id"],"required":["id","clientKey"],"properties":{"id":{"type":"integer"},"clientKey":{"type":"string"},"value":{"type":"integer"}}}
          },
          "resourceModels": {
            "root": {"schemaRef":"root","write":{"inputPath":"Root","mode":"overlayBaseline"},"hooks":{"beforeUnmarshal":"beforeRead","afterUnmarshal":"afterRead","beforeMarshal":"beforeWrite","afterMarshal":"afterWrite"},"fields":{"id":{"write":"Id"},"name":{"write":"Name"},"rows":{"write":"Rows","collection":{"modelRef":"row","identity":["id"],"clientKey":"clientKey","mode":"merge","preserveOrder":false}}}},
            "row": {"schemaRef":"row","fields":{"id":{"write":"Id"},"clientKey":{"write":"-"},"value":{"write":"Value"}}}
          }
        }
        """#.data(using: .utf8)!)
        let hook: ResourceModelHook = { name, value in
            guard var object = value.objectValue else { return value }
            switch name {
            case "beforeRead": object["name"] = .string("before")
            case "afterRead": object["name"] = .string("after")
            case "beforeWrite": object["name"] = .string("hooked")
            case "afterWrite": object["Name"] = .string("done")
            default: break
            }
            return .object(object)
        }
        let read = try ResourceModelRuntime.unmarshal(value: .object(["id": .number(1), "name": .string("raw")]), modelRef: "root", schemas: metadata.schemas, models: metadata.resourceModels, hook: hook)
        XCTAssertEqual(read.objectValue?["name"], .string("after"))
        let baseline: JSONValue = .object(["id": .number(1), "name": .string("old"), "rows": .array([
            .object(["id": .number(11), "clientKey": .string("a"), "value": .number(1)]),
            .object(["id": .number(12), "clientKey": .string("b"), "value": .number(2)])
        ])])
        let payload = try ResourceModelRuntime.marshal(draft: .object(["id": .number(1), "name": .string("new"), "rows": .array([
            .object(["id": .number(12), "clientKey": .string("b"), "value": .number(20)]),
            .object(["id": .number(11), "clientKey": .string("a"), "value": .number(10)]),
            .object(["id": .number(0), "clientKey": .string("new-a"), "value": .number(30)]),
            .object(["id": .number(0), "clientKey": .string("new-b"), "value": .number(40)])
        ])]), baseline: baseline, modelRef: "root", schemas: metadata.schemas, models: metadata.resourceModels, hook: hook)
        XCTAssertEqual(payload["Root"]?.objectValue?["Name"], .string("done"))
        let rows = payload["Root"]?.objectValue?["Rows"]?.arrayValue ?? []
        XCTAssertEqual(rows.compactMap { $0.objectValue?["Id"] }, [.number(11), .number(12), .number(0), .number(0)])
        XCTAssertTrue(rows.allSatisfy { $0.objectValue?["clientKey"] == nil })
        XCTAssertThrowsError(try ResourceModelRuntime.marshal(draft: .object(["id": .number(1), "name": .string("new"), "rows": .array([
            .object(["id": .number(0), "clientKey": .string("same"), "value": .number(1)]),
            .object(["id": .number(0), "clientKey": .string("same"), "value": .number(2)])
        ])]), baseline: baseline, modelRef: "root", schemas: metadata.schemas, models: metadata.resourceModels))
        let identityChangingHook: ResourceModelHook = { name, value in
            guard name == "beforeWrite", var object = value.objectValue else { return value }
            object["id"] = .number(2); return .object(object)
        }
        XCTAssertThrowsError(try ResourceModelRuntime.marshal(draft: .object(["id": .number(1), "name": .string("new")]), baseline: baseline, modelRef: "root", schemas: metadata.schemas, models: metadata.resourceModels, hook: identityChangingHook))
    }

    func testMutationCommandExecutesOnceAndReconcilesCommittedRows() async throws {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(
            view: ViewDef(content: ContentDef()),
            dataSources: [
                "source": DataSourceDef(),
                "writer": DataSourceDef(),
                "records": DataSourceDef()
            ]
        )
        let window = await runtime.openWindowInline(key: "test", title: "Test", metadata: metadata)
        await runtime.setDataSourceCollection(
            windowID: window.id,
            dataSourceRef: "records",
            rows: [["id": .number(1), "name": .string("before"), "retained": .bool(true)]]
        )
        let capture = MutationLoaderCapture()
        await runtime.registerDataSourceLoader { request in
            await capture.record(request)
            if request.dataSourceRef == "writer" {
                return ForgeRuntime.DataSourceFetchResult(rows: [["id": .number(1), "name": .string("after")]])
            }
            return ForgeRuntime.DataSourceFetchResult()
        }
        let command = MutationCommandDef(
            commandId: "save-record",
            invocationParameter: "invocationId",
            dataSourceRef: "writer",
            successState: ["saved": .bool(true)],
            reconcile: ReconcileSpec(mode: "merge", dataSourceRef: "records", identityField: "id")
        )

        let result = await runtime.executeMutationCommand(
            windowID: window.id,
            sourceDataSourceRef: "source",
            command: command,
            extras: ["id": .number(1), "name": .string("after")]
        )

        XCTAssertTrue(result.accepted)
        XCTAssertEqual(result.status, "succeeded")
        XCTAssertFalse(result.invocationId.isEmpty)
        let rows = await runtime.dataSourceCollection(windowID: window.id, dataSourceRef: "records")
        let windowForm = await runtime.windowFormJSONValue(windowID: window.id)
        let writerCount = await capture.count(for: "writer")
        let lastInputParameters = await capture.lastInputParameters
        let commandState = await runtime.mutationCommandState(windowID: window.id, command: command)
        XCTAssertEqual(rows.first?["name"], .string("after"))
        XCTAssertEqual(rows.first?["retained"], .bool(true))
        XCTAssertEqual(windowForm["saved"], .bool(true))
        XCTAssertEqual(writerCount, 1)
        XCTAssertEqual(lastInputParameters?["invocationId"], .string(result.invocationId))
        XCTAssertEqual(commandState.writerStatus, .succeeded)
    }

    func testSelectionConfirmationMatchesWebContract() {
        let command = MutationCommandDef(
            confirmSelection: SelectionConfirmationDef(
                action: "Remove", singularLabel: "Creative", pluralLabel: "Creatives",
                labelField: "name", identityField: "id", maxItems: 2,
                suffix: "Inventory is retained."
            ),
            dataSourceRef: "writer"
        )
        let message = resolveMutationConfirmation(
            command: command,
            extras: ["selectedRows": .array([
                .object(["id": .number(7), "name": .string("Alpha")]),
                .object(["id": .number(8), "name": .string("Beta")]),
                .object(["id": .number(9), "name": .string("Gamma")])
            ])]
        )
        XCTAssertEqual(message, "Remove 3 Creatives: Alpha (7), Beta (8), +1 more? Inventory is retained.")
    }

    func testMutationValidationAndConfirmationCancelDoNotInvokeWriter() async throws {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(
            view: ViewDef(content: ContentDef()),
            dataSources: ["source": DataSourceDef(), "writer": DataSourceDef()]
        )
        let window = await runtime.openWindowInline(key: "test", title: "Test", metadata: metadata)
        await runtime.setDataSourceForm(windowID: window.id, dataSourceRef: "source", values: ["allowed": .bool(false)])
        let capture = MutationLoaderCapture()
        await runtime.registerDataSourceLoader { request in
            await capture.record(request)
            return ForgeRuntime.DataSourceFetchResult()
        }
        let invalid = MutationCommandDef(
            commandId: "invalid",
            invalidMessage: "Not allowed",
            dataSourceRef: "writer",
            validateWhen: DashboardConditionDef(source: "form", field: "allowed", equals: .bool(true))
        )
        let invalidResult = await runtime.executeMutationCommand(
            windowID: window.id,
            sourceDataSourceRef: "source",
            command: invalid
        )
        XCTAssertEqual(invalidResult.status, "invalid")

        let confirmation = MutationCommandDef(commandId: "confirm", confirm: "Continue?", dataSourceRef: "writer")
        let cancelled = await runtime.executeMutationCommand(
            windowID: window.id,
            sourceDataSourceRef: "source",
            command: confirmation,
            confirm: { _ in false }
        )
        XCTAssertEqual(cancelled.status, "cancelled")
        let totalCount = await capture.totalCount
        XCTAssertEqual(totalCount, 0)
    }

    func testMutationTimeoutRemainsGuardedUntilAuthoritativeResolution() async throws {
        let runtime = ForgeRuntime()
        let metadata = WindowMetadata(
            view: ViewDef(content: ContentDef()),
            dataSources: ["source": DataSourceDef(), "writer": DataSourceDef()]
        )
        let window = await runtime.openWindowInline(key: "test", title: "Test", metadata: metadata)
        await runtime.registerDataSourceLoader { _ in
            try await Task.sleep(for: .seconds(5))
            return ForgeRuntime.DataSourceFetchResult()
        }
        let command = MutationCommandDef(commandId: "slow", timeoutMs: 1_000, dataSourceRef: "writer")
        let result = await runtime.executeMutationCommand(
            windowID: window.id,
            sourceDataSourceRef: "source",
            command: command
        )
        XCTAssertEqual(result.status, "indeterminate")
        let guardedBeforeResolution = await runtime.mutationCommandState(windowID: window.id, command: command).guarded
        let resolved = await runtime.resolveIndeterminateMutationCommand(windowID: window.id, command: command)
        let guardedAfterResolution = await runtime.mutationCommandState(windowID: window.id, command: command).guarded
        XCTAssertTrue(guardedBeforeResolution)
        XCTAssertTrue(resolved)
        XCTAssertFalse(guardedAfterResolution)
    }
}

private actor MutationLoaderCapture {
    private var requests: [ForgeRuntime.DataSourceFetchRequest] = []

    func record(_ request: ForgeRuntime.DataSourceFetchRequest) {
        requests.append(request)
    }

    func count(for ref: String) -> Int {
        requests.filter { $0.dataSourceRef == ref }.count
    }

    var totalCount: Int { requests.count }
    var lastInputParameters: [String: JSONValue]? { requests.last?.input.parameters }
}
