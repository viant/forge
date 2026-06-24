import SwiftUI
import ForgeIOSRuntime

public struct FileBrowserRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let fileBrowser: FileBrowserDef

    @State private var rows: [[String: JSONValue]] = []
    @State private var selection: SelectionState = SelectionState()
    @State private var currentURI: String = ""
    @State private var errorMessage: String?

    public init(
        runtime: ForgeRuntime? = nil,
        window: WindowContext? = nil,
        container: ContainerDef,
        fileBrowser: FileBrowserDef
    ) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.fileBrowser = fileBrowser
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(resolvedTitle)
                .font(.subheadline.weight(.semibold))

            if !normalizedCurrentURI.isEmpty && normalizedCurrentURI != "/" {
                breadcrumb
            }

            if let errorMessage, !errorMessage.isEmpty {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if rows.isEmpty {
                Text("No files")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 8)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(rowModels.enumerated()), id: \.element.id) { index, model in
                        fileRow(model, rowIndex: index)
                    }
                }
            }
        }
        .padding(12)
        .background(Color.forgeSystemBackground, in: RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
        .task(id: loadTaskKey) {
            await loadState()
        }
        .task(id: rowsTaskKey) {
            await observeRows()
        }
        .task(id: selectionTaskKey) {
            await observeSelection()
        }
        .task(id: inputTaskKey) {
            await observeInput()
        }
        .task(id: controlTaskKey) {
            await observeControl()
        }
    }

    private var resolvedTitle: String {
        fileBrowser.title?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank
            ?? container.title?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank
            ?? "Browse files"
    }

    private var resolvedDataSourceRef: String {
        fileBrowser.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank
            ?? container.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank
            ?? ""
    }

    private var normalizedCurrentURI: String {
        currentURI.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var selectedURI: String? {
        fileBrowserRowLocation(selection.selected)
    }

    private var rowModels: [FileBrowserRowModel] {
        rows.enumerated().map { index, row in
            FileBrowserRowModel(row: row, fallbackIndex: index)
        }
    }

    private var loadTaskKey: String {
        [window?.windowID ?? "", container.id ?? "", resolvedDataSourceRef, "load"].joined(separator: ":")
    }

    private var rowsTaskKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, "rows"].joined(separator: ":")
    }

    private var selectionTaskKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, "selection"].joined(separator: ":")
    }

    private var inputTaskKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, "input"].joined(separator: ":")
    }

    private var controlTaskKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, "control"].joined(separator: ":")
    }

    private var breadcrumb: some View {
        Button {
            Task {
                await navigate(to: parentURI(for: normalizedCurrentURI))
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "arrow.up.left")
                    .font(.caption.weight(.semibold))
                    .frame(width: 16)
                Text(normalizedCurrentURI)
                    .font(.footnote)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer(minLength: 0)
            }
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Up from \(normalizedCurrentURI)")
    }

    private func fileRow(_ model: FileBrowserRowModel, rowIndex: Int) -> some View {
        let disabled = fileBrowser.folderOnly == true && !model.isFolder
        return Button {
            guard !disabled else { return }
            Task {
                await activate(model, rowIndex: rowIndex)
            }
        } label: {
            HStack(alignment: .center, spacing: 10) {
                Image(systemName: model.isFolder ? "folder.fill" : "doc.text")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(model.isFolder ? .blue : .secondary)
                    .frame(width: 22)

                VStack(alignment: .leading, spacing: 2) {
                    Text(model.name)
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(disabled ? .secondary : .primary)
                        .lineLimit(1)
                    if !model.subtitle.isEmpty {
                        Text(disabled ? "\(model.subtitle) (file disabled)" : model.subtitle)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                }

                Spacer(minLength: 0)

                if selectedURI == model.uri {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.tint)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 9)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(selectedURI == model.uri ? Color.accentColor.opacity(0.10) : Color.secondary.opacity(0.055))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(selectedURI == model.uri ? Color.accentColor.opacity(0.35) : Color.clear, lineWidth: 1)
            )
            .opacity(disabled ? 0.55 : 1)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityLabel(model.accessibilityLabel(disabled: disabled))
    }

    private func loadState() async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else {
            rows = []
            selection = SelectionState()
            currentURI = ""
            errorMessage = nil
            return
        }
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        selection = await runtime.dataSourceSelectionState(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        currentURI = await runtime.dataSourceInputState(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef).filter["uri"]?.stringLike ?? ""
        errorMessage = await runtime.dataSourceControl(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef).error
        if rows.isEmpty {
            for _ in 0..<5 {
                try? await Task.sleep(for: .milliseconds(200))
                let refreshedRows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
                if !refreshedRows.isEmpty {
                    rows = refreshedRows
                    break
                }
            }
        }
    }

    private func observeRows() async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else { return }
        let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        for await next in stream {
            await MainActor.run {
                rows = next
            }
        }
    }

    private func observeSelection() async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else { return }
        let stream = await runtime.dataSourceSelectionUpdates(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        for await next in stream {
            await MainActor.run {
                selection = next
            }
        }
    }

    private func observeInput() async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else { return }
        let stream = await runtime.dataSourceInputUpdates(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        for await next in stream {
            await MainActor.run {
                currentURI = next.filter["uri"]?.stringLike ?? ""
            }
        }
    }

    private func observeControl() async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else { return }
        let stream = await runtime.dataSourceControlUpdates(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        for await next in stream {
            await MainActor.run {
                errorMessage = next.error
            }
        }
    }

    private func activate(_ model: FileBrowserRowModel, rowIndex: Int) async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else { return }
        if model.isFolder {
            await runtime.toggleDataSourceSelection(
                windowID: window.windowID,
                dataSourceRef: resolvedDataSourceRef,
                row: model.row,
                rowIndex: rowIndex
            )
            await navigate(to: model.uri)
        } else {
            await runtime.toggleDataSourceSelection(
                windowID: window.windowID,
                dataSourceRef: resolvedDataSourceRef,
                row: model.row,
                rowIndex: rowIndex
            )
        }
        for execution in fileBrowser.on {
            _ = await runtime.execute(
                execution,
                context: ExecutionContext(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef),
                args: [
                    "row": .object(model.row),
                    "rowIndex": .number(Double(rowIndex)),
                    "uri": .string(model.uri)
                ]
            )
        }
    }

    private func navigate(to uri: String) async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else { return }
        await runtime.setDataSourceFilter(
            windowID: window.windowID,
            dataSourceRef: resolvedDataSourceRef,
            filter: ["uri": .string(uri)]
        )
        await MainActor.run {
            currentURI = uri
        }
    }
}

struct FileBrowserRowModel: Identifiable, Equatable {
    let id: String
    let row: [String: JSONValue]
    let uri: String
    let name: String
    let subtitle: String
    let isFolder: Bool

    init(row: [String: JSONValue], fallbackIndex: Int = 0) {
        self.row = row
        self.uri = fileBrowserRowLocation(row) ?? ""
        self.isFolder = row["isFolder"]?.boolValue
            ?? row["isDirectory"]?.boolValue
            ?? row["directory"]?.boolValue
            ?? row["folder"]?.boolValue
            ?? normalizedKindIsFolder(row["kind"]?.stringLike)
            ?? normalizedKindIsFolder(row["type"]?.stringLike)
            ?? normalizedKindIsFolder(row["fileType"]?.stringLike)
            ?? false
        self.name = fileBrowserRowName(row: row, uri: self.uri, fallbackIndex: fallbackIndex)
        self.subtitle = self.uri
        self.id = [self.uri.nilIfBlank ?? self.name, String(fallbackIndex)].joined(separator: "#")
    }

    func accessibilityLabel(disabled: Bool) -> String {
        let kind = isFolder ? "Folder" : "File"
        let status = disabled ? ", disabled" : ""
        if subtitle.isEmpty {
            return "\(kind) \(name)\(status)"
        }
        return "\(kind) \(name), \(subtitle)\(status)"
    }
}

func fileBrowserRowName(row: [String: JSONValue], uri: String, fallbackIndex: Int) -> String {
    for key in ["name", "label", "filename", "fileName"] {
        if let value = row[key]?.stringLike?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank {
            return value
        }
    }
    if let uriName = uri.split(separator: "/").last.map(String.init)?.nilIfBlank {
        return uriName
    }
    if uri == "/" {
        return "/"
    }
    return "Unnamed"
}

func fileBrowserRowLocation(_ row: [String: JSONValue]?) -> String? {
    guard let row else { return nil }
    for key in ["uri", "URI", "url", "path", "Path"] {
        if let value = row[key]?.stringLike?.trimmingCharacters(in: .whitespacesAndNewlines),
           !value.isEmpty {
            return value
        }
    }
    return nil
}

func parentURI(for uri: String) -> String {
    let trimmed = uri.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, trimmed != "/" else {
        return "/"
    }
    let withoutTrailingSlash = trimmed.count > 1 && trimmed.hasSuffix("/")
        ? String(trimmed.dropLast())
        : trimmed
    guard let slash = withoutTrailingSlash.lastIndex(of: "/") else {
        return "/"
    }
    if slash == withoutTrailingSlash.startIndex {
        return "/"
    }
    return String(withoutTrailingSlash[..<slash])
}

private func normalizedKindIsFolder(_ value: String?) -> Bool? {
    guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
          !value.isEmpty else {
        return nil
    }
    if ["true", "yes", "1", "folder", "directory", "dir"].contains(value) {
        return true
    }
    if ["false", "no", "0", "file", "document", "blob"].contains(value) {
        return false
    }
    return nil
}

private extension JSONValue {
    var stringLike: String? {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            if value.rounded(.towardZero) == value {
                return String(Int(value))
            }
            return String(value)
        case .bool(let value):
            return value ? "true" : "false"
        default:
            return nil
        }
    }

    var boolValue: Bool? {
        switch self {
        case .bool(let value):
            return value
        case .string(let value):
            let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if ["true", "yes", "1"].contains(normalized) {
                return true
            }
            if ["false", "no", "0"].contains(normalized) {
                return false
            }
            return nil
        case .number(let value):
            if value == 1 {
                return true
            }
            if value == 0 {
                return false
            }
            return nil
        default:
            return nil
        }
    }
}

private extension String {
    var nilIfBlank: String? {
        isEmpty ? nil : self
    }
}
