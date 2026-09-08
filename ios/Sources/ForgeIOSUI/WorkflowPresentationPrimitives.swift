import SwiftUI
import ForgeIOSRuntime

struct WorkflowPresentationPrimitives: View {
    let runtime: ForgeRuntime?
    let window: WindowContext?
    let container: ContainerDef
    let form: [String: JSONValue]
    let collection: [[String: JSONValue]]
    let metrics: [String: JSONValue]
    let windowForm: [String: JSONValue]
    let selection: SelectionState

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    private var record: [String: JSONValue] {
        WorkflowPrimitiveRuntime.presentationRecord(form: form, collection: collection, metrics: metrics)
    }

    private var detailRecord: [String: JSONValue] {
        switch container.detailView?.source?.lowercased() {
        case "selection": return selection.selected ?? selection.selection.last ?? [:]
        case "collection": return collection.first ?? [:]
        case "metrics": return metrics
        default: return form.isEmpty ? (collection.first ?? metrics) : form
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if container.derivedDataSource != nil, let runtime, let window {
                DerivedDataSourceRenderer(runtime: runtime, window: window, container: container)
            }
            resourceHeader
            queryToolbar
            notificationRules
            editableCollectionActions
            statusWorkflow
            draftForm
            metricSummary
            relationDrill
            detailView
            historyDiff
            mutationCommand
        }
    }

    @ViewBuilder
    private var queryToolbar: some View {
        if let spec = container.queryToolbar,
           let runtime,
           let window,
           !(spec.items ?? []).isEmpty {
            MenuListRenderer(runtime: runtime, window: window, container: container, items: spec.items ?? [])
                .padding(spec.density?.lowercased() == "compact" ? 4 : 8)
                .background(.secondary.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
                .accessibilityIdentifier("forge-query-toolbar")
        }
    }

    @ViewBuilder
    private var historyDiff: some View {
        if let spec = container.historyDiff {
            let entries = WorkflowPrimitiveRuntime.historyDiffEntries(
                before: resolved(spec.beforeField ?? "before"),
                after: resolved(spec.afterField ?? "after"),
                spec: spec
            )
            VStack(alignment: .leading, spacing: 8) {
                ForEach(entries) { entry in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(entry.label).font(.caption.weight(.semibold))
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(entry.before).foregroundStyle(.red)
                            Image(systemName: "arrow.right").foregroundStyle(.secondary)
                            Text(entry.after).foregroundStyle(.green)
                        }
                        .font(.callout.monospaced())
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(8)
                    .background(.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
                }
                if entries.isEmpty { Text("No changes").font(.caption).foregroundStyle(.secondary) }
            }
            .accessibilityIdentifier("forge-history-diff")
        }
    }

    @ViewBuilder
    private var draftForm: some View {
        if let spec = container.draftForm,
           let runtime,
           let window {
            DraftFormActions(
                runtime: runtime,
                window: window,
                dataSourceRef: spec.dataSourceRef ?? container.dataSourceRef ?? "",
                spec: spec,
                form: form,
                baseline: selection.selected ?? [:],
                valid: spec.validWhen == nil || conditionAllows(spec.validWhen),
                dirty: spec.dirtyWhen.map { conditionAllows($0) } ?? (form != (selection.selected ?? [:]))
            )
        }
    }

    private var selectedRows: [[String: JSONValue]] {
        if !selection.selection.isEmpty { return selection.selection }
        return selection.selected.map { [$0] } ?? []
    }

    @ViewBuilder
    private var resourceHeader: some View {
        if let spec = container.resourceHeader {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 3) {
                        if let titleField = spec.titleField {
                            Text(formatted(resolved(titleField), format: nil, empty: ""))
                                .font(.title2.weight(.semibold))
                        }
                        if let subtitleField = spec.subtitleField {
                            Text(formatted(resolved(subtitleField), format: nil, empty: ""))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer(minLength: 8)
                    ForEach((spec.actions ?? []).filter { conditionAllows($0.visibleWhen) }) { action in
                        if let mutation = action.mutation, let runtime, let window {
                            MutationCommandButton(
                                runtime: runtime,
                                window: window,
                                sourceDataSourceRef: spec.dataSourceRef ?? container.dataSourceRef ?? mutation.dataSourceRef,
                                command: mutation,
                                labelOverride: action.label,
                                extras: ["resource": .object(record)]
                            )
                        } else if let handler = action.handler, let runtime, let window {
                            Button(action.label ?? action.id) {
                                Task {
                                    _ = await runtime.execute(
                                        ExecutionDef(action: handler),
                                        context: ExecutionContext(windowID: window.windowID, dataSourceRef: spec.dataSourceRef ?? container.dataSourceRef ?? ""),
                                        args: ["resource": .object(record)]
                                    )
                                }
                            }
                            .disabled(action.disabledWhen != nil && conditionAllows(action.disabledWhen))
                        }
                    }
                }
                if !(spec.fields ?? []).isEmpty {
                    HStack(spacing: 16) {
                        ForEach(Array((spec.fields ?? []).enumerated()), id: \.offset) { _, field in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(field.label).font(.caption).foregroundStyle(.secondary)
                                Text(formatted(resolved(field.field), format: field.format, empty: "—"))
                            }
                        }
                    }
                }
            }
            .accessibilityIdentifier("forge-resource-header")
        }
    }

    @ViewBuilder
    private var editableCollectionActions: some View {
        if let spec = container.editableCollection, !(spec.operations ?? []).isEmpty {
            HStack(spacing: 8) {
                ForEach((spec.operations ?? []).filter { operationVisible($0) }) { operation in
                    let disabled = operationDisabled(operation)
                    if let mutation = operation.mutation ?? spec.mutation, let runtime, let window {
                        MutationCommandButton(
                            runtime: runtime,
                            window: window,
                            sourceDataSourceRef: spec.dataSourceRef ?? container.dataSourceRef ?? mutation.dataSourceRef,
                            command: mutation,
                            labelOverride: operation.label,
                            extras: [
                                "operationId": .string(operation.id),
                                "selectedRows": .array(selectedRows.map(JSONValue.object))
                            ],
                            externallyDisabled: disabled
                        )
                    } else {
                        Button(operation.label) { invokeEditableOperation(operation, spec: spec) }
                            .disabled(disabled)
                    }
                }
            }
            if spec.selectionStatus == true {
                Text(selectedRows.isEmpty ? (spec.selectionPrompt ?? "Select a row to enable row actions.") : "\(selectedRows.count) \(selectedRows.count == 1 ? "row" : "rows") selected")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("forge-editable-selection-status")
            }
        }
    }

    @ViewBuilder
    private var statusWorkflow: some View {
        if let workflow = container.statusWorkflow, let runtime, let window {
            let current = resolved(workflow.stateField)
            HStack(spacing: 8) {
                ForEach(workflow.transitions.filter { transition in
                    let from = transition.from ?? []
                    return (from.isEmpty || from.contains(current ?? .null)) && conditionAllows(transition.availableWhen)
                }) { transition in
                    MutationCommandButton(
                        runtime: runtime,
                        window: window,
                        sourceDataSourceRef: container.dataSourceRef ?? transition.command.dataSourceRef,
                        command: transition.command,
                        labelOverride: transition.label,
                        confirmationOverride: transition.confirm,
                        extras: ["transitionId": .string(transition.id), "from": current ?? .null, "to": transition.to]
                    )
                }
            }
            .accessibilityIdentifier("forge-status-workflow")
        }
    }

    @ViewBuilder
    private var mutationCommand: some View {
        if let command = container.mutationCommand,
           let runtime,
           let window {
            MutationCommandButton(
                runtime: runtime,
                window: window,
                sourceDataSourceRef: container.dataSourceRef ?? command.dataSourceRef,
                command: command
            )
        }
    }

    @ViewBuilder
    private var notificationRules: some View {
        if let spec = container.notificationRules {
            ForEach(spec.rules.filter { conditionAllows($0.visibleWhen) }) { rule in
                VStack(alignment: .leading, spacing: 8) {
                    Label(rule.message, systemImage: notificationSymbol(rule.icon ?? rule.intent))
                        .font(.subheadline)
                        .foregroundStyle(notificationColor(rule.intent))
                    if let action = rule.action,
                       action.visibleWhen == nil || conditionAllows(action.visibleWhen) {
                        if let mutation = action.mutation, let runtime, let window {
                            MutationCommandButton(
                                runtime: runtime, window: window,
                                sourceDataSourceRef: container.dataSourceRef ?? mutation.dataSourceRef,
                                command: mutation, labelOverride: action.label,
                                externallyDisabled: action.disabledWhen != nil && conditionAllows(action.disabledWhen)
                            )
                        } else if let handler = action.handler, let runtime, let window {
                            Button(action.label ?? action.id) {
                                Task { _ = await runtime.execute(ExecutionDef(action: handler), context: ExecutionContext(windowID: window.windowID, dataSourceRef: container.dataSourceRef ?? "")) }
                            }.disabled(action.disabledWhen != nil && conditionAllows(action.disabledWhen))
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(notificationColor(rule.intent).opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                .accessibilityIdentifier("forge-notification-\(rule.id)")
            }
        }
    }

    @ViewBuilder
    private var metricSummary: some View {
        if let spec = container.metricSummary, !spec.metrics.isEmpty {
            LazyVGrid(columns: metricColumns(spec), alignment: .leading, spacing: 10) {
                ForEach(spec.metrics) { item in
                    let value = resolved(item.field)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.label).font(.caption).foregroundStyle(.secondary)
                        Text(formatted(value, format: item.format, empty: item.emptyText))
                            .font(.title3.weight(.semibold))
                            .lineLimit(2)
                            .minimumScaleFactor(0.75)
                        if let comparisonField = item.comparisonField,
                           let comparison = numeric(resolved(comparisonField)) {
                            Label(
                                formatted(.number(comparison), format: item.comparisonFormat, empty: nil),
                                systemImage: comparison >= 0 ? "arrow.up.right" : "arrow.down.right"
                            )
                            .font(.caption)
                            .foregroundStyle(comparisonColor(comparison, betterWhen: item.betterWhen))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("forge-metric-\(item.id)")
                }
            }
        }
    }

    @ViewBuilder
    private var relationDrill: some View {
        if let spec = container.relationDrill {
            let count = Int(numeric(resolved(spec.countField ?? "count")) ?? 0)
            Button {
                open(spec.link, value: resolved(spec.countField ?? "count"))
            } label: {
                Label(WorkflowPrimitiveRuntime.relationLabel(count: count, spec: spec), systemImage: "chevron.right.circle")
            }
            .disabled(count == 0 || spec.link == nil)
            .accessibilityIdentifier("forge-relation-drill")
        }
    }

    @ViewBuilder
    private var detailView: some View {
        if let spec = container.detailView {
            let sections = spec.sections.isEmpty
                ? [DetailViewSectionSpec(id: "details", fields: spec.fields)]
                : spec.sections
            VStack(alignment: .leading, spacing: 16) {
                ForEach(sections.filter { conditionAllows($0.visibleWhen) }) { section in
                    VStack(alignment: .leading, spacing: 8) {
                        if let label = section.label, !label.isEmpty {
                            Text(label).font(.headline)
                        }
                        if let description = section.description, !description.isEmpty {
                            Text(description).font(.caption).foregroundStyle(.secondary)
                        }
                        LazyVGrid(columns: detailColumns(spec), alignment: .leading, spacing: 12) {
                            ForEach(section.fields.filter { conditionAllows($0.visibleWhen) }) { field in
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(field.label).font(.caption).foregroundStyle(.secondary)
                                    Text(formatted(resolved(field.field, from: detailRecord), format: field.format, empty: field.emptyText ?? spec.emptyText))
                                        .font(.body)
                                        .textSelection(.enabled)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .accessibilityElement(children: .combine)
                                .accessibilityIdentifier("forge-detail-\(field.id)")
                            }
                        }
                    }
                }
            }
        }
    }

    private func metricColumns(_ spec: MetricSummarySpec) -> [GridItem] {
        let authored = max(1, min(spec.columns ?? 4, 6))
        let count = horizontalSizeClass == .compact ? min(2, authored) : authored
        return Array(repeating: GridItem(.flexible(), spacing: 10, alignment: .topLeading), count: count)
    }

    private func detailColumns(_ spec: DetailViewSpec) -> [GridItem] {
        let target = horizontalSizeClass == .compact ? "phone" : "wide"
        let authored = spec.responsiveColumns[target] ?? spec.columns ?? 2
        let count = max(1, min(authored, horizontalSizeClass == .compact ? 2 : 4))
        return Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .topLeading), count: count)
    }

    private func resolved(_ selector: String) -> JSONValue? {
        resolved(selector, from: record)
    }

    private func resolved(_ selector: String, from holder: [String: JSONValue]) -> JSONValue? {
        jsonValue(SelectorUtil.resolve(holder.mapValues(primitiveAnyValue), selector: selector))
    }

    private func formatted(_ value: JSONValue?, format: String?, empty: String?) -> String {
        guard let value, value != .null else { return empty ?? "—" }
        return DashboardRuntime.formatDashboardValue(primitiveAnyValue(value), format: format)
    }

    private func numeric(_ value: JSONValue?) -> Double? {
        switch value {
        case .number(let value): return value
        case .string(let value): return Double(value)
        default: return nil
        }
    }

    private func conditionAllows(_ condition: DashboardConditionDef?, row: [String: JSONValue]? = nil) -> Bool {
        DashboardRuntime.evaluateDashboardCondition(
            condition,
            metrics: metrics.mapValues(primitiveAnyValue),
            form: (row ?? form).mapValues(primitiveAnyValue),
            windowForm: windowForm.mapValues(primitiveAnyValue),
            collection: collection.map { $0.mapValues(primitiveAnyValue) }
        )
    }

    private func operationVisible(_ operation: EditableCollectionOperationSpec) -> Bool {
        operation.visibleWhen == nil || conditionAllows(operation.visibleWhen)
    }

    private func operationDisabled(_ operation: EditableCollectionOperationSpec) -> Bool {
        let selectionSpec = operation.selection ?? container.editableCollection?.selection
        let minimum = selectionSpec?.min ?? (operation.requiresSelection == true ? 1 : 0)
        let maximum = selectionSpec?.max ?? 0
        if selectedRows.count < minimum || (maximum > 0 && selectedRows.count > maximum) { return true }
        if operation.disabledWhen != nil && conditionAllows(operation.disabledWhen) { return true }
        if selectionSpec?.disabledWhen != nil && conditionAllows(selectionSpec?.disabledWhen) { return true }
        if let predicate = selectionSpec?.every, (selectedRows.isEmpty || !selectedRows.allSatisfy({ conditionAllows(predicate, row: $0) })) { return true }
        if let predicate = selectionSpec?.any, (selectedRows.isEmpty || !selectedRows.contains(where: { conditionAllows(predicate, row: $0) })) { return true }
        if let predicate = selectionSpec?.none, selectedRows.contains(where: { conditionAllows(predicate, row: $0) }) { return true }
        return false
    }

    private func invokeEditableOperation(_ operation: EditableCollectionOperationSpec, spec: EditableCollectionSpec) {
        guard let runtime, let window else { return }
        let args: [String: JSONValue] = [
            "operationId": .string(operation.id),
            "selectedRows": .array(selectedRows.map(JSONValue.object))
        ]
        let dataSourceRef = spec.dataSourceRef ?? container.dataSourceRef ?? ""
        Task {
            if let handler = operation.handler {
                _ = await runtime.execute(ExecutionDef(action: handler), context: ExecutionContext(windowID: window.windowID, dataSourceRef: dataSourceRef), args: args)
            } else if let dialogId = operation.dialogId {
                _ = await runtime.execute(ExecutionDef(action: "window.openDialog", args: [dialogId]), context: ExecutionContext(windowID: window.windowID, dataSourceRef: dataSourceRef), args: args)
            }
        }
    }

    private func open(_ link: LinkDef?, value: JSONValue?) {
        guard let link, let runtime, let window else { return }
        let key = (link.windowKey ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty else { return }
        let context = LinkResolutionContext(row: record, value: value, form: form, metrics: metrics, windowForm: windowForm)
        let target = WindowLinkTarget(
            windowKey: key,
            title: resolveLinkWindowTitleFromContext(link: link, context: context, fallbackTitle: link.title ?? key),
            parameters: resolveLinkParametersFromContext(link: link, context: context),
            inTab: link.inTab != false,
            modal: link.modal == true,
            newInstance: link.newInstance == true
        )
        Task { _ = await openResolvedWindowLink(runtime: runtime, window: window, link: target) }
    }
}

private struct DraftFormActions: View {
    let runtime: ForgeRuntime
    let window: WindowContext
    let dataSourceRef: String
    let spec: DraftFormSpec
    let form: [String: JSONValue]
    let baseline: [String: JSONValue]
    let valid: Bool
    let dirty: Bool

    @State private var discardConfirmationVisible = false

    var body: some View {
        HStack(spacing: 8) {
            Button(spec.resetLabel ?? "Reset") {
                if spec.confirmDiscard?.isEmpty == false { discardConfirmationVisible = true }
                else { reset() }
            }
            .disabled(!dirty)
            if let submit = spec.submit {
                MutationCommandButton(
                    runtime: runtime,
                    window: window,
                    sourceDataSourceRef: dataSourceRef,
                    command: submit,
                    labelOverride: spec.saveLabel ?? submit.label,
                    extras: ["draft": .object(form)],
                    externallyDisabled: !valid || !dirty
                )
            }
            if dirty { Text("Unsaved changes").font(.caption).foregroundStyle(.secondary) }
        }
        .alert(spec.confirmDiscard ?? "Discard changes?", isPresented: $discardConfirmationVisible) {
            Button("Cancel", role: .cancel) {}
            Button("Discard", role: .destructive) { reset() }
        }
        .accessibilityIdentifier("forge-draft-form")
    }

    private func reset() {
        Task {
            await runtime.setDataSourceForm(windowID: window.windowID, dataSourceRef: dataSourceRef, values: baseline)
            if let handler = spec.onReset, !handler.isEmpty {
                _ = await runtime.execute(
                    ExecutionDef(action: handler),
                    context: ExecutionContext(windowID: window.windowID, dataSourceRef: dataSourceRef),
                    args: ["form": .object(baseline)]
                )
            }
        }
    }
}

struct MutationCommandButton: View {
    private static let acceptConfirmation: @Sendable (String) async -> Bool = { _ in true }
    let runtime: ForgeRuntime
    let window: WindowContext
    let sourceDataSourceRef: String
    let command: MutationCommandDef
    var labelOverride: String? = nil
    var confirmationOverride: String? = nil
    var extras: [String: JSONValue] = [:]
    var externallyDisabled: Bool = false
    var onSettled: ((MutationCommandResult) -> Void)? = nil

    @State private var state = MutationCommandState()
    @State private var confirmationVisible = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button {
                if effectiveConfirmation?.isEmpty == false {
                    confirmationVisible = true
                } else {
                    execute(confirmed: false)
                }
            } label: {
                if state.pending {
                    ProgressView().controlSize(.small)
                }
                if !command.hideLabel {
                    Text(labelOverride ?? command.label ?? "Save")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(state.guarded || externallyDisabled)
            .accessibilityIdentifier("forge-mutation-\(command.commandId ?? command.dataSourceRef)")
            .alert(effectiveConfirmation ?? "Confirm", isPresented: $confirmationVisible) {
                Button("Cancel", role: .cancel) {}
                Button(labelOverride ?? command.label ?? "Confirm") { execute(confirmed: true) }
            }
            if !state.message.isEmpty {
                Text(state.message)
                    .font(.caption)
                    .foregroundStyle(state.phase == .failed ? .red : .secondary)
            }
        }
        .task {
            state = await runtime.mutationCommandState(windowID: window.windowID, command: command)
        }
    }

    private var effectiveConfirmation: String? {
        confirmationOverride ?? resolveMutationConfirmation(command: command, extras: extras)
    }

    private func execute(confirmed: Bool) {
        Task {
            let confirmation: (@Sendable (String) async -> Bool)? = confirmed ? Self.acceptConfirmation : nil
            async let execution = runtime.executeMutationCommand(
                windowID: window.windowID,
                sourceDataSourceRef: sourceDataSourceRef,
                command: command,
                extras: extras,
                confirm: confirmation
            )
            await Task.yield()
            state = await runtime.mutationCommandState(windowID: window.windowID, command: command)
            let result = await execution
            state = await runtime.mutationCommandState(windowID: window.windowID, command: command)
            onSettled?(result)
        }
    }
}

private func primitiveAnyValue(_ value: JSONValue) -> Any {
    switch value {
    case .string(let value): return value
    case .number(let value): return value
    case .bool(let value): return value
    case .array(let value): return value.map(primitiveAnyValue)
    case .object(let value): return value.mapValues(primitiveAnyValue)
    case .null: return NSNull()
    }
}

private func jsonValue(_ value: Any?) -> JSONValue? {
    switch value {
    case let value as JSONValue: return value
    case let value as String: return .string(value)
    case let value as Bool: return .bool(value)
    case let value as Double: return .number(value)
    case let value as Int: return .number(Double(value))
    default: return nil
    }
}

private func notificationSymbol(_ intent: String?) -> String {
    switch intent?.lowercased() {
    case "danger", "error": return "xmark.octagon.fill"
    case "warning": return "exclamationmark.triangle.fill"
    case "success": return "checkmark.circle.fill"
    default: return "info.circle.fill"
    }
}

private func notificationColor(_ intent: String?) -> Color {
    switch intent?.lowercased() {
    case "danger", "error": return .red
    case "warning": return .orange
    case "success": return .green
    default: return .blue
    }
}

private func comparisonColor(_ value: Double, betterWhen: String?) -> Color {
    switch betterWhen?.lowercased() {
    case "lower": return value <= 0 ? .green : .red
    case "neutral": return .secondary
    default: return value >= 0 ? .green : .red
    }
}
