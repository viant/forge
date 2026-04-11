import Foundation

public actor SignalRegistry {
    private var metadataSignals: [String: Signal<WindowMetadata?>] = [:]
    private var collectionSignals: [String: Signal<[[String: JSONValue]]>] = [:]
    private var formSignals: [String: Signal<[String: JSONValue]>] = [:]
    private var selectionSignals: [String: Signal<SelectionState>] = [:]
    private var inputSignals: [String: Signal<InputState>] = [:]
    private var controlSignals: [String: Signal<ControlState>] = [:]
    private var metricsSignals: [String: Signal<[String: JSONValue]>] = [:]
    private var dialogSignals: [String: Signal<DialogState>] = [:]
    private var dashboardFilterSignals: [String: Signal<[String: JSONValue]>] = [:]
    private var dashboardSelectionSignals: [String: Signal<DashboardSelectionState>] = [:]

    public init() {}

    public func metadata(windowID: String) -> Signal<WindowMetadata?> {
        if let existing = metadataSignals[windowID] {
            return existing
        }
        let signal = Signal<WindowMetadata?>(nil)
        metadataSignals[windowID] = signal
        return signal
    }

    public func collection(dataSourceID: String) -> Signal<[[String: JSONValue]]> {
        if let existing = collectionSignals[dataSourceID] {
            return existing
        }
        let signal = Signal<[[String: JSONValue]]>([])
        collectionSignals[dataSourceID] = signal
        return signal
    }

    public func form(dataSourceID: String) -> Signal<[String: JSONValue]> {
        if let existing = formSignals[dataSourceID] {
            return existing
        }
        let signal = Signal<[String: JSONValue]>([:])
        formSignals[dataSourceID] = signal
        return signal
    }

    public func selection(dataSourceID: String, initial: SelectionState = SelectionState()) -> Signal<SelectionState> {
        if let existing = selectionSignals[dataSourceID] {
            return existing
        }
        let signal = Signal(initial)
        selectionSignals[dataSourceID] = signal
        return signal
    }

    public func input(dataSourceID: String) -> Signal<InputState> {
        if let existing = inputSignals[dataSourceID] {
            return existing
        }
        let signal = Signal(InputState())
        inputSignals[dataSourceID] = signal
        return signal
    }

    public func control(dataSourceID: String) -> Signal<ControlState> {
        if let existing = controlSignals[dataSourceID] {
            return existing
        }
        let signal = Signal(ControlState())
        controlSignals[dataSourceID] = signal
        return signal
    }

    public func metrics(dataSourceID: String) -> Signal<[String: JSONValue]> {
        if let existing = metricsSignals[dataSourceID] {
            return existing
        }
        let signal = Signal<[String: JSONValue]>([:])
        metricsSignals[dataSourceID] = signal
        return signal
    }

    public func dialog(dialogID: String) -> Signal<DialogState> {
        if let existing = dialogSignals[dialogID] {
            return existing
        }
        let signal = Signal(DialogState())
        dialogSignals[dialogID] = signal
        return signal
    }

    public func dashboardFilters(key: String) -> Signal<[String: JSONValue]> {
        if let existing = dashboardFilterSignals[key] {
            return existing
        }
        let signal = Signal<[String: JSONValue]>([:])
        dashboardFilterSignals[key] = signal
        return signal
    }

    public func dashboardSelection(key: String) -> Signal<DashboardSelectionState> {
        if let existing = dashboardSelectionSignals[key] {
            return existing
        }
        let signal = Signal(DashboardSelectionState())
        dashboardSelectionSignals[key] = signal
        return signal
    }

    public func removeWindow(windowID: String) {
        metadataSignals.removeValue(forKey: windowID)
        collectionSignals.keys.filter { $0.hasPrefix(windowID) }.forEach { collectionSignals.removeValue(forKey: $0) }
        formSignals.keys.filter { $0.hasPrefix(windowID) }.forEach { formSignals.removeValue(forKey: $0) }
        selectionSignals.keys.filter { $0.hasPrefix(windowID) }.forEach { selectionSignals.removeValue(forKey: $0) }
        inputSignals.keys.filter { $0.hasPrefix(windowID) }.forEach { inputSignals.removeValue(forKey: $0) }
        controlSignals.keys.filter { $0.hasPrefix(windowID) }.forEach { controlSignals.removeValue(forKey: $0) }
        metricsSignals.keys.filter { $0.hasPrefix(windowID) }.forEach { metricsSignals.removeValue(forKey: $0) }
        dialogSignals.keys.filter { $0.hasPrefix(windowID) }.forEach { dialogSignals.removeValue(forKey: $0) }
        dashboardFilterSignals.keys.filter { $0.hasPrefix("\(windowID):") }.forEach { dashboardFilterSignals.removeValue(forKey: $0) }
        dashboardSelectionSignals.keys.filter { $0.hasPrefix("\(windowID):") }.forEach { dashboardSelectionSignals.removeValue(forKey: $0) }
    }
}
