import SwiftUI
import ForgeIOSRuntime

public struct TabsRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    @State private var selectedIndex = 0

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef) {
        self.runtime = runtime
        self.window = window
        self.container = container
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = container.title, !title.isEmpty {
                Text(title)
                    .font(.headline)
            }
            if usesMenuStyle {
                Menu {
                    ForEach(Array(container.containers.enumerated()), id: \.element.id) { index, child in
                        Button(child.title ?? child.id ?? "Tab") {
                            selectedIndex = index
                        }
                    }
                } label: {
                    HStack(spacing: 8) {
                        Text(selectedContainer?.title ?? selectedContainer?.id ?? "Tab")
                            .font(.subheadline.weight(.semibold))
                        Image(systemName: "chevron.down")
                            .font(.caption.weight(.semibold))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(Color(.systemBackground))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(Color.black.opacity(0.06), lineWidth: 1)
                    )
                }
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(Array(container.containers.enumerated()), id: \.element.id) { index, child in
                            let isSelected = index == clampedSelectedIndex
                            Button {
                                selectedIndex = index
                            } label: {
                                HStack(spacing: 8) {
                                    Text(child.title ?? child.id ?? "Tab")
                                        .font(.subheadline.weight(isSelected ? .semibold : .medium))
                                    if isSelected {
                                        Image(systemName: "chevron.right")
                                            .font(.caption2.weight(.bold))
                                    }
                                }
                                .foregroundStyle(isSelected ? Color.accentColor : Color.primary.opacity(0.78))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 10)
                                .background(
                                    Capsule()
                                        .fill(isSelected ? Color.accentColor.opacity(0.14) : Color(.systemBackground))
                                )
                                .overlay(
                                    Capsule()
                                        .stroke(isSelected ? Color.accentColor.opacity(0.18) : Color.black.opacity(0.06), lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            if let child = selectedContainer {
                ContainerRenderer(
                    runtime: runtime,
                    window: window,
                    container: child,
                    suppressTitle: true
                )
            }
        }
        .onAppear {
            selectedIndex = resolveInitialTabIndex()
        }
    }

    private var clampedSelectedIndex: Int {
        guard !container.containers.isEmpty else {
            return 0
        }
        return min(max(selectedIndex, 0), container.containers.count - 1)
    }

    private var selectedContainer: ContainerDef? {
        guard container.containers.indices.contains(clampedSelectedIndex) else {
            return nil
        }
        return container.containers[clampedSelectedIndex]
    }

    private var usesMenuStyle: Bool {
        let style = container.tabs?.style?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        return style == "menu" || style == "dropdown" || style == "picker"
    }

    private func resolveInitialTabIndex() -> Int {
        let requestedId = (container.tabs?.selectedTabId?.isEmpty == false ? container.tabs?.selectedTabId : container.tabs?.defaultSelectedTabId)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let requestedId, !requestedId.isEmpty else {
            return 0
        }
        return container.containers.firstIndex(where: { $0.id == requestedId }) ?? 0
    }
}
