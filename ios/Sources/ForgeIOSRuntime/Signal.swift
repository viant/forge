import Foundation

public actor Signal<Value: Sendable> {
    private var value: Value

    public init(_ value: Value) {
        self.value = value
    }

    public func set(_ next: Value) {
        value = next
    }

    public func peek() -> Value {
        value
    }
}
