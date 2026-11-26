import XCTest

@testable import ForgeIOSRuntime
@testable import ForgeIOSUI

private actor PreparedReadLog {
    var calls: [ForgeRuntime.DataSourceFetchRequest] = []
    func add(_ request: ForgeRuntime.DataSourceFetchRequest) { calls.append(request) }
}

final class PreparedSelectionTests: XCTestCase {
    typealias Row = [String: JSONValue]
    let script = #"""
        ({
            draft: ({context, rows, parameters, invocationId, mapping, descriptors, rowCases, draftModel}) => {
                if (context.Context || context.handlers || context.signals.collection || context.metadata.resourceModels) throw Error('Leaked non-source context');
                if (context.signals.form.peek().unrelated || context.authorization.principal.subject !== 'editor') throw Error('Wrong source state');
                if (!invocationId || parameters.owner !== '0007' || mapping.fieldOrder.join(',') !== 'caption' || Object.hasOwn(mapping,'cases'))
                    throw Error('Invalid preparation envelope');
                if (mapping.uploads.text.upload !== null) throw Error('Missing explicit null on the declared upload');
                if (descriptors.length !== 2 || rowCases.join(',') !== '0,1,0') throw Error('Duplicate or unordered mapped case');
                if (descriptors[0].modelRef !== 'note' || descriptors[1].values.format !== 'other' || !descriptors[0].schema.properties.caption)
                    throw Error('Expected only selected descriptors');
                return {labels:rows.map(row=>row.caption), kinds:rowCases, selected:parameters.Ids, seed:draftModel.fields.seed.default};
            },
            effect: ({context})=>{context.signals.windowForm.value={unexpected:true};return {};},
            invalid:()=>[],
            simple:({rows})=>({count:rows.length})
        })
        """#
    private func fixture(handler: String = "draft", httpPath: String? = nil) async throws -> (
        ForgeRuntime, String, EditableCollectionSpec, EditableCollectionOperationSpec
    ) {
        let source: [String: Any] = httpPath.map { ["service": ["uri": $0, "method": "POST"], "selectors": ["data": "rows"]] } ?? [:]
        let json: [String: Any] = [
            "namespace": "Catalog", "actions": ["code": script], "dialogs": [["id": "editor", "dataSourceRef": "draft"]],
            "dataSource": ["list": ["selectionMode": "multi"], "reader": source, "draft": ["resourceModelRef": "editor"]],
            "resourceModels": ["note": ["schemaRef": "note"], "editor": ["schemaRef": "draft", "fields": ["seed": ["default": "initial"]]]],
            "schemas": [
                "note": ["type": "object", "properties": ["caption": ["type": "string"]]],
                "draft": ["type": "object", "properties": ["seed": ["type": "string"]]],
            ],
            "resourceMappings": [
                "noteTypes": [
                    "uploads": ["text": ["accept": [".txt"], "upload": NSNull()]],
                    "selectors": ["primary.kind", "kind"], "fieldOrder": ["caption"],
                    "cases": ["known": ["modelRef": "note", "values": ["format": "normal"]]],
                    "default": ["modelRef": "note", "values": ["format": "other"]],
                ]
            ],
            "authorizationSnapshot": ["principal": ["subject": "editor", "roles": ["write"]]],
        ]
        let meta = try JSONDecoder().decode(WindowMetadata.self, from: JSONSerialization.data(withJSONObject: json))
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [SelectionReadProtocol.self]
        let runtime = ForgeRuntime(windowMetadataBaseURL: URL(string: "https://lookup.test")!, session: URLSession(configuration: config))
        let id = await runtime.openWindowInline(key: "catalog", title: "Notes", metadata: meta).id
        let op: [String: Any] = [
            "id": "edit", "label": "Edit", "dialogId": "editor",
            "visibleWhen": ["source": "authorization", "field": "principal.roles", "contains": "write"],
            "disabledWhen": ["source": "windowForm", "field": "opening", "equals": true],
            "selection": ["min": 1, "max": 4, "every": ["source": "form", "field": "canEdit", "equals": true]],
            "parameters": [["name": "owner", "in": "windowForm", "location": "owner"]],
            "prepareSelection": [
                "dataSourceRef": "reader", "idsParameter": "Ids", "identityField": "id", "scopeFields": ["parent.id": "owner"],
                "mappingRef": "noteTypes",
                "pendingField": "opening", "errorField": "problem", "prepare": "Catalog." + handler,
            ],
        ]
        let operation = try JSONDecoder().decode(EditableCollectionOperationSpec.self, from: JSONSerialization.data(withJSONObject: op))
        let spec = EditableCollectionSpec(dataSourceRef: "list", operations: [operation])
        let ids: [JSONValue] = [.number(1), .string("9007199254740993"), .string("opaque ")]
        await select(runtime, id, ids: ids)
        await runtime.setWindowFormValue(windowID: id, values: ["owner": .string("0007")])
        await runtime.setDataSourceForm(windowID: id, dataSourceRef: "draft", values: ["existing": .bool(true)])
        await runtime.setDataSourceCollection(windowID: id, dataSourceRef: "reader", rows: [["old": .bool(true)]])
        return (runtime, id, spec, operation)
    }
    func select(_ runtime: ForgeRuntime, _ id: String, ids: [JSONValue], canEdit: Bool = true) async {
        let ds = WindowIdentity(windowID: id).dataSourceID(ref: "list")
        let rows = ids.map { ["id": $0, "canEdit": .bool(canEdit)] }
        let state = SelectionState(selected: rows.first, selection: rows, rowIndex: 0)
        await runtime.dataSourceRuntime.setSelection(dataSourceID: ds, selection: state)
        await (await runtime.signals.selection(dataSourceID: ds)).set(state)
    }
    func sample() -> [Row] {
        [
            ["id": .string("opaque "), "caption": .string("three"), "kind": .string("known")],
            ["id": .string("01"), "caption": .string("one"), "primary": .object(["kind": .string("known")])],
            ["id": .string("09007199254740993"), "caption": .string("two"), "kind": .string("alternative")],
        ]
        .map { $0.merging(["parent": .object(["id": .number(7)])]) { a, _ in a } }
    }
    private func parentFixture(_ identity: JSONValue = .string("001")) async throws -> (
        ForgeRuntime, String, EditableCollectionSpec, EditableCollectionOperationSpec, WindowMetadata
    ) {
        let op: [String: Any] = [
            "id": "new", "label": "New", "dialogId": "editor",
            "visibleWhen": ["source":"authorization", "field":"principal.roles", "contains":"write"],
            "parameters": [["name":"Parent", "in":"windowForm", "location":"parent"]],
            "prepareSelection": ["dataSourceRef":"reader", "parentParameter":"Parent", "identityField":"id", "prepare":"Editor.seed"]
        ]
        let collection: [String:Any] = ["dataSourceRef":"list", "operations":[op]]
        let json: [String:Any] = [
            "namespace":"Editor", "authorizationSnapshot":["principal":["subject":"owner","roles":["write"]]],
            "dialogs":[["id":"editor","dataSourceRef":"draft"]],
            "dataSource":["list":[:],"draft":[:],"reader":["parameters":[["name":"Parent","in":"windowForm","location":"parent"]]]],
            "view":["content":["containers":[["id":"list","editableCollection":collection]]]],
            "actions":["code":"({seed:({rows,parameters})=>({id:rows[0].id,caption:rows[0].caption,bound:parameters.Parent})})"]
        ]
        let metadata = try JSONDecoder().decode(WindowMetadata.self, from: JSONSerialization.data(withJSONObject: json))
        let spec = try XCTUnwrap(metadata.view?.content?.containers.first?.editableCollection)
        let runtime = ForgeRuntime()
        let id = await runtime.openWindowInline(key: "catalog", title: "Catalog", metadata: metadata).id
        await runtime.setWindowFormValue(windowID: id, values: ["parent": identity])
        return (runtime, id, spec, try XCTUnwrap(spec.operations?.first), metadata)
    }

    func testParentColdPreservesScalarAndSingletonShapeWithoutRequiringGridSelection() async throws {
        for identity: JSONValue in [.string("001"), .array([.string("001")])] {
            let (runtime,id,spec,op,_) = try await parentFixture(identity)
            let reads = PreparedReadLog()
            await runtime.registerDataSourceLoader { request in
                await reads.add(request)
                return .init(rows:[["id":.number(1),"caption":.string("New draft")]])
            }
            if identity.arrayValue != nil { await select(runtime,id,ids:[.string("unrelated")]) }
            let result = await runtime.prepareEditableSelection(windowID:id,sourceDataSourceRef:"list",collection:spec,operation:op)
            XCTAssertEqual(result.status,"opened",result.error ?? "")
            let requests = await reads.calls
            XCTAssertEqual(requests.count,1)
            XCTAssertEqual(requests.first?.input.parameters["Parent"],identity)
            XCTAssertEqual(requests.first?.resolvedInputs["Parent"],identity)
            let draft = await runtime.dataSourceForm(windowID:id,dataSourceRef:"draft")
            XCTAssertEqual(draft,["id":.number(1),"caption":.string("New draft"),"bound":identity])
        }
    }

    func testParentWarmRequiresQualifiedReadForCurrentMetadataAndUnmodifiedCollection() async throws {
        let (runtime,id,spec,op,metadata) = try await parentFixture()
        let log = PreparedReadLog()
        await runtime.registerDataSourceLoader { request in
            await log.add(request)
            return .init(rows:[["id":.number(1),"caption":.string("Confirmed")]])
        }
        func open() async {
            let result = await runtime.prepareEditableSelection(windowID:id,sourceDataSourceRef:"list",collection:spec,operation:op)
            XCTAssertEqual(result.status,"opened",result.error ?? "")
            await runtime.closeDialogPublic(windowID:id,dialogID:"editor")
        }
        await runtime.refreshDataSourceCollection(windowID:id,dataSourceRef:"reader")
        await open()
        let warm = await log.calls
        XCTAssertEqual(warm.count,1, "An already resolved reader shares the actor and effective parameter")
        _ = await runtime.updateWindowInline(id:id,title:"Reloaded",metadata:metadata)
        await open()
        let changed = await log.calls
        XCTAssertEqual(changed.count,2,"Even the same actor and ID cannot reuse a previous metadata installation")
        await runtime.refreshDataSourceCollection(windowID:id,dataSourceRef:"reader")
        await runtime.setDataSourceCollection(windowID:id,dataSourceRef:"reader",rows:[["id":.number(1),"caption":.string("Manual")]])
        await open()
        let replaced = await log.calls
        XCTAssertEqual(replaced.count,4,"A manually replaced collection has no authenticated read provenance")
    }

    func testParentIgnoresUnprovenRowsAndRequiresOneMatchingDetachedResult() async throws {
        let (runtime,id,spec,op,_) = try await parentFixture()
        let journal = PreparedReadLog()
        let ref = WindowIdentity(windowID:id).dataSourceID(ref:"reader")
        let row: Row = ["id":.number(1),"caption":.string("Ready")]
        for scenario in ["failed","loading","other-input","extra-warm","wrong-warm","extra-response","wrong-response"] {
            await runtime.registerDataSourceLoader { request in
                await journal.add(request)
                if request.bypassCache == true {
                    if scenario == "extra-response" { return .init(rows:[row,row]) }
                    if scenario == "wrong-response" { return .init(rows:[["id":.number(2)]]) }
                    return .init(rows:[row])
                }
                if scenario == "extra-warm" { return .init(rows:[row,row]) }
                if scenario == "wrong-warm" { return .init(rows:[["id":.number(2)]]) }
                return .init(rows:[row])
            }
            await runtime.setDataSourceInputParameters(windowID:id,dataSourceRef:"reader",parameters:[:])
            await runtime.refreshDataSourceCollection(windowID:id,dataSourceRef:"reader")
            switch scenario {
            case "failed":
                await runtime.dataSourceRuntime.setControl(dataSourceID:ref,control:ControlState(error:"Denied"))
                await runtime.dataSourceRuntime.setControl(dataSourceID:ref,control:ControlState())
            case "loading":
                await runtime.dataSourceRuntime.setControl(dataSourceID:ref,control:ControlState(loading:true))
            case "other-input":
                await runtime.setDataSourceInputParameters(windowID:id,dataSourceRef:"reader",parameters:["unrelated":.number(2)])
            case "extra-response","wrong-response":
                await runtime.setDataSourceCollection(windowID:id,dataSourceRef:"reader",rows:[row])
            default: break
            }
            let count = await journal.calls.count
            let result = await runtime.prepareEditableSelection(windowID:id,sourceDataSourceRef:"list",collection:spec,operation:op)
            let calls = await journal.calls
            XCTAssertEqual(calls.count,count+1,scenario)
            XCTAssertEqual(calls.last?.bypassCache,true,scenario)
            let invalid = scenario.hasSuffix("response")
            XCTAssertEqual(result.status,invalid ? "failed" : "opened",scenario)
            let state = await runtime.dialogState(windowID:id,dialogID:"editor")
            XCTAssertEqual(state.open,!invalid,scenario)
            await runtime.closeDialogPublic(windowID:id,dialogID:"editor")
        }
    }

    func testMetadataReplacementDuringOrdinaryParentLoadCannotAuthorizeWarmReuse() async throws {
        let (runtime,id,spec,op,metadata) = try await parentFixture()
        let journal = PreparedReadLog()
        await runtime.registerDataSourceLoader { request in
            await journal.add(request)
            if request.bypassCache != true {
                _ = await runtime.updateWindowInline(id:id,title:"Reloaded",metadata:metadata)
            }
            return .init(rows:[["id":.number(1),"caption":.string(request.bypassCache == true ? "Current" : "Old")]])
        }
        await runtime.refreshDataSourceCollection(windowID:id,dataSourceRef:"reader")
        let result = await runtime.prepareEditableSelection(windowID:id,sourceDataSourceRef:"list",collection:spec,operation:op)
        let calls = await journal.calls
        XCTAssertEqual(result.status,"opened")
        XCTAssertEqual(calls.count,2)
        let draft = await runtime.dataSourceForm(windowID:id,dataSourceRef:"draft")
        XCTAssertEqual(draft["caption"],.string("Current"))
    }

    func testExistingControlPredicatesFenceParentOperationOnTheReferencedReader() async throws {
        let (runtime,id,_,_,_) = try await parentFixture()
        let ref = WindowIdentity(windowID:id).dataSourceID(ref:"reader")
        func value(_ field: String, _ expected: Any, source: String = "reader") async throws -> Bool {
            let raw: [String:Any] = ["source":"control","field":field,"dataSourceRef":source,"equals":expected]
            let condition = try JSONDecoder().decode(DashboardConditionDef.self, from: JSONSerialization.data(withJSONObject:raw))
            let scope = await runtime.mutationScope(windowID:id,source:"list")
            return try XCTUnwrap(scope).allows(condition)
        }
        var allowed = try await value("loaded",true)
        XCTAssertFalse(allowed)
        await runtime.setDataSourceCollection(windowID:id,dataSourceRef:"reader",rows:[])
        allowed = try await value("loaded",true)
        XCTAssertTrue(allowed)
        allowed = try await value("loaded",true,source:"missing")
        XCTAssertFalse(allowed)
        await runtime.dataSourceRuntime.setControl(dataSourceID:ref,control:ControlState(loading:true))
        allowed = try await value("loading",true)
        XCTAssertTrue(allowed)
        await runtime.dataSourceRuntime.setControl(dataSourceID:ref,control:ControlState(error:"Unavailable"))
        allowed = try await value("error","Unavailable")
        XCTAssertTrue(allowed)
        await runtime.setDataSourceInputParameters(windowID:id,dataSourceRef:"reader",parameters:["id":.number(2)])
        allowed = try await value("stale",true)
        XCTAssertTrue(allowed)
    }

    func testMalformedParentAndMidReadParentChangeLeaveTheDialogClosed() async throws {
        for invalid: JSONValue in [.array([]), .array([.number(1),.number(2)]), .null, .string(" ")] {
            let (runtime,id,spec,op,_) = try await parentFixture(invalid)
            let log = PreparedReadLog()
            await runtime.registerDataSourceLoader { request in await log.add(request); return .init(rows:[]) }
            let result = await runtime.prepareEditableSelection(windowID:id,sourceDataSourceRef:"list",collection:spec,operation:op)
            XCTAssertEqual(result.status,"failed")
            let requests = await log.calls
            XCTAssertTrue(requests.isEmpty)
        }
        let (runtime,id,spec,op,_) = try await parentFixture()
        await runtime.registerDataSourceLoader { _ in
            await runtime.setWindowFormValue(windowID:id,values:["parent":.string("002")])
            return .init(rows:[["id":.number(1)]])
        }
        let result = await runtime.prepareEditableSelection(windowID:id,sourceDataSourceRef:"list",collection:spec,operation:op)
        XCTAssertEqual(result.status,"superseded")
        let shown = await runtime.dialogState(windowID:id,dialogID:"editor")
        XCTAssertFalse(shown.open)
    }

    func testSingleDetachedReadPreparesExactlyTheOrderedSelection() async throws {
        let (runtime, id, spec, op) = try await fixture()
        let journal = PreparedReadLog()
        await runtime.registerDataSourceLoader { request in
            await journal.add(request)
            let duplicate = await runtime.prepareEditableSelection(windowID: id, sourceDataSourceRef: "list", collection: spec, operation: op)
            XCTAssertEqual(duplicate.status, "suppressed")
            return .init(rows: self.sample())
        }
        let result = await runtime.prepareEditableSelection(windowID: id, sourceDataSourceRef: "list", collection: spec, operation: op)
        XCTAssertEqual(result.status, "opened", result.error ?? "")
        let calls = await journal.calls
        XCTAssertEqual(calls.first?.bypassCache, true)
        XCTAssertEqual(calls.first?.invocationId, result.invocationId)
        XCTAssertEqual(calls.map(\.dataSourceRef), ["reader"])
        XCTAssertEqual(
            calls.first?.input.parameters,
            ["Ids": .array([.number(1), .string("9007199254740993"), .string("opaque ")]), "owner": .string("0007")])
        let form = await runtime.dataSourceForm(windowID: id, dataSourceRef: "draft")
        XCTAssertEqual(form["labels"], .array([.string("one"), .string("two"), .string("three")]))
        XCTAssertEqual(form["seed"], .string("initial"))
        XCTAssertNil(form["existing"])
        let reader = await runtime.dataSourceCollection(windowID: id, dataSourceRef: "reader")
        XCTAssertEqual(reader, [["old": .bool(true)]])
        let state = await runtime.windowFormJSONValue(windowID: id)
        XCTAssertEqual(state["opening"], .bool(false))
        let opened = await runtime.dialogState(windowID: id, dialogID: "editor")
        XCTAssertTrue(opened.open)
    }
    func testInvalidResponseOrPreparationFailureNeverSeedsOrOpens() async throws {
        for fault in ["missing", "duplicate", "extra", "scope", "effect", "invalid", "failure"] {
            let (runtime, id, spec, op) = try await fixture(handler: ["effect", "invalid"].contains(fault) ? fault : "draft")
            let journal = PreparedReadLog()
            await runtime.registerDataSourceLoader { req in
                await journal.add(req)
                var rows = self.sample()
                switch fault {
                case "missing": rows.removeFirst()
                case "extra": rows[2]["id"] = .number(45)
                case "duplicate": rows[0]["id"] = rows[1]["id"]
                case "scope": rows[2]["parent"] = .object(["id": .number(8)])
                case "failure": throw URLError(.notConnectedToInternet)
                default: break
                }
                return .init(rows: rows)
            }
            let result = await runtime.prepareEditableSelection(windowID: id, sourceDataSourceRef: "list", collection: spec, operation: op)
            XCTAssertEqual(result.status, "failed", fault)
            let state = await runtime.windowFormJSONValue(windowID: id)
            XCTAssertEqual(state["opening"], .bool(false), fault)
            XCTAssertNotEqual(state["problem"], .string(""), fault)
            XCTAssertNil(state["unexpected"])
            let draft = await runtime.dataSourceForm(windowID: id, dataSourceRef: "draft")
            XCTAssertEqual(draft, ["existing": .bool(true)], fault)
            let opened = await runtime.dialogState(windowID: id, dialogID: "editor")
            XCTAssertFalse(opened.open, fault)
            let calls = await journal.calls
            XCTAssertEqual(calls.count, 1, fault)
        }
    }
    func testStaleSelectionScopeRevocationOrDialogReplacementIgnoresLateResults() async throws {
        for fault in ["selection", "parameter", "revoke", "reopen", "actor"] {
            let (runtime, id, spec, op) = try await fixture(handler: "simple")
            await runtime.registerDataSourceLoader { _ in
                switch fault {
                case "selection": await self.select(runtime, id, ids: [.number(3)])
                case "actor":
                    let signal = await runtime.signals.metadata(windowID: id)
                    let loaded = await signal.peek()
                    let current = try XCTUnwrap(loaded)
                    var raw = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(current)) as? [String: Any])
                    raw["authorizationSnapshot"] = ["principal": ["subject": "other", "roles": []]]
                    let next = try JSONDecoder().decode(WindowMetadata.self, from: JSONSerialization.data(withJSONObject: raw))
                    await signal.set(next)
                case "parameter": await runtime.setWindowFormValue(windowID: id, values: ["owner": .string("8")])
                case "revoke":
                    await self.select(runtime, id, ids: [.number(1), .string("9007199254740993"), .string("opaque ")], canEdit: false)
                default:
                    await runtime.openDialog(windowID: id, dialogID: "editor", parameters: [:])
                    await runtime.closeDialogPublic(windowID: id, dialogID: "editor")
                }
                return .init(rows: self.sample())
            }
            let result = await runtime.prepareEditableSelection(windowID: id, sourceDataSourceRef: "list", collection: spec, operation: op)
            XCTAssertEqual(result.status, "superseded", fault)
            let draft = await runtime.dataSourceForm(windowID: id, dataSourceRef: "draft")
            XCTAssertEqual(draft, ["existing": .bool(true)])
            let open = await runtime.dialogState(windowID: id, dialogID: "editor").open
            XCTAssertFalse(open, fault)
        }
    }
    func testAmbiguousUnsafeAndDeniedSelectionsMakeNoPhysicalRead() async throws {
        for ids: [JSONValue] in [
            [.number(1), .string("01")], [.number(9_007_199_254_740_992)], [.number(1.5)], [.string("  ")], [.bool(true)], [],
        ] {
            let (runtime, id, spec, op) = try await fixture()
            await select(runtime, id, ids: ids)
            let journal = PreparedReadLog()
            await runtime.registerDataSourceLoader { req in
                await journal.add(req)
                return .init(rows: [])
            }
            let result = await runtime.prepareEditableSelection(windowID: id, sourceDataSourceRef: "list", collection: spec, operation: op)
            XCTAssertFalse(result.accepted)
            if !ids.isEmpty {
                let error = await runtime.windowFormJSONValue(windowID: id)["problem"]
                XCTAssertNotNil(error?.stringValue)
            }
            let calls = await journal.calls
            XCTAssertTrue(calls.isEmpty)
        }
    }
}

private final class SelectionReadProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        XCTAssertEqual(request.cachePolicy, .reloadIgnoringLocalCacheData)
        XCTAssertEqual(request.value(forHTTPHeaderField:"Cache-Control"),"no-cache")
        var data = request.httpBody ?? Data()
        if data.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var bytes=[UInt8](repeating:0,count:4096)
            while true {
                let count=stream.read(&bytes,maxLength:bytes.count)
                if count <= 0 { break }
                data.append(contentsOf:bytes.prefix(count))
            }
        }
        let envelope=(try? JSONDecoder().decode(JSONValue.self,from:data))?.objectValue
        XCTAssertEqual(envelope?["cache"], .object(["bypassCache":.bool(true)]))
        XCTAssertNotNil(envelope?["invocationId"]?.stringValue)
        XCTAssertNil(envelope?["inputs"]?.objectValue?["cache"])
        XCTAssertNil(envelope?["inputs"]?.objectValue?["invocationId"])
        let target = request.url!.path
        let code = target.contains("denied") ? 403 : 200
        let rows: [[String: Any]] = [
            ["id": "opaque ", "parent": ["id": 7], "caption": "three", "kind": "known"],
            ["id": 1, "parent": ["id": 7], "caption": "one", "kind": "known"],
            ["id": "9007199254740993", "parent": ["id": 7], "caption": "two"],
        ]
        var body: [String: Any] = ["rows": rows]
        if target.contains("malformed") { body["rows"] = ["unexpected": true] }
        let response = HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: [:])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: (try? JSONSerialization.data(withJSONObject: body)) ?? Data())
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

extension PreparedSelectionTests {
    func testDetachedHTTPResponseDoesNotPublishAReaderInputCollectionOrSelection() async throws {
        for route in ["reader", "denied", "malformed"] {
            let (runtime, id, model, op) = try await fixture(httpPath: "/v1/api/datasources/" + route + "/fetch")
            let reader = WindowIdentity(windowID: id).dataSourceID(ref: "reader")
            let originalInput = InputState(parameters: ["untouched": .number(5)])
            await runtime.dataSourceRuntime.setInput(dataSourceID: reader, input: originalInput)
            let result = await runtime.prepareEditableSelection(windowID: id, sourceDataSourceRef: "list", collection: model, operation: op)
            XCTAssertEqual(result.status, route == "reader" ? "opened" : "failed", result.error ?? route)
            if route == "denied" { XCTAssertTrue(result.error?.contains("403") == true) }
            let input = await runtime.dataSourceRuntime.input(dataSourceID: reader)
            let rows = await runtime.dataSourceCollection(windowID: id, dataSourceRef: "reader")
            let selected = await runtime.dataSourceSelectionState(windowID: id, dataSourceRef: "reader")
            XCTAssertEqual(input, originalInput, route)
            XCTAssertEqual(rows, [["old": .bool(true)]], route)
            XCTAssertNil(selected.selected, route)
        }
    }

    func testNilRegisteredResponseIsFinalEvenWhenTheHTTPRouteCouldReturnValidRows() async throws {
        let (runtime,id,model,op) = try await fixture(httpPath:"/v1/api/datasources/reader/fetch")
        let requests=PreparedReadLog()
        await runtime.registerDataSourceLoader { request in await requests.add(request); return nil }
        let result=await runtime.prepareEditableSelection(windowID:id,sourceDataSourceRef:"list",collection:model,operation:op)
        XCTAssertEqual(result.status,"failed")
        XCTAssertEqual(result.error,"Selection reader did not return records.")
        let calls=await requests.calls
        XCTAssertEqual(calls.count,1)
        let form=await runtime.dataSourceForm(windowID:id,dataSourceRef:"draft")
        XCTAssertEqual(form,["existing":.bool(true)])
    }

    func testRenderedWorkflowChecksTheAdmittedActorAndEachSelectedRow() throws {
        let condition = try JSONDecoder().decode(
            DashboardConditionDef.self,
            from: Data(
                #"{"all":[{"source":"authorization","field":"principal.roles","contains":"write"},{"source":"row","field":"id","gt":0}]}"#.utf8))
        let write: Row = ["principal": .object(["roles": .array([.string("write")])])]
        for (actor, row, allowed): (Row, Row, Bool) in [
            (write, ["id": .number(1)], true), (write, ["id": .number(0)], false), ([:], ["id": .number(1)], false),
        ] {
            XCTAssertEqual(
                workflowConditionAllows(condition, row: row, form: [:], metrics: [:], windowForm: [:], collection: [], authorization: actor),
                allowed)
        }
    }
}
