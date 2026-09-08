import SwiftUI
import UniformTypeIdentifiers
import ForgeIOSRuntime

struct UploadCollectionRenderer: View {
    let runtime: ForgeRuntime
    let window: WindowContext
    let container: ContainerDef

    @State private var files: [UploadFileValue] = []
    @State private var form: [String: JSONValue] = [:]
    @State private var importerVisible = false
    @State private var loading = false
    @State private var error = ""

    private var spec: UploadCollectionSpec { container.uploadCollection! }
    private var dataSourceRef: String { container.dataSourceRef ?? spec.upload.dataSourceRef }
    private var validation: UploadValidationResult { WorkflowPrimitiveRuntime.validateUpload(files: files, spec: spec) }
    private var extras: [String: JSONValue] {
        var payload = (try? WorkflowPrimitiveRuntime.encodeUpload(files: files, spec: spec)) ?? [:]
        if let field = spec.metadataField { payload[field] = .object(form) }
        return payload
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(spec.emptyMessage ?? "Choose files…", systemImage: "paperclip") { importerVisible = true }
                .disabled(loading)
            ForEach(files) { file in
                HStack {
                    Image(systemName: "doc")
                    VStack(alignment: .leading) {
                        Text(file.name)
                        Text(ByteCountFormatter.string(fromByteCount: Int64(file.data.count), countStyle: .file)).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button(role: .destructive) { files.removeAll { $0.id == file.id } } label: { Image(systemName: "xmark.circle.fill") }
                        .accessibilityLabel("Remove \(file.name)")
                }
            }
            let messages = validation.errors + (error.isEmpty ? [] : [error])
            if !messages.isEmpty { Text(messages.joined(separator: " ")).font(.caption).foregroundStyle(.red) }
            MutationCommandButton(
                runtime: runtime,
                window: window,
                sourceDataSourceRef: dataSourceRef,
                command: spec.upload,
                labelOverride: loading ? "Preparing…" : (spec.upload.label ?? "Upload"),
                extras: extras,
                externallyDisabled: files.isEmpty || !validation.valid || loading || !error.isEmpty,
                onSettled: { result in if result.status == "succeeded" { files = [] } }
            )
        }
        .fileImporter(isPresented: $importerVisible, allowedContentTypes: allowedTypes, allowsMultipleSelection: spec.multiple != false) { result in
            Task { await load(result) }
        }
        .task { form = await runtime.formJSONValue(windowID: window.windowID, dataSourceRef: dataSourceRef) }
        .accessibilityIdentifier("forge-upload-collection")
    }

    private var allowedTypes: [UTType] {
        let types = (spec.accept ?? []).compactMap { rule -> UTType? in
            if rule.hasPrefix(".") { return UTType(filenameExtension: String(rule.dropFirst())) }
            if rule.hasSuffix("/*") { return nil }
            return UTType(mimeType: rule)
        }
        return types.isEmpty ? [.data] : types
    }

    @MainActor
    private func load(_ result: Result<[URL], Error>) async {
        loading = true; error = ""
        defer { loading = false }
        do {
            let urls = try result.get()
            var selected: [UploadFileValue] = []
            for url in urls {
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                let values = try url.resourceValues(forKeys: [.contentTypeKey, .nameKey])
                selected.append(UploadFileValue(name: values.name ?? url.lastPathComponent, mimeType: values.contentType?.preferredMIMEType ?? "application/octet-stream", data: try Data(contentsOf: url)))
            }
            files = spec.multiple == false ? Array(selected.prefix(1)) : selected
        } catch { self.error = error.localizedDescription }
    }
}
