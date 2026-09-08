import SwiftUI
import ForgeIOSRuntime

struct ScheduleEditorRenderer: View {
    let runtime: ForgeRuntime
    let window: WindowContext
    let container: ContainerDef

    @State private var rows: [[String: JSONValue]] = []
    @State private var dirty = false

    private var spec: ScheduleEditorSpec { container.scheduleEditor! }
    private var dataSourceRef: String { spec.dataSourceRef ?? container.dataSourceRef ?? "" }
    private var validation: ScheduleValidationResult { WorkflowPrimitiveRuntime.validateSchedule(rows: rows, spec: spec) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(rows.indices, id: \.self) { index in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Schedule \(index + 1)").font(.headline)
                        Spacer()
                        if spec.allowRemove != false {
                            Button(role: .destructive) { rows.remove(at: index); dirty = true } label: { Image(systemName: "trash") }
                                .accessibilityLabel("Remove schedule \(index + 1)")
                        }
                    }
                    DatePicker("Start", selection: dateBinding(index: index, field: spec.startField ?? "start"), displayedComponents: [.date, .hourAndMinute])
                    DatePicker("End", selection: dateBinding(index: index, field: spec.endField ?? "end"), displayedComponents: [.date, .hourAndMinute])
                    if let zoneField = spec.timeZoneField {
                        TextField("Time zone", text: stringBinding(index: index, field: zoneField, fallback: TimeZone.current.identifier))
                            .textFieldStyle(.roundedBorder)
                    }
                    ForEach(validation.errors.filter { $0.index == index }, id: \.code) { error in
                        Text(scheduleErrorMessage(error.code)).font(.caption).foregroundStyle(.red)
                    }
                }
                .padding(10)
                .background(.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
                .environment(\.timeZone, rowTimeZone(index: index))
            }
            HStack(spacing: 8) {
                if spec.allowAdd != false {
                    Button("Add schedule", systemImage: "plus") { addRow() }
                }
                if let command = spec.mutation {
                    MutationCommandButton(
                        runtime: runtime,
                        window: window,
                        sourceDataSourceRef: dataSourceRef,
                        command: command,
                        labelOverride: command.label ?? "Save schedule",
                        extras: ["rows": .array(rows.map(JSONValue.object))],
                        externallyDisabled: !validation.valid || !dirty
                    )
                }
            }
        }
        .task(id: "\(window.windowID)#\(dataSourceRef)") { await observeRows() }
        .accessibilityIdentifier("forge-schedule-editor")
    }

    @MainActor
    private func observeRows() async {
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef)
        if rows.isEmpty { await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef) }
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef)
        let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: dataSourceRef)
        for await next in stream where !dirty { rows = next }
    }

    private func addRow() {
        let now = Date()
        let formatter = ISO8601DateFormatter()
        var row: [String: JSONValue] = [
            spec.startField ?? "start": .string(formatter.string(from: now)),
            spec.endField ?? "end": .string(formatter.string(from: now.addingTimeInterval(3_600)))
        ]
        if let zone = spec.timeZoneField { row[zone] = .string(TimeZone.current.identifier) }
        rows.append(row)
        dirty = true
    }

    private func dateBinding(index: Int, field: String) -> Binding<Date> {
        Binding(
            get: {
                guard rows.indices.contains(index), case .string(let value)? = rows[index][field] else { return Date() }
                return ISO8601DateFormatter().date(from: value) ?? Date()
            },
            set: { value in
                guard rows.indices.contains(index) else { return }
                rows[index][field] = .string(ISO8601DateFormatter().string(from: value))
                dirty = true
            }
        )
    }

    private func stringBinding(index: Int, field: String, fallback: String) -> Binding<String> {
        Binding(
            get: { rows.indices.contains(index) ? (rows[index][field]?.stringValue ?? fallback) : fallback },
            set: { value in guard rows.indices.contains(index) else { return }; rows[index][field] = .string(value); dirty = true }
        )
    }

    private func rowTimeZone(index: Int) -> TimeZone {
        guard let field = spec.timeZoneField,
              rows.indices.contains(index),
              let identifier = rows[index][field]?.stringValue,
              let zone = TimeZone(identifier: identifier) else { return .current }
        return zone
    }
}

private func scheduleErrorMessage(_ code: String) -> String {
    switch code {
    case "invalid_date": return "Enter a valid start and end time."
    case "invalid_range": return "End time must be after start time."
    case "min_duration": return "The schedule is shorter than the minimum duration."
    case "overlap": return "This schedule overlaps another entry."
    case "timezone": return "Resolve the time-zone or daylight-saving-time value."
    default: return "The schedule is invalid."
    }
}
