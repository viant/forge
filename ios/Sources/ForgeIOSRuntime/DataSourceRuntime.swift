import Foundation

typealias DataSourceRowReceipt = Result<[JSONValue], Error>

struct FormFileSelection: Equatable, Sendable {
    let revision: UUID
    let reading: Bool
}

// The picker records intent synchronously before scheduling I/O. The receipt
// and form actors consult the same revisions; file bytes are never stored here.
final class FormFileSelections: @unchecked Sendable {
    private let lock = NSLock()
    private struct Field {
        var revision: UUID
        let presentation: UUID?
        var pending: [String: UUID] = [:]
    }
    private var entries: [String: [String: Field]] = [:]

    private func topLevel(_ path: String) -> String { String(path.prefix { $0 != "." }) }

    func begin(_ id: String, field: String, presentation: UUID?) -> UUID {
        lock.withLock {
            let revision = UUID()
            let key = topLevel(field)
            var choice = entries[id]?[key]
            if choice == nil || choice?.presentation != presentation { choice = Field(revision: revision, presentation: presentation) }
            choice?.revision = revision
            choice?.pending[field] = revision
            entries[id, default: [:]][key] = choice
            return revision
        }
    }

    func whileCurrent(_ id: String, field: String, revision: UUID, _ apply: () -> Bool) -> Bool {
        lock.withLock {
            guard entries[id]?[topLevel(field)]?.pending[field] == revision else { return false }
            return apply()
        }
    }

    func finish(_ id: String, field: String, revision: UUID) {
        lock.withLock {
            let key = topLevel(field)
            if entries[id]?[key]?.pending[field] == revision { entries[id]?[key]?.pending[field] = nil }
        }
    }

    func snapshot(_ id: String, fields: Set<String>, presentation: UUID?) -> [String: FormFileSelection] {
        withSnapshot(id, fields: fields, presentation: presentation) { $0 }
    }

    func withSnapshot<T>(_ id: String, fields: Set<String>, presentation: UUID?, _ apply: ([String: FormFileSelection]) -> T) -> T {
        lock.withLock {
            var snapshot: [String: FormFileSelection] = [:]
            if let selections = entries[id] {
                for field in fields {
                    guard let selection = selections[field], selection.presentation == nil || presentation == nil || selection.presentation == presentation else { continue }
                    snapshot[field] = FormFileSelection(revision: selection.revision, reading: !selection.pending.isEmpty)
                }
            }
            return apply(snapshot)
        }
    }

    func detach(windowID: String) {
        lock.withLock {
            for id in entries.keys where id.hasPrefix(windowID + "DS") { entries[id] = nil }
        }
    }
}

public actor DataSourceRuntime {
    nonisolated let fileSelections = FormFileSelections()
    private struct CollectionInput: Sendable {
        let input: InputState
        var parentRead: ParentCollectionRead?
    }
    private var collectionInputs: [String: CollectionInput] = [:]
    private var collectionInfo: [String: [String: JSONValue]] = [:]
    private var collectionValues: [String: [[String: JSONValue]]] = [:]
    private var formValues: [String: [String: JSONValue]] = [:]
    private struct DialogSelection {
        let identityPath: [String]
        let keys: [String]
    }
    private var dialogSelectionFences: [String: [UUID: DialogSelection]] = [:]
    private var selectionValues: [String: SelectionState] = [:]
    private var inputValues: [String: InputState] = [:]
    private var controlValues: [String: ControlState] = [:]
    private var metricsValues: [String: [String: JSONValue]] = [:]

    private var formObservers: [String: [UUID: AsyncStream<[String: JSONValue]>.Continuation]] = [:]

    public init() {}

    // MARK: - Accessors

    public func collection(dataSourceID: String) -> [[String: JSONValue]] {
        collectionValues[dataSourceID] ?? []
    }

    public func setCollection(dataSourceID: String, rows: [[String: JSONValue]], forInput: InputState? = nil) {
        setCollection(dataSourceID: dataSourceID, rows: rows, forInput: forInput, parentRead: nil)
    }

    func setCollection(dataSourceID: String, rows: [[String: JSONValue]], forInput: InputState?, parentRead: ParentCollectionRead?) {
        collectionInputs[dataSourceID] = CollectionInput(input: forInput ?? inputValues[dataSourceID] ?? InputState(), parentRead: parentRead)
        collectionValues[dataSourceID] = rows
    }

    public func form(dataSourceID: String) -> [String: JSONValue] {
        formValues[dataSourceID] ?? [:]
    }

    func publishFormFile(_ id: String, field: String, revision: UUID, value: JSONValue) -> Bool {
        fileSelections.whileCurrent(id, field: field, revision: revision) {
            guard let updated = SelectorUtil.setting(value, in: .object(formValues[id] ?? [:]), selector: field)?.objectValue else { return false }
            setForm(dataSourceID: id, values: updated)
            return true
        }
    }

    func clearSubmittedFormFields(dataSourceID: String, submitted: [String: JSONValue], files: [String: FormFileSelection], presentation: UUID?) -> [String: JSONValue] {
        fileSelections.withSnapshot(dataSourceID, fields: Set(submitted.keys), presentation: presentation) { choices in
            let eligible = submitted.filter { choices[$0.key] == files[$0.key] }
            guard let updated = clearingSubmittedFields(form(dataSourceID: dataSourceID), submitted: eligible) else { return [:] }
            setForm(dataSourceID: dataSourceID, values: updated)
            return eligible
        }
    }

    func applySubmittedFormPatch(dataSourceID: String, submitted: [String: JSONValue], patch: [String: JSONValue], files: [String: FormFileSelection], guardedFields: Set<String>, presentation: UUID?) -> SubmittedFormPatchDisposition {
        fileSelections.withSnapshot(dataSourceID, fields: guardedFields, presentation: presentation) { choices in
            guard choices == files else { return .conflict }
            let decision = submittedFormPatchDisposition(formValues[dataSourceID] ?? [:], submitted: submitted, patch: patch)
            if decision == .apply {
                formValues[dataSourceID, default: [:]].merge(patch) { _, value in value }
                publishForm(dataSourceID)
            }
            return decision
        }
    }

    func restoreForm(dataSourceID: String, ifCurrent current: [String:JSONValue], previous: [String:JSONValue]) -> Bool {
        guard form(dataSourceID: dataSourceID) == current else { return false }
        setForm(dataSourceID: dataSourceID, values: previous)
        return true
    }

    public func setForm(dataSourceID: String, values: [String: JSONValue]) {
        formValues[dataSourceID] = values
        publishForm(dataSourceID)
    }

    private func publishForm(_ dataSourceID: String) {
        let current = formValues[dataSourceID] ?? [:]
        for observer in formObservers[dataSourceID]?.values ?? [:].values { observer.yield(current) }
    }

    public func compareAndSetReportForm(dataSourceID: String, expected: [String: JSONValue], updated: [String: JSONValue]) -> Bool {
        commitReportFormSnapshot(dataSourceID: dataSourceID, expected: expected, updated: updated) != nil
    }

    public func commitReportFormSnapshot(dataSourceID: String, expected: [String: JSONValue], updated: [String: JSONValue]) -> [String: JSONValue]? {
        let current = formValues[dataSourceID] ?? [:]
        guard reportPreparationAuthorInputs(current) == reportPreparationAuthorInputs(expected) else { return nil }
        var next = current
        for (key, value) in reportPreparationAuthorInputs(updated) { next[key] = value }
        if next != current { setForm(dataSourceID: dataSourceID, values: next) }
        return next
    }

    public func formUpdates(dataSourceID: String) -> AsyncStream<[String: JSONValue]> {
        let id = UUID()
        return AsyncStream { continuation in
            formObservers[dataSourceID, default: [:]][id] = continuation
            continuation.yield(formValues[dataSourceID] ?? [:])
            continuation.onTermination = { _ in Task { await self.removeFormObserver(dataSourceID: dataSourceID, id: id) } }
        }
    }

    private func removeFormObserver(dataSourceID: String, id: UUID) { formObservers[dataSourceID]?[id] = nil }

    public func selection(dataSourceID: String) -> SelectionState {
        selectionValues[dataSourceID] ?? SelectionState()
    }

    public func setSelection(dataSourceID: String, selection: SelectionState) {
        selectionValues[dataSourceID] = selection
        guard let active = dialogSelectionFences[dataSourceID] else { return }
        let remaining = active.filter { _, guardState in
            selection.preparedSelectionKeys(identityPath: guardState.identityPath) == guardState.keys
        }
        dialogSelectionFences[dataSourceID] = remaining.isEmpty ? nil : remaining
    }

    func guardDialogSelection(dataSourceID: String, identityField: String, keys: [String]) -> DialogSelectionFence? {
        let path = identityField.components(separatedBy: ".")
        guard selection(dataSourceID: dataSourceID).preparedSelectionKeys(identityPath: path) == keys else { return nil }
        let fence = DialogSelectionFence(dataSourceID: dataSourceID)
        dialogSelectionFences[dataSourceID, default: [:]][fence.token] = DialogSelection(identityPath: path, keys: keys)
        return fence
    }

    func dialogSelectionIsCurrent(_ fence: DialogSelectionFence?) -> Bool {
        guard let fence else { return true }
        return dialogSelectionFences[fence.dataSourceID]?[fence.token] != nil
    }

    func releaseDialogSelection(_ fence: DialogSelectionFence) {
        dialogSelectionFences[fence.dataSourceID]?.removeValue(forKey: fence.token)
        if dialogSelectionFences[fence.dataSourceID]?.isEmpty == true {
            dialogSelectionFences.removeValue(forKey: fence.dataSourceID)
        }
    }

    public func input(dataSourceID: String) -> InputState {
        inputValues[dataSourceID] ?? InputState()
    }

    public func setInput(dataSourceID: String, input: InputState) {
        inputValues[dataSourceID] = input
    }

    public func setInputParameters(dataSourceID: String, parameters: [String: JSONValue], fetch: Bool = false, preservePendingFetch: Bool = true) {
        let current = inputValues[dataSourceID] ?? InputState()
        let query = parameters["input"]?.objectValue?["query"]?.objectValue ?? [:]
        let mergedFilter = current.filter.merging(query) { _, new in new }
        inputValues[dataSourceID] = InputState(
            filter: mergedFilter,
            parameters: parameters,
            page: current.page,
            fetch: fetch || (preservePendingFetch && current.fetch),
            refresh: preservePendingFetch && current.refresh
        )
    }

    /// A parameter edit is atomic with respect to sibling controls on the same datasource.
    func editInputParameter(dataSourceID: String, selector: String, value: JSONValue) -> InputState? {
        let updated: JSONValue?
        if selector == "parameters" {
            updated = value
        } else {
            let prefix = "parameters."
            guard selector.hasPrefix(prefix) else { return nil }
            let path = String(selector.dropFirst(prefix.count))
            updated = SelectorUtil.setting(value, in: .object(input(dataSourceID: dataSourceID).parameters), selector: path)
        }
        guard let parameters = updated?.objectValue else { return nil }
        setInputParameters(dataSourceID: dataSourceID, parameters: parameters, fetch: false, preservePendingFetch: false)
        return input(dataSourceID: dataSourceID)
    }

    public func control(dataSourceID: String) -> ControlState {
        controlValues[dataSourceID] ?? ControlState()
    }

    public func setControl(dataSourceID: String, control: ControlState) {
        if control.loading || control.inactive || control.error != nil, collectionInputs[dataSourceID]?.parentRead != nil {
            collectionInputs[dataSourceID]?.parentRead = nil
        }
        controlValues[dataSourceID] = control
    }

    public func metrics(dataSourceID: String) -> [String: JSONValue] {
        metricsValues[dataSourceID] ?? [:]
    }

    /// Staging report inputs registers a real, unresolved context without IO.
    /// Changed inputs must not be paired with rows from an older request.
    public func registerReportInput(dataSourceID: String, parameters: [String: JSONValue]) -> Bool {
        if inputValues[dataSourceID]?.parameters == parameters { return false }
        inputValues[dataSourceID] = InputState(parameters: parameters)
        collectionValues.removeValue(forKey: dataSourceID)
        collectionInputs.removeValue(forKey: dataSourceID)
        collectionInfo.removeValue(forKey: dataSourceID)
        formValues.removeValue(forKey: dataSourceID)
        metricsValues.removeValue(forKey: dataSourceID)
        selectionValues.removeValue(forKey: dataSourceID)
        dialogSelectionFences.removeValue(forKey: dataSourceID)
        controlValues[dataSourceID] = ControlState(inactive: true)
        return true
    }

    // Copy-on-write storage gives one operation a consistent indexed view without
    // walking the window catalog or materializing unused forms and collections.
    func snapshotReader() -> @Sendable (String) -> RegisteredDataSourceSnapshot? {
        { [inputValues, controlValues, formValues, selectionValues, collectionValues, metricsValues, collectionInputs, collectionInfo] id in
            guard inputValues[id] != nil || controlValues[id] != nil || formValues[id] != nil
                    || selectionValues[id] != nil || collectionValues[id] != nil || metricsValues[id] != nil else { return nil }
            let input = inputValues[id] ?? InputState(), loaded = collectionInputs[id]
            let stale = (loaded?.input).map { $0.parameters != input.parameters || $0.filter != input.filter || $0.page != input.page } ?? false
            return RegisteredDataSourceSnapshot(input: input, control: controlValues[id] ?? ControlState(),
                form: formValues[id] ?? [:], selection: selectionValues[id] ?? SelectionState(), collection: collectionValues[id], metrics: metricsValues[id] ?? [:], dataInfo: collectionInfo[id] ?? [:], stale: stale, parentRead: loaded?.parentRead)
        }
    }

    public func registeredSnapshot(dataSourceID: String) -> RegisteredDataSourceSnapshot? {
        snapshotReader()(dataSourceID)
    }

    func setCollectionInfo(dataSourceID: String, values: [String: JSONValue]) {
        collectionInfo[dataSourceID] = values
    }

    public func setMetrics(dataSourceID: String, values: [String: JSONValue]) {
        metricsValues[dataSourceID] = values
    }

    // MARK: - Mutation helpers (used by built-in handlers)

    public func triggerFetch(dataSourceID: String) {
        let input = inputValues[dataSourceID] ?? InputState()
        inputValues[dataSourceID] = InputState(
            filter: input.filter, parameters: input.parameters,
            page: input.page, fetch: true, refresh: input.refresh)
    }

    public func setFilter(dataSourceID: String, filter: [String: JSONValue]) {
        let input = inputValues[dataSourceID] ?? InputState()
        inputValues[dataSourceID] = InputState(
            filter: filter, parameters: input.parameters,
            page: input.page, fetch: true, refresh: input.refresh)
    }

    public func setPage(dataSourceID: String, page: Int?) {
        let input = inputValues[dataSourceID] ?? InputState()
        inputValues[dataSourceID] = InputState(
            filter: input.filter,
            parameters: input.parameters,
            page: page,
            fetch: true,
            refresh: input.refresh
        )
    }

    // MARK: - REST collection fetch

    /// Fetch a collection from a REST endpoint and normalize the response.
    /// Mirrors Android DataSourceRuntime.fetchCollection() normalization logic.
    public func fetchCollection(
        dataSourceID: String,
        baseURL: String,
        path: String,
        method: String = "GET",
        staticParameters: [String: String] = [:],
        inputParameters: [String: JSONValue] = [:],
        selectors: DataSourceSelectorDef? = nil,
        paging: DataSourcePagingDef? = nil,
        additionalHeaders: [String: String] = [:],
        session: URLSession = .shared
    ) async {
        _ = await fetchCollectionRows(dataSourceID: dataSourceID, baseURL: baseURL, path: path, method: method, staticParameters: staticParameters, inputParameters: inputParameters, selectors: selectors, paging: paging, additionalHeaders: additionalHeaders, session: session)
    }

    func fetchCollectionRows(
        dataSourceID: String,
        baseURL: String,
        path: String,
        method: String = "GET",
        staticParameters: [String: String] = [:],
        inputParameters: [String: JSONValue] = [:],
        selectors: DataSourceSelectorDef? = nil,
        paging: DataSourcePagingDef? = nil,
        requireInvocationRecords: Bool = false,
        additionalHeaders: [String: String] = [:],
        session: URLSession = .shared,
        bypassCache: Bool = false,
        invocationId: String? = nil,
        current: (@Sendable () async -> Bool)? = nil
    ) async -> DataSourceRowReceipt? {
        if let current, await !current() { return nil }
        setControl(dataSourceID: dataSourceID, control: ControlState(loading: true))
        do {
            let input = inputValues[dataSourceID] ?? InputState()
            let raw = try await requestCollection(input: input, baseURL: baseURL, path: path, method: method, staticParameters: staticParameters,
                                                  inputParameters: inputParameters, paging: paging, additionalHeaders: additionalHeaders,
                                                  session: session, bypassCache: bypassCache, invocationId: invocationId)
            if let current, await !current() { return nil }
            var invocationRecords: [JSONValue]?
            if requireInvocationRecords {
                guard let items = invocationRecordsFromResponse(raw, selector: selectors?.data) else {
                    setControl(dataSourceID: dataSourceID, control: ControlState(error: "Writer invocation records are unavailable."))
                    return nil
                }
                invocationRecords = items
            }
            let rows = normalizeCollection(raw, selector: selectors?.data)
            setCollection(dataSourceID: dataSourceID, rows: rows, forInput: input)
            let selectedMetrics = normalizeDataInfo(raw, selector: selectors?.metrics)
            let dataInfo = normalizeDataInfo(raw, selector: selectors?.dataInfo)
            setCollectionInfo(dataSourceID: dataSourceID, values: extractPagingMetrics(raw, paging: paging).merging(dataInfo) { _, selected in selected })
            if !selectedMetrics.isEmpty {
                setMetrics(dataSourceID: dataSourceID, values: selectedMetrics)
            } else if dataInfo.isEmpty {
                setMetrics(dataSourceID: dataSourceID, values: extractPagingMetrics(raw, paging: paging))
            } else {
                setMetrics(dataSourceID: dataSourceID, values: dataInfo)
            }
            setControl(dataSourceID: dataSourceID, control: ControlState())
            return .success(invocationRecords ?? rows.map(JSONValue.object))
        } catch {
            if let current, await !current() { return nil }
            if Task.isCancelled || (error as? URLError)?.code == .cancelled || error is CancellationError {
                setControl(dataSourceID: dataSourceID, control: ControlState())
                return nil
            }
            setControl(dataSourceID: dataSourceID,
                       control: ControlState(error: error.localizedDescription))
            return .failure(error)
        }
    }

    /// The transport has no signal side effects. Normal collection fetches
    /// publish the returned payload, while selection preparations consume it locally.
    func requestCollection(input: InputState, baseURL: String, path: String, method: String, staticParameters: [String: String],
                           inputParameters: [String: JSONValue], paging: DataSourcePagingDef?, additionalHeaders: [String: String],
                           session: URLSession, bypassCache: Bool = false, invocationId: String? = nil) async throws -> JSONValue {
        let resolvedMethod = method.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let requestMethod = resolvedMethod.isEmpty ? "GET" : resolvedMethod
        guard var components = URLComponents(string: baseURL + path) else { throw URLError(.badURL) }
        let fetchInputs = buildDatasourceFetchInputs(
            input: input,
            staticParameters: staticParameters,
            inputParameters: inputParameters,
            paging: paging
        )
        if requestMethod == "GET" {
            let queryItems = fetchInputs.compactMap { key, value -> URLQueryItem? in
                guard let stringValue = requestString(value) else { return nil }
                return URLQueryItem(name: key, value: stringValue)
            }
            if !queryItems.isEmpty { components.queryItems = queryItems }
        }

        guard let url = components.url else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = requestMethod
        if bypassCache {
            request.cachePolicy = .reloadIgnoringLocalCacheData
            request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        }
        for (k, v) in additionalHeaders { request.setValue(v, forHTTPHeaderField: k) }
        if requestMethod != "GET" {
            let payload: JSONValue
            if isDatasourceFetchRoute(path) {
                var envelope: [String: JSONValue] = ["inputs": .object(fetchInputs)]
                if bypassCache { envelope["cache"] = .object(["bypassCache": .bool(true)]) }
                if let invocationId { envelope["invocationId"] = .string(invocationId) }
                payload = .object(envelope)
            } else {
                payload = .object(inputParameters)
            }
            request.httpBody = try JSONEncoder().encode(payload)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let (data, response) = try await session.data(for: request)
        if let response = response as? HTTPURLResponse,
           !(200..<300).contains(response.statusCode) {
            throw NSError(
                domain: "Forge.DataSource.HTTP",
                code: response.statusCode,
                userInfo: [NSLocalizedDescriptionKey: "Unable to load data (HTTP \(response.statusCode)). Please retry."]
            )
        }
        return try JSONDecoder().decode(JSONValue.self, from: data)
    }

    func invocationRecordsFromResponse(_ raw: JSONValue, selector: String?) -> [JSONValue]? {
        let path = selector?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let value = path.isEmpty
            ? raw.objectValue?["data"] ?? raw.objectValue?["entries"] ?? raw.objectValue?["Rows"] ?? raw.objectValue?["rows"] ?? raw
            : selectValue(raw, selector: path)
        return value?.arrayValue
    }

    private func buildDatasourceFetchInputs(
        input: InputState,
        staticParameters: [String: String],
        inputParameters: [String: JSONValue],
        paging: DataSourcePagingDef?
    ) -> [String: JSONValue] {
        var values = staticParameters.mapValues { JSONValue.string($0) }
        for (key, value) in inputParameters {
            values[key] = value
        }
        if paging?.enabled != false, let page = input.page {
            let pageParameters = paging?.parameters ?? [:]
            let pageParamName = pageParameters["page"] ?? "page"
            values[pageParamName] = .number(Double(resolvedPageValue(
                pageParamName: pageParamName,
                pageValue: page,
                pageSize: paging?.size
            )))
            if let size = paging?.size, size > 0 {
                values[pageParameters["size"] ?? "size"] = .number(Double(size))
            }
        }
        for (key, value) in input.filter {
            values[key] = value
        }
        return values
    }

    private func resolvedPageValue(pageParamName: String, pageValue: Int, pageSize: Int?) -> Int {
        if pageParamName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "offset" {
            let size = max(pageSize ?? 0, 0)
            return (max(pageValue, 1) - 1) * size
        }
        return pageValue
    }

    private func requestString(_ value: JSONValue) -> String? {
        switch value {
        case .string(let value): return value
        case .number(let value):
            if value.rounded() == value {
                return String(Int(value))
            }
            return String(value)
        case .bool(let value): return value ? "true" : "false"
        case .null: return nil
        case .array, .object: return nil
        }
    }

    private func isDatasourceFetchRoute(_ path: String) -> Bool {
        let pattern = #"(^|/)v1/api/datasources/[^/]+/fetch(\?.*)?$"#
        return path.range(of: pattern, options: .regularExpression) != nil
    }

    /// Mirrors Android normalizeCollection() fallback chain:
    /// data → entries → Rows → rows → bare array/object
    private func normalizeCollection(_ value: JSONValue, selector: String? = nil) -> [[String: JSONValue]] {
        let selected = selectValue(value, selector: selector)
        let object = value.objectValue
        let candidates: [JSONValue?]
        if selector?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
            candidates = [
                selected,
                object?["data"],
                object?["entries"],
                object?["Rows"],
                object?["rows"]
            ]
        } else {
            candidates = [
                object?["data"],
                object?["entries"],
                object?["Rows"],
                object?["rows"],
                value
            ]
        }
        for candidate in candidates.compactMap({ $0 }) {
            switch candidate {
            case .array(let items): return items.compactMap { $0.objectValue }
            case .object(let dict): return [dict]
            default: continue
            }
        }
        return []
    }

    private func extractPagingMetrics(_ value: JSONValue, paging: DataSourcePagingDef?) -> [String: JSONValue] {
        var output: [String: JSONValue] = [:]
        for (name, path) in paging?.dataInfoSelectors ?? [:] {
            if let selected = selectValue(value, selector: path) {
                output[name] = selected
            }
        }
        for key in ["pageCount", "totalCount", "nextCursor", "prevCursor", "hasMore", "cursor"] {
            if output[key] == nil, let selected = selectValue(value, selector: key) {
                output[key] = selected
            }
        }
        return output
    }

    private func selectValue(_ value: JSONValue, selector: String?) -> JSONValue? {
        let path = selector?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !path.isEmpty else { return value }
        var current: JSONValue? = value
        for component in path.split(separator: ".").map(String.init).filter({ !$0.isEmpty }) {
            guard let active = current else { return nil }
            if let object = active.objectValue {
                current = object[component]
            } else if let array = active.arrayValue, let index = Int(component), array.indices.contains(index) {
                current = array[index]
            } else {
                return nil
            }
        }
        return current
    }

    private func normalizeMap(_ value: JSONValue?) -> [String: JSONValue] {
        value?.objectValue ?? [:]
    }

    private func normalizeDataInfo(_ value: JSONValue, selector: String?) -> [String: JSONValue] {
        let path = selector?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !path.isEmpty else { return [:] }
        return normalizeMap(selectValue(value, selector: path))
    }

    // MARK: - Window cleanup

    public func detachWindow(_ windowID: String) {
        fileSelections.detach(windowID: windowID)
        let keys = Set(collectionValues.keys.filter { $0.hasPrefix(windowID) })
            .union(formValues.keys.filter { $0.hasPrefix(windowID) })
            .union(selectionValues.keys.filter { $0.hasPrefix(windowID) })
            .union(inputValues.keys.filter { $0.hasPrefix(windowID) })
            .union(controlValues.keys.filter { $0.hasPrefix(windowID) })
            .union(metricsValues.keys.filter { $0.hasPrefix(windowID) })
        for key in keys {
            collectionValues.removeValue(forKey: key)
            collectionInputs.removeValue(forKey: key)
            collectionInfo.removeValue(forKey: key)
            formValues.removeValue(forKey: key)
            selectionValues.removeValue(forKey: key)
            dialogSelectionFences.removeValue(forKey: key)
            inputValues.removeValue(forKey: key)
            controlValues.removeValue(forKey: key)
            metricsValues.removeValue(forKey: key)
        }
    }
}

enum SubmittedFormPatchDisposition: Sendable { case apply, unchanged, conflict }

// Missing dictionary entries and explicit JSON null are distinct submitted values.
func submittedFormPatchDisposition(_ form: [String: JSONValue], submitted: [String: JSONValue], patch: [String: JSONValue]) -> SubmittedFormPatchDisposition {
    var changed = false
    for (key, value) in patch {
        guard form[key] == submitted[key] else { return .conflict }
        if form[key] != value { changed = true }
    }
    return changed ? .apply : .unchanged
}

/// Release only values still owned by the completed submission. Each form
/// owner applies the same comparison, so a later editor's signal is preserved.
private func clearingSubmittedFields(_ current: [String: JSONValue], submitted: [String: JSONValue]) -> [String: JSONValue]? {
    var next = current
    var changed = false
    for (field, original) in submitted where current[field] == original {
        let cleared: JSONValue = original.arrayValue == nil ? .null : .array([])
        if original != cleared {
            next[field] = cleared
            changed = true
        }
    }
    return changed ? next : nil
}

extension Signal where Value == [String: JSONValue] {
    func clearSubmittedFormFields(_ submitted: [String: JSONValue], id: String, files: FormFileSelections, original: [String: FormFileSelection], presentation: UUID?) {
        files.withSnapshot(id, fields: Set(submitted.keys), presentation: presentation) { choices in
            let eligible = submitted.filter { choices[$0.key] == original[$0.key] }
            if let updated = clearingSubmittedFields(peek(), submitted: eligible) { set(updated) }
        }
    }
}
