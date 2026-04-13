import Foundation

public actor DataSourceRuntime {
    private var collectionValues: [String: [[String: JSONValue]]] = [:]
    private var formValues: [String: [String: JSONValue]] = [:]
    private var selectionValues: [String: SelectionState] = [:]
    private var inputValues: [String: InputState] = [:]
    private var controlValues: [String: ControlState] = [:]
    private var metricsValues: [String: [String: JSONValue]] = [:]

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
    }

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

    public func control(dataSourceID: String) -> ControlState {
        controlValues[dataSourceID] ?? ControlState()
    }

    public func setControl(dataSourceID: String, control: ControlState) {
        controlValues[dataSourceID] = control
    }

    public func metrics(dataSourceID: String) -> [String: JSONValue] {
        metricsValues[dataSourceID] ?? [:]
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

    public func toggleSelection(dataSourceID: String, row: [String: JSONValue],
                                rowIndex: Int) {
        let current = selectionValues[dataSourceID] ?? SelectionState()
        if current.selected == row {
            selectionValues[dataSourceID] = SelectionState()
        } else {
            selectionValues[dataSourceID] = SelectionState(
                selected: row, rowIndex: rowIndex)
        }
    }

    // MARK: - REST collection fetch

    /// Fetch a collection from a REST endpoint and normalize the response.
    /// Mirrors Android DataSourceRuntime.fetchCollection() normalization logic.
    public func fetchCollection(
        dataSourceID: String,
        baseURL: String,
        path: String,
        additionalHeaders: [String: String] = [:],
        session: URLSession = .shared
    ) async {
        setControl(dataSourceID: dataSourceID, control: ControlState(loading: true))
        do {
            let input = inputValues[dataSourceID] ?? InputState()
            var components = URLComponents(string: baseURL + path)!
            let queryItems = input.filter.compactMap { k, v -> URLQueryItem? in
                guard case .string(let s) = v else { return nil }
                return URLQueryItem(name: k, value: s)
            }
            if !queryItems.isEmpty { components.queryItems = queryItems }

            var request = URLRequest(url: components.url!)
            for (k, v) in additionalHeaders { request.setValue(v, forHTTPHeaderField: k) }

            let (data, _) = try await session.data(for: request)
            let raw = try JSONDecoder().decode(JSONValue.self, from: data)
            let rows = normalizeCollection(raw)
            setCollection(dataSourceID: dataSourceID, rows: rows)
            setControl(dataSourceID: dataSourceID, control: ControlState())
        } catch {
            setControl(dataSourceID: dataSourceID,
                       control: ControlState(error: error.localizedDescription))
        }
    }

    /// Mirrors Android normalizeCollection() fallback chain:
    /// data → entries → Rows → rows → bare array/object
    private func normalizeCollection(_ value: JSONValue) -> [[String: JSONValue]] {
        let candidates: [JSONValue?] = [
            value.objectValue?["data"],
            value.objectValue?["entries"],
            value.objectValue?["Rows"],
            value.objectValue?["rows"],
            value
        ]
        for candidate in candidates.compactMap({ $0 }) {
            switch candidate {
            case .array(let items): return items.compactMap { $0.objectValue }
            case .object(let dict): return [dict]
            default: continue
            }
        }
        return []
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
