import Foundation

public actor DataSourceRuntime {
    private var collectionValues: [String: [[String: JSONValue]]] = [:]
    private var formValues: [String: [String: JSONValue]] = [:]
    private var selectionValues: [String: SelectionState] = [:]
    private var inputValues: [String: InputState] = [:]
    private var controlValues: [String: ControlState] = [:]
    private var metricsValues: [String: [String: JSONValue]] = [:]

    public init() {}

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
