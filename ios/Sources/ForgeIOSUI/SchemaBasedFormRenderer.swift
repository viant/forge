import SwiftUI
import ForgeIOSRuntime

public struct SchemaBasedFormRenderer: View {
    private let container: ContainerDef
    @State private var formValues: [String: String] = [:]
    @State private var multiSelectValues: [String: Set<String>] = [:]

    public init(container: ContainerDef) {
        self.container = container
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
                Text("Schema form has no resolvable fields.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(.quaternary)
                    )
            } else {
                ForEach(fields) { field in
                    fieldView(field)
                }
            }
            if container.schemaBasedForm?.showSubmit != false, !fields.isEmpty {
                Button("Submit") {}
                    .buttonStyle(.borderedProminent)
                    .disabled(true)
                Text("Forge form submission/data-source wiring is still pending in runtime.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .task(id: fields.map(\.id).joined(separator: "|")) {
            seedDefaults(fields)
        }
    }

    private var resolvedFields: [ResolvedSchemaField] {
        guard let form = container.schemaBasedForm else { return [] }
        return SchemaFormRuntime.resolvedFields(for: form)
    }

    @ViewBuilder
    private func fieldView(_ field: ResolvedSchemaField) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(field.label)
                    .font(.body.weight(.medium))
                if field.required {
                    Text("*")
                        .foregroundStyle(.red)
                }
            }
            switch field.type {
            case .text:
                TextField(
                    field.placeholder ?? field.key,
                    text: binding(for: field.key)
                )
                .textFieldStyle(.roundedBorder)
            case .textarea:
                TextEditor(text: binding(for: field.key))
                    .frame(minHeight: 120)
                    .padding(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(.quaternary)
                    )
            case .radio:
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(field.options, id: \.self) { option in
                        Button {
                            formValues[field.key] = option
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: formValues[field.key] == option ? "largecircle.fill.circle" : "circle")
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
                    ForEach(field.options, id: \.self) { option in
                        Text(option).tag(option)
                    }
                }
                .pickerStyle(.menu)
            case .multiSelect:
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(field.options, id: \.self) { option in
                            let selected = multiSelectValues[field.key, default: []].contains(option)
                            Button {
                                toggleSelection(option, for: field.key)
                            } label: {
                                Text(option)
                                    .font(.caption.weight(.medium))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(
                                        Capsule()
                                            .fill(selected ? Color.accentColor.opacity(0.16) : Color.secondary.opacity(0.08))
                                    )
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
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(.quaternary)
                    )
            }
        }
    }

    private func binding(for key: String) -> Binding<String> {
        Binding(
            get: { formValues[key] ?? "" },
            set: { formValues[key] = $0 }
        )
    }

    private func seedDefaults(_ fields: [ResolvedSchemaField]) {
        for field in fields {
            guard formValues[field.key] == nil else { continue }
            switch field.type {
            case .multiSelect:
                let defaults = field.defaultValue?.arrayValue?.compactMap(\.stringValue) ?? []
                if !defaults.isEmpty {
                    multiSelectValues[field.key] = Set(defaults)
                    formValues[field.key] = defaults.joined(separator: ", ")
                }
            default:
                let display = SchemaFormRuntime.displayValue(for: field.defaultValue)
                if !display.isEmpty {
                    formValues[field.key] = display
                }
            }
        }
    }

    private func toggleSelection(_ option: String, for key: String) {
        var current = multiSelectValues[key, default: []]
        if current.contains(option) {
            current.remove(option)
        } else {
            current.insert(option)
        }
        multiSelectValues[key] = current
        formValues[key] = current.sorted().joined(separator: ", ")
    }
}
