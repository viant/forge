import SwiftUI
import ForgeIOSRuntime

public struct SchemaBasedFormRenderer: View {
    @Environment(\.forgePresentationDensity) private var presentationDensity
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
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
    @State private var dynamicFormState: [String: JSONValue] = [:]
    @State private var validationErrors: [String: String] = [:]
    @State private var dateRangeValues: [String: FeedDateRangeValue] = [:]

    public init(runtime: ForgeRuntime? = nil,
                window: WindowContext? = nil,
                container: ContainerDef,
                seedValues: [String: JSONValue]? = nil,
                onChange: (([String: JSONValue]) -> Void)? = nil,
                onSubmit: (([String: JSONValue]) -> Void)? = nil) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.seedValues = seedValues
        self.onChange = onChange
        self.onSubmit = onSubmit
    }

    public var body: some View {
        let fields = resolvedFields
        VStack(alignment: .leading, spacing: presentationDensity == .compact ? 8 : 12) {
            if fields.isEmpty {
                Text("No form fields.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 12).strokeBorder(.quaternary))
            } else {
                if presentationDensity == .compact {
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 150), spacing: 10, alignment: .top)],
                        alignment: .leading,
                        spacing: 10
                    ) {
                        ForEach(fields) { field in fieldView(field) }
                    }
                } else {
                    ForEach(fields) { field in fieldView(field) }
                }
            }
            if container.schemaBasedForm?.showSubmit != false,
               !fields.isEmpty,
               let onSubmit {
                Button("Submit") { submit(fields: fields, onSubmit: onSubmit) }
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(presentationDensity == .compact ? 8 : 16)
        .task(id: fields.map(\.id).joined(separator: "|")) {
            applySeeds(fields)
        }
        .task(id: schemaFormDataSourceRef ?? "") {
            await observeDynamicSchemaFormState()
        }
        .onChange(of: dynamicFormState) { _, _ in
            applyDatasourceValues(fields)
        }
        // Propagate changes whenever formValues or multiSelectValues changes.
        .onChange(of: formValues) { _, _ in notifyChange() }
        .onChange(of: multiSelectValues) { _, _ in notifyChange() }
    }

    // MARK: - Field resolution

    private var resolvedFields: [ResolvedSchemaField] {
        guard let form = container.schemaBasedForm else { return [] }
        return SchemaFormRuntime.resolvedFields(for: form, formState: dynamicFormState)
    }

    private var schemaFormDataSourceRef: String? {
        guard let form = container.schemaBasedForm else { return nil }
        return form.dataSourceRef ?? container.dataSourceRef
    }

    private func observeDynamicSchemaFormState() async {
        guard let runtime, let window, let ref = schemaFormDataSourceRef else {
            return
        }

        let current = await runtime.formJSONValue(windowID: window.windowID, dataSourceRef: ref)
        await MainActor.run {
            dynamicFormState = current
        }

        let stream = await runtime.dataSourceFormUpdates(windowID: window.windowID, dataSourceRef: ref)
        for await next in stream {
            await MainActor.run {
                dynamicFormState = next
            }
        }
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
            case .lookup:
                let display = lookupDisplay(for: field)
                HStack(spacing: 8) {
                    TextField(field.placeholder ?? field.key, text: binding(for: field.key))
                        .textFieldStyle(.plain)
                        .padding(.horizontal, 8)
                        .frame(height: 34)
                        .background(Color(red: 0.933, green: 0.973, blue: 0.945), in: RoundedRectangle(cornerRadius: 7))
                        .overlay(RoundedRectangle(cornerRadius: 7).stroke(Color(red: 0.75, green: 0.86, blue: 0.78), lineWidth: 1))
                    Button {
                        openLookup(field)
                    } label: {
                        Image(systemName: "magnifyingglass")
                            .accessibilityLabel("Open lookup")
                    }
                    .buttonStyle(.bordered)
                    .disabled(lookupDialogID(field.lookup) == nil)
                }
                if let display {
                    Text(display)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            case .boolean:
                Toggle(field.label, isOn: Binding(
                    get: { formValues[field.key]?.lowercased() == "true" },
                    set: { value in commitValue(.bool(value), for: field.key) }
                ))
                .labelsHidden()
                .accessibilityLabel(field.label)
            case .dateRange:
                if presentationDensity == .compact {
                    VStack(alignment: .leading, spacing: 6) {
                        compactDatePickerRow("Start", selection: dateBinding(for: field.key, start: true))
                        compactDatePickerRow("End", selection: dateBinding(for: field.key, start: false))
                    }
                } else {
                    HStack(spacing: 8) {
                        compactDatePicker("Start", selection: dateBinding(for: field.key, start: true))
                        Image(systemName: "arrow.right").font(.caption).foregroundStyle(.secondary)
                        compactDatePicker("End", selection: dateBinding(for: field.key, start: false))
                    }
                }
            }
            if let message = validationErrors[field.key] {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
    }

    // MARK: - Bindings and helpers

    private func binding(for key: String) -> Binding<String> {
        Binding(get: { formValues[key] ?? "" }, set: { commitValue(.string($0), for: key) })
    }

    private func applySeeds(_ fields: [ResolvedSchemaField]) {
        // External seed values take priority over schema defaults
        for field in fields {
            if formValues[field.key] != nil { continue }
            if let seed = seedValues?[field.key] {
                applyValue(seed, for: field)
                continue
            }
            if let current = dynamicFormState[field.key] {
                applyValue(current, for: field)
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
            case .dateRange:
                if let value = field.defaultValue { applyValue(value, for: field) }
            case .boolean:
                if let value = field.defaultValue { applyValue(value, for: field) }
            default:
                let display = SchemaFormRuntime.displayValue(for: field.defaultValue)
                if !display.isEmpty { formValues[field.key] = display }
            }
        }
    }

    private func applyDatasourceValues(_ fields: [ResolvedSchemaField]) {
        guard !dynamicFormState.isEmpty else { return }
        for field in fields {
            guard let value = dynamicFormState[field.key] else { continue }
            applyValue(value, for: field)
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
        case .dateRange:
            let object = value.objectValue ?? [:]
            let start = feedDate(object["start"]?.stringValue) ?? Date()
            let end = feedDate(object["end"]?.stringValue) ?? start
            dateRangeValues[field.key] = FeedDateRangeValue(start: start, end: max(start, end))
            formValues[field.key] = "\(feedDateString(start)) – \(feedDateString(max(start, end)))"
        case .boolean:
            formValues[field.key] = value.boolValue == true ? "true" : "false"
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
            case .dateRange:
                if let range = dateRangeValues[field.key] {
                    result[field.key] = .object(["start": .string(feedDateString(range.start)), "end": .string(feedDateString(range.end))])
                }
            case .boolean:
                result[field.key] = .bool(formValues[field.key]?.lowercased() == "true")
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

    private func submit(fields: [ResolvedSchemaField], onSubmit: ([String: JSONValue]) -> Void) {
        let payload = buildPayload(fields: fields)
        let errors = SchemaFormRuntime.validationErrors(fields: fields, payload: payload)
        validationErrors = errors
        guard errors.isEmpty else { return }
        onSubmit(payload)
    }

    private func openLookup(_ field: ResolvedSchemaField) {
        guard let runtime, let window, let dialogID = lookupDialogID(field.lookup) else {
            return
        }
        let dataSourceRef = schemaFormDataSourceRef ?? container.dataSourceRef ?? ""
        let parameters = lookupParameters(field.lookup)
        let execution = ExecutionDef(
            action: "window.openDialog",
            args: [dialogID],
            parameters: parameters
        )
        Task {
            _ = await runtime.execute(
                execution,
                context: ExecutionContext(windowID: window.windowID, dataSourceRef: dataSourceRef),
                args: [
                    "windowId": .string(window.windowID),
                    "selectionMode": .string(lookupMultiple(field.lookup) ? "multi" : "single"),
                    "multiple": .bool(lookupMultiple(field.lookup))
                ]
            )
        }
    }

    private func lookupDisplay(for field: ResolvedSchemaField) -> String? {
        let fallback = formValues[field.key] ?? ""
        guard let display = SchemaFormRuntime.lookupDisplayValue(
            for: field,
            formState: dynamicFormState,
            fallback: fallback
        ) else {
            return nil
        }
        if display == fallback {
            return nil
        }
        return display
    }

    private func toggleMultiSelect(_ option: String, for key: String) {
        var current = multiSelectValues[key, default: []]
        if current.contains(option) { current.remove(option) } else { current.insert(option) }
        multiSelectValues[key] = current
        formValues[key] = current.sorted().joined(separator: ", ")
        commitValue(.array(current.sorted().map(JSONValue.string)), for: key)
    }

    private func commitValue(_ value: JSONValue, for key: String) {
        switch value {
        case .string(let text): formValues[key] = text
        case .bool(let flag): formValues[key] = flag ? "true" : "false"
        default: break
        }
        notifyChange()
        guard let runtime, let window, let ref = schemaFormDataSourceRef, !ref.isEmpty else { return }
        Task {
            let operation = FeedPatchOperation(
                dataSourceRef: ref,
                op: "replace",
                path: "/collection/0/\(escapeSchemaFeedPointer(key))",
                value: value
            )
            do {
                if try await runtime.dispatchFeedPatch(windowID: window.windowID, operation: operation) { return }
                _ = try await runtime.applyFeedPatchOperations(windowID: window.windowID, operations: [operation])
            } catch { return }
        }
    }

    private func dateBinding(for key: String, start: Bool) -> Binding<Date> {
        Binding(
            get: {
                let range = dateRangeValues[key] ?? FeedDateRangeValue(start: Date(), end: Date())
                return start ? range.start : range.end
            },
            set: { value in
                var range = dateRangeValues[key] ?? FeedDateRangeValue(start: value, end: value)
                if start { range.start = value; range.end = max(value, range.end) }
                else { range.end = max(range.start, value) }
                dateRangeValues[key] = range
                formValues[key] = "\(feedDateString(range.start)) – \(feedDateString(range.end))"
                commitValue(.object(["start": .string(feedDateString(range.start)), "end": .string(feedDateString(range.end))]), for: key)
            }
        )
    }

    private func compactDatePicker(_ label: String, selection: Binding<Date>) -> some View {
        DatePicker(label, selection: selection, displayedComponents: .date)
            .labelsHidden()
            .datePickerStyle(.compact)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityLabel(label)
    }

    private func compactDatePickerRow(_ label: String, selection: Binding<Date>) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
            compactDatePicker(label, selection: selection)
                .fixedSize(horizontal: true, vertical: false)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct FeedDateRangeValue: Equatable {
    var start: Date
    var end: Date
}

private func feedDate(_ value: String?) -> Date? {
    guard let value else { return nil }
    return ISO8601DateFormatter().date(from: value + (value.count == 10 ? "T00:00:00Z" : ""))
}

private func feedDateString(_ value: Date) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: value)
}

private func escapeSchemaFeedPointer(_ value: String) -> String {
    value.replacingOccurrences(of: "~", with: "~0").replacingOccurrences(of: "/", with: "~1")
}

private func lookupDialogID(_ lookup: JSONValue?) -> String? {
    let dialogID = lookup?.objectValue?["dialogId"]?.stringValue?
        .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return dialogID.isEmpty ? nil : dialogID
}

private func lookupMultiple(_ lookup: JSONValue?) -> Bool {
    lookup?.objectValue?["multiple"]?.boolValue ?? false
}

private func lookupParameters(_ lookup: JSONValue?) -> [ParameterDef] {
    guard let object = lookup?.objectValue else { return [] }
    let inputs = object["inputs"]?.arrayValue ?? []
    let outputs = object["outputs"]?.arrayValue ?? []
    var parameters: [ParameterDef] = inputs.compactMap { value in
        guard let entry = value.objectValue else { return nil }
        let name = lookupString(entry["name"]) ?? lookupString(entry["location"]) ?? ""
        guard !name.isEmpty else { return nil }
        return ParameterDef(
            name: name,
            input: "form",
            location: .string(lookupString(entry["location"]) ?? name)
        )
    }
    parameters += outputs.compactMap { value in
        guard let entry = value.objectValue else { return nil }
        let name = lookupString(entry["name"]) ?? lookupString(entry["location"]) ?? ""
        guard !name.isEmpty else { return nil }
        return ParameterDef(
            name: name,
            direction: "out",
            location: .string(lookupString(entry["location"]) ?? name)
        )
    }
    return parameters
}

private func lookupString(_ value: JSONValue?) -> String? {
    value?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines)
}
