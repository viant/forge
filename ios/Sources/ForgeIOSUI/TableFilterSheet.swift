import SwiftUI
import ForgeIOSRuntime

struct TableFilterDraft: Identifiable {
    let id = UUID()
    let fields: [[String: JSONValue]]
    let values: [String: JSONValue]
}

struct TableFilterSheet: View {
    let draft: TableFilterDraft
    let apply: ([String: JSONValue]) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var text: [String: String]
    @State private var error: String?

    init(draft: TableFilterDraft, apply: @escaping ([String: JSONValue]) -> Void) {
        self.draft = draft
        self.apply = apply
        _text = State(initialValue: draft.values.mapValues { value in
            if let string = value.stringValue { return string }
            return (try? String(decoding: JSONEncoder().encode(value), as: UTF8.self)) ?? ""
        })
    }

    var body: some View {
        NavigationStack {
            Form {
                ForEach(Array(draft.fields.enumerated()), id: \.offset) { _, field in
                    if let id = field["id"]?.stringValue {
                        Section(field["label"]?.stringValue ?? id) {
                            TextField("Value", text: Binding<String>(get: { text[id] ?? "" }, set: { text[id] = $0 }))
                                .autocorrectionDisabled()
                                .accessibilityLabel(field["label"]?.stringValue ?? id)
                            Text(field["operator"]?.stringValue ?? "equal").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                if let error { Text(error).foregroundStyle(.red) }
                Button("Clear filters") { text = [:]; error = nil }
            }
            .navigationTitle("Filter rows")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Apply") { submit() } }
            }
        }
    }

    private func submit() {
        var values: [String: JSONValue] = [:]
        do {
            for field in draft.fields {
                guard let id = field["id"]?.stringValue, let raw = text[id], !raw.isEmpty else { continue }
                let type = field["type"]?.stringValue ?? "string"
                let value: JSONValue
                if type.hasSuffix("[]") {
                    value = try JSONDecoder().decode(JSONValue.self, from: Data(raw.utf8))
                    guard value.arrayValue != nil else { throw ClientFilterError.invalidOperand }
                } else if ["int", "integer", "number", "float", "double"].contains(type) {
                    guard let number = Double(raw), number.isFinite else { throw ClientFilterError.invalidOperand }
                    value = .number(number)
                } else { value = .string(raw) }
                _ = try ClientFilterRuntime.matches(value, expected: value, operation: field["operator"]?.stringValue ?? "equal")
                values[id] = value
            }
            apply(values)
            dismiss()
        } catch { self.error = "Check filter values and operators. List values must be JSON arrays." }
    }
}
