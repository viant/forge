import Foundation

public actor ForgeRuntime {
    public struct DataSourceFetchRequest: Sendable {
        public let windowID: String
        public let dataSourceRef: String
        public let dataSource: DataSourceDef
        public let input: InputState
        public let resolvedInputs: [String: JSONValue]
        public let conversationID: String?
        public let bypassCache: Bool
        public let invocationId: String?

        public init(
            windowID: String,
            dataSourceRef: String,
            dataSource: DataSourceDef,
            input: InputState,
            resolvedInputs: [String: JSONValue] = [:],
            conversationID: String? = nil,
            bypassCache: Bool = false,
            invocationId: String? = nil
        ) {
            self.windowID = windowID
            self.dataSourceRef = dataSourceRef
            self.dataSource = dataSource
            self.input = input
            self.resolvedInputs = resolvedInputs
            self.conversationID = conversationID
            self.bypassCache = bypassCache
            self.invocationId = invocationId
        }
    }

    public struct DataSourceFetchResult: Sendable {
        public let rows: [[String: JSONValue]]
        public let dataInfo: [String: JSONValue]
        public let metrics: [String: JSONValue]
        public let form: [String: JSONValue]?
        public let selection: [String: JSONValue]?
        public let rowIndex: Int?

        public init(
            rows: [[String: JSONValue]] = [],
            metrics: [String: JSONValue] = [:],
            dataInfo: [String: JSONValue] = [:],
            form: [String: JSONValue]? = nil,
            selection: [String: JSONValue]? = nil,
            rowIndex: Int? = nil
        ) {
            self.rows = rows
            self.dataInfo = dataInfo
            self.metrics = metrics
            self.form = form
            self.selection = selection
            self.rowIndex = rowIndex
        }
    }

    public struct WindowState: Sendable, Identifiable {
        public let id: String
        public let key: String
        public let title: String
        public let metadata: WindowMetadata?
        public let inTab: Bool
        public let parameters: [String: JSONValue]
        public let conversationID: String?
        public let presentation: String?
        public let region: String?
        public let workspaceSharePct: Int?
        public let workspaceMinHeight: Int?
        public let parentKey: String?
        public let isModal: Bool

        public init(
            id: String = UUID().uuidString,
            key: String,
            title: String,
            metadata: WindowMetadata?,
            inTab: Bool = true,
            parameters: [String: JSONValue] = [:],
            conversationID: String? = nil,
            presentation: String? = nil,
            region: String? = nil,
            workspaceSharePct: Int? = nil,
            workspaceMinHeight: Int? = nil,
            parentKey: String? = nil,
            isModal: Bool = false
        ) {
            self.id = id
            self.key = key
            self.title = title
            self.metadata = metadata
            self.inTab = inTab
            self.parameters = parameters
            self.conversationID = conversationID
            self.presentation = presentation
            self.region = region
            self.workspaceSharePct = workspaceSharePct
            self.workspaceMinHeight = workspaceMinHeight
            self.parentKey = parentKey
            self.isModal = isModal
        }
    }

    public private(set) var windows: [WindowState] = []
    var preparedReportRequests: [String: PreparedReportRequest] = [:]
    var preparedPrimaryFetches: [String: PreparedPrimaryFetch] = [:]
    var acknowledgedReportInitialIntents: [String: String] = [:]
    var nativeReportAccountGeneration = 0
    var frozenNativeReportPublishedSignatures: [String: String] = [:]
    var frozenNativeReportAdmissions: [String: NativeReportFrozenAdmission] = [:]
    var completedNativeReportCaches: [String: NativeReportCompletedCache] = [:]
    public let nativeReportLifecycle = NativeReportLifecycle()
    var nativeReportActiveRequestIDs: [String: String] = [:]
    var nativeReportActiveRequestGenerations: [String: Int] = [:]
    var nativeReportMaterializations: [String: Task<NativeReportMaterializedRun, Error>] = [:]
    var nativeReportDatasetResults: [String: DataSourceFetchResult] = [:]
    var nativeReportDispatches: [String: NativeReportDatasetDispatch] = [:]
    var nativeReportAuthoredPreparations: [String: PreparedReportIdentity] = [:]
    public func markNativeReportAuthoredPreparation(windowID: String, identity: PreparedReportIdentity?) { nativeReportAuthoredPreparations[windowID] = identity }
    public nonisolated let targetContext: ForgeTargetContext
    let signals: SignalRegistry
    let dataSourceRuntime: DataSourceRuntime
    private var dataSourceFetchGenerations: [String: UInt64] = [:]
    private var windowMetadataEndpoint: URL?
    private var defaultDataSourceBaseURL: URL?
    private let session: URLSession
    private(set) var dataSourceTransportRevision = UUID()
    private var dataSourceLoader: (@Sendable (DataSourceFetchRequest) async throws -> DataSourceFetchResult?)?
    private var windowMetadataLoader: (@Sendable (String) async throws -> WindowMetadata?)?
    private var windowMetadataRequestLoader: (@Sendable (WindowMetadataRequest) async throws -> WindowMetadata?)?
    private var feedPatchHandler: (@Sendable (String, FeedPatchOperation) async throws -> Bool)?
    private var interactionObserver: (@Sendable (ForgeInteraction) async -> Void)?
    private var externalURLHandler: (@Sendable (URL) async -> Void)?
    var mutationCommandStates: [String: Signal<MutationCommandState>] = [:]
    var guardedMutationCommands: Set<String> = []
    var acknowledgedDialogMutations: [String: AcknowledgedDialogMutation] = [:]
    var mutationSerializationOwners: [String: String] = [:]
    var mutationTransportOwners: [String: String] = [:]

    var handlers: [String: ForgeHandler] = [:]
    private struct DialogPresentation {
        var review: ReviewedDialogPresentation?
        var pendingRetirement: Task<Void,Never>?
        var id: UUID?
        var outbound: PendingDialog?
        var selectionFence: DialogSelectionFence?
        var waiter: CheckedContinuation<[String: JSONValue]?, Never>?
    }
    private var pendingDialogs: [String: DialogPresentation] = [:]
    var selectionPreparationOwners: [String: UUID] = [:]
    private var pendingWindows: [String: PendingWindow] = [:]

    public init(
        targetContext: ForgeTargetContext = ForgeTargetContext(),
        windowMetadataBaseURL: URL? = nil,
        windowMetadataBasePath: String = "/v1/api/forge/window",
        session: URLSession = .shared
    ) {
        self.targetContext = targetContext
        self.signals = SignalRegistry()
        self.dataSourceRuntime = DataSourceRuntime()
        self.session = session
        self.defaultDataSourceBaseURL = windowMetadataBaseURL
        self.windowMetadataEndpoint = Self.makeWindowMetadataEndpoint(
            baseURL: windowMetadataBaseURL,
            path: windowMetadataBasePath
        )
    }

    public func registerInteractionObserver(
        _ observer: (@Sendable (ForgeInteraction) async -> Void)?
    ) {
        interactionObserver = observer
    }

    public func registerExternalURLHandler(_ handler: (@Sendable (URL) async -> Void)?) {
        externalURLHandler = handler
    }

    public func emitInteraction(
        kind: String,
        windowID: String,
        dataSourceRef: String? = nil,
        detail: [String: JSONValue] = [:]
    ) async {
        guard let interactionObserver else { return }
        await interactionObserver(
            ForgeInteraction(
                kind: kind,
                windowID: windowID,
                windowKey: windows.first { $0.id == windowID }?.key,
                dataSourceRef: dataSourceRef,
                detail: detail
            )
        )
    }

    // MARK: - Window lifecycle

    @discardableResult
    public func openWindowInline(
        key: String,
        title: String,
        metadata: WindowMetadata,
        conversationID: String? = nil,
        presentation: String? = nil
    ) async -> WindowState {
        let resolved = MetadataResolver.resolve(metadata, for: targetContext).preparingParentReaders()
        let state = WindowState(
            key: key,
            title: title,
            metadata: resolved,
            conversationID: conversationID,
            presentation: presentation
        )
        windows.append(state)
        let signal = await signals.metadata(windowID: state.id)
        await signal.set(resolved)
        await reconcileWindowForm(windowID: state.id, metadata: resolved, parameters: [:])
        return state
    }

    /// Replaces the metadata for an existing inline window without allocating a
    /// second window during streamed transcript updates.
    @discardableResult
    public func updateWindowInline(
        id: String,
        title: String,
        metadata: WindowMetadata,
        resolveMetadata: Bool = true
    ) async -> WindowState? {
        guard let index = windows.firstIndex(where: { $0.id == id }) else { return nil }
        let current = windows[index]
        let resolved = (resolveMetadata ? MetadataResolver.resolve(metadata, for: targetContext) : metadata).preparingParentReaders()
        let state = WindowState(
            id: current.id,
            key: current.key,
            title: title,
            metadata: resolved,
            inTab: current.inTab,
            parameters: current.parameters,
            conversationID: current.conversationID,
            presentation: current.presentation,
            region: current.region,
            workspaceSharePct: current.workspaceSharePct,
            workspaceMinHeight: current.workspaceMinHeight,
            parentKey: current.parentKey,
            isModal: current.isModal
        )
        windows[index] = state
        let signal = await signals.metadata(windowID: id)
        await signal.set(resolved)
        await reconcileWindowForm(windowID: id, metadata: resolved, parameters: current.parameters)
        return state
    }

    @discardableResult
    public func openWindow(
        key: String,
        title: String,
        id: String? = nil,
        inTab: Bool = true,
        parameters: [String: JSONValue] = [:],
        conversationID: String? = nil,
        presentation: String? = nil,
        region: String? = nil,
        workspaceSharePct: Int? = nil,
        workspaceMinHeight: Int? = nil,
        parentKey: String? = nil,
        isModal: Bool = false
    ) async -> WindowState {
        let state = WindowState(
            id: id ?? UUID().uuidString,
            key: key,
            title: title,
            metadata: nil,
            inTab: inTab,
            parameters: parameters,
            conversationID: conversationID,
            presentation: presentation,
            region: region,
            workspaceSharePct: workspaceSharePct,
            workspaceMinHeight: workspaceMinHeight,
            parentKey: parentKey,
            isModal: isModal
        )
        if let existingIndex = windows.firstIndex(where: { $0.id == state.id }) {
            windows[existingIndex] = state
            await loadWindowMetadata(for: state, forceReload: true)
            return windows[existingIndex]
        }
        windows.append(state)
        await loadWindowMetadata(for: state, forceReload: true)
        return windows.first(where: { $0.id == state.id }) ?? state
    }

    public func closeWindow(id: String) {
        for (key, acknowledged) in acknowledgedDialogMutations where acknowledged.operation.windowID == id {
            acknowledgedDialogMutations.removeValue(forKey: key)
            guardedMutationCommands.remove(key)
            mutationSerializationOwners = mutationSerializationOwners.filter { $0.value != key }
        }
        for key in pendingDialogs.keys.filter({ $0.hasPrefix("\(id)Dialog") }) {
            pendingDialogs.removeValue(forKey:key)?.waiter?.resume(returning:nil)
        }
        frozenNativeReportAdmissions.removeValue(forKey: id)
        frozenNativeReportPublishedSignatures.removeValue(forKey: id)
        completedNativeReportCaches.removeValue(forKey: id)
        preparedPrimaryFetches.removeValue(forKey: id)?.task.cancel()
        acknowledgedReportInitialIntents.removeValue(forKey: id)
        windows.removeAll { $0.id == id }
        Task {
            await signals.removeWindow(windowID: id)
            await dataSourceRuntime.detachWindow(id)
        }
        pendingWindows.removeValue(forKey: id)
    }

    public func windowContext(id: String) -> WindowContext {
        let parameters = (windows.first(where: { $0.id == id })?.parameters ?? [:]).reduce(into: [String: String]()) { result, entry in
            switch entry.value {
            case .string(let value):
                result[entry.key] = value
            case .number(let value):
                result[entry.key] = String(value)
            case .bool(let value):
                result[entry.key] = value ? "true" : "false"
            default:
                break
            }
        }
        return WindowContext(windowID: id, parameters: parameters)
    }

    public func windowState(id: String) -> WindowState? {
        windows.first(where: { $0.id == id })
    }

    internal func buildParameterResolutionContext(
        windowID: String,
        metadata: WindowMetadata?,
        identityDataSourceRef: String,
        preferredInput: InputState? = nil
    ) async -> ParameterResolver.ResolutionContext {
        let windowForm = await windowFormJSONValue(windowID: windowID)
        let reader = await dataSourceRuntime.snapshotReader()
        let identity = WindowIdentity(windowID: windowID)
        var context = ParameterResolver.ResolutionContext(identityDataSourceRef: identityDataSourceRef, windowForm: windowForm, metadata: metadata)
        context.lookup = { ref in
            guard ref == identityDataSourceRef || metadata?.dataSources[ref] != nil else { return nil }
            let value = reader(identity.dataSourceID(ref: ref))
            return .init(selectionMode: metadata?.dataSources[ref]?.selectionMode, form: value?.form ?? [:], metrics: value?.metrics ?? [:], collection: value?.collection,
                selection: value?.selection ?? .init(), input: (ref == identityDataSourceRef ? preferredInput : nil) ?? value?.input ?? .init())
        }
        return context
    }

    public func windowMetadata(id: String) async -> WindowMetadata? {
        let signal = await signals.metadata(windowID: id)
        return await signal.peek()
    }

    public func windowMetadataUpdates(id: String) async -> AsyncStream<WindowMetadata?> {
        let signal = await signals.metadata(windowID: id)
        return await signal.stream()
    }

    public func configureWindowMetadata(baseURL: URL?, path: String = "/v1/api/forge/window") {
        if defaultDataSourceBaseURL != baseURL { dataSourceTransportRevision = UUID() }
        defaultDataSourceBaseURL = baseURL
        windowMetadataEndpoint = Self.makeWindowMetadataEndpoint(baseURL: baseURL, path: path)
    }

    public func registerDataSourceLoader(
        _ loader: @escaping @Sendable (DataSourceFetchRequest) async throws -> DataSourceFetchResult?
    ) {
        dataSourceTransportRevision = UUID()
        dataSourceLoader = loader
    }

    public func registerWindowMetadataLoader(
        _ loader: @escaping @Sendable (String) async throws -> WindowMetadata?
    ) {
        windowMetadataLoader = loader
    }

    public func registerWindowMetadataRequestLoader(
        _ loader: @escaping @Sendable (WindowMetadataRequest) async throws -> WindowMetadata?
    ) {
        windowMetadataRequestLoader = loader
    }

    public func registerFeedPatchHandler(
        _ handler: @escaping @Sendable (String, FeedPatchOperation) async throws -> Bool
    ) {
        feedPatchHandler = handler
    }

    public func dispatchFeedPatch(windowID: String, operation: FeedPatchOperation) async throws -> Bool {
        try await feedPatchHandler?(windowID, operation) == true
    }

    // MARK: - Form values

    public func setFormValue(windowID: String, dataSourceRef: String, values: [String: String]) async {
        let payload = values.mapValues { JSONValue.string($0) }
        await setFormValue(windowID: windowID, dataSourceRef: dataSourceRef, values: payload)
    }

    public func setFormValue(windowID: String, dataSourceRef: String, values: [String: JSONValue]) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setForm(dataSourceID: dataSourceID, values: values)
    }

    public func formValue(windowID: String, dataSourceRef: String) async -> [String: String] {
        let values = await formJSONValue(windowID: windowID, dataSourceRef: dataSourceRef)
        return values.reduce(into: [:]) { r, e in r[e.key] = e.value.stringValue ?? "" }
    }

    public func formJSONValue(windowID: String, dataSourceRef: String) async -> [String: JSONValue] {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        return await dataSourceRuntime.form(dataSourceID: dataSourceID)
    }

    public func setDataSourceCollection(windowID: String, dataSourceRef: String, rows: [[String: JSONValue]]) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setCollection(dataSourceID: dataSourceID, rows: rows)
        let signal = await signals.collection(dataSourceID: dataSourceID)
        await signal.set(rows)
    }

    public func setDataSourceForm(windowID: String, dataSourceRef: String, values: [String: JSONValue]) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setForm(dataSourceID: dataSourceID, values: values)
        let signal = await signals.form(dataSourceID: dataSourceID)
        await signal.set(values)
    }

    public func setDataSourceSelection(
        windowID: String,
        dataSourceRef: String,
        selected: [String: JSONValue]?,
        rowIndex: Int = -1
    ) async {
        let selectionState: SelectionState
        if let selected {
            let metadataSignal = await signals.metadata(windowID: windowID)
            let metadata = await metadataSignal.peek()
            let preparedSelection = applySelectionHook(
                metadata: metadata,
                row: selected,
                rowIndex: rowIndex
            )
            selectionState = SelectionState(selected: preparedSelection, rowIndex: rowIndex)
        } else {
            selectionState = SelectionState(rowIndex: rowIndex)
        }
        await setDataSourceSelectionState(
            windowID: windowID,
            dataSourceRef: dataSourceRef,
            selection: selectionState
        )
    }

    public func setDataSourceSelectionState(
        windowID: String,
        dataSourceRef: String,
        selection: SelectionState
    ) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        let selected = selection.selected
            ?? selection.selection.last
        let form = selected ?? [:]
        await dataSourceRuntime.setSelection(
            dataSourceID: dataSourceID,
            selection: selection
        )
        await dataSourceRuntime.setForm(dataSourceID: dataSourceID, values: form)
        let selectionSignal = await signals.selection(dataSourceID: dataSourceID)
        await selectionSignal.set(selection)
        let formSignal = await signals.form(dataSourceID: dataSourceID)
        await formSignal.set(form)
    }

    public func toggleDataSourceSelection(
        windowID: String,
        dataSourceRef: String,
        row: [String: JSONValue],
        rowIndex: Int = -1
    ) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        let metadataSignal = await signals.metadata(windowID: windowID)
        let metadata = await metadataSignal.peek()
        let preparedSelection = applySelectionHook(
            metadata: metadata,
            row: row,
            rowIndex: rowIndex
        )
        let current = await dataSourceRuntime.selection(dataSourceID: dataSourceID)
        if current.selected == preparedSelection {
            await setDataSourceSelection(
                windowID: windowID,
                dataSourceRef: dataSourceRef,
                selected: nil,
                rowIndex: -1
            )
        } else {
            await setDataSourceSelection(
                windowID: windowID,
                dataSourceRef: dataSourceRef,
                selected: row,
                rowIndex: rowIndex
            )
        }
    }

    public func dataSourceCollection(windowID: String, dataSourceRef: String) async -> [[String: JSONValue]] {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        return await dataSourceRuntime.collection(dataSourceID: dataSourceID)
    }

    public func dataSourceControl(windowID: String, dataSourceRef: String) async -> ControlState {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        return await dataSourceRuntime.control(dataSourceID: dataSourceID)
    }

    public func setDataSourceControl(windowID: String, dataSourceRef: String, control: ControlState) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setControl(dataSourceID: dataSourceID, control: control)
        await (await signals.control(dataSourceID: dataSourceID)).set(control)
    }

    /// Loads one logical report dataset into an isolated instance while using
    /// the declared datasource transport. Authored reports commonly reference
    /// several date-window datasets backed by the same cube; storing them under
    /// the declaration id prevents one response from overwriting another.
    public func fetchDataSourceInstance(
        windowID: String,
        instanceRef: String,
        dataSourceRef: String,
        parameters: [String: JSONValue],
        nativeCompletionID: String? = nil
    ) async {
        let preparationFence: PreparedReportFetchFence
        do { preparationFence = try await validatedReportFetchFence(windowID: windowID, dataSourceRef: dataSourceRef, instanceRef: instanceRef, parameters: parameters, nativeCompletionID: nativeCompletionID) }
        catch {
            let id = WindowIdentity(windowID: windowID).dataSourceID(ref: instanceRef)
            let control = ControlState(loading: false, error: error.localizedDescription)
            await dataSourceRuntime.setControl(dataSourceID: id, control: control)
            await (await signals.control(dataSourceID: id)).set(control)
            return
        }
        let metadataSignal = await signals.metadata(windowID: windowID)
        guard let metadata = await metadataSignal.peek() else { return }
        guard let dataSource = metadata.dataSources[dataSourceRef] else {
            return
        }
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: instanceRef)
        await dataSourceRuntime.setInputParameters(
            dataSourceID: dataSourceID,
            parameters: parameters,
            fetch: true
        )
        let input = await dataSourceRuntime.input(dataSourceID: dataSourceID)
        let generation = (dataSourceFetchGenerations[dataSourceID] ?? 0) &+ 1
        dataSourceFetchGenerations[dataSourceID] = generation
        let loading = ControlState(loading: true)
        await dataSourceRuntime.setControl(dataSourceID: dataSourceID, control: loading)
        await (await signals.control(dataSourceID: dataSourceID)).set(loading)

        guard let dataSourceLoader else {
            let error = ControlState(error: "A datasource loader is unavailable.")
            await dataSourceRuntime.setControl(dataSourceID: dataSourceID, control: error)
            await (await signals.control(dataSourceID: dataSourceID)).set(error)
            return
        }
        do {
            guard await reportFetchFenceIsCurrent(preparationFence, windowID: windowID) else { return }
            let result = try await dataSourceLoader(
                DataSourceFetchRequest(
                    windowID: windowID,
                    dataSourceRef: dataSourceRef,
                    dataSource: dataSource,
                    input: input,
                    resolvedInputs: parameters,
                    conversationID: windows.first { $0.id == windowID }?.conversationID
                )
            )
            guard dataSourceFetchGenerations[dataSourceID] == generation, await reportFetchFenceIsCurrent(preparationFence, windowID: windowID) else { return }
            if result == nil && nativeCompletionID != nil { throw ReportPreparationError(reason: "missing-dataset-response") }
            let rows = applyCollectionHook(metadata: metadata, rows: try unmarshalResourceRows(result?.rows ?? [], dataSource: dataSource, metadata: metadata))
            if let nativeCompletionID { nativeReportDatasetResults[nativeCompletionID] = DataSourceFetchResult(rows: rows, metrics: result?.metrics ?? [:]) }
            let control = ControlState()
            await dataSourceRuntime.setCollection(dataSourceID: dataSourceID, rows: rows)
            await dataSourceRuntime.setMetrics(dataSourceID: dataSourceID, values: result?.metrics ?? [:])
            await dataSourceRuntime.setControl(dataSourceID: dataSourceID, control: control)
            await (await signals.collection(dataSourceID: dataSourceID)).set(rows)
            await (await signals.metrics(dataSourceID: dataSourceID)).set(result?.metrics ?? [:])
            await (await signals.control(dataSourceID: dataSourceID)).set(control)
        } catch {
            guard dataSourceFetchGenerations[dataSourceID] == generation, await reportFetchFenceIsCurrent(preparationFence, windowID: windowID) else { return }
            let control = Task.isCancelled || isForgeCancellationError(error)
                ? ControlState()
                : ControlState(error: error.localizedDescription)
            await dataSourceRuntime.setControl(dataSourceID: dataSourceID, control: control)
            await (await signals.control(dataSourceID: dataSourceID)).set(control)
        }
    }

    func restorePreparedForm(windowID: String, draft: String, submitted: [String:JSONValue], previous: [String:JSONValue]) async {
        let id = WindowIdentity(windowID:windowID).dataSourceID(ref:draft), signal = await signals.form(dataSourceID: id)
        if await dataSourceRuntime.restoreForm(dataSourceID:id,ifCurrent:submitted,previous:previous) {
            await signal.replace(submitted,with:previous)
        }
    }

    func readPreparedSelection(windowID: String, metadata: WindowMetadata, ref: String, parameters: [String: JSONValue], invocationId: String?, useExactParameters: Bool = false, current: (@Sendable () async -> Bool)? = nil) async throws -> [[String: JSONValue]] {
        guard let source = metadata.dataSources[ref] else { throw SelectionPreparationError("Selection reader is unavailable.") }
        let input = InputState(parameters: parameters)
        let inputs: [String: JSONValue]
        if useExactParameters {
            inputs = parameters
        } else {
            let resolution = await buildParameterResolutionContext(windowID: windowID, metadata: metadata, identityDataSourceRef: ref, preferredInput: input)
            let bound = ParameterResolver.resolve(parameters: source.parameters, context: resolution)
            inputs = bound.isEmpty ? parameters : bound
        }
        let fence = try await validatedReportFetchFence(windowID:windowID,dataSourceRef:ref,parameters:parameters)
        guard await reportFetchFenceIsCurrent(fence,windowID:windowID), await current?() != false else { throw SelectionPreparationError("The selection read is no longer authorized.") }
        if let dataSourceLoader {
            let request = DataSourceFetchRequest(windowID:windowID, dataSourceRef:ref, dataSource:source, input:input,
                                                 resolvedInputs:inputs, conversationID:windows.first { $0.id == windowID }?.conversationID, bypassCache:true, invocationId:invocationId)
            guard let result = try await dataSourceLoader(request) else {
                throw SelectionPreparationError("Selection reader did not return records.")
            }
            guard await reportFetchFenceIsCurrent(fence,windowID:windowID), await current?() != false else { throw SelectionPreparationError("The selection read is no longer authorized.") }
            return result.rows
        }
        guard !fence.required else { throw SelectionPreparationError("A prepared report requires its native datasource loader.") }
        guard let baseURL = defaultDataSourceBaseURL, let path = source.service?.uri ?? source.uri else { throw URLError(.resourceUnavailable) }
        let method = source.service?.method ?? source.method ?? "GET"
        if useExactParameters {
            let verb = method.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            guard verb == "POST" else {
                throw SelectionPreparationError("The HTTP verification reader requires a fetch request that accepts the exact ID array.")
            }
        }
        let response = try await dataSourceRuntime.requestCollection(input: input, baseURL: baseURL.absoluteString, path: path,
            method: method, staticParameters: useExactParameters ? [:] : source.params, inputParameters: inputs, paging: useExactParameters ? nil : source.paging,
            additionalHeaders: [:], session: session, bypassCache: true, invocationId: invocationId)
        if useExactParameters {
            guard await reportFetchFenceIsCurrent(fence, windowID: windowID), await current?() != false else {
                throw SelectionPreparationError("The scoped read is no longer authorized.")
            }
        }
        guard let records = await dataSourceRuntime.invocationRecordsFromResponse(response, selector: source.selectors?.data),
              records.allSatisfy({ $0.objectValue != nil }) else { throw SelectionPreparationError("Selection reader returned invalid records.") }
        return records.compactMap(\.objectValue)
    }

    public func setDataSourceMetrics(windowID: String, dataSourceRef: String, values: [String: JSONValue]) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setMetrics(dataSourceID: dataSourceID, values: values)
        let signal = await signals.metrics(dataSourceID: dataSourceID)
        await signal.set(values)
    }

    public func dataSourceMetrics(windowID: String, dataSourceRef: String) async -> [String: JSONValue] {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        return await dataSourceRuntime.metrics(dataSourceID: dataSourceID)
    }

    public func setDataSourceInputParameters(
        windowID: String,
        dataSourceRef: String,
        parameters: [String: JSONValue],
        fetch: Bool = false,
        preservePendingFetch: Bool = true
    ) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setInputParameters(dataSourceID: dataSourceID, parameters: parameters, fetch: fetch, preservePendingFetch: preservePendingFetch)
        let signal = await signals.input(dataSourceID: dataSourceID)
        let next = await dataSourceRuntime.input(dataSourceID: dataSourceID)
        await signal.set(next)
        if next.fetch {
            await refreshDataSourceCollection(windowID: windowID, dataSourceRef: dataSourceRef)
        }
    }

    public func setDataSourcePage(windowID: String, dataSourceRef: String, page: Int?) async {
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        await dataSourceRuntime.setPage(dataSourceID: dataSourceID, page: page)
        let signal = await signals.input(dataSourceID: dataSourceID)
        let next = await dataSourceRuntime.input(dataSourceID: dataSourceID)
        await signal.set(next)
        if next.fetch {
            await refreshDataSourceCollection(windowID: windowID, dataSourceRef: dataSourceRef)
        }
    }

    public func refreshDataSourceCollection(
        windowID: String,
        dataSourceRef: String,
        baseURL: String = "",
        additionalHeaders: [String: String] = [:],
        lifecyclePath: [String] = []
    ) async {
        _ = await refreshDataSourceRows(windowID: windowID, dataSourceRef: dataSourceRef, baseURL: baseURL, additionalHeaders: additionalHeaders, lifecyclePath: lifecyclePath)
    }

    func refreshDataSourceRows(
        windowID: String,
        dataSourceRef: String,
        baseURL: String = "",
        additionalHeaders: [String: String] = [:],
        lifecyclePath: [String] = [],
        requireInvocationRecords: Bool = false,
        bypassCache: Bool = false,
        invocationId: String? = nil,
        current: (@Sendable () async -> Bool)? = nil,
        admitTransport: (@Sendable () async -> Bool)? = nil,
        submittedInput: InputState? = nil
    ) async -> DataSourceRowReceipt? {
        if let current, await !current() { return nil }
        let signal = await signals.metadata(windowID: windowID)
        guard let metadata = await signal.peek() else { return nil }
        guard let dataSource = metadata.dataSources[dataSourceRef] else {
            print("ForgeRuntime datasource missing from metadata for \(dataSourceRef) on window \(windowID)")
            return nil
        }
        let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        let input = if let submittedInput { submittedInput } else { await dataSourceRuntime.input(dataSourceID: dataSourceID) }
        let transportRevision = dataSourceTransportRevision
        let originalControl = if current != nil || admitTransport != nil { await dataSourceRuntime.control(dataSourceID: dataSourceID) } else { ControlState() }
        func parentRead(_ rows: [[String: JSONValue]], raw: [[String: JSONValue]], _ resolvedInputs: [String: JSONValue]) -> ParentCollectionRead? {
            guard rows.count == 1, let readers = metadata.parentReaders, readers.refs.contains(dataSourceRef), rows == raw else { return nil }
            return ParentCollectionRead(metadataRevision: readers.revision, transportRevision: transportRevision, effectiveParameters: input.parameters.merging(resolvedInputs) { _, resolved in resolved })
        }
        let preparationFence: PreparedReportFetchFence
        do { preparationFence = try await validatedReportFetchFence(windowID: windowID, dataSourceRef: dataSourceRef, parameters: input.parameters) }
        catch {
            if let current, await !current() { return nil }
            let control = ControlState(loading: false, error: error.localizedDescription)
            await dataSourceRuntime.setControl(dataSourceID: dataSourceID, control: control)
            await (await signals.control(dataSourceID: dataSourceID)).set(control)
            return .failure(error)
        }
        if let current, await !current() { return nil }
        let fetchGeneration = (dataSourceFetchGenerations[dataSourceID] ?? 0) &+ 1
        dataSourceFetchGenerations[dataSourceID] = fetchGeneration

        func restoreOriginalControl() async {
            guard dataSourceFetchGenerations[dataSourceID] == fetchGeneration else { return }
            await dataSourceRuntime.setControl(dataSourceID: dataSourceID, control: originalControl)
            let signal = await signals.control(dataSourceID: dataSourceID)
            if dataSourceFetchGenerations[dataSourceID] == fetchGeneration { await signal.set(originalControl) }
        }

        func stillCurrent() async -> Bool {
            guard let current else { return true }
            if await current() { return true }
            await restoreOriginalControl()
            return false
        }

        if let dataSourceLoader {
            let loadingControl = ControlState(loading: true)
            await dataSourceRuntime.setControl(dataSourceID: dataSourceID, control: loadingControl)
            let loadingSignal = await signals.control(dataSourceID: dataSourceID)
            await loadingSignal.set(loadingControl)
            do {
                guard await stillCurrent(), await reportFetchFenceIsCurrent(preparationFence, windowID: windowID) else { return nil }
                let resolvedInputs = ParameterResolver.resolve(parameters: dataSource.parameters, context: await buildParameterResolutionContext(
                    windowID: windowID, metadata: metadata, identityDataSourceRef: dataSourceRef, preferredInput: input))
                if let admitTransport, await !admitTransport() {
                    await restoreOriginalControl()
                    return .failure(ReviewedScopeChanged())
                }
                if let result = try await dataSourceLoader(
                    DataSourceFetchRequest(
                        windowID: windowID,
                        dataSourceRef: dataSourceRef,
                        dataSource: dataSource,
                        input: input,
                        resolvedInputs: resolvedInputs,
                        conversationID: windows.first { $0.id == windowID }?.conversationID,
                        bypassCache: bypassCache,
                        invocationId: invocationId
                    )
                ) {
                    guard await stillCurrent(), dataSourceFetchGenerations[dataSourceID] == fetchGeneration, await reportFetchFenceIsCurrent(preparationFence, windowID: windowID) else {
                        return nil
                    }
                    let baseRows = applyCollectionHook(metadata: metadata, rows: try unmarshalResourceRows(result.rows, dataSource: dataSource, metadata: metadata))
                    let hookedRows = await applyDataSourceFetchHooks(
                        windowID: windowID, dataSourceRef: dataSourceRef, metadata: metadata,
                        rows: baseRows, generation: fetchGeneration, path: lifecyclePath + [dataSourceRef], current: current
                    )
                    guard await stillCurrent(), dataSourceFetchGenerations[dataSourceID] == fetchGeneration, await reportFetchFenceIsCurrent(preparationFence, windowID: windowID) else { return nil }
                    await dataSourceRuntime.setCollection(dataSourceID: dataSourceID, rows: hookedRows, forInput: input,
                        parentRead: parentRead(hookedRows, raw: result.rows, resolvedInputs))
                    await dataSourceRuntime.setCollectionInfo(dataSourceID: dataSourceID, values: result.dataInfo)
                    await dataSourceRuntime.setMetrics(dataSourceID: dataSourceID, values: result.metrics)
                    await dataSourceRuntime.setControl(dataSourceID: dataSourceID, control: ControlState())
                    let collectionSignal = await signals.collection(dataSourceID: dataSourceID)
                    await collectionSignal.set(hookedRows)
                    let metricsSignal = await signals.metrics(dataSourceID: dataSourceID)
                    await metricsSignal.set(result.metrics)
                    let controlSignal = await signals.control(dataSourceID: dataSourceID)
                    await controlSignal.set(ControlState())
                    if let form = result.form {
                        await dataSourceRuntime.setForm(dataSourceID: dataSourceID, values: form)
                        let formSignal = await signals.form(dataSourceID: dataSourceID)
                        await formSignal.set(form)
                    }
                    if let selection = result.selection {
                        let preparedSelection = applySelectionHook(
                            metadata: metadata,
                            row: selection,
                            rowIndex: result.rowIndex ?? -1
                        )
                        await dataSourceRuntime.setSelection(
                            dataSourceID: dataSourceID,
                            selection: SelectionState(selected: preparedSelection, rowIndex: result.rowIndex ?? -1)
                        )
                        let selectionSignal = await signals.selection(dataSourceID: dataSourceID)
                        await selectionSignal.set(SelectionState(selected: preparedSelection, rowIndex: result.rowIndex ?? -1))
                        if result.form == nil {
                            await dataSourceRuntime.setForm(dataSourceID: dataSourceID, values: preparedSelection)
                            let formSignal = await signals.form(dataSourceID: dataSourceID)
                            await formSignal.set(preparedSelection)
                        }
                    }
                    await applyDataSourceLifecycleHooks(
                        windowID: windowID, dataSourceRef: dataSourceRef, metadata: metadata,
                        event: "onSuccess", rows: hookedRows, generation: fetchGeneration,
                        path: lifecyclePath + [dataSourceRef], current: current
                    )
                    return .success(hookedRows.map(JSONValue.object))
                }
            } catch {
                guard await stillCurrent() else { return nil }
                // SwiftUI restarts report tasks as restored filters and presets settle.
                // URLSession reports the superseded request as cancelled; that is not
                // a datasource failure and must not replace the next request's state
                // with a visible error.
                if Task.isCancelled || isForgeCancellationError(error) {
                    if dataSourceFetchGenerations[dataSourceID] == fetchGeneration {
                        let idleControl = ControlState()
                        await dataSourceRuntime.setControl(dataSourceID: dataSourceID, control: idleControl)
                        let controlSignal = await signals.control(dataSourceID: dataSourceID)
                        await controlSignal.set(idleControl)
                    }
                    return nil
                }
                guard await stillCurrent(), dataSourceFetchGenerations[dataSourceID] == fetchGeneration, await reportFetchFenceIsCurrent(preparationFence, windowID: windowID) else {
                    return nil
                }
                print("ForgeRuntime datasource load failed for \(dataSourceRef): \(error)")
                await dataSourceRuntime.setControl(
                    dataSourceID: dataSourceID,
                    control: ControlState(error: error.localizedDescription)
                )
                let controlSignal = await signals.control(dataSourceID: dataSourceID)
                await controlSignal.set(ControlState(error: error.localizedDescription))
                await applyDataSourceLifecycleHooks(
                    windowID: windowID, dataSourceRef: dataSourceRef, metadata: metadata,
                    event: "onError", rows: [], generation: fetchGeneration,
                    path: lifecyclePath + [dataSourceRef], current: current
                )
                return .failure(error)
            }
        }

        if preparationFence.required {
            let control = ControlState(loading: false, error: "A prepared report requires its native datasource loader. No request was sent.")
            await dataSourceRuntime.setControl(dataSourceID: dataSourceID, control: control)
            await (await signals.control(dataSourceID: dataSourceID)).set(control)
            return nil
        }
        let resolvedPath = dataSource.service?.uri ?? dataSource.uri
        guard let path = resolvedPath, !path.isEmpty else { return .failure(URLError(.resourceUnavailable)) }
        let resolvedMethod = dataSource.service?.method ?? dataSource.method ?? "GET"
        let resolvedInputs = ParameterResolver.resolve(
            parameters: dataSource.parameters,
            context: await buildParameterResolutionContext(
                windowID: windowID,
                metadata: metadata,
                identityDataSourceRef: dataSourceRef,
                preferredInput: input
            )
        )
        let resolvedBaseURL: String
        if !baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            resolvedBaseURL = baseURL
        } else if let defaultDataSourceBaseURL {
            resolvedBaseURL = defaultDataSourceBaseURL.absoluteString
        } else {
            return .failure(URLError(.badURL))
        }
        let receipt = await dataSourceRuntime.fetchCollectionRows(
            dataSourceID: dataSourceID,
            baseURL: resolvedBaseURL,
            path: path,
            method: resolvedMethod,
            staticParameters: dataSource.params,
            inputParameters: resolvedInputs,
            selectors: dataSource.selectors,
            paging: dataSource.paging,
            requireInvocationRecords: requireInvocationRecords,
            additionalHeaders: additionalHeaders,
            session: session,
            bypassCache: bypassCache,
            invocationId: invocationId,
            current: current, admitTransport: admitTransport, submittedInput: submittedInput
        )
        if case .failure(let error) = receipt, error is ReviewedScopeChanged {
            await restoreOriginalControl()
            return receipt
        }
        guard await stillCurrent(), dataSourceFetchGenerations[dataSourceID] == fetchGeneration, await reportFetchFenceIsCurrent(preparationFence, windowID: windowID) else { return nil }
        let fetchedRows: [[String: JSONValue]]
        if case let .success(rows) = receipt { fetchedRows = rows.compactMap(\.objectValue) }
        else { fetchedRows = await dataSourceRuntime.collection(dataSourceID: dataSourceID) }
        let hookedRows = await applyDataSourceFetchHooks(
            windowID: windowID, dataSourceRef: dataSourceRef, metadata: metadata,
            rows: fetchedRows, generation: fetchGeneration, path: lifecyclePath + [dataSourceRef], current: current
        )
        guard await stillCurrent(), dataSourceFetchGenerations[dataSourceID] == fetchGeneration, await reportFetchFenceIsCurrent(preparationFence, windowID: windowID) else { return nil }
        if case .success = receipt, baseURL.isEmpty, additionalHeaders.isEmpty, let proof = parentRead(hookedRows, raw: fetchedRows, resolvedInputs) {
            await dataSourceRuntime.setCollection(dataSourceID: dataSourceID, rows: hookedRows, forInput: input, parentRead: proof)
        } else {
            await dataSourceRuntime.setCollection(dataSourceID: dataSourceID, rows: hookedRows)
        }
        if dataSource.autoSelect != false,
           let first = hookedRows.first,
           await dataSourceRuntime.selection(dataSourceID: dataSourceID).selected == nil {
            let prepared = applySelectionHook(metadata: metadata, row: first, rowIndex: 0)
            let selection = SelectionState(selected: prepared, rowIndex: 0)
            await dataSourceRuntime.setSelection(dataSourceID: dataSourceID, selection: selection)
            await dataSourceRuntime.setForm(dataSourceID: dataSourceID, values: prepared)
        }
        let collectionSignal = await signals.collection(dataSourceID: dataSourceID)
        await collectionSignal.set(hookedRows)
        let metricsSignal = await signals.metrics(dataSourceID: dataSourceID)
        await metricsSignal.set(await dataSourceRuntime.metrics(dataSourceID: dataSourceID))
        let formSignal = await signals.form(dataSourceID: dataSourceID)
        await formSignal.set(await dataSourceRuntime.form(dataSourceID: dataSourceID))
        let selectionSignal = await signals.selection(dataSourceID: dataSourceID)
        await selectionSignal.set(await dataSourceRuntime.selection(dataSourceID: dataSourceID))
        let controlSignal = await signals.control(dataSourceID: dataSourceID)
        await controlSignal.set(await dataSourceRuntime.control(dataSourceID: dataSourceID))
        let control = await dataSourceRuntime.control(dataSourceID: dataSourceID)
        await applyDataSourceLifecycleHooks(
            windowID: windowID, dataSourceRef: dataSourceRef, metadata: metadata,
            event: control.error == nil ? "onSuccess" : "onError", rows: hookedRows,
            generation: fetchGeneration, path: lifecyclePath + [dataSourceRef], current: current
        )
        // Grid signals contain objects. A command may also receive a scalar
        // acknowledgement from its producer, which must keep its JSON type.
        return receipt?.map { records in
            records.contains { $0.objectValue == nil } ? records : hookedRows.map(JSONValue.object)
        }
    }

    private func applyDataSourceLifecycleHooks(windowID: String, dataSourceRef: String,
                                               metadata: WindowMetadata, event: String,
                                               rows: [[String: JSONValue]], generation: UInt64,
                                               path: [String], current: (@Sendable () async -> Bool)? = nil) async {
        let hooks = metadata.dataSources[dataSourceRef]?.on.filter { $0.event == event } ?? []
        guard !hooks.isEmpty, let code = metadata.actions?.code else { return }
        let sourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        for hook in hooks {
            var snapshots: [String: JSONValue] = [:]
            for ref in metadata.dataSources.keys {
                let id = WindowIdentity(windowID: windowID).dataSourceID(ref: ref)
                snapshots[ref] = .object([
                    "form": .object(await dataSourceRuntime.form(dataSourceID: id)),
                    "collection": .array(await dataSourceRuntime.collection(dataSourceID: id).map(JSONValue.object))
                ])
            }
            guard await current?() != false, dataSourceFetchGenerations[sourceID] == generation, !Task.isCancelled else { return }
            do {
                let projection = try DataSourceHookProjection.invoke(code: code, function: hook.action,
                    namespace: metadata.actionNamespace(for: hook.action), source: dataSourceRef, snapshots: snapshots, collection: rows,
                    windowForm: await windowFormJSONValue(windowID: windowID))
                await applyDataSourceLifecycleEffects(
                    projection.effects, windowID: windowID, metadata: metadata,
                    sourceID: sourceID, generation: generation, path: path, current: current
                )
            } catch {
                print("Forge datasource lifecycle hook failed [\(hook.action)]: \(error.localizedDescription)")
            }
        }
    }

    private func applyDataSourceFetchHooks(
        windowID: String, dataSourceRef: String, metadata: WindowMetadata,
        rows: [[String: JSONValue]], generation: UInt64, path: [String], current: (@Sendable () async -> Bool)? = nil
    ) async -> [[String: JSONValue]] {
        let hooks = metadata.dataSources[dataSourceRef]?.on.filter { $0.event == "onFetch" } ?? []
        guard !hooks.isEmpty, let code = metadata.actions?.code else { return rows }
        let sourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: dataSourceRef)
        var transformedRows = rows
        for hook in hooks {
            guard await current?() != false, dataSourceFetchGenerations[sourceID] == generation, !Task.isCancelled else { return rows }
            var snapshots: [String: JSONValue] = [:]
            for ref in metadata.dataSources.keys {
                let id = WindowIdentity(windowID: windowID).dataSourceID(ref: ref)
                snapshots[ref] = .object([
                    "form": .object(await dataSourceRuntime.form(dataSourceID: id)),
                    "collection": .array(await dataSourceRuntime.collection(dataSourceID: id).map(JSONValue.object))
                ])
            }
            do {
                let projection = try DataSourceHookProjection.invoke(
                    code: code, function: hook.action, namespace: metadata.actionNamespace(for: hook.action),
                    source: dataSourceRef, snapshots: snapshots, collection: transformedRows,
                    windowForm: await windowFormJSONValue(windowID: windowID)
                )
                guard await current?() != false, dataSourceFetchGenerations[sourceID] == generation, !Task.isCancelled else { return rows }
                await applyDataSourceLifecycleEffects(
                    projection.effects, windowID: windowID, metadata: metadata,
                    sourceID: sourceID, generation: generation, path: path, current: current
                )
                if let transformed = projection.result?.arrayValue {
                    transformedRows = transformed.compactMap(\.objectValue)
                }
            } catch {
                print("Forge datasource onFetch hook failed [\(hook.action)]: \(error.localizedDescription)")
            }
        }
        return transformedRows
    }

    private func applyDataSourceLifecycleEffects(
        _ effects: [JSONValue], windowID: String, metadata: WindowMetadata,
        sourceID: String, generation: UInt64, path: [String], current: (@Sendable () async -> Bool)? = nil
    ) async {
        for effect in effects {
            guard await current?() != false, dataSourceFetchGenerations[sourceID] == generation, !Task.isCancelled else { return }
            guard let object = effect.objectValue, let ref = object["ref"]?.stringValue,
                  metadata.dataSources[ref] != nil else { continue }
            switch object["kind"]?.stringValue {
            case "form":
                if let value = object["value"]?.objectValue {
                    await setDataSourceForm(windowID: windowID, dataSourceRef: ref, values: value)
                }
            case "input":
                if let value = object["value"]?.objectValue {
                    await setDataSourceInputParameters(windowID: windowID, dataSourceRef: ref, parameters: value)
                }
            case "fetch":
                guard !path.contains(ref), path.count < 16 else {
                    print("Forge datasource hook cycle rejected: \(path) -> \(ref)")
                    continue
                }
                _ = await refreshDataSourceRows(windowID: windowID, dataSourceRef: ref, lifecyclePath: path, current: current)
            default: break
            }
        }
    }

    // MARK: - Handler registry

    public func registerHandler(_ name: String, _ handler: @escaping ForgeHandler) {
        handlers[name] = handler
    }

    public func canExecute(_ execution: ExecutionDef) -> Bool {
        if handlers[execution.action] == nil {
            registerBuiltInHandlers()
        }
        return handlers[execution.action] != nil
    }

    func registeredHandler(named name: String) -> ForgeHandler? {
        handlers[name]
    }

    @discardableResult
    public func execute(
        _ execution: ExecutionDef,
        context: ExecutionContext? = nil,
        args: [String: JSONValue] = [:]
    ) async -> JSONValue? {
        if handlers[execution.action] == nil {
            registerBuiltInHandlers()
        }
        let execArgs = ExecutionArgs(execution: execution, context: context, args: args)
        if let handler = handlers[execution.action] {
            return await handler(execArgs)
        }
        if let context {
            let readOnlyEvent = ["onVisible", "onReadonly", "onDisabled"].contains(execution.event ?? "")
            return await executeProjectedMetadataAction(execution, context: context, args: args, applyEffects: !readOnlyEvent)
        }
        return nil
    }

    package func openSelectionOnlyLookup(
        windowID: String, source: String, dialogID: String, parameters: [ParameterDef], valueField: String?,
        parent: (id: String, presentation: UUID)?, callback: ExecutionDef
    ) async {
        let key = "\(windowID)Dialog\(dialogID)"
        guard parent?.id != dialogID, selectionPreparationOwners[key] == nil,
              let scope = await mutationScope(windowID: windowID, source: source),
              let dialog = scope.metadata.dialogs.first(where: { $0.id == dialogID }),
              scope.metadata.dataSources[source] != nil, selectionPreparationOwners[key] == nil else { return }
        let token = UUID()
        selectionPreparationOwners[key] = token
        defer { selectionPreparationOwners.removeValue(forKey: key) }

        let authorization = scope.metadata.authorizationSnapshot
        let revision = scope.metadata.parentReaders?.revision
        let current: @Sendable () async -> Bool = {
            await self.selectionOnlyLookupIsCurrent(windowID: windowID, parent: parent, authorization: authorization,
                revision: revision, key: key, token: token)
        }
        guard await current(), await dialogState(windowID: windowID, dialogID: dialogID).open == false else { return }
        let destination = dialog.content?.dataSourceRef ?? dialog.dataSourceRef ?? source
        let input = scope.resolvedParameters(parameters, target: destination)
        guard let payload = await openDialogAwaitResult(windowID: windowID, dialogID: dialogID, parameters: input, selectionMode: "single"),
              let record = payload["selected"]?.objectValue ?? payload["selection"]?.arrayValue?.first?.objectValue ?? (payload.isEmpty ? nil : payload),
              await current() else { return }
        guard await applyOutbound(parameters, payload: record, callerWindowID: windowID, callerDSRef: source, current: current) else { return }
        let data = JSONValue.object(record)
        let execution = ExecutionContext(windowID: windowID, dataSourceRef: source)
        let value = await formJSONValue(windowID: windowID, dataSourceRef: source)
        _ = await executeProjectedMetadataAction(callback, context: execution,
            args: ["record": data, "value": valueField.flatMap { resourceResolveValue(.object(value), path: $0) } ?? .null],
            applyEffects: true, current: current)
    }

    private func selectionOnlyLookupIsCurrent(windowID: String, parent: (id: String, presentation: UUID)?,
                                             authorization: [String: JSONValue], revision: UUID?, key: String, token: UUID) async -> Bool {
        guard !Task.isCancelled, let metadata = await windowMetadata(id: windowID),
              metadata.authorizationSnapshot == authorization, metadata.parentReaders?.revision == revision,
              windowState(id: windowID) != nil, selectionPreparationOwners[key] == token else { return false }
        guard let parent else { return true }
        return pendingDialogScope("\(windowID)Dialog\(parent.id)").id == parent.presentation
    }

    private func executeProjectedMetadataAction(
        _ execution: ExecutionDef, context: ExecutionContext,
        args: [String: JSONValue], applyEffects: Bool, current: (@Sendable () async -> Bool)? = nil
    ) async -> JSONValue? {
        guard await current?() != false, windowState(id: context.windowID) != nil,
              let metadata = await windowMetadata(id: context.windowID),
              let code = metadata.actions?.code, !code.isEmpty,
              let namespace = metadata.actionNamespace(for: execution.action) else { return nil }
        var snapshots: [String: JSONValue] = [:]
        for ref in metadata.dataSources.keys {
            let id = WindowIdentity(windowID: context.windowID).dataSourceID(ref: ref)
            let selection = await dataSourceRuntime.selection(dataSourceID: id)
            let input = await dataSourceRuntime.input(dataSourceID: id)
            snapshots[ref] = .object([
                "form": .object(await dataSourceRuntime.form(dataSourceID: id)),
                "collection": .array(await dataSourceRuntime.collection(dataSourceID: id).map(JSONValue.object)),
                "selection": .object(["selected": selection.selected.map(JSONValue.object) ?? .null, "selection": .array(selection.selection.map(JSONValue.object)), "rowIndex": .number(Double(selection.rowIndex))]),
                "input": .object(["filter": .object(input.filter), "parameters": .object(input.parameters), "page": input.page.map { .number(Double($0)) } ?? .null, "fetch": .bool(input.fetch), "refresh": .bool(input.refresh)]),
                "metrics": .object(await dataSourceRuntime.metrics(dataSourceID: id))
            ])
        }
        let executionValue = (try? JSONEncoder().encode(execution)).flatMap { try? JSONDecoder().decode(JSONValue.self, from: $0) } ?? .object([:])
        let windowForm = await windowFormJSONValue(windowID: context.windowID)
        if let current {
            guard await current() else { return nil }
        } else {
            guard await windowMetadata(id: context.windowID)?.authorizationSnapshot == metadata.authorizationSnapshot,
                  windowState(id: context.windowID) != nil else { return nil }
        }
        do {
            let projection = try UIActionProjection.invoke(
                code: code, function: execution.action, namespace: namespace,
                source: context.dataSourceRef, snapshots: snapshots, windowForm: windowForm,
                props: args.merging(["execution": executionValue]) { current, _ in current },
                authorization: metadata.authorizationSnapshot, aliases: metadata.actionNamespaces
            )
            if applyEffects {
                guard await applyProjectedUIEffects(projection.effects, context: context, metadata: metadata, current: current) else { return nil }
            }
            return projection.result
        } catch {
            print("Forge UI action failed [\(execution.action)]: \(error.localizedDescription)")
            return nil
        }
    }

    private func applyProjectedUIEffects(_ effects: [JSONValue], context: ExecutionContext, metadata: WindowMetadata,
                                         current: (@Sendable () async -> Bool)? = nil) async -> Bool {
        for effect in effects {
            if let current {
                guard await current() else { return false }
            } else {
                guard await windowMetadata(id: context.windowID)?.authorizationSnapshot == metadata.authorizationSnapshot,
                      windowState(id: context.windowID) != nil else { return false }
            }
            guard let object = effect.objectValue, let kind = object["kind"]?.stringValue else { continue }
            let ref = object["ref"]?.stringValue
            let value = object["value"]
            switch kind {
            case "form": if let ref, let values = value?.objectValue { await setDataSourceForm(windowID: context.windowID, dataSourceRef: ref, values: values) }
            case "collection":
                if let ref, metadata.dataSources[ref] != nil, let rows = value?.arrayValue?.compactMap(\.objectValue) {
                    let id = WindowIdentity(windowID: context.windowID).dataSourceID(ref: ref)
                    await dataSourceRuntime.setCollection(dataSourceID: id, rows: rows)
                    let signal = await signals.collection(dataSourceID: id)
                    await signal.set(rows)
                }
            case "selection":
                if let ref, metadata.dataSources[ref] != nil, let payload = value?.objectValue {
                    let rows = payload["selection"]?.arrayValue?.compactMap(\.objectValue) ?? []
                    let selected = payload["selected"]?.objectValue ?? rows.last
                    let selection = SelectionState(selected: selected, selection: rows, rowIndex: Int(payload["rowIndex"]?.widgetNumber ?? -1))
                    let id = WindowIdentity(windowID: context.windowID).dataSourceID(ref: ref)
                    await dataSourceRuntime.setSelection(dataSourceID: id, selection: selection)
                    let signal = await signals.selection(dataSourceID: id)
                    await signal.set(selection)
                }
            case "windowForm": if let values = value?.objectValue { await setWindowFormValue(windowID: context.windowID, values: values, bumpPrefillRevision: false) }
            case "windowFormPatch": if let values = value?.objectValue { await setWindowFormValue(windowID: context.windowID, values: values, bumpPrefillRevision: false) }
            case "input": if let ref, let values = value?.objectValue { await setDataSourceInputParameters(windowID: context.windowID, dataSourceRef: ref, parameters: values) }
            case "filter": if let ref, let values = value?.objectValue { await setDataSourceFilter(windowID: context.windowID, dataSourceRef: ref, filter: values) }
            case "fetch":
                if let ref, metadata.dataSources[ref] != nil {
                    if let current {
                        let bypassCache = value?.objectValue?["cache"]?.objectValue?["bypassCache"] == .bool(true)
                        _ = await refreshDataSourceRows(windowID: context.windowID, dataSourceRef: ref, bypassCache: bypassCache, current: current)
                    } else {
                        await refreshDataSourceCollection(windowID: context.windowID, dataSourceRef: ref)
                    }
                }
            case "resetSelection":
                if let ref, metadata.dataSources[ref] != nil {
                    let id = WindowIdentity(windowID: context.windowID).dataSourceID(ref: ref)
                    let selection = SelectionState()
                    await dataSourceRuntime.setSelection(dataSourceID: id, selection: selection)
                    let signal = await signals.selection(dataSourceID: id)
                    await signal.set(selection)
                }
            case "openDialog": await applyProjectedOpenDialog(value, context: context, metadata: metadata)
            case "closeDialog": if let dialogID = value?.objectValue?["dialogId"]?.stringValue { await closeDialog(windowID: context.windowID, dialogID: dialogID) }
            case "openWindow": await applyProjectedOpenWindow(value, context: context)
            case "openTarget": await applyProjectedOpenTarget(value, context: context, metadata: metadata)
            case "openURL":
                if let href = value?.objectValue?["href"]?.stringValue,
                   let url = URL(string: href),
                   ["http", "https", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") {
                    await externalURLHandler?(url)
                }
            default: break
            }
        }
        return true
    }

    private func applyProjectedOpenDialog(_ value: JSONValue?, context: ExecutionContext, metadata: WindowMetadata) async {
        guard let payload = value?.objectValue else { return }
        let nested = payload["execution"]?.objectValue
        let arguments = nested?["args"]?.arrayValue?.compactMap(\.stringValue) ?? []
        guard let dialogID = payload["dialogId"]?.stringValue ?? arguments.first else { return }
        guard metadata.dialogs.contains(where: { $0.id == dialogID }) else { return }
        await openDialog(windowID: context.windowID, dialogID: dialogID, parameters: payload["parameters"]?.objectValue ?? [:])
    }

    private func applyProjectedOpenWindow(_ value: JSONValue?, context: ExecutionContext) async {
        guard let payload = value?.objectValue else { return }
        let nested = payload["execution"]?.objectValue
        let arguments = nested?["args"]?.arrayValue?.compactMap(\.stringValue) ?? []
        guard let key = payload["windowKey"]?.stringValue ?? arguments.first else { return }
        let title = payload["windowTitle"]?.stringValue ?? payload["title"]?.stringValue ?? arguments.dropFirst().first ?? key
        _ = await openWindow(key: key, title: title, inTab: payload["inTab"]?.boolValue != false, parameters: payload["parameters"]?.objectValue ?? [:])
    }

    private func applyProjectedOpenTarget(_ value: JSONValue?, context: ExecutionContext, metadata: WindowMetadata) async {
        guard let payload = value?.objectValue else { return }
        let target = payload["target"]?.objectValue ?? payload
        switch target["kind"]?.stringValue?.lowercased() {
        case "dialog": await applyProjectedOpenDialog(.object(target), context: context, metadata: metadata)
        case "window": await applyProjectedOpenWindow(.object(target), context: context)
        case "external", "url", "link":
            let href = target["href"]?.stringValue ?? target["url"]?.stringValue
            if let href, let url = URL(string: href), ["http", "https", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") {
                await externalURLHandler?(url)
            }
        default: break
        }
    }

    // MARK: - Pending state

    func registerPendingDialog(_ key: String, _ pending: PendingDialog) {
        pendingDialogs[key, default: DialogPresentation()].outbound = pending
    }

    func ownReviewedPending(_ operation: MutationOperation, before: [String:JSONValue], after: [String:JSONValue]) -> Bool {
        guard let dialogID = operation.dialogID, let id = operation.presentationID else { return false }
        let key = "\(operation.windowID)Dialog\(dialogID)"
        guard pendingDialogs[key]?.id == id, let sequence = pendingDialogs[key]?.review?.pendingSequence,
              pendingDialogs[key]?.pendingRetirement == nil else { return false }
        pendingDialogs[key]?.review?.pendingSequence = sequence &+ 1
        pendingDialogs[key]?.review?.pending[operation.id] = ReviewedPendingPatch(sequence: sequence, keys: operation.root.pendingState.keys, before: before, after: after)
        return true
    }

    func finishReviewedPending(_ operation: MutationOperation, stale: Bool) async {
        guard operation.root.reviewedScope != nil, let dialog = operation.dialogID, let id = operation.presentationID else { return }
        let key = "\(operation.windowID)Dialog\(dialog)"
        guard let session = pendingDialogs[key], session.id == id else { return }
        if let retirement = session.pendingRetirement { await retirement.value; return }
        if stale {
            await releasePendingPatch(windowID: operation.windowID, key: key, presentation: id, invocation: operation.id)?.value
        } else if pendingDialogs[key]?.review?.pending[operation.id]?.release == nil {
            pendingDialogs[key]?.review?.pending.removeValue(forKey: operation.id)
        }
    }

    private func releasePendingPatch(windowID: String, key: String, presentation: UUID, invocation: String) -> Task<Void,Never>? {
        guard let session = pendingDialogs[key], session.id == presentation, let review = session.review,
              let patch = review.pending[invocation] else { return nil }
        if let release = patch.release { return release }
        let actor = review.actor
        let release = Task {
            await releaseReviewedPending(patch, actor: actor, windowID: windowID, owner: key, presentation: presentation)
            if pendingDialogs[key]?.id == presentation { pendingDialogs[key]?.review?.pending.removeValue(forKey: invocation) }
        }
        pendingDialogs[key]?.review?.pending[invocation]?.release = release
        return release
    }

    /// Keep the original presentation installed until its outstanding releases finish.
    private func retirePendingFields(windowID: String, key: String, presentationID: UUID) async {
        guard let session = pendingDialogs[key], session.id == presentationID else { return }
        if let retirement = session.pendingRetirement { await retirement.value; return }
        guard let pending = session.review?.pending, !pending.isEmpty else { return }
        // Overlapping pending fields restore in reverse publication order.
        let invocations = pending.sorted { $0.value.sequence > $1.value.sequence }.map(\.key)
        let retirement = Task {
            for invocation in invocations {
                await releasePendingPatch(windowID: windowID, key: key, presentation: presentationID, invocation: invocation)?.value
            }
        }
        pendingDialogs[key]?.pendingRetirement = retirement
        await retirement.value
    }

    func admitsDialogReview(key: String, presentationID: UUID, command: MutationCommandDef, scope: MutationScope) -> Bool {
        let name = command.commandId ?? command.dataSourceRef
        guard let rules = command.reviewedScope, let session = pendingDialogs[key], session.id == presentationID, session.pendingRetirement == nil,
              let review = session.review, review.plans[name] == rules, !review.invalidated.contains(name) else { return false }
        if scope.admitsReviewed(rules, review: review) { return true }
        pendingDialogs[key]?.review?.invalidated.insert(name)
        return false
    }

    func pendingDialogScope(_ key: String) -> (id: UUID?, outbound: PendingDialog?, selectionFence: DialogSelectionFence?) {
        let dialog = pendingDialogs[key]
        return (dialog?.id, dialog?.outbound, dialog?.selectionFence)
    }

    func waitForDialog(_ key: String) async -> [String: JSONValue]? {
        return await withCheckedContinuation { continuation in
            pendingDialogs[key]?.waiter?.resume(returning: nil)
            pendingDialogs[key, default: DialogPresentation()].waiter = continuation
        }
    }

    func registerPendingWindow(_ id: String, _ pending: PendingWindow) {
        pendingWindows[id] = pending
    }

    func pendingWindow(_ id: String) -> PendingWindow? { pendingWindows[id] }

    func clearPendingWindow(_ id: String) { pendingWindows.removeValue(forKey: id) }


    // MARK: - Dialog lifecycle

    @discardableResult
    func openDialog(
        windowID: String,
        dialogID: String,
        parameters: [String: JSONValue],
        selectionMode: String? = nil,
        outbound: PendingDialog? = nil,
        waiter: CheckedContinuation<[String: JSONValue]?, Never>? = nil,
        selectionFence: DialogSelectionFence? = nil,
        expected: DialogState? = nil
    ) async -> UUID? {
        let key = "\(windowID)Dialog\(dialogID)"
        let sig = await signals.dialog(dialogID: key)
        let metadata = await windowMetadata(id: windowID)
        let dialog = metadata?.dialogs.first { $0.id == dialogID }
        if !parameters.isEmpty, let dialog,
           let ref = dialog.content?.dataSourceRef ?? dialog.dataSourceRef, !ref.isEmpty {
            let scoped = parameters[ref]?.objectValue
            await setDataSourceInputParameters(windowID: windowID, dataSourceRef: ref,
                parameters: scoped?.isEmpty == false ? scoped! : parameters, preservePendingFetch: false)
        }
        if let selectionFence, await !dataSourceRuntime.dialogSelectionIsCurrent(selectionFence) { return nil }
        if let expected, await sig.peek() != expected || pendingDialogs[key]?.id != nil { return nil }
        if let previous = pendingDialogs[key], let previousID = previous.id,
           previous.pendingRetirement != nil || previous.review?.pending.isEmpty == false {
            await retirePendingFields(windowID: windowID, key: key, presentationID: previousID)
            if let live = pendingDialogs[key]?.id, live != previousID { waiter?.resume(returning: nil); return nil }
            if let selectionFence, await !dataSourceRuntime.dialogSelectionIsCurrent(selectionFence) {
                if pendingDialogs[key]?.id == previousID { pendingDialogs[key]?.pendingRetirement = nil }
                waiter?.resume(returning: nil)
                return nil
            }
        }
        var presentation = DialogState(open: true, selectionMode: selectionMode, props: parameters, args: parameters)
        let id = UUID()
        presentation.presentationID = id
        var session = pendingDialogs[key] ?? DialogPresentation()
        let replacedID = session.id
        let replacedSelectionFence = session.selectionFence
        if session.id != nil {
            session.waiter?.resume(returning: nil)
            session = DialogPresentation()
        }
        session.id = id
        if let dialog, !dialog.reviewedPlans.isEmpty, let metadata {
            session.review = ReviewedDialogPresentation(dialog.reviewedPlans, authorization: metadata.authorizationSnapshot, arguments: parameters)
        }
        session.selectionFence = selectionFence
        if let waiter {
            session.waiter?.resume(returning: nil)
            session.waiter = waiter
        }
        if let outbound { session.outbound = outbound }
        pendingDialogs[key] = session
        let previous = await sig.exchange(presentation)
        if let replacedSelectionFence { await dataSourceRuntime.releaseDialogSelection(replacedSelectionFence) }
        if let replacedID { await releaseAcknowledgedDialogMutations(windowID: windowID, presentationID: replacedID) }
        if !previous.open, pendingDialogs[key]?.id == id {
            await dispatchDialogLifecycle("onOpen", windowID: windowID, dialogID: dialogID, parameters: parameters)
        }
        return id
    }

    func closeDialog(windowID: String, dialogID: String, presentationID: UUID? = nil, payload: [String: JSONValue]? = nil) async {
        let key = "\(windowID)Dialog\(dialogID)"
        let sig = await signals.dialog(dialogID: key)
        if let presentationID, pendingDialogs[key]?.id != presentationID { return }
        // Detach the accepted presentation before yielding to its signal. A new
        // presentation at the same key owns its own caller and result waiter.
        if let previous = pendingDialogs[key], let previousID = previous.id,
           previous.pendingRetirement != nil || previous.review?.pending.isEmpty == false {
            await retirePendingFields(windowID: windowID, key: key, presentationID: previousID)
            guard pendingDialogs[key]?.id == previousID else { return }
        }
        let session = pendingDialogs.removeValue(forKey: key)
        let previous = await sig.dismiss(presentationID: session?.id)
        if let selectionFence = session?.selectionFence { await dataSourceRuntime.releaseDialogSelection(selectionFence) }
        if let id = session?.id { await releaseAcknowledgedDialogMutations(windowID: windowID, presentationID: id) }
        session?.waiter?.resume(returning: payload)
        if let previous, previous.open, pendingDialogs[key]?.id == nil {
            await dispatchDialogLifecycle("onClose", windowID: windowID, dialogID: dialogID, parameters: previous.args)
        }
    }

    private func dispatchDialogLifecycle(_ event:String, windowID:String, dialogID:String, parameters:[String:JSONValue]) async {
        guard let dialog = await windowMetadata(id:windowID)?.dialogs.first(where: { $0.id == dialogID }) else { return }
        let ref = dialog.content?.dataSourceRef ?? dialog.dataSourceRef ?? ""
        let context = ExecutionContext(windowID:windowID,dataSourceRef:ref)
        for execution in dialog.on where execution.event == event {
            _ = await execute(execution,context:context,args:["dialogId":.string(dialogID),"windowId":.string(windowID),"parameters":.object(parameters)])
        }
    }

    // MARK: - Outbound parameter application

    @discardableResult
    func applyOutbound(
        _ outbound: [ParameterDef],
        payload: [String: JSONValue],
        callerWindowID: String,
        callerDSRef: String,
        current: (@Sendable () async -> Bool)? = nil
    ) async -> Bool {
        let dsID = WindowIdentity(windowID: callerWindowID).dataSourceID(ref: callerDSRef)
        var form = await dataSourceRuntime.form(dataSourceID: dsID)
        for param in outbound where param.direction == "out" || param.direction == "inout" {
            let targetName = param.name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !targetName.isEmpty else { continue }
            let sourceName = param.location?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines)
            if let sourceName, !sourceName.isEmpty,
               let val = Self.jsonValue(any: SelectorUtil.resolve(Self.jsonObjectAny(payload), selector: sourceName)) {
                form[targetName] = val
            } else if let val = payload[targetName] {
                form[targetName] = val
            }
        }
        if let current {
            guard await current() else { return false }
            await setDataSourceForm(windowID: callerWindowID, dataSourceRef: callerDSRef, values: form)
        } else {
            await dataSourceRuntime.setForm(dataSourceID: dsID, values: form)
        }
        return true
    }

    func resolveOutbound(_ parameters: [ParameterDef]) -> [ParameterDef] {
        parameters.filter { $0.direction == "out" || $0.direction == "inout" }
    }

    private func loadWindowMetadata(for state: WindowState, forceReload: Bool = false) async {
        let signal = await signals.metadata(windowID: state.id)
        if !forceReload, await signal.peek() != nil {
            return
        }
        if forceReload {
            await signal.set(nil)
        }
        if windowMetadataRequestLoader != nil || windowMetadataLoader != nil {
            do {
                let resolved: WindowMetadata?
                if let windowMetadataRequestLoader {
                    resolved = try await windowMetadataRequestLoader(
                        WindowMetadataRequest(
                            windowID: state.id,
                            windowKey: state.key,
                            parameters: state.parameters,
                            conversationID: state.conversationID
                        )
                    )
                } else if let windowMetadataLoader {
                    resolved = try await windowMetadataLoader(state.key)
                } else {
                    resolved = nil
                }
                if let resolved = resolved?.preparingParentReaders() {
                    if let index = windows.firstIndex(where: { $0.id == state.id }) {
                        let existing = windows[index]
                        windows[index] = WindowState(
                            id: existing.id,
                            key: existing.key,
                            title: existing.title,
                            metadata: resolved,
                            inTab: existing.inTab,
                            parameters: existing.parameters,
                            conversationID: existing.conversationID,
                            presentation: existing.presentation,
                            region: existing.region,
                            workspaceSharePct: existing.workspaceSharePct,
                            workspaceMinHeight: existing.workspaceMinHeight,
                            parentKey: existing.parentKey,
                            isModal: existing.isModal
                        )
                    }
                    await signal.set(resolved)
                    await reconcileWindowForm(windowID: state.id, metadata: resolved, parameters: state.parameters)
                    return
                }
            } catch {
                print("ForgeRuntime metadata loader failed for \(state.key): \(error)")
            }
        }
        guard let endpoint = metadataURL(for: state.key) else {
            await signal.set(nil)
            return
        }
        do {
            let (data, _) = try await session.data(from: endpoint)
            let resolved = try Self.decodeWindowMetadata(from: data, targetContext: targetContext).preparingParentReaders()
            if let index = windows.firstIndex(where: { $0.id == state.id }) {
                let existing = windows[index]
                windows[index] = WindowState(
                    id: existing.id,
                    key: existing.key,
                    title: existing.title,
                    metadata: resolved,
                    inTab: existing.inTab,
                    parameters: existing.parameters,
                    conversationID: existing.conversationID,
                    presentation: existing.presentation,
                    region: existing.region,
                    workspaceSharePct: existing.workspaceSharePct,
                    workspaceMinHeight: existing.workspaceMinHeight,
                    parentKey: existing.parentKey,
                    isModal: existing.isModal
                )
            }
            await signal.set(resolved)
            await reconcileWindowForm(windowID: state.id, metadata: resolved, parameters: state.parameters)
        } catch {
            print("ForgeRuntime metadata load failed for \(state.key): \(error)")
            await signal.set(nil)
        }
    }

    public struct WindowMetadataRequest: Sendable {
        public let windowID: String
        public let windowKey: String
        public let parameters: [String: JSONValue]
        public let conversationID: String?

        public init(
            windowID: String,
            windowKey: String,
            parameters: [String: JSONValue] = [:],
            conversationID: String? = nil
        ) {
            self.windowID = windowID
            self.windowKey = windowKey
            self.parameters = parameters
            self.conversationID = conversationID
        }
    }

    private func metadataURL(for key: String) -> URL? {
        guard let endpoint = windowMetadataEndpoint else { return nil }
        return endpoint.appendingPathComponent(key)
    }

    private static func makeWindowMetadataEndpoint(baseURL: URL?, path: String) -> URL? {
        guard let baseURL else { return nil }
        let trimmedPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return trimmedPath.isEmpty ? baseURL : baseURL.appendingPathComponent(trimmedPath)
    }

    private static func decodeWindowMetadata(
        from data: Data,
        targetContext: ForgeTargetContext
    ) throws -> WindowMetadata {
        let decoder = JSONDecoder()
        if let direct = try? decoder.decode(WindowMetadata.self, from: data),
           isMeaningfulWindowMetadata(direct) {
            return MetadataResolver.resolve(direct, for: targetContext)
        }
        let wrapped = try decoder.decode(WindowMetadataEnvelope.self, from: data)
        guard let metadata = wrapped.data else {
            throw URLError(.cannotDecodeContentData)
        }
        return MetadataResolver.resolve(metadata, for: targetContext)
    }

    private static func isMeaningfulWindowMetadata(_ metadata: WindowMetadata) -> Bool {
        metadata.namespace != nil
            || metadata.view != nil
            || !metadata.dataSources.isEmpty
    }

    private func applyCollectionHook(
        metadata: WindowMetadata,
        rows: [[String: JSONValue]]
    ) -> [[String: JSONValue]] {
        guard let code = metadata.actions?.code?.trimmingCharacters(in: .whitespacesAndNewlines),
              !code.isEmpty else {
            return rows
        }
        let props: JSONValue = .object([
            "collection": .array(rows.map { .object($0) })
        ])
        guard let result = try? ActionHookRuntime.invoke(
            code: code,
            functionName: "prepareCollection",
            props: props
        ) else {
            return rows
        }
        guard case .array(let transformedRows) = result else {
            return rows
        }
        return transformedRows.compactMap(\.objectValue)
    }

    private func applySelectionHook(
        metadata: WindowMetadata?,
        row: [String: JSONValue],
        rowIndex: Int
    ) -> [String: JSONValue] {
        guard let code = metadata?.actions?.code?.trimmingCharacters(in: .whitespacesAndNewlines),
              !code.isEmpty else {
            return row
        }
        let props: JSONValue = .object([
            "selected": .object(row),
            "rowIndex": .number(Double(rowIndex))
        ])
        guard let result = try? ActionHookRuntime.invoke(
            code: code,
            functionName: "prepareSelection",
            props: props
        ) else {
            return row
        }
        return result.objectValue ?? row
    }

    private static func jsonObjectAny(_ value: [String: JSONValue]) -> [String: Any] {
        value.mapValues(jsonAnyValue)
    }

    private static func jsonAnyValue(_ value: JSONValue) -> Any {
        switch value {
        case .string(let string):
            return string
        case .number(let number):
            return number
        case .bool(let bool):
            return bool
        case .array(let values):
            return values.map(jsonAnyValue)
        case .object(let object):
            return jsonObjectAny(object)
        case .null:
            return NSNull()
        }
    }

    private static func jsonValue(any value: Any?) -> JSONValue? {
        guard let value else { return nil }
        if let json = value as? JSONValue {
            return json
        }
        if let string = value as? String {
            return .string(string)
        }
        if let bool = value as? Bool {
            return .bool(bool)
        }
        if let int = value as? Int {
            return .number(Double(int))
        }
        if let double = value as? Double {
            return .number(double)
        }
        if let number = value as? NSNumber {
            return .number(number.doubleValue)
        }
        if let object = value as? [String: JSONValue] {
            return .object(object)
        }
        if let object = value as? [String: Any] {
            return .object(object.compactMapValues { jsonValue(any: $0) })
        }
        if let array = value as? [JSONValue] {
            return .array(array)
        }
        if let array = value as? [Any] {
            return .array(array.compactMap { jsonValue(any: $0) })
        }
        return nil
    }
}

internal func isForgeCancellationError(_ error: Error) -> Bool {
    if error is CancellationError {
        return true
    }
    let nsError = error as NSError
    return nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled
}

private struct WindowMetadataEnvelope: Decodable {
    let data: WindowMetadata?
}
