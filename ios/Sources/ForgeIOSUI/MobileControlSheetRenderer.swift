import SwiftUI
import ForgeIOSRuntime

struct MobileControlSheetRenderer: View {
    let runtime: ForgeRuntime?
    let window: WindowContext?
    let container: ContainerDef

    @State private var presented = false
    @State private var windowFormValues: [String: JSONValue] = [:]

    var body: some View {
        Button {
            presented = true
        } label: {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(container.title?.nilIfBlank ?? "View options")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(summary.isEmpty ? "Choose view options" : summary)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                Image(systemName: "slider.horizontal.3")
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.secondary.opacity(0.22)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open view options")
        .sheet(isPresented: $presented) {
            NavigationStack {
                ScrollView {
                    MenuListRenderer(runtime: runtime, window: window, container: container, items: container.items)
                        .padding(18)
                }
                .navigationTitle(container.title?.nilIfBlank ?? "View options")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { presented = false }
                    }
                }
            }
            .presentationDetents([.medium])
        }
        .task(id: window?.windowID ?? "") {
            guard let runtime, let window else {
                windowFormValues = [:]
                return
            }
            windowFormValues = await runtime.windowFormJSONValue(windowID: window.windowID)
            let updates = await runtime.windowFormUpdates(windowID: window.windowID)
            for await next in updates {
                windowFormValues = next
            }
        }
    }

    private var summary: String {
        container.items.compactMap { item in
            let key = item.dataField?.nilIfBlank
                ?? item.bindingPath?.nilIfBlank
                ?? item.field?.nilIfBlank
                ?? item.id?.nilIfBlank
            guard let key, let selected = windowFormValues[key]?.stringValue?.nilIfBlank else { return nil }
            return item.options.first(where: { $0.value == selected })?.label?.nilIfBlank ?? selected
        }.joined(separator: " · ")
    }
}

private extension String {
    var nilIfBlank: String? {
        let normalized = trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : normalized
    }
}
