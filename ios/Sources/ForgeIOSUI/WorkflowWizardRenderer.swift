import SwiftUI
import ForgeIOSRuntime

struct WorkflowWizardRenderer: View {
    let runtime: ForgeRuntime?
    let window: WindowContext?
    let container: ContainerDef
    let form: [String: JSONValue]
    let collection: [[String: JSONValue]]
    let metrics: [String: JSONValue]
    let windowForm: [String: JSONValue]

    @State private var currentStepId = ""
    @AccessibilityFocusState private var stepFocused: Bool

    private var wizard: WizardSpec { container.wizard! }
    private var visibleSteps: [WizardStepSpec] {
        wizard.steps.filter { conditionAllows($0.visibleWhen) }
    }
    private var currentIndex: Int {
        let index = visibleSteps.firstIndex { $0.id == currentStepId } ?? 0
        return min(max(index, 0), max(visibleSteps.count - 1, 0))
    }
    private var currentStep: WizardStepSpec? { visibleSteps.indices.contains(currentIndex) ? visibleSteps[currentIndex] : nil }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(visibleSteps.enumerated()), id: \.element.id) { index, step in
                        Text(step.label)
                            .font(.subheadline.weight(index == currentIndex ? .semibold : .regular))
                            .foregroundStyle(index == currentIndex ? .primary : .secondary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(index == currentIndex ? Color.accentColor.opacity(0.12) : Color.clear, in: Capsule())
                    }
                }
            }
            Group {
                if let step = currentStep,
                   let childId = step.containerId,
                   let child = container.containers.first(where: { $0.id == childId }) {
                    ContainerRenderer(
                        runtime: runtime,
                        window: window,
                        container: child,
                        inheritedDataSourceRef: container.dataSourceRef
                    )
                } else {
                    ContentUnavailableView("No active step", systemImage: "list.number")
                }
            }
            .accessibilityFocused($stepFocused)
            .accessibilityLabel(currentStep.map { "Step \(currentIndex + 1): \($0.label)" } ?? "No active step")

            HStack {
                Button("Back") { select(index: currentIndex - 1) }
                    .disabled(currentIndex <= 0)
                Spacer()
                if currentIndex < visibleSteps.count - 1 {
                    Button("Next") { select(index: currentIndex + 1) }
                        .buttonStyle(.borderedProminent)
                        .disabled(currentStep.map { !conditionAllows($0.validWhen) } ?? true)
                } else if let submit = wizard.submit,
                          let runtime,
                          let window {
                    MutationCommandButton(
                        runtime: runtime,
                        window: window,
                        sourceDataSourceRef: container.dataSourceRef ?? submit.dataSourceRef,
                        command: submit,
                        labelOverride: submit.label ?? "Submit"
                    )
                }
            }
        }
        .task(id: window?.windowID) {
            let persisted = wizard.stateKey.flatMap { windowForm[$0]?.stringValue }
            currentStepId = visibleSteps.contains { $0.id == persisted } ? (persisted ?? "") : (visibleSteps.first?.id ?? "")
        }
        .onChange(of: visibleSteps.map(\.id)) { _, ids in
            if !ids.contains(currentStepId) { select(index: 0) }
        }
        .accessibilityIdentifier("forge-wizard")
    }

    private func select(index: Int) {
        guard visibleSteps.indices.contains(index) else { return }
        currentStepId = visibleSteps[index].id
        stepFocused = true
        guard let key = wizard.stateKey, let runtime, let window else { return }
        Task { await runtime.setWindowFormValue(windowID: window.windowID, values: [key: .string(currentStepId)], bumpPrefillRevision: false) }
    }

    private func conditionAllows(_ condition: DashboardConditionDef?) -> Bool {
        DashboardRuntime.evaluateDashboardCondition(
            condition,
            metrics: metrics.mapValues(wizardAnyValue),
            form: form.mapValues(wizardAnyValue),
            windowForm: windowForm.mapValues(wizardAnyValue),
            collection: collection.map { $0.mapValues(wizardAnyValue) }
        )
    }
}

private func wizardAnyValue(_ value: JSONValue) -> Any {
    switch value {
    case .string(let value): return value
    case .number(let value): return value
    case .bool(let value): return value
    case .array(let values): return values.map(wizardAnyValue)
    case .object(let values): return values.mapValues(wizardAnyValue)
    case .null: return NSNull()
    }
}
