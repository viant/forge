import SwiftUI
import ForgeIOSRuntime

struct AssignmentPickerRenderer: View {
    let runtime: ForgeRuntime
    let window: WindowContext
    let container: ContainerDef

    @State private var available: [[String: JSONValue]] = []
    @State private var assigned: [[String: JSONValue]] = []
    @State private var availableSelection: Set<String> = []
    @State private var assignedSelection: Set<String> = []

    private var spec: AssignmentPickerSpec { container.assignmentPicker! }
    private var identityFields: [String] { spec.identityFields?.isEmpty == false ? spec.identityFields! : ["id"] }
    private var assignedIDs: Set<String> { Set(assigned.compactMap(identity)) }
    private var assignable: [[String: JSONValue]] { available.filter { row in identity(row).map { !assignedIDs.contains($0) } ?? false } }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                pickerColumn(title: "Available", rows: assignable, selection: $availableSelection)
                pickerColumn(title: "Assigned", rows: assigned, selection: $assignedSelection)
            }
            HStack(spacing: 8) {
                if let command = spec.assign {
                    MutationCommandButton(
                        runtime: runtime,
                        window: window,
                        sourceDataSourceRef: spec.availableDataSourceRef,
                        command: command,
                        labelOverride: command.label ?? "Assign",
                        extras: ["selectedRows": .array(selectedRows(assignable, ids: availableSelection).map(JSONValue.object))],
                        externallyDisabled: availableSelection.isEmpty
                    )
                }
                if let command = spec.unassign {
                    MutationCommandButton(
                        runtime: runtime,
                        window: window,
                        sourceDataSourceRef: spec.assignedDataSourceRef,
                        command: command,
                        labelOverride: command.label ?? "Unassign",
                        extras: ["selectedRows": .array(selectedRows(assigned, ids: assignedSelection).map(JSONValue.object))],
                        externallyDisabled: assignedSelection.isEmpty
                    )
                }
            }
        }
        .task(id: "\(window.windowID)#\(spec.availableDataSourceRef)#\(spec.assignedDataSourceRef)") {
            await observeCollections()
        }
        .onChange(of: assignable.compactMap(identity)) { _, ids in availableSelection.formIntersection(Set(ids)) }
        .onChange(of: assigned.compactMap(identity)) { _, ids in assignedSelection.formIntersection(Set(ids)) }
        .accessibilityIdentifier("forge-assignment-picker")
    }

    private func pickerColumn(title: String, rows: [[String: JSONValue]], selection: Binding<Set<String>>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.headline)
            if rows.isEmpty {
                Text("None").font(.caption).foregroundStyle(.secondary)
            } else {
                ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                    let rowID = identity(row) ?? "invalid-\(index)"
                    Button {
                        if spec.allowMultiple == false {
                            selection.wrappedValue = selection.wrappedValue.contains(rowID) ? [] : [rowID]
                        } else if selection.wrappedValue.contains(rowID) {
                            selection.wrappedValue.remove(rowID)
                        } else {
                            selection.wrappedValue.insert(rowID)
                        }
                    } label: {
                        HStack {
                            Image(systemName: selection.wrappedValue.contains(rowID) ? "checkmark.square.fill" : "square")
                            Text(label(row))
                            Spacer(minLength: 0)
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(identity(row) == nil)
                    .accessibilityValue(selection.wrappedValue.contains(rowID) ? "Selected" : "Not selected")
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .padding(10)
        .background(.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
    }

    @MainActor
    private func observeCollections() async {
        available = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: spec.availableDataSourceRef)
        assigned = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: spec.assignedDataSourceRef)
        if available.isEmpty { await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: spec.availableDataSourceRef) }
        if assigned.isEmpty { await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: spec.assignedDataSourceRef) }
        available = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: spec.availableDataSourceRef)
        assigned = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: spec.assignedDataSourceRef)
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: spec.availableDataSourceRef)
                for await rows in stream { await MainActor.run { available = rows } }
            }
            group.addTask {
                let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: spec.assignedDataSourceRef)
                for await rows in stream { await MainActor.run { assigned = rows } }
            }
        }
    }

    private func identity(_ row: [String: JSONValue]) -> String? {
        let values = identityFields.compactMap { field -> String? in
            guard let value = row[field] else { return nil }
            switch value {
            case .string(let value): return value.isEmpty ? nil : value
            case .number(let value): return value.rounded() == value ? String(Int(value)) : String(value)
            default: return nil
            }
        }
        return values.count == identityFields.count ? values.joined(separator: "\u{001f}") : nil
    }

    private func label(_ row: [String: JSONValue]) -> String {
        let field = spec.labelField ?? "label"
        return assignmentJSONValue(SelectorUtil.resolve(row.mapValues(assignmentAnyValue), selector: field))?.stringValue
            ?? identity(row)
            ?? "Item"
    }

    private func selectedRows(_ rows: [[String: JSONValue]], ids: Set<String>) -> [[String: JSONValue]] {
        rows.filter { identity($0).map(ids.contains) == true }
    }
}

private func assignmentAnyValue(_ value: JSONValue) -> Any {
    switch value {
    case .string(let value): return value
    case .number(let value): return value
    case .bool(let value): return value
    case .array(let values): return values.map(assignmentAnyValue)
    case .object(let values): return values.mapValues(assignmentAnyValue)
    case .null: return NSNull()
    }
}

private func assignmentJSONValue(_ value: Any?) -> JSONValue? {
    switch value {
    case let value as String: return .string(value)
    case let value as Double: return .number(value)
    case let value as Int: return .number(Double(value))
    case let value as Bool: return .bool(value)
    default: return nil
    }
}
