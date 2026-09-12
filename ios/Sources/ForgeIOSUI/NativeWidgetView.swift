import SwiftUI
import UniformTypeIdentifiers
import AVKit
import ForgeIOSRuntime

/// Native presentation of the web widget value contract. The host still owns
/// signals, callbacks and authenticated data access.
struct NativeWidgetView: View {
    let item: ItemDef
    let value: JSONValue?
    var onChange: (JSONValue) -> Void
    var onAction: (() -> Void)? = nil
    var windowForm: [String: JSONValue] = [:]
    var onDraftChange: (([String: JSONValue]) -> Void)? = nil
    var onCustomApply: (([String: JSONValue]) -> Void)? = nil
    var presetSyncKey: String = ""
    var onPresetSync: ((JSONValue) -> Void)? = nil
    var loadedOptions: [(JSONValue, String)]? = nil
    @Environment(\.forgeThemeAppearance) private var themeAppearance
    @State private var draft: String? = nil
    @State private var error = ""
    @State private var importing = false
    private var kind: String { NativeWidgetContract.kind(item) }
    private var label: String { item.label ?? item.title ?? item.id ?? "Field" }
    private var unavailable: Bool { NativeWidgetContract.disabled(item) }
    private var required: Bool { item.required == true || item.properties["required"] == .bool(true) }
    private var text: String { NativeWidgetContract.editorText(value, kind: kind) }
    private var editText: String {
        if let draft { return draft }
        if kind == "percentfraction2input", let number = value?.widgetNumber { return String(format: "%.2f", number * 100) }
        return text
    }
    private var textBinding: Binding<String> { Binding(get: { editText }, set: { raw in
        draft = raw
        if let next = NativeWidgetContract.input(raw, kind: kind, properties: item.properties) { error = ""; onChange(next) }
        else { error = kind == "object" ? "Enter valid JSON" : "Enter a valid value" }
    }) }
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if !["checkbox","toggle","switch","booleanpill","button","link"].contains(kind) { Text(label + (required ? " *" : "")).font(.caption.weight(.semibold)) }
            control
            if !error.isEmpty { Text(error).font(.caption).foregroundStyle(themeAppearance?.validationBorder ?? .red).accessibilityLabel(error) }
        }
        .disabled(NativeWidgetContract.presentationDisabled(item))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("forge-widget-\(kind)-\(item.id ?? "field")")
        .onChange(of: value) { draft = nil; error = "" }
        .task(id: text + presetSyncKey) { if kind == "daterangepreset", let value { onPresetSync?(value) } }
        .fileImporter(isPresented: $importing, allowedContentTypes: allowedTypes) { result in
            do {
                let url = try result.get()
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                let bytes = try Data(contentsOf: url)
                let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                onChange(.object(["name": .string(url.lastPathComponent), "filename": .string(url.lastPathComponent), "size": .number(Double(bytes.count)), "type": .string(mime), "mimeType": .string(mime), "data": .string(bytes.base64EncodedString())]))
                error = ""
            } catch { self.error = "Could not read the selected file" }
        }
    }
    @ViewBuilder private var control: some View {
        switch kind {
        case "password": SecureField(label, text: textBinding).modifier(ForgeThemeInputModifier(invalid: !error.isEmpty, required: required)).accessibilityLabel(label)
        case "text", "number", "currency", "percentfraction2input", "math": TextField(label, text: textBinding).modifier(ForgeThemeInputModifier(invalid: !error.isEmpty, required: required)).accessibilityLabel(label)
        case "textarea", "document", "object":
            TextEditor(text: textBinding).frame(minHeight: 100).modifier(ForgeThemeInputModifier(invalid: !error.isEmpty, multiline: true, required: required)).accessibilityLabel(label)
            if kind == "document" { MarkdownRenderer(markdown: editText) }
        case "schema": ScrollView { Text(text).font(.caption.monospaced()).textSelection(.enabled) }.frame(maxHeight: 300)
        case "checkbox", "toggle", "switch", "booleanpill":
            Toggle(label, isOn: Binding(get: { NativeWidgetContract.truthy(value) }, set: { onChange(.bool($0)) }))
        case "select", "radio":
            let options = loadedOptions ?? NativeWidgetContract.options(item)
            Picker(label, selection: Binding(get: { options.firstIndex { $0.0 == value } ?? -1 }, set: { if options.indices.contains($0) { onChange(options[$0].0) } })) {
                Text(value == nil || value == .null ? "Select" : NativeWidgetContract.text(value)).tag(-1)
                ForEach(options.indices, id: \.self) { index in Text(options[index].1).tag(index) }
            }.accessibilityLabel(label)
        case "treemultiselect":
            NativeTreeChoices(options: NativeWidgetContract.options(item), selected: value?.arrayValue ?? [], separator: item.properties["separator"]?.stringValue ?? "_", enabled: !unavailable, onChange: { onChange(.array($0)) })
        case "multiselect":
            let options = NativeWidgetContract.options(item)
            let selected = value?.arrayValue ?? []
            ForEach(options.indices, id: \.self) { index in
                Toggle(options[index].1, isOn: Binding(get: { selected.contains(options[index].0) }, set: { included in
                    onChange(.array(included ? selected + (selected.contains(options[index].0) ? [] : [options[index].0]) : selected.filter { $0 != options[index].0 }))
                }))
            }
        case "chiplist":
            let values = value?.arrayValue ?? []
            ForEach(values.indices, id: \.self) { index in
                let chip = values[index]
                let title = chip.objectValue?["label"] ?? chip.objectValue?["name"] ?? chip.objectValue?["value"] ?? chip
                HStack { Text((chip.objectValue?["excluded"] == .bool(true) || chip.objectValue?["mode"] == .string("exclude") ? "Exclude: " : "") + NativeWidgetContract.text(title)); if item.readOnly == false || item.properties["readOnly"] == .bool(false) { Button("Remove") { onChange(.array(values.enumerated().filter { $0.offset != index }.map(\.element))) }.accessibilityLabel("Remove \(NativeWidgetContract.text(title))") } }
            }
            if values.isEmpty { Text(item.properties["emptyText"]?.stringValue ?? "None") }
        case "keyvaluepairs":
            let object = value?.objectValue ?? [:]
            ForEach(object.keys.sorted(), id: \.self) { key in
                HStack {
                    TextField("Key", text: Binding(get: { key }, set: { next in var result = object; let old = result.removeValue(forKey: key); result[next] = old; onChange(.object(result)) }))
                    TextField("Value", text: Binding(get: { NativeWidgetContract.text(object[key]) }, set: { next in var result = object; result[key] = .string(next); onChange(.object(result)) }))
                    Button("Remove") { var result = object; result.removeValue(forKey: key); onChange(.object(result)) }.accessibilityLabel("Remove \(key)")
                }
            }
            Button("Add pair") { var result = object; result[""] = .string(""); onChange(.object(result)) }
        case "date", "datetime": dateControl(label: label, raw: text, time: kind == "datetime") { onChange(.string($0)) }
        case "daterange":
            let range = value?.objectValue ?? [:]
            dateControl(label: "Start", raw: range["start"]?.stringValue ?? "", time: false) { next in var result = range; result["start"] = .string(next); onChange(.object(result)) }
            dateControl(label: "End", raw: range["end"]?.stringValue ?? "", time: false) { next in var result = range; result["end"] = .string(next); onChange(.object(result)) }
            if let start = range["start"]?.stringValue, let end = range["end"]?.stringValue, start > end { Text("Start must not be after end").foregroundStyle(.red) }
        case "daterangepreset":
            let options = NativeWidgetContract.options(item)
            Picker(label, selection: Binding(get: { text }, set: { if $0 != "custom" { onChange(.string($0)) } })) {
                ForEach(options.indices, id: \.self) { index in Text(options[index].1).tag(NativeWidgetContract.text(options[index].0)) }
            }
            let startField = item.properties["startField"]?.stringValue ?? "customDateStart"
            let endField = item.properties["endField"]?.stringValue ?? "customDateEnd"
            let start = windowForm[startField]?.stringValue ?? ""
            let end = windowForm[endField]?.stringValue ?? ""
            dateControl(label: "Custom start", raw: start, time: false) { onDraftChange?([startField: .string($0)]) }
            dateControl(label: "Custom end", raw: end, time: false) { onDraftChange?([endField: .string($0)]) }
            Toggle("Include partial data", isOn: Binding(get: { windowForm[item.properties["includePartialDataField"]?.stringValue ?? "includePartialData"] != .bool(false) }, set: { onDraftChange?([item.properties["includePartialDataField"]?.stringValue ?? "includePartialData": .bool($0)]) }))
            Button("Apply custom dates") {
                let formatter = DateFormatter(); formatter.dateFormat = "yyyy-MM-dd"; formatter.timeZone = TimeZone(secondsFromGMT: 0)
                if let a = formatter.date(from: start), let b = formatter.date(from: end) {
                    let patch = [item.properties["granularityField"]?.stringValue ?? "granularity": JSONValue.string(b.timeIntervalSince(a) / 86400 + 1 <= 2 ? "hour" : "day")]
                    if let onCustomApply { onCustomApply(patch) } else { onDraftChange?(patch); onChange(.string("custom")) }
                }
            }.disabled(item.properties["customApplyEnabled"] != .bool(true) || start.isEmpty || end.isEmpty || start > end)
            if item.properties["customApplyEnabled"] != .bool(true) { Text("Custom dates are saved as a draft and do not refresh data yet.").font(.caption) }
        case "file":
            HStack { Text(value?.objectValue?["name"]?.stringValue ?? "No file selected"); Button("Browse") { importing = true }; if value != nil && value != .null { Button("Clear selected file") { onChange(.null) } } }
        case "progressbar": ProgressView(value: min(1, max(0, value?.widgetNumber ?? 0))).accessibilityLabel(label)
        case "link": if let url = safeURL(text) { Link(label, destination: url) } else { Text(label) }
        case "mediapreview":
            if let url = safeURL(value?.objectValue?["url"]?.stringValue ?? text), url.scheme?.lowercased() == "https" {
                let mediaKind = value?.objectValue?["kind"]?.stringValue?.lowercased() ?? ""
                if ["video", "audio"].contains(mediaKind) { VideoPlayer(player: AVPlayer(url: url)).frame(minHeight: 140) }
                else if mediaKind == "image" { AsyncImage(url: url) { phase in
                    if let image = phase.image { image.resizable().scaledToFit() }
                    else { Text(phase.error == nil ? "Loading preview…" : "Preview failed to load.") }
                }.frame(maxHeight: 200) }
                else { Text(value?.objectValue?["message"]?.stringValue ?? "Preview is not available for this media type.") }
                Link("Open \(label)", destination: url)
            } else { Text("No media") }
        case "markdown": MarkdownRenderer(markdown: text)
        case "button": Button(label) { onAction?() }.modifier(ForgeThemeButtonModifier())
        case "label": Text(text).textSelection(.enabled)
        default: Text("Unsupported widget: \(kind)").foregroundStyle(.secondary)
        }
    }
    private func safeURL(_ text: String) -> URL? {
        guard let url = URL(string: text), ["http","https","mailto","tel","file"].contains(url.scheme?.lowercased() ?? "") else { return nil }; return url
    }
    private var allowedTypes: [UTType] {
        let accept = item.properties["accept"]?.stringValue ?? ".csv"
        let types = accept.split(separator: ",").compactMap { raw -> UTType? in let type = raw.trimmingCharacters(in: .whitespaces); if type == "image/*" { return .image }; if type == "audio/*" { return .audio }; if type == "video/*" { return .movie }; if type == "text/*" { return .text }; return type.hasPrefix(".") ? UTType(filenameExtension: String(type.dropFirst())) : UTType(mimeType: type) }
        return types.isEmpty ? [.data] : types
    }
    private func dateControl(label: String, raw: String, time: Bool, change: @escaping (String) -> Void) -> some View {
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.timeZone = TimeZone(secondsFromGMT: 0); formatter.dateFormat = "yyyy-MM-dd"
        let date = ISO8601DateFormatter().date(from: raw) ?? formatter.date(from: raw) ?? Date()
        return DatePicker(label, selection: Binding(get: { date }, set: { change(time ? ISO8601DateFormatter().string(from: $0) : formatter.string(from: $0)) }), displayedComponents: time ? [.date, .hourAndMinute] : [.date]).environment(\.timeZone, TimeZone(secondsFromGMT: 0)!)
    }
}
