import SwiftUI
import ForgeIOSRuntime

func toolbarOptionMatches(_ lhs: JSONValue?, _ rhs: JSONValue?) -> Bool {
    guard let lhs, let rhs else { return false }
    if lhs == rhs { return true }
    switch (lhs, rhs) {
    case (.string(let text), .number(let number)), (.number(let number), .string(let text)):
        return Double(text) == number
    default: return false
    }
}

struct TableWindowFormSelector: View {
    let item: ToolbarItemDef
    let runtime: ForgeRuntime?
    let window: WindowContext?
    let dataSourceRef: String
    var externallyDisabled: Bool = false
    @State private var values: [String: JSONValue] = [:]

    private var field: String { item.field ?? item.dataField ?? item.id ?? "" }
    private var selected: JSONValue? { values[field] ?? item.value }
    private var caption: String {
        let option = item.options.first { toolbarOptionMatches($0.objectValue?["value"], selected) }
        return option?.objectValue?["label"]?.stringValue ?? NativeWidgetContract.text(selected)
    }

    var body: some View {
        Menu {
            ForEach(Array(item.options.enumerated()), id: \.offset) { _, option in
                if let object = option.objectValue, let value = object["value"] {
                    Button {
                        Task { await select(value) }
                    } label: {
                        if toolbarOptionMatches(value, selected) {
                            Label(object["label"]?.stringValue ?? NativeWidgetContract.text(value), systemImage: "checkmark")
                        } else {
                            Text(object["label"]?.stringValue ?? NativeWidgetContract.text(value))
                        }
                    }
                }
            }
        } label: {
            Label("\(item.label ?? "Choose"): \(caption)", systemImage: "chevron.down")
                .font(.subheadline)
                .frame(minHeight: 44)
        }
        .disabled(externallyDisabled || item.disabled == true || item.enabled == false || field.isEmpty || runtime == nil)
        .accessibilityLabel(item.ariaLabel ?? item.label ?? "Choose")
        .accessibilityValue(caption)
        .task(id: window?.windowID ?? "") {
            guard let runtime, let window else { return }
            values = await runtime.windowFormJSONValue(windowID: window.windowID)
            if values[field] == nil, let value = item.value, !field.isEmpty { await select(value) }
            let updates = await runtime.windowFormUpdates(windowID: window.windowID)
            for await next in updates {
                guard !Task.isCancelled else { return }
                values = next
            }
        }
    }

    private func select(_ value: JSONValue) async {
        guard let runtime, let window, !field.isEmpty, !externallyDisabled else { return }
        await runtime.setWindowFormValue(windowID: window.windowID, values: [field: value])
        values[field] = value
        if !dataSourceRef.isEmpty {
            await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef)
        }
    }
}
