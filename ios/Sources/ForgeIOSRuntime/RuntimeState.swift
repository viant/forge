import Foundation

public struct SelectionState: Sendable, Equatable {
    public let selected: [String: JSONValue]?
    public let selection: [[String: JSONValue]]
    public let rowIndex: Int

    public init(
        selected: [String: JSONValue]? = nil,
        selection: [[String: JSONValue]] = [],
        rowIndex: Int = -1
    ) {
        self.selected = selected
        self.selection = selection
        self.rowIndex = rowIndex
    }
}

public struct InputState: Sendable, Equatable {
    public let filter: [String: JSONValue]
    public let parameters: [String: JSONValue]
    public let page: Int?
    public let fetch: Bool
    public let refresh: Bool

    public init(
        filter: [String: JSONValue] = [:],
        parameters: [String: JSONValue] = [:],
        page: Int? = nil,
        fetch: Bool = false,
        refresh: Bool = false
    ) {
        self.filter = filter
        self.parameters = parameters
        self.page = page
        self.fetch = fetch
        self.refresh = refresh
    }
}

public struct ControlState: Sendable, Equatable {
    public let loading: Bool
    public let error: String?
    public let inactive: Bool

    public init(loading: Bool = false, error: String? = nil, inactive: Bool = false) {
        self.loading = loading
        self.error = error
        self.inactive = inactive
    }
}

public struct DialogState: Sendable, Equatable {
    public let open: Bool
    public let props: [String: JSONValue]
    public let args: [String: JSONValue]

    public init(
        open: Bool = false,
        props: [String: JSONValue] = [:],
        args: [String: JSONValue] = [:]
    ) {
        self.open = open
        self.props = props
        self.args = args
    }
}
