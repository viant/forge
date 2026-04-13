import SwiftUI
import ForgeIOSRuntime

public struct SchemaBasedFormRenderer: View {
    private let container: ContainerDef
    /// Called with the current payload whenever any field value changes.
    /// Use this to track live form state without requiring a submit action.
    public var onChange: (([String: JSONValue]) -> Void)?
    /// When provided, a Submit button is shown and calls back with the payload.
    public var onSubmit: (([String: JSONValue]) -> Void)?
    /// Seed values applied once on first render. Keys match field.key.
    public var seedValues: [String: JSONValue]?

    @State private var formValues: [String: String] = [:]
    @State private var multiSelectValues: [String: Set<String>] = [:]

    public init(container: ContainerDef,
                seedValues: [String: JSONValue]? = nil,
                onChange: (([String: JSONValue]) -> Void)? = nil,
                onSubmit: (([String: JSONValue]) -> Void)? = nil) {
        self.container = container
        self.seedValues = seedValues
        self.onChange = onChange
        self.onSubmit = onSubmit
    }

    public var body: some View {
        let fields = resolvedFields
        VStack(alignment: .leading, spacing: 12) {
            if let title = container.title, !title.isEmpty {
                Text(title).font(.headline)
            }
            if let subtitle = container.subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if fields.isEmpty {
                Text("No form fields.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 12).strokeBorder(.quaternary))
            } else {
                ForEach(fields) { field in
                    fieldView(field)
                }
            }
            if container.schemaBasedForm?.showSubmit != false,
               !fields.isEmpty,
               let onSubmit {
                Button("Submit") { onSubmit(buildPayload(fields: fields)) }
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .task(id: fields.map(\.id).joined(separator: "|")) {
            applySeeds(fields)
        }
        // Propagate changes whenever formValues or multiSelectValues changes.
        .onChange(of: formValues) { _, _ in notifyChange() }
        .onChange(of: multiSelectValues) { _, _ in notifyChange() }
    }

    // MARK: - Field resolution

    private var resolvedFields: [ResolvedSchemaField] {
        guard let form = container.schemaBasedForm else { return [] }
        return SchemaFormRuntime.resolvedFields(for: form)
    }

    // MARK: - Field rendering

    @ViewBuilder
    private func fieldView(_ field: ResolvedSchemaField) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(field.label).font(.body.weight(.medium))
                if field.required { Text("*").foregroundStyle(.red) }
            }
            switch field.type {
            case .text:
                TextField(field.placeholder ?? field.key, text: binding(for: field.key))
                    .textFieldStyle(.roundedBorder)
            case .textarea:
                TextEditor(text: binding(for: field.key))
                    .frame(minHeight: 120)
                    .padding(8)
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(.quaternary))
            case .radio:
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(field.options, id: \.self) { option in
                        Button {
                            formValues[field.key] = option
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: formValues[field.key] == option
                                      ? "largecircle.fill.circle" : "circle")
                                Text(option)
                                Spacer()
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            case .picker:
                Picker(field.label, selection: binding(for: field.key)) {
                    Text("Select").tag("")
                    ForEach(field.options, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.menu)
            case .multiSelect:
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(field.options, id: \.self) { option in
                            let selected = multiSelectValues[field.key, default: []].contains(option)
                            Button { toggleMultiSelect(option, for: field.key) } label: {
                                Text(option)
                                    .font(.caption.weight(.medium))
                                    .padding(.horizontal, 10).padding(.vertical, 6)
                                    .background(Capsule().fill(
                                        selected ? Color.accentColor.opacity(0.16)
                                                 : Color.secondary.opacity(0.08)))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            case .json:
                TextEditor(text: binding(for: field.key))
                    .font(.body.monospaced())
                    .frame(minHeight: 140)
                    .padding(8)
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(.quaternary))
            }
        }
    }

    // MARK: - Bindings and helpers

    private func binding(for key: String) -> Binding<String> {
        Binding(get: { formValues[key] ?? "" }, set: { formValues[key] = $0 })
    }

    private func applySeeds(_ fields: [ResolvedSchemaField]) {
        // External seed values take priority over schema defaults
        for field in fields {
            if formValues[field.key] != nil { continue }
            if let seed = seedValues?[field.key] {
                applyValue(seed, for: field)
                continue
            }
            // Schema default fallback
            switch field.type {
            case .multiSelect:
                let defaults = field.defaultValue?.arrayValue?.compactMap(\.stringValue) ?? []
                if !defaults.isEmpty {
                    multiSelectValues[field.key] = Set(defaults)
                    formValues[field.key] = defaults.joined(separator: ", ")
                }
            default:
                let display = SchemaFormRuntime.displayValue(for: field.defaultValue)
                if !display.isEmpty { formValues[field.key] = display }
            }
        }
    }

    private func applyValue(_ value: JSONValue, for field: ResolvedSchemaField) {
        switch field.type {
        case .multiSelect:
            let items: [String]
            switch value {
            case .array(let arr): items = arr.compactMap(\.stringValue)
            case .string(let s): items = [s]
            default: items = []
            }
            multiSelectValues[field.key] = Set(items)
            formValues[field.key] = items.joined(separator: ", ")
        default:
            formValues[field.key] = value.stringValue ?? SchemaFormRuntime.displayValue(for: value)
        }
    }

    private func buildPayload(fields: [ResolvedSchemaField]) -> [String: JSONValue] {
        var result: [String: JSONValue] = [:]
        for field in fields {
            switch field.type {
            case .multiSelect:
                let selected = multiSelectValues[field.key, default: []]
                result[field.key] = .array(selected.sorted().map { .string($0) })
            default:
                if let v = formValues[field.key], !v.isEmpty {
                    result[field.key] = .string(v)
                }
            }
        }
        return result
    }

    private func notifyChange() {
        guard let onChange else { return }
        onChange(buildPayload(fields: resolvedFields))
    }

    private func toggleMultiSelect(_ option: String, for key: String) {
        var current = multiSelectValues[key, default: []]
        if current.contains(option) { current.remove(option) } else { current.insert(option) }
        multiSelectValues[key] = current
        formValues[key] = current.sorted().joined(separator: ", ")
    }
}
