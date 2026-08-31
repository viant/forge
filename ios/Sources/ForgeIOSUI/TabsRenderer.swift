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
            if container.containers.count > 3 {
                CompactSectionNavigator(
                    entries: container.containers.enumerated().map { index, child in
                        (id: child.id ?? "tab-\(index)", title: child.title ?? child.id ?? "Tab")
                    },
                    selectedID: selectedContainer?.id ?? "tab-\(clampedSelectedIndex)",
                    onSelect: { selectedID in
                        container.containers.enumerated().first(where: { ($0.element.id ?? "tab-\($0.offset)") == selectedID })
                            .map { selectTab(at: $0.offset) }
                    }
                )
            } else if usesMenuStyle {
                Menu {
                    ForEach(Array(container.containers.enumerated()), id: \.element.id) { index, child in
                        Button(child.title ?? child.id ?? "Tab") { selectTab(at: index) }
                    }
                } label: {
                    Label(selectedContainer?.title ?? selectedContainer?.id ?? "Tab", systemImage: "chevron.down")
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                        .background(Color.forgeSystemBackground, in: RoundedRectangle(cornerRadius: 12))
                }
            } else {
                SectionTabRail(
                    items: container.containers.enumerated().map { index, child in
                        SectionTabItem(id: child.id ?? "tab-\(index)", label: child.title ?? child.id ?? "Tab")
                    },
                    selectedID: selectedContainer?.id ?? "tab-\(clampedSelectedIndex)",
                    onSelect: { selectedID in
                        container.containers.enumerated().first(where: { ($0.element.id ?? "tab-\($0.offset)") == selectedID })
                            .map { selectTab(at: $0.offset) }
                    }
                )
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

    private func selectTab(at index: Int) {
        guard container.containers.indices.contains(index) else { return }
        selectedIndex = index
        guard let runtime, let window else { return }
        let child = container.containers[index]
        Task {
            await runtime.emitInteraction(
                kind: "feed.tab_changed",
                windowID: window.windowID,
                dataSourceRef: container.dataSourceRef,
                detail: [
                    "containerId": .string(container.id ?? ""),
                    "tabId": .string(child.id ?? "tab-\(index)"),
                    "tabTitle": .string(child.title ?? child.id ?? "Tab \(index + 1)"),
                    "tabIndex": .number(Double(index))
                ]
            )
        }
    }
}
