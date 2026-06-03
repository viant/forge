import Foundation

public actor Signal<Value: Sendable> {
    private var value: Value
    private var continuations: [UUID: AsyncStream<Value>.Continuation] = [:]

    public init(_ value: Value) {
        self.value = value
    }

    public func set(_ next: Value) {
        value = next
        for continuation in continuations.values {
            continuation.yield(next)
        }
    }

    public func peek() -> Value {
        value
    }

    public func stream(includeCurrent: Bool = true) -> AsyncStream<Value> {
        AsyncStream { continuation in
            let id = UUID()
            continuations[id] = continuation
            if includeCurrent {
                continuation.yield(value)
            }
            continuation.onTermination = { _ in
                Task {
                    await self.removeContinuation(id)
                }
            }
        }
    }

    private func removeContinuation(_ id: UUID) {
        continuations.removeValue(forKey: id)
    }
}
