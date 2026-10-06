import Foundation

public actor DataSourceRuntime {
    private var collectionValues: [String: [[String: JSONValue]]] = [:]
    private var formValues: [String: [String: JSONValue]] = [:]
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

    public func setCollection(dataSourceID: String, rows: [[String: JSONValue]]) {
        collectionValues[dataSourceID] = rows
    }

    public func form(dataSourceID: String) -> [String: JSONValue] {
        formValues[dataSourceID] ?? [:]
    }

    public func setForm(dataSourceID: String, values: [String: JSONValue]) {
        formValues[dataSourceID] = values
        for observer in formObservers[dataSourceID]?.values ?? [:].values { observer.yield(values) }
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
    }

    public func input(dataSourceID: String) -> InputState {
        inputValues[dataSourceID] ?? InputState()
    }

    public func setInput(dataSourceID: String, input: InputState) {
        inputValues[dataSourceID] = input
    }

    public func setInputParameters(dataSourceID: String, parameters: [String: JSONValue], fetch: Bool = false) {
        let current = inputValues[dataSourceID] ?? InputState()
        let query = parameters["input"]?.objectValue?["query"]?.objectValue ?? [:]
        let mergedFilter = current.filter.merging(query) { _, new in new }
        inputValues[dataSourceID] = InputState(
            filter: mergedFilter,
            parameters: parameters,
            page: current.page,
            fetch: fetch || current.fetch,
            refresh: current.refresh
        )
    }

    public func control(dataSourceID: String) -> ControlState {
        controlValues[dataSourceID] ?? ControlState()
    }

    public func setControl(dataSourceID: String, control: ControlState) {
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
        formValues.removeValue(forKey: dataSourceID)
        metricsValues.removeValue(forKey: dataSourceID)
        selectionValues.removeValue(forKey: dataSourceID)
        controlValues[dataSourceID] = ControlState(inactive: true)
        return true
    }

    public func registeredSnapshot(dataSourceID: String) -> RegisteredDataSourceSnapshot? {
        guard inputValues[dataSourceID] != nil || collectionValues[dataSourceID] != nil || formValues[dataSourceID] != nil || controlValues[dataSourceID] != nil else { return nil }
        return RegisteredDataSourceSnapshot(input: inputValues[dataSourceID] ?? InputState(), control: controlValues[dataSourceID] ?? ControlState(), form: formValues[dataSourceID] ?? [:], selection: selectionValues[dataSourceID] ?? SelectionState(), collection: collectionValues[dataSourceID], metrics: metricsValues[dataSourceID] ?? [:])
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
        setControl(dataSourceID: dataSourceID, control: ControlState(loading: true))
        do {
            let input = inputValues[dataSourceID] ?? InputState()
            let resolvedMethod = method.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            let requestMethod = resolvedMethod.isEmpty ? "GET" : resolvedMethod
            var components = URLComponents(string: baseURL + path)!
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

            var request = URLRequest(url: components.url!)
            request.httpMethod = requestMethod
            for (k, v) in additionalHeaders { request.setValue(v, forHTTPHeaderField: k) }
            if requestMethod != "GET" {
                let payload: JSONValue
                if isDatasourceFetchRoute(path) {
                    payload = .object(["inputs": .object(fetchInputs)])
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
            let raw = try JSONDecoder().decode(JSONValue.self, from: data)
            let rows = normalizeCollection(raw, selector: selectors?.data)
            setCollection(dataSourceID: dataSourceID, rows: rows)
            let selectedMetrics = normalizeDataInfo(raw, selector: selectors?.metrics)
            let dataInfo = normalizeDataInfo(raw, selector: selectors?.dataInfo)
            if !selectedMetrics.isEmpty {
                setMetrics(dataSourceID: dataSourceID, values: selectedMetrics)
            } else if dataInfo.isEmpty {
                setMetrics(dataSourceID: dataSourceID, values: extractPagingMetrics(raw, paging: paging))
            } else {
                setMetrics(dataSourceID: dataSourceID, values: dataInfo)
            }
            setControl(dataSourceID: dataSourceID, control: ControlState())
        } catch {
            if Task.isCancelled || (error as? URLError)?.code == .cancelled || error is CancellationError {
                setControl(dataSourceID: dataSourceID, control: ControlState())
                return
            }
            setControl(dataSourceID: dataSourceID,
                       control: ControlState(error: error.localizedDescription))
        }
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
        let keys = Set(collectionValues.keys.filter { $0.hasPrefix(windowID) })
            .union(formValues.keys.filter { $0.hasPrefix(windowID) })
            .union(selectionValues.keys.filter { $0.hasPrefix(windowID) })
            .union(inputValues.keys.filter { $0.hasPrefix(windowID) })
            .union(controlValues.keys.filter { $0.hasPrefix(windowID) })
            .union(metricsValues.keys.filter { $0.hasPrefix(windowID) })
        for key in keys {
            collectionValues.removeValue(forKey: key)
            formValues.removeValue(forKey: key)
            selectionValues.removeValue(forKey: key)
            inputValues.removeValue(forKey: key)
            controlValues.removeValue(forKey: key)
            metricsValues.removeValue(forKey: key)
        }
    }
}
