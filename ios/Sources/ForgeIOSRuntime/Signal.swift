import Foundation

public actor Signal<Value: Sendable> {
    private var value: Value
    private var continuations: [UUID: AsyncStream<Value>.Continuation] = [:]

    public init(_ value: Value) {
        self.value = value
    }

    public func set(_ next: Value) {
        _ = exchange(next)
    }

    func exchange(_ next: Value) -> Value {
        let previous = value
        value = next
        publish()
        return previous
    }

    private func publish() {
        for continuation in continuations.values { continuation.yield(value) }
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

extension Signal where Value == [String: JSONValue] {
    func setFormFile(field: String, value file: JSONValue, id: String, revision: UUID, files: FormFileSelections) -> Bool {
        files.whileCurrent(id, field: field, revision: revision) {
            guard let updated = SelectorUtil.setting(file, in: .object(value), selector: field)?.objectValue else { return false }
            set(updated)
            return true
        }
    }

    func checkSubmittedFormPatch(submitted: [String: JSONValue], patch: [String: JSONValue]) -> SubmittedFormPatchDisposition {
        submittedFormPatchDisposition(value, submitted: submitted, patch: patch)
    }

    func applySubmittedFormPatch(submitted: [String: JSONValue], patch: [String: JSONValue], id: String, files: FormFileSelections, original: [String: FormFileSelection], guardedFields: Set<String>, presentation: UUID) -> SubmittedFormPatchDisposition {
        files.withSnapshot(id, fields: guardedFields, presentation: presentation) { choices in
            guard choices == original else { return .conflict }
            let decision = checkSubmittedFormPatch(submitted: submitted, patch: patch)
            if decision == .apply {
                value.merge(patch) { _, next in next }
                publish()
            }
            return decision
        }
    }
}

extension Signal where Value == DialogState {
    /// A completed command may dismiss only the presentation that accepted it.
    func dismiss(presentationID: UUID?) -> DialogState? {
        if let presentationID, value.presentationID != presentationID || !value.open { return nil }
        var closed = DialogState(open: false)
        closed.lastClosedPresentationID = value.presentationID ?? value.lastClosedPresentationID
        return exchange(closed)
    }
}

extension Signal where Value: Equatable {
    func replace(_ expected: Value, with replacement: Value) {
        if value == expected { set(replacement) }
    }
}
